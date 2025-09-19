import { unstable_cache } from 'next/cache';

import {
  getUserThreadsCacheTag,
  getCachedThreadSummaries,
} from '@/lib/chat/service';

// Mock the dependencies
jest.mock('next/cache');
jest.mock('@/lib/db', () => ({
  db: {
    query: {
      threads: {
        findMany: jest.fn(),
      },
    },
  },
}));

describe('Thread Caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserThreadsCacheTag', () => {
    it('should generate consistent cache tags for user IDs', () => {
      const userId = 'test-user-123';
      const tag = getUserThreadsCacheTag(userId);

      expect(tag).toBe('user-threads:test-user-123');
    });

    it('should generate unique tags for different users', () => {
      const tag1 = getUserThreadsCacheTag('user-1');
      const tag2 = getUserThreadsCacheTag('user-2');

      expect(tag1).not.toBe(tag2);
      expect(tag1).toBe('user-threads:user-1');
      expect(tag2).toBe('user-threads:user-2');
    });
  });

  describe('getCachedThreadSummaries', () => {
    it('should call unstable_cache with correct parameters', () => {
      const mockCacheFn = jest.fn().mockReturnValue(() => Promise.resolve([]));
      (unstable_cache as jest.Mock).mockReturnValue(mockCacheFn);

      const userId = 'test-user-123';
      getCachedThreadSummaries(userId);

      // Verify unstable_cache was called with correct arguments
      expect(unstable_cache).toHaveBeenCalledWith(
        expect.any(Function),
        ['user-threads:test-user-123'],
        {
          tags: ['user-threads:test-user-123'],
        }
      );

      // Verify the returned function was called
      expect(mockCacheFn).toHaveBeenCalledTimes(1);
    });

    it('should use unique cache keys for different users', () => {
      const mockCacheFn = jest.fn().mockReturnValue(() => Promise.resolve([]));
      (unstable_cache as jest.Mock).mockReturnValue(mockCacheFn);

      getCachedThreadSummaries('user-1');
      getCachedThreadSummaries('user-2');

      // Check first call
      expect(unstable_cache).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        ['user-threads:user-1'],
        {
          tags: ['user-threads:user-1'],
        }
      );

      // Check second call
      expect(unstable_cache).toHaveBeenNthCalledWith(
        2,
        expect.any(Function),
        ['user-threads:user-2'],
        {
          tags: ['user-threads:user-2'],
        }
      );
    });

    it('should return a function that calls the cached operation', async () => {
      const mockThreads = [
        { id: '1', name: 'Thread 1', updatedAt: new Date() },
        { id: '2', name: 'Thread 2', updatedAt: new Date() },
      ];

      // Mock unstable_cache to return a function that returns our mock data
      const mockCacheFn = jest.fn().mockResolvedValue(mockThreads);
      (unstable_cache as jest.Mock).mockReturnValue(() => mockCacheFn());

      const userId = 'test-user';
      const result = await getCachedThreadSummaries(userId);

      // The result should be our mock threads
      expect(result).toEqual(mockThreads);
      expect(mockCacheFn).toHaveBeenCalled();
    });
  });
});
