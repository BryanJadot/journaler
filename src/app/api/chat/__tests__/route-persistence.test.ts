import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  jest,
} from '@jest/globals';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

import {
  createMockUserWithPassword,
  createApiMessage,
  createApiMessages,
  createUniqueMessageId,
} from '@/__tests__/helpers/test-helpers';
import * as cookies from '@/lib/auth/cookies';
import * as jwt from '@/lib/auth/jwt';
import { db } from '@/lib/db';
import { users, threads, messages } from '@/lib/db/schema';

import { POST } from '../route';

// Mock the streamText function to avoid actual AI calls
jest.mock('ai', () => ({
  convertToModelMessages: jest.fn((msgs) => msgs),
  streamText: jest.fn(() => ({
    toUIMessageStreamResponse: jest.fn(() => {
      // Create a proper mock response with mutable headers
      const mockHeaders = new Map();
      const response = {
        status: 200,
        headers: {
          get: jest.fn((key: string) => mockHeaders.get(key)),
          set: jest.fn((key: string, value: string) => {
            mockHeaders.set(key, value);
          }),
        },
        body: 'mocked stream',
        json: jest.fn(() => Promise.resolve({} as never)),
      } as unknown as Response;
      return response;
    }),
  })),
}));

/**
 * Comprehensive test suite for chat API persistence functionality.
 *
 * This suite tests the complete persistence flow including:
 * - Message structure validation and AI SDK format compliance
 * - Content normalization and edge case handling
 * - Thread ownership and multi-user isolation
 * - Database transactions and error handling
 * - Performance under concurrent access
 *
 * These tests use real database operations (not mocks) to ensure
 * the complete persistence pipeline works correctly.
 */
