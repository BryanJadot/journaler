import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { db } from '@/lib/db';
import { users, threads, messages } from '@/lib/db/schema';

import {
  createThread,
  getThreadsByUser,
  getMostRecentThread,
  getThreadWithMessages,
  saveMessage,
  verifyThreadOwnership,
} from '../service';
import type { Role, OutputType } from '../types';

describe('Chat Service', () => {
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

  describe('saveMessage', () => {
    let threadId: string;
    let otherThreadId: string;

    beforeEach(async () => {
      const thread = await createThread(testUserId, 'Test Thread');
      threadId = thread.id;

      const otherThread = await createThread(otherUserId, 'Other Thread');
      otherThreadId = otherThread.id;
    });

    it('should save a message and update thread timestamp atomically', async () => {
      const originalThread = await db.query.threads.findFirst({
        where: eq(threads.id, threadId),
      });
      const originalUpdatedAt = originalThread?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const message = await saveMessage(
        threadId,
        'user' as Role,
        'Hello, world!',
        'text' as OutputType
      );

      expect(message).toBeDefined();
      expect(message.threadId).toBe(threadId);
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.outputType).toBe('text');

      // Check that thread was updated
      const updatedThread = await db.query.threads.findFirst({
        where: eq(threads.id, threadId),
      });
      expect(updatedThread?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt!.getTime()
      );
    });

    it('should use default outputType when not specified', async () => {
      const message = await saveMessage(
        threadId,
        'assistant' as Role,
        'Response text'
      );

      expect(message.outputType).toBe('text');
    });

    it('should save messages with all valid roles', async () => {
      const userMsg = await saveMessage(
        threadId,
        'user' as Role,
        'User message'
      );
      const assistantMsg = await saveMessage(
        threadId,
        'assistant' as Role,
        'Assistant message'
      );
      const devMsg = await saveMessage(
        threadId,
        'developer' as Role,
        'Developer message'
      );

      expect(userMsg.role).toBe('user');
      expect(assistantMsg.role).toBe('assistant');
      expect(devMsg.role).toBe('developer');
    });

    it('should save messages with all valid output types', async () => {
      const textMsg = await saveMessage(
        threadId,
        'user' as Role,
        'Text',
        'text' as OutputType
      );
      const errorMsg = await saveMessage(
        threadId,
        'assistant' as Role,
        'Error',
        'error' as OutputType
      );

      expect(textMsg.outputType).toBe('text');
      expect(errorMsg.outputType).toBe('error');
    });

    it('should handle empty message content', async () => {
      const message = await saveMessage(threadId, 'user' as Role, '');
      expect(message.content).toBe('');
    });

    it('should handle very long message content', async () => {
      const longContent = 'x'.repeat(100000); // 100K characters
      const message = await saveMessage(threadId, 'user' as Role, longContent);
      expect(message.content).toBe(longContent);
      expect(message.content.length).toBe(100000);
    });

    it('should handle JSON content', async () => {
      const jsonContent = JSON.stringify({
        key: 'value',
        nested: { data: 123 },
      });
      const message = await saveMessage(
        threadId,
        'assistant' as Role,
        jsonContent
      );
      expect(message.content).toBe(jsonContent);
      expect(JSON.parse(message.content)).toEqual({
        key: 'value',
        nested: { data: 123 },
      });
    });

    it('should handle special characters in content', async () => {
      const specialContent =
        'Test with \'quotes\', "double quotes", \n newlines, \t tabs, and emojis 🎉';
      const message = await saveMessage(
        threadId,
        'user' as Role,
        specialContent
      );
      expect(message.content).toBe(specialContent);
    });

    it('should fail with non-existent thread', async () => {
      await expect(
        saveMessage(
          '550e8400-e29b-41d4-a716-446655440001',
          'user' as Role,
          'Message'
        )
      ).rejects.toThrow();
    });

    it('should maintain message order by creation time', async () => {
      const msg1 = await saveMessage(threadId, 'user' as Role, 'First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const msg2 = await saveMessage(threadId, 'assistant' as Role, 'Second');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const msg3 = await saveMessage(threadId, 'user' as Role, 'Third');

      expect(msg1.createdAt.getTime()).toBeLessThan(msg2.createdAt.getTime());
      expect(msg2.createdAt.getTime()).toBeLessThan(msg3.createdAt.getTime());
    });

    it('should handle concurrent messages to different threads', async () => {
      const promises = [
        saveMessage(threadId, 'user' as Role, 'Thread 1 Message'),
        saveMessage(otherThreadId, 'user' as Role, 'Thread 2 Message'),
      ];

      const [msg1, msg2] = await Promise.all(promises);

      expect(msg1.threadId).toBe(threadId);
      expect(msg2.threadId).toBe(otherThreadId);
      expect(msg1.content).toBe('Thread 1 Message');
      expect(msg2.content).toBe('Thread 2 Message');
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

  describe('Transaction behavior', () => {
    it('should rollback entire transaction if any part fails in saveMessage', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      // Get initial state
      const initialMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, thread.id),
      });
      const initialThread = await db.query.threads.findFirst({
        where: eq(threads.id, thread.id),
      });

      expect(initialMessages).toHaveLength(0);
      const initialUpdatedAt = initialThread?.updatedAt;

      // Force transaction to fail by using an invalid thread ID that will pass initial insert
      // but fail on foreign key constraint
      const invalidThreadId = '550e8400-e29b-41d4-a716-446655440001';

      await expect(
        saveMessage(invalidThreadId, 'user' as Role, 'This should rollback')
      ).rejects.toThrow();

      // Verify original thread wasn't updated (no side effects from failed transaction)
      const afterThread = await db.query.threads.findFirst({
        where: eq(threads.id, thread.id),
      });
      expect(afterThread?.updatedAt.getTime()).toBe(
        initialUpdatedAt?.getTime()
      );
    });

    it('should handle concurrent saves to same thread correctly', async () => {
      const thread = await createThread(testUserId, 'Concurrent Thread');

      // Save multiple messages concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        saveMessage(thread.id, 'user' as Role, `Message ${i}`)
      );

      const messages = await Promise.all(promises);

      // All should succeed
      expect(messages).toHaveLength(5);
      messages.forEach((msg, i) => {
        expect(msg.content).toBe(`Message ${i}`);
        expect(msg.threadId).toBe(thread.id);
      });

      // Thread should have all messages
      const threadWithMessages = await getThreadWithMessages(thread.id);
      expect(threadWithMessages?.messages).toHaveLength(5);
    });
  });
});
