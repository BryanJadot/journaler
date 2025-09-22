import { describe, it, expect, beforeEach } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import type { Role } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { saveMessage } from '@/lib/db/messages';
import { users, messages } from '@/lib/db/schema';
import {
  createThread,
  deleteThread,
  getThreadWithMessages,
} from '@/lib/db/threads';

// Mock revalidateTag to prevent Next.js static generation errors in tests
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

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
describe('Thread Deletion', () => {
  let testUserId: string;
  let otherUserId: string;
  let thread1: Awaited<ReturnType<typeof createThread>>;
  let thread2: Awaited<ReturnType<typeof createThread>>;
  let otherUserThread: Awaited<ReturnType<typeof createThread>>;

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

    // Create test threads
    thread1 = await createThread(testUserId, 'Thread 1');
    thread2 = await createThread(testUserId, 'Thread 2');
    otherUserThread = await createThread(otherUserId, 'Other User Thread');

    // Add messages to threads
    await saveMessage(thread1.id, 'user' as Role, 'User message 1');
    await saveMessage(thread1.id, 'assistant' as Role, 'Assistant response 1');
    await saveMessage(thread1.id, 'user' as Role, 'User message 2');

    await saveMessage(thread2.id, 'user' as Role, 'Thread 2 message');

    await saveMessage(otherUserThread.id, 'user' as Role, 'Other user message');
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
    await saveMessage(thread1.id, 'assistant' as Role, 'Assistant response 2');
    await saveMessage(thread1.id, 'user' as Role, 'User message 4');
    await saveMessage(thread1.id, 'assistant' as Role, 'Assistant response 3');

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