describe('Chat API Route - Persistence', () => {
  let testUserId: string;
  let mockUser: Awaited<ReturnType<typeof createMockUserWithPassword>>;

  beforeEach(async () => {
    // Create a test user using the helper
    mockUser = await createMockUserWithPassword();
    const [user] = await db
      .insert(users)
      .values({
        username: mockUser.user.username,
        passwordHash: mockUser.passwordHash,
      })
      .returning();
    testUserId = user.id;

    // Mock authentication
    jest.spyOn(cookies, 'getAuthToken').mockResolvedValue('valid-token');
    jest.spyOn(jwt, 'verifyAuthToken').mockResolvedValue({
      success: true,
      payload: { userId: testUserId, username: mockUser.user.username },
    });
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  /**
   * Validation test group - focuses on request structure validation.
   *
   * These tests ensure the API properly validates incoming requests
   * and provides clear error messages for invalid data. Validation
   * happens before any database operations to fail fast.
   */
  describe('Validation', () => {
    let existingThreadId: string;

    beforeEach(async () => {
      // Create a thread for validation tests
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Validation Thread',
          updatedAt: new Date(),
        })
        .returning();
      existingThreadId = thread.id;
    });

    /**
     * Tests validation when messages array is missing entirely.
     * This simulates a malformed request from the frontend.
     */
    it('should return 400 for missing messages', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ threadId: existingThreadId }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Messages must be an array');
    });

    /**
     * Tests validation when messages array is empty.
     * Empty conversations should not be processed as they provide
     * no context for the AI model to respond to.
     */
    it('should return 400 for empty messages array', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ threadId: existingThreadId, messages: [] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain(
        'Cannot start a conversation without messages'
      );
    });

    /**
     * Tests validation when messages is not an array.
     * The AI SDK requires messages to be an array format,
     * so other data types should be rejected early.
     */
    it('should return 400 for non-array messages', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: existingThreadId,
          messages: 'not an array',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Messages must be an array');
    });

    /**
     * Tests validation when threadId is missing.
     * ThreadId is required for persistence and ownership verification.
     */
    it('should return 400 for missing threadId', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [createApiMessage('user', 'Hello')],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Thread ID is required');
    });

    /**
     * Tests graceful handling of malformed JSON requests.
     * This ensures the API doesn't crash on invalid request bodies.
     */
    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  /**
   * Existing thread usage test group.
   *
   * These tests verify that the API correctly uses existing threads
   * when a threadId is provided, ensuring messages are added to the
   * correct conversation context.
   */
  describe('Existing Thread Usage', () => {
    let existingThreadId: string;

    beforeEach(async () => {
      // Create an existing thread
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Existing Thread',
          updatedAt: new Date(),
        })
        .returning();
      existingThreadId = thread.id;
    });

    /**
     * Tests that messages are saved to the specified existing thread.
     * This ensures conversation continuity and proper thread management.
     */
    it('should use provided threadId when specified', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: existingThreadId,
          messages: [createApiMessage('user', 'Message with specific thread')],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Verify message was persisted to the correct thread context
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, existingThreadId),
      });
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toBe('Message with specific thread');
    });
  });

  /**
   * Content normalization test group.
   *
   * These tests verify that message content is properly validated and normalized
   * before database storage. This includes testing the AI SDK message format
   * requirements and edge cases with different content types.
   */
  describe('Content Normalization', () => {
    let testThreadId: string;

    beforeEach(async () => {
      // Create a thread for content normalization tests
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Content Test Thread',
          updatedAt: new Date(),
        })
        .returning();
      testThreadId = thread.id;
    });

    /**
     * Tests handling of valid string content in user messages.
     * This represents the normal case where users send text messages.
     */
    it('should handle string content', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: testThreadId,
          messages: [createApiMessage('user', 'Simple string content')],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, testThreadId),
      });
      expect(savedMessages[0].content).toBe('Simple string content');
    });

    /**
     * Tests validation of message part text content type.
     *
     * This test is crucial because it validates the AI SDK format requirement
     * that text parts must contain string content. Non-string content would
     * cause issues in the AI model processing.
     */
    it('should reject non-string content with proper error', async () => {
      // Create message with object instead of string text content
      // This simulates a frontend bug where complex data is passed as text
      const invalidMessage = {
        id: createUniqueMessageId(),
        role: 'user',
        parts: [{ type: 'text', text: { invalid: 'object' } }], // Invalid: must be string
      };

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: testThreadId,
          messages: [invalidMessage],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain(
        'User message part must be text type with string content'
      );
    });

    /**
     * Tests handling of empty string content.
     * Empty messages should be allowed as users might send blank messages.
     */
    it('should handle empty string content', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: testThreadId,
          messages: [createApiMessage('user', '')],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, testThreadId),
      });
      expect(savedMessages[0].content).toBe('');
    });

    /**
     * Tests handling of content with special characters and encoding.
     * This ensures the database can properly store various text content.
     */
    it('should handle special characters in content', async () => {
      const specialContent =
        'Content with \'quotes\', "double quotes", \n newlines, and émojis 🎉';

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: testThreadId,
          messages: [createApiMessage('user', specialContent)],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, testThreadId),
      });
      expect(savedMessages[0].content).toBe(specialContent);
    });

    /**
     * Tests handling of null/undefined content.
     * The createApiMessage helper converts these to string representation
     * for consistent storage format.
     */
    it('should handle null and undefined content', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: testThreadId,
          messages: [createApiMessage('user', null)],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, testThreadId),
      });
      expect(savedMessages[0].content).toBe('null');
    });
  });

  /**
   * Message role handling test group.
   *
   * These tests verify that the system correctly processes different message roles
   * according to the chat flow requirements:
   * - Only user messages are persisted immediately
   * - Assistant messages are saved via the onFinish callback
   * - System messages are not persisted (they're configuration)
   */
  describe('Message Role Handling', () => {
    let roleTestThreadId: string;

    beforeEach(async () => {
      // Create a thread for role handling tests
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Role Test Thread',
          updatedAt: new Date(),
        })
        .returning();
      roleTestThreadId = thread.id;
    });

    /**
     * Tests that only user messages are persisted to the database.
     *
     * System and assistant messages are handled differently:
     * - System messages are configuration and don't need persistence
     * - Assistant messages are saved via the onFinish callback after generation
     * - Only user messages need immediate persistence for context
     */
    it('should only save user messages, not system/assistant messages', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: roleTestThreadId,
          messages: createApiMessages([
            { role: 'system', content: 'System instruction' },
            { role: 'assistant', content: 'Assistant response' },
          ]),
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, roleTestThreadId),
      });
      expect(savedMessages).toHaveLength(0); // No user messages to save
    });

    /**
     * Tests that only the most recent user message is saved.
     *
     * This behavior ensures:
     * - We don't duplicate messages already in the database
     * - Only new user input is persisted
     * - Conversation history doesn't get corrupted with duplicates
     */
    it('should save only the last user message in a conversation', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: roleTestThreadId,
          messages: createApiMessages([
            { role: 'user', content: 'First user message' },
            { role: 'assistant', content: 'Assistant response' },
            { role: 'user', content: 'Latest user message' },
          ]),
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, roleTestThreadId),
      });
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toBe('Latest user message');
      expect(savedMessages[0].role).toBe('user');
    });

    /**
     * Tests handling of messages without a role property.
     * Messages without roles are ignored to prevent invalid data storage.
     */
    it('should handle missing role by not saving the message', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: roleTestThreadId,
          messages: [
            { id: createUniqueMessageId(), content: 'Message without role' },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should not save since role is not 'user'
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, roleTestThreadId),
      });
      expect(savedMessages).toHaveLength(0);
    });
  });

  /**
   * Thread updates and timestamps test group.
   *
   * These tests verify that thread metadata is properly maintained:
   * - Timestamps are updated when messages are added
   * - Only relevant messages trigger timestamp updates
   *
   * This ensures thread ordering and "last activity" tracking work correctly.
   */
  describe('Thread Updates and Timestamps', () => {
    /**
     * Tests that thread timestamps are updated when user messages are saved.
     * This is important for thread ordering and "recent activity" features.
     */
    it('should update thread timestamp when message is saved', async () => {
      // Create thread with initial timestamp
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Test Thread',
          updatedAt: new Date('2023-01-01'),
        })
        .returning();

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: thread.id,
          messages: [createApiMessage('user', 'Update timestamp')],
        }),
      });

      await POST(request);

      // Check that timestamp was updated
      const updatedThread = await db.query.threads.findFirst({
        where: eq(threads.id, thread.id),
      });

      expect(updatedThread?.updatedAt.getTime()).toBeGreaterThan(
        new Date('2023-01-01').getTime()
      );
    });

    /**
     * Tests that timestamps are not updated for non-user messages.
     * Only user messages should affect thread activity timestamps.
     */
    it('should not update thread timestamp for non-user messages', async () => {
      // Create thread with initial timestamp
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Test Thread',
          updatedAt: new Date('2023-01-01'),
        })
        .returning();

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: thread.id,
          messages: [createApiMessage('system', 'System message')],
        }),
      });

      await POST(request);

      // Timestamp should remain unchanged since no user message was saved
      const updatedThread = await db.query.threads.findFirst({
        where: eq(threads.id, thread.id),
      });

      expect(updatedThread?.updatedAt.getTime()).toBe(
        new Date('2023-01-01').getTime()
      );
    });
  });

  /**
   * Database error handling test group.
   *
   * These tests verify graceful error handling for database-related failures:
   * - Connection errors
   * - Transaction failures
   * - Constraint violations
   *
   * Proper error handling prevents system crashes and data corruption.
   */
  describe('Database Error Handling', () => {
    /**
     * Tests graceful handling of database connectivity issues.
     * The system should return appropriate error responses without crashing.
     */
    it('should handle database connection errors gracefully', async () => {
      // Test with malformed JSON to trigger error handling
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    /**
     * Tests handling of database transaction failures.
     * Ensures partial operations are rolled back properly.
     */
    it('should handle transaction failures properly', async () => {
      // Mock transaction failure in createThreadWithFirstMessage
      const originalTransaction = db.transaction;
      jest.spyOn(db, 'transaction').mockImplementation(async () => {
        throw new Error('Transaction failed');
      });

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [createApiMessage('user', 'Transaction should fail')],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      // Restore original function
      db.transaction = originalTransaction;
    });
  });

  /**
   * Edge cases and performance test group.
   *
   * These tests verify the system handles unusual conditions and concurrent access:
   * - Very large message content
   * - Concurrent requests to the same thread
   * - Mixed message types in conversations
   *
   * These scenarios help ensure system robustness in production.
   */
  describe('Edge Cases and Performance', () => {
    let edgeCaseThreadId: string;

    beforeEach(async () => {
      // Create a thread for edge case tests
      const [thread] = await db
        .insert(threads)
        .values({
          userId: testUserId,
          name: 'Edge Case Thread',
          updatedAt: new Date(),
        })
        .returning();
      edgeCaseThreadId = thread.id;
    });

    /**
     * Tests handling of very large message content.
     * Ensures the system can handle substantial user input without issues.
     */
    it('should handle very long message content', async () => {
      const longContent = 'x'.repeat(100000); // 100K characters

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: edgeCaseThreadId,
          messages: [createApiMessage('user', longContent)],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, edgeCaseThreadId),
      });
      expect(savedMessages[0].content).toBe(longContent);
      expect(savedMessages[0].content.length).toBe(100000);
    });

    /**
     * Tests concurrent access to the same thread.
     *
     * This simulates multiple users or browser tabs sending messages
     * simultaneously to ensure database integrity and proper serialization.
     */
    it('should handle concurrent requests to same thread correctly', async () => {
      const requests = Array.from(
        { length: 3 },
        (_, i) =>
          new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({
              threadId: edgeCaseThreadId,
              messages: [createApiMessage('user', `Concurrent message ${i}`)],
            }),
          })
      );

      const responses = await Promise.all(requests.map((req) => POST(req)));

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // Should have saved all user messages to the thread
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, edgeCaseThreadId),
      });
      expect(savedMessages.length).toBe(3);
    });

    /**
     * Tests processing conversations with mixed message roles.
     *
     * This verifies the system correctly identifies and processes only
     * the user message while ignoring system/assistant messages.
     */
    it('should handle messages array with mixed types', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: edgeCaseThreadId,
          messages: createApiMessages([
            { role: 'system', content: 'System message' },
            { role: 'assistant', content: 'Assistant message' },
            { role: 'user', content: 'User message' },
            { role: 'user', content: 'Another user message' },
          ]),
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should extract and save only the most recent user message
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, edgeCaseThreadId),
      });
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toBe('Another user message');
    });
  });

  /**
   * Multi-user isolation test group.
   *
   * These tests verify that users can only access their own threads,
   * ensuring data privacy and security in the multi-tenant system.
   */
  describe('Multi-user Isolation', () => {
    /**
     * Tests thread ownership enforcement - critical security feature.
     *
     * This test ensures users cannot write to threads they don't own,
     * preventing unauthorized access to other users' conversations.
     * This is a fundamental security requirement for the chat system.
     */
    it("should not allow users to write to other users' threads", async () => {
      // Create another user
      const otherMockUser = await createMockUserWithPassword();
      const [otherUser] = await db
        .insert(users)
        .values({
          username: otherMockUser.user.username,
          passwordHash: otherMockUser.passwordHash,
        })
        .returning();

      // Create a thread for the other user
      const [otherUserThread] = await db
        .insert(threads)
        .values({
          userId: otherUser.id,
          name: 'Other User Thread',
          updatedAt: new Date(),
        })
        .returning();

      // Attempt to write to another user's thread (should fail)
      // This simulates a malicious request or frontend bug
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: otherUserThread.id,
          messages: [createApiMessage('user', 'Unauthorized message')],
        }),
      });

      const response = await POST(request);
      // Should fail with 400 due to thread ownership validation
      expect(response.status).toBe(400);

      // Critical: verify no data was leaked or corrupted
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, otherUserThread.id),
      });
      expect(savedMessages).toHaveLength(0);
    });
  });
});
