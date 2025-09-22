import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import type { Role } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { saveMessage } from '@/lib/db/messages';
import { users, messages } from '@/lib/db/schema';
import {
  createThread,
  getThreadsByUser,
  getMostRecentThread,
  getThreadWithMessages,
  getThreadSummariesForUser,
  verifyThreadOwnership,
  deleteThread,
} from '@/lib/db/threads';

// Mock revalidateTag to prevent Next.js static generation errors in tests
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

describe('Threads Service', () => {
  let testUserId: string;
  let otherUserId: string;

  beforeEach(async () => {
    // Create test users with unique names to avoid conflicts
    const mockUser1 = createMockUser();
    const mockUser2 = createMockUser();

    const [testUser] = await db
      .insert(users)
      .values({
        username: mockUser1.username,
        passwordHash: 'hash123',
      })
      .returning();
    testUserId = testUser.id;

    const [otherUser] = await db
      .insert(users)
      .values({
        username: mockUser2.username,
        passwordHash: 'hash456',
      })
      .returning();
    otherUserId = otherUser.id;
  });

  describe('createThread', () => {
    it('should create a new thread', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      expect(thread).toBeDefined();
      expect(thread.name).toBe('Test Thread');
      expect(thread.userId).toBe(testUserId);
      expect(thread.updatedAt).toBeInstanceOf(Date);
    });

    it('should create multiple threads for the same user', async () => {
      const thread1 = await createThread(testUserId, 'Thread 1');
      const thread2 = await createThread(testUserId, 'Thread 2');

      expect(thread1.id).not.toBe(thread2.id);
      expect(thread1.userId).toBe(thread2.userId);
    });

    it('should handle empty thread name', async () => {
      const thread = await createThread(testUserId, '');
      expect(thread.name).toBe('');
    });

    it('should handle very long thread names', async () => {
      const longName = 'x'.repeat(255); // Max varchar length
      const thread = await createThread(testUserId, longName);
      expect(thread.name).toBe(longName);
    });

    it('should fail with non-existent user', async () => {
      const fakeUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      await expect(createThread(fakeUserId, 'Thread')).rejects.toThrow();
    });
  });

  describe('getThreadsByUser', () => {
    let thread1: Awaited<ReturnType<typeof createThread>>;
    let thread2: Awaited<ReturnType<typeof createThread>>;
    let thread3: Awaited<ReturnType<typeof createThread>>;

    beforeEach(async () => {
      // Create threads with different update times
      thread1 = await createThread(testUserId, 'Thread 1');
      await new Promise((resolve) => setTimeout(resolve, 10));

      thread2 = await createThread(testUserId, 'Thread 2');
      await new Promise((resolve) => setTimeout(resolve, 10));

      thread3 = await createThread(testUserId, 'Thread 3');

      // Create thread for other user
      await createThread(otherUserId, 'Other User Thread');

      // Add messages to threads
      await saveMessage(thread1.id, 'user' as Role, 'Message 1');
      await saveMessage(thread2.id, 'user' as Role, 'Message 2');
      await saveMessage(thread3.id, 'user' as Role, 'Message 3');

      // Update thread1 to be most recent
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(thread1.id, 'assistant' as Role, 'Latest message');
    });

    it('should return threads ordered by most recent first', async () => {
      const userThreads = await getThreadsByUser(testUserId);

      expect(userThreads).toHaveLength(3);
      expect(userThreads[0].name).toBe('Thread 1'); // Most recently updated
      expect(userThreads[1].name).toBe('Thread 3');
      expect(userThreads[2].name).toBe('Thread 2');
    });

    it('should only return threads for specified user', async () => {
      const userThreads = await getThreadsByUser(testUserId);
      const otherUserThreads = await getThreadsByUser(otherUserId);

      expect(userThreads).toHaveLength(3);
      expect(otherUserThreads).toHaveLength(1);
      expect(otherUserThreads[0].name).toBe('Other User Thread');
    });

    it('should include only the most recent message for each thread', async () => {
      const userThreads = await getThreadsByUser(testUserId);

      expect(userThreads[0].messages).toHaveLength(1);
      expect(userThreads[0].messages[0].content).toBe('Latest message');
      expect(userThreads[1].messages).toHaveLength(1);
      expect(userThreads[2].messages).toHaveLength(1);
    });

    it('should return empty array for user with no threads', async () => {
      const [newUser] = await db
        .insert(users)
        .values({
          username: 'emptyuser',
          passwordHash: 'hash',
        })
        .returning();

      const userThreads = await getThreadsByUser(newUser.id);
      expect(userThreads).toHaveLength(0);
    });

    it('should handle non-existent user', async () => {
      const fakeUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const threads = await getThreadsByUser(fakeUserId);
      expect(threads).toHaveLength(0);
    });

    it('should handle threads with no messages', async () => {
      const emptyThread = await createThread(testUserId, 'Empty Thread');
      const threads = await getThreadsByUser(testUserId);

      const empty = threads.find((t) => t.id === emptyThread.id);
      expect(empty).toBeDefined();
      expect(empty?.messages).toHaveLength(0);
    });
  });

  describe('getMostRecentThread', () => {
    it('should return the most recent thread with all messages', async () => {
      const thread1 = await createThread(testUserId, 'Old Thread');
      await saveMessage(thread1.id, 'user' as Role, 'Old message');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const thread2 = await createThread(testUserId, 'Recent Thread');
      await saveMessage(thread2.id, 'user' as Role, 'Message 1');
      await saveMessage(thread2.id, 'assistant' as Role, 'Message 2');

      const recentThread = await getMostRecentThread(testUserId);

      expect(recentThread?.id).toBe(thread2.id);
      expect(recentThread?.name).toBe('Recent Thread');
      expect(recentThread?.messages).toHaveLength(2);
      expect(recentThread?.messages[0].content).toBe('Message 1');
      expect(recentThread?.messages[1].content).toBe('Message 2');
    });

    it('should return undefined for user with no threads', async () => {
      const [newUser] = await db
        .insert(users)
        .values({
          username: 'nothread',
          passwordHash: 'hash',
        })
        .returning();

      const recentThread = await getMostRecentThread(newUser.id);
      expect(recentThread).toBeUndefined();
    });

    it('should return undefined for non-existent user', async () => {
      const fakeUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const recentThread = await getMostRecentThread(fakeUserId);
      expect(recentThread).toBeUndefined();
    });

    it('should return messages in chronological order', async () => {
      const thread = await createThread(testUserId, 'Thread');

      await saveMessage(thread.id, 'user' as Role, 'First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(thread.id, 'assistant' as Role, 'Second');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(thread.id, 'user' as Role, 'Third');

      const recentThread = await getMostRecentThread(testUserId);

      expect(recentThread?.messages).toHaveLength(3);
      expect(recentThread?.messages[0].content).toBe('First');
      expect(recentThread?.messages[1].content).toBe('Second');
      expect(recentThread?.messages[2].content).toBe('Third');
    });

    it('should handle thread with no messages', async () => {
      await createThread(testUserId, 'Empty Thread');

      const recentThread = await getMostRecentThread(testUserId);
      expect(recentThread?.name).toBe('Empty Thread');
      expect(recentThread?.messages).toHaveLength(0);
    });

    it('should update most recent when message is added', async () => {
      const thread1 = await createThread(testUserId, 'Thread 1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const thread2 = await createThread(testUserId, 'Thread 2');

      // Thread 2 is most recent initially
      let recent = await getMostRecentThread(testUserId);
      expect(recent?.id).toBe(thread2.id);

      // Add message to thread1, making it most recent
      await saveMessage(thread1.id, 'user' as Role, 'New message');

      recent = await getMostRecentThread(testUserId);
      expect(recent?.id).toBe(thread1.id);
    });
  });

  describe('getThreadWithMessages', () => {
    it('should return thread with all its messages', async () => {
      const thread = await createThread(testUserId, 'Test Thread');
      await saveMessage(thread.id, 'user' as Role, 'Message 1');
      await saveMessage(thread.id, 'assistant' as Role, 'Message 2');
      await saveMessage(thread.id, 'user' as Role, 'Message 3');

      const threadWithMessages = await getThreadWithMessages(thread.id);

      expect(threadWithMessages?.id).toBe(thread.id);
      expect(threadWithMessages?.messages).toHaveLength(3);
      expect(threadWithMessages?.messages.map((m) => m.content)).toEqual([
        'Message 1',
        'Message 2',
        'Message 3',
      ]);
    });

    it('should return undefined for non-existent thread', async () => {
      const threadWithMessages = await getThreadWithMessages(
        '550e8400-e29b-41d4-a716-446655440001'
      );
      expect(threadWithMessages).toBeUndefined();
    });

    it('should return thread even with no messages', async () => {
      const thread = await createThread(testUserId, 'Empty Thread');
      const threadWithMessages = await getThreadWithMessages(thread.id);

      expect(threadWithMessages?.id).toBe(thread.id);
      expect(threadWithMessages?.messages).toHaveLength(0);
    });

    it('should return messages in chronological order', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      // Add messages out of order
      await saveMessage(thread.id, 'user' as Role, 'First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(thread.id, 'assistant' as Role, 'Second');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(thread.id, 'user' as Role, 'Third');

      const threadWithMessages = await getThreadWithMessages(thread.id);

      const contents = threadWithMessages?.messages.map((m) => m.content);
      expect(contents).toEqual(['First', 'Second', 'Third']);
    });

    it('should return thread from any user', async () => {
      // Create thread for other user
      const otherThread = await createThread(otherUserId, 'Other User Thread');
      await saveMessage(otherThread.id, 'user' as Role, 'Other message');

      // Should be able to get thread without user check
      const threadWithMessages = await getThreadWithMessages(otherThread.id);

      expect(threadWithMessages?.id).toBe(otherThread.id);
      expect(threadWithMessages?.userId).toBe(otherUserId);
    });

    it('should handle another non-existent thread UUID', async () => {
      const threadWithMessages = await getThreadWithMessages(
        '550e8400-e29b-41d4-a716-446655440002'
      );
      expect(threadWithMessages).toBeUndefined();
    });

    it('should handle yet another non-existent thread UUID', async () => {
      const threadWithMessages = await getThreadWithMessages(
        '550e8400-e29b-41d4-a716-446655440003'
      );
      expect(threadWithMessages).toBeUndefined();
    });
  });

  describe('verifyThreadOwnership', () => {
    let threadId: string;

    beforeEach(async () => {
      const thread = await createThread(testUserId, 'Test Thread');
      threadId = thread.id;

      const _otherThread = await createThread(otherUserId, 'Other User Thread');
    });

    it('should return true for thread owner', async () => {
      const result = await verifyThreadOwnership(threadId, testUserId);
      expect(result).toBe(true);
    });

    it('should return false for non-owner', async () => {
      const result = await verifyThreadOwnership(threadId, otherUserId);
      expect(result).toBe(false);
    });

    it('should return false for non-existent thread', async () => {
      const fakeThreadId = '550e8400-e29b-41d4-a716-446655440001';
      const result = await verifyThreadOwnership(fakeThreadId, testUserId);
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const fakeUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      const result = await verifyThreadOwnership(threadId, fakeUserId);
      expect(result).toBe(false);
    });

    it('should work independently of thread messages', async () => {
      // Add messages to thread to ensure the function doesn't load them
      await saveMessage(threadId, 'user' as Role, 'Message 1');
      await saveMessage(threadId, 'assistant' as Role, 'Message 2');
      await saveMessage(threadId, 'user' as Role, 'Message 3');

      const result = await verifyThreadOwnership(threadId, testUserId);
      expect(result).toBe(true);

      const otherResult = await verifyThreadOwnership(threadId, otherUserId);
      expect(otherResult).toBe(false);
    });

    it('should handle empty thread ID', async () => {
      const result = await verifyThreadOwnership('', testUserId);
      expect(result).toBe(false);
    });

    it('should handle empty user ID', async () => {
      const result = await verifyThreadOwnership(threadId, '');
      expect(result).toBe(false);
    });
  });

  describe('getThreadSummariesForUser', () => {
    it('should return thread summaries without messages', async () => {
      // Create test threads
      const thread1 = await createThread(testUserId, 'First Thread');
      const thread2 = await createThread(testUserId, 'Second Thread');

      const summaries = await getThreadSummariesForUser(testUserId);

      expect(summaries).toHaveLength(2);
      expect(summaries[0]).toEqual({
        id: thread2.id, // Most recent first
        name: 'Second Thread',
        updatedAt: expect.any(Date),
      });
      expect(summaries[1]).toEqual({
        id: thread1.id,
        name: 'First Thread',
        updatedAt: expect.any(Date),
      });

      // Ensure no messages are included
      summaries.forEach((summary) => {
        expect(summary).not.toHaveProperty('messages');
      });
    });

    it('should return empty array for user with no threads', async () => {
      const summaries = await getThreadSummariesForUser(testUserId);

      expect(summaries).toEqual([]);
    });

    it('should only return threads for specified user', async () => {
      const mockUser2 = createMockUser();
      const [testUser2] = await db
        .insert(users)
        .values({
          username: mockUser2.username,
          passwordHash: 'hash456',
        })
        .returning();
      const user2Id = testUser2.id;

      await createThread(testUserId, 'User 1 Thread');
      await createThread(user2Id, 'User 2 Thread');

      const user1Summaries = await getThreadSummariesForUser(testUserId);
      const user2Summaries = await getThreadSummariesForUser(user2Id);

      expect(user1Summaries).toHaveLength(1);
      expect(user1Summaries[0].name).toBe('User 1 Thread');

      expect(user2Summaries).toHaveLength(1);
      expect(user2Summaries[0].name).toBe('User 2 Thread');
    });
  });

  /**
   * Test suite for thread deletion functionality.
   *
   * This comprehensive test suite validates the deleteThread function's behavior
   * across various scenarios including successful deletions, error handling,
   * and edge cases. Tests ensure data integrity, proper transaction handling,
   * and cache invalidation behavior.
   *
   * Key areas tested:
   * - Complete thread and message deletion
   * - Transaction integrity (all-or-nothing operations)
   * - Handling of non-existent or invalid thread IDs
   * - Cache invalidation after deletion
   * - Isolation between different users' threads
   * - Referential integrity maintenance
   */
  describe('deleteThread', () => {
    let thread1: Awaited<ReturnType<typeof createThread>>;
    let thread2: Awaited<ReturnType<typeof createThread>>;
    let otherUserThread: Awaited<ReturnType<typeof createThread>>;

    beforeEach(async () => {
      // Create test threads
      thread1 = await createThread(testUserId, 'Thread 1');
      thread2 = await createThread(testUserId, 'Thread 2');
      otherUserThread = await createThread(otherUserId, 'Other User Thread');

      // Add messages to threads
      await saveMessage(thread1.id, 'user' as Role, 'User message 1');
      await saveMessage(
        thread1.id,
        'assistant' as Role,
        'Assistant response 1'
      );
      await saveMessage(thread1.id, 'user' as Role, 'User message 2');

      await saveMessage(thread2.id, 'user' as Role, 'Thread 2 message');

      await saveMessage(
        otherUserThread.id,
        'user' as Role,
        'Other user message'
      );
    });

    it('should successfully delete a thread and all its messages', async () => {
      // Verify thread and messages exist before deletion
      const threadBefore = await getThreadWithMessages(thread1.id);
      expect(threadBefore).toBeDefined();
      expect(threadBefore?.messages).toHaveLength(3);

      // Delete the thread
      await deleteThread(thread1.id, testUserId);

      // Verify thread is deleted
      const threadAfter = await getThreadWithMessages(thread1.id);
      expect(threadAfter).toBeUndefined();
    });

    it('should delete messages and thread in a transaction', async () => {
      const threadId = thread1.id;

      // Verify initial state
      const threadBefore = await getThreadWithMessages(threadId);
      expect(threadBefore?.messages).toHaveLength(3);

      // Delete the thread
      await deleteThread(threadId, testUserId);

      // Verify both thread and all messages are gone
      const threadAfter = await getThreadWithMessages(threadId);
      expect(threadAfter).toBeUndefined();

      // Verify messages are also deleted by checking if any messages exist for this thread
      const remainingMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
      });
      expect(remainingMessages).toHaveLength(0);
    });

    it('should handle non-existent thread ID gracefully', async () => {
      const fakeThreadId = '550e8400-e29b-41d4-a716-446655440001';

      // This should not throw an error
      await expect(
        deleteThread(fakeThreadId, testUserId)
      ).resolves.toBeUndefined();

      // Verify existing threads are not affected
      const thread1After = await getThreadWithMessages(thread1.id);
      const thread2After = await getThreadWithMessages(thread2.id);
      expect(thread1After).toBeDefined();
      expect(thread2After).toBeDefined();
    });

    it('should not affect other threads and their messages', async () => {
      // Get initial state of other threads
      const thread2Before = await getThreadWithMessages(thread2.id);
      const otherUserThreadBefore = await getThreadWithMessages(
        otherUserThread.id
      );

      expect(thread2Before?.messages).toHaveLength(1);
      expect(otherUserThreadBefore?.messages).toHaveLength(1);

      // Delete thread1
      await deleteThread(thread1.id, testUserId);

      // Verify other threads are unaffected
      const thread2After = await getThreadWithMessages(thread2.id);
      const otherUserThreadAfter = await getThreadWithMessages(
        otherUserThread.id
      );

      expect(thread2After).toBeDefined();
      expect(thread2After?.messages).toHaveLength(1);
      expect(thread2After?.messages[0].content).toBe('Thread 2 message');

      expect(otherUserThreadAfter).toBeDefined();
      expect(otherUserThreadAfter?.messages).toHaveLength(1);
      expect(otherUserThreadAfter?.messages[0].content).toBe(
        'Other user message'
      );
    });

    it('should invalidate cache after deletion', async () => {
      const nextCache = await import('next/cache');
      const revalidateTag = jest.mocked(nextCache.revalidateTag);

      // Clear any previous calls
      revalidateTag.mockClear();

      await deleteThread(thread1.id, testUserId);

      // Verify cache invalidation was called with correct tag
      expect(revalidateTag).toHaveBeenCalledWith(`user-threads:${testUserId}`);
      expect(revalidateTag).toHaveBeenCalledTimes(1);
    });

    it('should successfully delete thread with no messages', async () => {
      // Create a thread without messages
      const emptyThread = await createThread(testUserId, 'Empty Thread');

      // Verify it exists
      const threadBefore = await getThreadWithMessages(emptyThread.id);
      expect(threadBefore).toBeDefined();
      expect(threadBefore?.messages).toHaveLength(0);

      // Delete the empty thread
      await deleteThread(emptyThread.id, testUserId);

      // Verify it's deleted
      const threadAfter = await getThreadWithMessages(emptyThread.id);
      expect(threadAfter).toBeUndefined();
    });

    it('should successfully delete thread with multiple messages', async () => {
      // Add more messages to thread1 (already has 3)
      await saveMessage(thread1.id, 'user' as Role, 'User message 3');
      await saveMessage(
        thread1.id,
        'assistant' as Role,
        'Assistant response 2'
      );
      await saveMessage(thread1.id, 'user' as Role, 'User message 4');
      await saveMessage(
        thread1.id,
        'assistant' as Role,
        'Assistant response 3'
      );

      // Verify thread has multiple messages
      const threadBefore = await getThreadWithMessages(thread1.id);
      expect(threadBefore?.messages).toHaveLength(7);

      // Delete the thread
      await deleteThread(thread1.id, testUserId);

      // Verify thread and all messages are deleted
      const threadAfter = await getThreadWithMessages(thread1.id);
      expect(threadAfter).toBeUndefined();

      // Double-check no messages remain
      const remainingMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, thread1.id),
      });
      expect(remainingMessages).toHaveLength(0);
    });

    it('should work correctly when deleting multiple threads sequentially', async () => {
      // Create another thread for sequential deletion
      const thread3 = await createThread(testUserId, 'Thread 3');
      await saveMessage(thread3.id, 'user' as Role, 'Thread 3 message');

      // Verify all threads exist
      expect(await getThreadWithMessages(thread1.id)).toBeDefined();
      expect(await getThreadWithMessages(thread2.id)).toBeDefined();
      expect(await getThreadWithMessages(thread3.id)).toBeDefined();

      // Delete threads one by one
      await deleteThread(thread1.id, testUserId);
      await deleteThread(thread3.id, testUserId);

      // Verify correct deletions
      expect(await getThreadWithMessages(thread1.id)).toBeUndefined();
      expect(await getThreadWithMessages(thread2.id)).toBeDefined(); // Should remain
      expect(await getThreadWithMessages(thread3.id)).toBeUndefined();
    });

    it('should throw error for empty thread ID', async () => {
      // Should throw an error for invalid thread ID
      await expect(deleteThread('', testUserId)).rejects.toThrow(
        'Invalid thread ID: '
      );

      // Verify existing threads are not affected
      const thread1After = await getThreadWithMessages(thread1.id);
      expect(thread1After).toBeDefined();
    });

    it('should throw error for invalid UUID format', async () => {
      const invalidUuid = 'not-a-valid-uuid';

      // Should throw an error for invalid UUID format
      await expect(deleteThread(invalidUuid, testUserId)).rejects.toThrow(
        `Invalid thread ID: ${invalidUuid}`
      );

      // Verify existing threads are not affected
      const thread1After = await getThreadWithMessages(thread1.id);
      expect(thread1After).toBeDefined();
    });

    it('should maintain referential integrity during deletion', async () => {
      const threadId = thread1.id;

      // Verify foreign key relationship exists
      const messagesBefore = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
      });
      expect(messagesBefore.length).toBeGreaterThan(0);

      // Delete the thread
      await deleteThread(threadId, testUserId);

      // Verify no orphaned messages remain
      const messagesAfter = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
      });
      expect(messagesAfter).toHaveLength(0);
    });
  });
});
