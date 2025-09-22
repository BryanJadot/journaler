import { describe, it, expect, beforeEach } from '@jest/globals';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import type { Role } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { saveMessage } from '@/lib/db/messages';
import { users } from '@/lib/db/schema';
import {
  createThread,
  getThreadById,
  getThreadWithMessages,
} from '@/lib/db/threads';

// Mock revalidateTag to prevent Next.js static generation errors in tests
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

describe('Thread CRUD Operations', () => {
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

  describe('getThreadById', () => {
    it('should return thread without messages', async () => {
      const thread = await createThread(testUserId, 'Test Thread');
      await saveMessage(thread.id, 'user' as Role, 'Message 1');
      await saveMessage(thread.id, 'assistant' as Role, 'Message 2');

      const fetchedThread = await getThreadById(thread.id);

      expect(fetchedThread).toBeDefined();
      expect(fetchedThread?.id).toBe(thread.id);
      expect(fetchedThread?.name).toBe('Test Thread');
      expect(fetchedThread?.userId).toBe(testUserId);
      // Should not include messages
      expect(fetchedThread).not.toHaveProperty('messages');
    });

    it('should return undefined for non-existent thread', async () => {
      const fetchedThread = await getThreadById(
        '550e8400-e29b-41d4-a716-446655440001'
      );
      expect(fetchedThread).toBeUndefined();
    });

    it('should return thread metadata only', async () => {
      const thread = await createThread(testUserId, 'Metadata Thread');

      const fetchedThread = await getThreadById(thread.id);

      expect(fetchedThread).toBeDefined();
      expect(fetchedThread?.id).toBe(thread.id);
      expect(fetchedThread?.name).toBe('Metadata Thread');
      expect(fetchedThread?.userId).toBe(testUserId);
      expect(fetchedThread?.updatedAt).toBeInstanceOf(Date);
      // Note: createdAt might not be returned by all queries
    });

    it('should return thread from any user', async () => {
      const otherThread = await createThread(otherUserId, 'Other User Thread');

      const fetchedThread = await getThreadById(otherThread.id);

      expect(fetchedThread).toBeDefined();
      expect(fetchedThread?.userId).toBe(otherUserId);
      expect(fetchedThread?.name).toBe('Other User Thread');
    });

    it('should handle empty thread name', async () => {
      const thread = await createThread(testUserId, '');

      const fetchedThread = await getThreadById(thread.id);

      expect(fetchedThread).toBeDefined();
      expect(fetchedThread?.name).toBe('');
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
});
