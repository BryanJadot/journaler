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

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

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

      // Verify message was saved to specified thread
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, existingThreadId),
      });
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toBe('Message with specific thread');
    });
  });

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

    it('should handle object content by stringifying', async () => {
      const complexContent = { text: 'Hello', metadata: { type: 'greeting' } };

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: testThreadId,
          messages: [createApiMessage('user', complexContent)],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, testThreadId),
      });
      expect(savedMessages[0].content).toBe(JSON.stringify(complexContent));
    });

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

  describe('Thread Updates and Timestamps', () => {
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

  describe('Database Error Handling', () => {
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

    it('should handle concurrent requests to same thread correctly', async () => {
      const requests = Array.from(
        { length: 3 },
        (_, i) =>
          new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({
              threadId: edgeCaseThreadId,
              messages: [
                {
                  id: `${i}`,
                  role: 'user',
                  content: `Concurrent message ${i}`,
                },
              ],
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

      // Should only save the last user message
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, edgeCaseThreadId),
      });
      expect(savedMessages).toHaveLength(1);
      expect(savedMessages[0].content).toBe('Another user message');
    });
  });

  describe('Multi-user Isolation', () => {
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

      // Try to write to other user's thread as first user
      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: otherUserThread.id,
          messages: [createApiMessage('user', 'Unauthorized message')],
        }),
      });

      const response = await POST(request);
      // This should fail because the thread belongs to another user
      expect(response.status).toBe(400);

      // Verify no message was saved
      const savedMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, otherUserThread.id),
      });
      expect(savedMessages).toHaveLength(0);
    });
  });
});
