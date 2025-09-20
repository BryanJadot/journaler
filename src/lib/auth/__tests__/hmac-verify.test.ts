import { silenceConsoleWarnings } from '@/__tests__/helpers/console-helpers';
import * as hmacSecretModule from '@/lib/auth/hmac-secret';
import { createHmacSignature } from '@/lib/auth/hmac-sign';
import { verifyHmacSignature } from '@/lib/auth/hmac-verify';

// Mock the secret to control test environment
jest.mock('../hmac-secret');

const mockGetHmacSecret = hmacSecretModule.getHmacSecret as jest.MockedFunction<
  typeof hmacSecretModule.getHmacSecret
>;

/**
 * Test suite for HMAC signature verification.
 *
 * This suite tests the actual verifyHmacSignature function (not mocked)
 * to ensure it properly validates signatures, timestamps, and handles errors.
 */
describe('verifyHmacSignature', () => {
  silenceConsoleWarnings();

  const testSecret = 'test-secret-for-verification-tests';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHmacSecret.mockReturnValue(testSecret);
  });

  describe('valid signature verification', () => {
    it('should verify a valid signature created with createHmacSignature', async () => {
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(true);
    });

    it('should verify signature with different user IDs', async () => {
      const userIds = ['user-123', 'service-456', 'admin-789'];

      for (const userId of userIds) {
        const data = {
          userId,
          method: 'GET',
          path: '/api/test',
          timestamp: Math.floor(Date.now() / 1000),
        };

        const signature = await createHmacSignature(data);
        const isValid = await verifyHmacSignature(data, signature);

        expect(isValid).toBe(true);
      }
    });

    it('should verify signature with different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const data = {
          userId: 'user-123',
          method,
          path: '/api/test',
          timestamp: Math.floor(Date.now() / 1000),
        };

        const signature = await createHmacSignature(data);
        const isValid = await verifyHmacSignature(data, signature);

        expect(isValid).toBe(true);
      }
    });

    it('should verify signature with different paths', async () => {
      const paths = ['/api/chat', '/api/users/123', '/api/threads/create', '/'];

      for (const path of paths) {
        const data = {
          userId: 'user-123',
          method: 'POST',
          path,
          timestamp: Math.floor(Date.now() / 1000),
        };

        const signature = await createHmacSignature(data);
        const isValid = await verifyHmacSignature(data, signature);

        expect(isValid).toBe(true);
      }
    });
  });

  describe('invalid signature detection', () => {
    it('should reject signature with wrong userId', async () => {
      const originalData = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(originalData);

      const tamperedData = { ...originalData, userId: 'user-456' };
      const isValid = await verifyHmacSignature(tamperedData, signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong method', async () => {
      const originalData = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(originalData);

      const tamperedData = { ...originalData, method: 'GET' };
      const isValid = await verifyHmacSignature(tamperedData, signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong path', async () => {
      const originalData = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(originalData);

      const tamperedData = { ...originalData, path: '/api/users' };
      const isValid = await verifyHmacSignature(tamperedData, signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong timestamp', async () => {
      const originalData = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(originalData);

      const tamperedData = {
        ...originalData,
        timestamp: originalData.timestamp + 1,
      };
      const isValid = await verifyHmacSignature(tamperedData, signature);

      expect(isValid).toBe(false);
    });

    it('should reject completely invalid signature', async () => {
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const isValid = await verifyHmacSignature(data, 'invalid-signature');

      expect(isValid).toBe(false);
    });

    it('should reject empty signature', async () => {
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const isValid = await verifyHmacSignature(data, '');

      expect(isValid).toBe(false);
    });
  });

  describe('timestamp validation', () => {
    it('should reject signature with timestamp too old (>120 seconds)', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 200; // 200 seconds ago
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: oldTimestamp,
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with timestamp just over 120 seconds old', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 121; // 121 seconds ago
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: oldTimestamp,
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(false);
    });

    it('should reject signature with timestamp too far in future (>120 seconds)', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 200; // 200 seconds in future
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: futureTimestamp,
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(false);
    });

    it('should accept signature with timestamp exactly at 120 second boundary', async () => {
      const boundaryTimestamp = Math.floor(Date.now() / 1000) - 120; // Exactly 120 seconds ago
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: boundaryTimestamp,
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(true); // Should be true because condition is age > 120, so 120 is valid
    });

    it('should accept signature with timestamp just under 120 seconds old', async () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - 119; // 119 seconds ago
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: recentTimestamp,
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw when HMAC secret is missing', async () => {
      mockGetHmacSecret.mockReturnValue(undefined);

      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      await expect(verifyHmacSignature(data, 'some-signature')).rejects.toThrow(
        'INTERNAL_HEADER_SECRET environment variable is required'
      );
    });

    it('should handle malformed base64 signatures gracefully', async () => {
      const data = {
        userId: 'user-123',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const malformedSignatures = [
        'not-base64-!!!',
        '###invalid###',
        'a'.repeat(1000), // Too long
      ];

      for (const malformedSignature of malformedSignatures) {
        const isValid = await verifyHmacSignature(data, malformedSignature);
        expect(isValid).toBe(false);
      }
    });
  });

  describe('special characters handling', () => {
    it('should handle special characters in userId', async () => {
      const data = {
        userId: 'user-with-special@chars.com',
        method: 'POST',
        path: '/api/chat',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(true);
    });

    it('should handle special characters in paths', async () => {
      const data = {
        userId: 'user-123',
        method: 'GET',
        path: '/api/chat/thread-with-special_chars-123',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(true);
    });

    it('should handle URL encoded characters in paths', async () => {
      const data = {
        userId: 'user-123',
        method: 'GET',
        path: '/api/search?query=hello%20world',
        timestamp: Math.floor(Date.now() / 1000),
      };

      const signature = await createHmacSignature(data);
      const isValid = await verifyHmacSignature(data, signature);

      expect(isValid).toBe(true);
    });
  });
});
