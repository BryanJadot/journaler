import { describe, it, expect, beforeEach } from '@jest/globals';

import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  createThread,
  getThreadById,
  updateThreadName,
} from '@/lib/db/threads';

// Mock revalidateTag to prevent Next.js static generation errors in tests
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

describe('updateThreadName', () => {
  let testUserId: string;
  let threadId: string;

  beforeEach(async () => {
    // Create test user
    const mockUser = createMockUser();
    const [testUser] = await db
      .insert(users)
      .values({
        username: mockUser.username,
        passwordHash: 'hash123',
      })
      .returning();
    testUserId = testUser.id;

    // Create test thread
    const thread = await createThread(testUserId, DEFAULT_THREAD_NAME);
    threadId = thread.id;
  });

  describe('Basic functionality', () => {
    it('should update thread name successfully', async () => {
      const newName = 'Updated Thread Name';

      const result = await updateThreadName(threadId, newName, testUserId);

      expect(result).toBe(true);

      // Verify the name was updated
      const updatedThread = await getThreadById(threadId);
      expect(updatedThread?.name).toBe(newName);
    });

    it('should update updatedAt timestamp', async () => {
      const thread = await getThreadById(threadId);
      const originalUpdatedAt = thread!.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await updateThreadName(threadId, 'New Name', testUserId);

      const updatedThread = await getThreadById(threadId);
      expect(updatedThread!.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it('should return false when thread does not exist', async () => {
      const nonExistentThreadId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID format

      const result = await updateThreadName(
        nonExistentThreadId,
        'New Name',
        testUserId
      );

      expect(result).toBe(false);
    });
  });

  describe('Conditional updates', () => {
    it('should update when current name matches expected name', async () => {
      const newName = 'Conditionally Updated Name';

      const result = await updateThreadName(
        threadId,
        newName,
        testUserId,
        DEFAULT_THREAD_NAME // Thread currently has default name
      );

      expect(result).toBe(true);

      const updatedThread = await getThreadById(threadId);
      expect(updatedThread?.name).toBe(newName);
    });

    it('should not update when current name does not match expected name', async () => {
      // First update the thread to have a different name
      await updateThreadName(threadId, 'Already Changed Name', testUserId);

      // Now try to update conditionally expecting the default name
      const result = await updateThreadName(
        threadId,
        'Should Not Update',
        testUserId,
        DEFAULT_THREAD_NAME // Thread no longer has default name
      );

      expect(result).toBe(false);

      // Verify the name was not changed
      const thread = await getThreadById(threadId);
      expect(thread?.name).toBe('Already Changed Name');
    });

    it('should handle race condition prevention', async () => {
      // This simulates the auto-naming scenario where we only want to update
      // if the thread still has the default name
      const generatedName = 'Auto Generated Name';

      // First call should succeed
      const result1 = await updateThreadName(
        threadId,
        generatedName,
        testUserId,
        DEFAULT_THREAD_NAME
      );
      expect(result1).toBe(true);

      // Second call with same condition should fail (thread no longer has default name)
      const result2 = await updateThreadName(
        threadId,
        'Another Generated Name',
        testUserId,
        DEFAULT_THREAD_NAME
      );
      expect(result2).toBe(false);

      // Verify first update won
      const thread = await getThreadById(threadId);
      expect(thread?.name).toBe(generatedName);
    });

    it('should work with empty string conditions', async () => {
      // Set thread to empty name
      await updateThreadName(threadId, '', testUserId);

      // Update conditionally based on empty string
      const result = await updateThreadName(
        threadId,
        'From Empty',
        testUserId,
        '' // Expecting empty string
      );

      expect(result).toBe(true);

      const thread = await getThreadById(threadId);
      expect(thread?.name).toBe('From Empty');
    });

    it('should differentiate between similar names', async () => {
      // Set thread to a specific name
      await updateThreadName(threadId, 'Test Name', testUserId);

      // Try to update expecting a slightly different name
      const result = await updateThreadName(
        threadId,
        'Should Not Update',
        testUserId,
        'Test Name ' // Note the trailing space
      );

      expect(result).toBe(false);

      const thread = await getThreadById(threadId);
      expect(thread?.name).toBe('Test Name');
    });
  });

  describe('Error cases', () => {
    it('should throw error if database returns undefined rowCount', async () => {
      // Mock the db to return a result with undefined rowCount
      const originalUpdate = db.update;
      const mockResult = { rowCount: undefined };

      // @ts-expect-error - Mocking internal implementation for testing
      db.update = jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve(mockResult)),
        })),
      }));

      await expect(
        updateThreadName(threadId, 'New Name', testUserId)
      ).rejects.toThrow(
        'Database update operation returned undefined rowCount'
      );

      // Restore original implementation
      db.update = originalUpdate;
    });
  });

  describe('Edge cases', () => {
    it('should handle very long thread names', async () => {
      const longName = 'a'.repeat(255); // Max length

      const result = await updateThreadName(threadId, longName, testUserId);

      expect(result).toBe(true);

      const updatedThread = await getThreadById(threadId);
      expect(updatedThread?.name).toBe(longName);
    });

    it('should handle special characters in names', async () => {
      const specialName = 'Thread with "quotes" & <brackets> and émojis 🎉';

      const result = await updateThreadName(threadId, specialName, testUserId);

      expect(result).toBe(true);

      const updatedThread = await getThreadById(threadId);
      expect(updatedThread?.name).toBe(specialName);
    });

    it('should handle unicode characters', async () => {
      const unicodeName = '测试线程 🌍 العربية';

      const result = await updateThreadName(threadId, unicodeName, testUserId);

      expect(result).toBe(true);

      const updatedThread = await getThreadById(threadId);
      expect(updatedThread?.name).toBe(unicodeName);
    });
  });
});
