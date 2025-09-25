import { describe, it, expect, beforeEach } from '@jest/globals';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import type { Role } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { saveMessage } from '@/lib/db/messages';
import { users } from '@/lib/db/schema';
import {
  createThread,
  getThreadsByUser,
  getMostRecentThread,
  getThreadSummariesForUser,
  verifyThreadOwnership,
} from '@/lib/db/threads';

// Mock revalidateTag to prevent Next.js static generation errors in tests
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

describe('User Thread Operations', () => {
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
        starred: false,
      });
      expect(summaries[1]).toEqual({
        id: thread1.id,
        name: 'First Thread',
        updatedAt: expect.any(Date),
        starred: false,
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
});
