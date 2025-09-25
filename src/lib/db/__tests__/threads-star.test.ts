import { describe, it, expect, beforeEach } from '@jest/globals';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  createThread,
  setThreadStarred,
  getThreadById,
  getThreadSummariesForUser,
} from '@/lib/db/threads';

// Mock revalidateTag to prevent Next.js static generation errors in tests
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  unstable_cache: jest.fn().mockImplementation(() => () => Promise.resolve([])),
}));

describe('Thread Star Operations', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user with unique name to avoid conflicts
    const mockUser = createMockUser();

    const [testUser] = await db
      .insert(users)
      .values({
        username: mockUser.username,
        passwordHash: 'hash123',
      })
      .returning();
    testUserId = testUser.id;
  });

  describe('setThreadStarred', () => {
    it('should star a thread', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      // Initially should be unstarred
      const initialThread = await getThreadById(thread.id);
      expect(initialThread?.starred).toBe(false);

      // Star the thread
      await setThreadStarred(thread.id, true, testUserId);

      const starredThread = await getThreadById(thread.id);
      expect(starredThread?.starred).toBe(true);
    });

    it('should unstar a thread', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      // First star the thread
      await setThreadStarred(thread.id, true, testUserId);
      const starredThread = await getThreadById(thread.id);
      expect(starredThread?.starred).toBe(true);

      // Then unstar it
      await setThreadStarred(thread.id, false, testUserId);
      const unstarredThread = await getThreadById(thread.id);
      expect(unstarredThread?.starred).toBe(false);
    });

    it('should update thread updatedAt when starring', async () => {
      const thread = await createThread(testUserId, 'Test Thread');
      const originalUpdatedAt = thread.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await setThreadStarred(thread.id, true, testUserId);
      const starredThread = await getThreadById(thread.id);

      expect(starredThread?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it('should handle repeated star operations', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      // Star multiple times
      await setThreadStarred(thread.id, true, testUserId);
      await setThreadStarred(thread.id, true, testUserId);
      await setThreadStarred(thread.id, true, testUserId);

      const starredThread = await getThreadById(thread.id);
      expect(starredThread?.starred).toBe(true);
    });

    it('should handle repeated unstar operations', async () => {
      const thread = await createThread(testUserId, 'Test Thread');

      // Unstar multiple times
      await setThreadStarred(thread.id, false, testUserId);
      await setThreadStarred(thread.id, false, testUserId);
      await setThreadStarred(thread.id, false, testUserId);

      const unstarredThread = await getThreadById(thread.id);
      expect(unstarredThread?.starred).toBe(false);
    });
  });

  describe('getThreadSummariesForUser with starred threads', () => {
    it('should return starred threads first', async () => {
      // Create threads with different timestamps
      const thread1 = await createThread(testUserId, 'Older Thread');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const thread2 = await createThread(testUserId, 'Newer Thread');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const thread3 = await createThread(testUserId, 'Newest Thread');

      // Star the oldest thread
      await setThreadStarred(thread1.id, true, testUserId);

      const summaries = await getThreadSummariesForUser(testUserId);

      // Starred thread should be first despite being older
      expect(summaries[0].id).toBe(thread1.id);
      expect(summaries[0].starred).toBe(true);

      // Other threads should follow in recency order
      expect(summaries[1].id).toBe(thread3.id);
      expect(summaries[1].starred).toBe(false);
      expect(summaries[2].id).toBe(thread2.id);
      expect(summaries[2].starred).toBe(false);
    });

    it('should order multiple starred threads by recency', async () => {
      // Create threads
      const thread1 = await createThread(testUserId, 'Thread 1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const thread2 = await createThread(testUserId, 'Thread 2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const thread3 = await createThread(testUserId, 'Thread 3');

      // Star thread1 and thread3
      await setThreadStarred(thread1.id, true, testUserId);
      await setThreadStarred(thread3.id, true, testUserId);

      const summaries = await getThreadSummariesForUser(testUserId);

      // Both starred threads should be at the top, ordered by recency
      expect(summaries[0].starred).toBe(true);
      expect(summaries[1].starred).toBe(true);
      expect(summaries[2].starred).toBe(false);

      // Among starred threads, newer one should be first
      expect(summaries[0].id).toBe(thread3.id);
      expect(summaries[1].id).toBe(thread1.id);
      expect(summaries[2].id).toBe(thread2.id);
    });

    it('should include starred field in thread summaries', async () => {
      const thread = await createThread(testUserId, 'Test Thread');
      await setThreadStarred(thread.id, true, testUserId);

      const summaries = await getThreadSummariesForUser(testUserId);

      expect(summaries[0]).toHaveProperty('id');
      expect(summaries[0]).toHaveProperty('name');
      expect(summaries[0]).toHaveProperty('updatedAt');
      expect(summaries[0]).toHaveProperty('starred');
      expect(summaries[0].starred).toBe(true);
    });
  });
});
