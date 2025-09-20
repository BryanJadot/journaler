import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import type { Role, OutputType } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { saveMessage } from '@/lib/db/messages';
import { users, threads, messages } from '@/lib/db/schema';
import { createThread } from '@/lib/db/threads';

describe('Messages Service', () => {
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
      const threadWithMessages = await db.query.threads.findFirst({
        where: eq(threads.id, thread.id),
        with: {
          messages: true,
        },
      });
      expect(threadWithMessages?.messages).toHaveLength(5);
    });
  });
});
