import { silenceConsoleErrors } from '@/__tests__/helpers/console-helpers';
import { setHmacHeaders } from '@/lib/auth/hmac-headers';
import * as hmacSecretModule from '@/lib/auth/hmac-secret';
import { createHmacSignature } from '@/lib/auth/hmac-sign';
import { fireAndForget } from '@/lib/internal/fire-and-forget';

// Mock dependencies
jest.mock('@/lib/auth/hmac-secret');
jest.mock('@/lib/auth/hmac-sign');
jest.mock('@/lib/auth/hmac-headers');

const mockGetHmacSecret = hmacSecretModule.getHmacSecret as jest.MockedFunction<
  typeof hmacSecretModule.getHmacSecret
>;
const mockCreateHmacSignature = createHmacSignature as jest.MockedFunction<
  typeof createHmacSignature
>;
const mockSetHmacHeaders = setHmacHeaders as jest.MockedFunction<
  typeof setHmacHeaders
>;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

/**
 * Test suite for fire-and-forget internal API calls.
 *
 * This suite tests the mechanism that allows server functions to make
 * authenticated internal API calls without waiting for responses.
 */
describe('Fire and Forget', () => {
  silenceConsoleErrors();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHmacSecret.mockReturnValue('test-secret-key');
    mockCreateHmacSignature.mockResolvedValue('test-signature');
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));

    // Clean up environment variables
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  describe('fireAndForget', () => {
    it('should make API call with proper HMAC authentication', async () => {
      const userId = 'user-123';
      const path = '/api/threads/rename';
      const options = {
        method: 'POST',
        body: JSON.stringify({ threadId: 'thread-456', newName: 'New Name' }),
        headers: { 'Content-Type': 'application/json' },
      };

      fireAndForget(userId, path, options);

      // Wait a tick for the async operation to start
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockCreateHmacSignature).toHaveBeenCalledWith({
        userId,
        method: 'POST',
        path,
        timestamp: expect.any(Number),
      });

      expect(mockSetHmacHeaders).toHaveBeenCalledWith(
        expect.any(Headers),
        {
          userId,
          method: 'POST',
          path,
          timestamp: expect.any(Number),
          signature: 'test-signature',
        },
        'x-service'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/threads/rename',
        expect.objectContaining({
          method: 'POST',
          body: options.body,
          headers: expect.any(Headers),
        })
      );
    });

    it('should use default GET method when not specified', async () => {
      const userId = 'user-123';
      const path = '/api/status';

      fireAndForget(userId, path);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockCreateHmacSignature).toHaveBeenCalledWith({
        userId,
        method: 'GET',
        path,
        timestamp: expect.any(Number),
      });
    });

    it('should handle different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        jest.clearAllMocks();

        const userId = 'user-123';
        const path = '/api/test';

        fireAndForget(userId, path, { method });

        await new Promise((resolve) => setImmediate(resolve));

        expect(mockCreateHmacSignature).toHaveBeenCalledWith({
          userId,
          method,
          path,
          timestamp: expect.any(Number),
        });
      }
    });

    it('should use VERCEL_PROJECT_PRODUCTION_URL when available', async () => {
      process.env.VERCEL_PROJECT_PRODUCTION_URL = 'journaler.example.com';

      const userId = 'user-123';
      const path = '/api/test';

      fireAndForget(userId, path);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://journaler.example.com/api/test',
        expect.any(Object)
      );
    });

    it('should use localhost when VERCEL_PROJECT_PRODUCTION_URL is not set', async () => {
      const userId = 'user-123';
      const path = '/api/test';

      fireAndForget(userId, path);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
        expect.any(Object)
      );
    });

    it('should handle different user ID formats', async () => {
      const userIds = [
        'user-123',
        'service-456',
        'uuid-550e8400-e29b-41d4-a716-446655440001',
        'user@example.com',
      ];

      for (const userId of userIds) {
        jest.clearAllMocks();

        fireAndForget(userId, '/api/test');

        await new Promise((resolve) => setImmediate(resolve));

        expect(mockCreateHmacSignature).toHaveBeenCalledWith(
          expect.objectContaining({ userId })
        );
      }
    });

    it('should handle complex request paths', async () => {
      const paths = [
        '/api/threads/123/rename',
        '/api/users/456/profile',
        '/api/chat/messages?limit=10',
        '/api/search?query=hello%20world',
      ];

      for (const path of paths) {
        jest.clearAllMocks();

        fireAndForget('user-123', path);

        await new Promise((resolve) => setImmediate(resolve));

        expect(mockCreateHmacSignature).toHaveBeenCalledWith(
          expect.objectContaining({ path })
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(path),
          expect.any(Object)
        );
      }
    });

    it('should preserve original headers and add service headers', async () => {
      const userId = 'user-123';
      const path = '/api/test';
      const options = {
        headers: {
          'Content-Type': 'application/json',
          'Custom-Header': 'custom-value',
        },
      };

      fireAndForget(userId, path, options);

      await new Promise((resolve) => setImmediate(resolve));

      const fetchCall = mockFetch.mock.calls[0];
      const fetchOptions = fetchCall[1];
      const headers = fetchOptions.headers;

      expect(headers).toBeInstanceOf(Headers);
      expect(mockSetHmacHeaders).toHaveBeenCalledWith(
        headers,
        expect.any(Object),
        'x-service'
      );
    });

    it('should return immediately without waiting', () => {
      const userId = 'user-123';
      const path = '/api/test';

      const start = Date.now();
      fireAndForget(userId, path);
      const end = Date.now();

      // Should return immediately (within a few milliseconds)
      expect(end - start).toBeLessThan(10);
    });

    it('should handle network errors gracefully', async () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      mockFetch.mockRejectedValue(new Error('Network error'));

      const userId = 'user-123';
      const path = '/api/test';

      // Should not throw
      expect(() => fireAndForget(userId, path)).not.toThrow();

      await new Promise((resolve) => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(
        'Fire-and-forget API call failed:',
        expect.any(Error)
      );

      console.error = originalError;
    });

    it('should handle HMAC signature creation errors gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      mockCreateHmacSignature.mockRejectedValue(new Error('HMAC error'));

      const userId = 'user-123';
      const path = '/api/test';

      expect(() => fireAndForget(userId, path)).not.toThrow();

      await new Promise((resolve) => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(
        'Fire-and-forget API call failed:',
        expect.any(Error)
      );

      console.error = originalError;
    });

    it('should handle missing HMAC secret gracefully', async () => {
      const originalError = console.error;
      console.error = jest.fn();

      mockCreateHmacSignature.mockRejectedValue(
        new Error('INTERNAL_HEADER_SECRET environment variable is required')
      );

      const userId = 'user-123';
      const path = '/api/test';

      expect(() => fireAndForget(userId, path)).not.toThrow();

      await new Promise((resolve) => setImmediate(resolve));

      expect(console.error).toHaveBeenCalledWith(
        'Fire-and-forget API call failed:',
        expect.any(Error)
      );

      console.error = originalError;
    });
  });

  describe('timestamp generation', () => {
    it('should use current timestamp', async () => {
      const beforeCall = Math.floor(Date.now() / 1000);

      fireAndForget('user-123', '/api/test');

      await new Promise((resolve) => setImmediate(resolve));

      const afterCall = Math.floor(Date.now() / 1000);
      const callArgs = mockCreateHmacSignature.mock.calls[0][0];

      expect(callArgs.timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(callArgs.timestamp).toBeLessThanOrEqual(afterCall);
    });

    it('should use fresh timestamp for each call', async () => {
      fireAndForget('user-123', '/api/test1');

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1));

      fireAndForget('user-123', '/api/test2');

      await new Promise((resolve) => setImmediate(resolve));

      const timestamp1 = mockCreateHmacSignature.mock.calls[0][0].timestamp;
      const timestamp2 = mockCreateHmacSignature.mock.calls[1][0].timestamp;

      expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical thread renaming scenario', async () => {
      const userId = 'user-123';
      const threadId = 'thread-456';
      const newName = 'My Updated Thread Name';

      fireAndForget(userId, '/api/threads/rename', {
        method: 'POST',
        body: JSON.stringify({ threadId, newName }),
        headers: { 'Content-Type': 'application/json' },
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockCreateHmacSignature).toHaveBeenCalledWith({
        userId,
        method: 'POST',
        path: '/api/threads/rename',
        timestamp: expect.any(Number),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/threads/rename',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ threadId, newName }),
        })
      );
    });

    it('should handle background user analytics tracking', async () => {
      const userId = 'user-789';
      const analyticsData = {
        event: 'thread_created',
        properties: { threadId: 'thread-123', source: 'chat' },
      };

      fireAndForget(userId, '/api/analytics/track', {
        method: 'POST',
        body: JSON.stringify(analyticsData),
        headers: { 'Content-Type': 'application/json' },
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockCreateHmacSignature).toHaveBeenCalledWith({
        userId,
        method: 'POST',
        path: '/api/analytics/track',
        timestamp: expect.any(Number),
      });
    });

    it('should handle cache invalidation calls', async () => {
      const userId = 'user-456';

      fireAndForget(userId, '/api/cache/invalidate', {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache' },
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockCreateHmacSignature).toHaveBeenCalledWith({
        userId,
        method: 'DELETE',
        path: '/api/cache/invalidate',
        timestamp: expect.any(Number),
      });
    });
  });
});
