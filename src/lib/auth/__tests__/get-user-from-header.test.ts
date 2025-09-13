import { headers } from 'next/headers';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import * as hmacSecretModule from '@/lib/auth/hmac-secret';
import { createHmacSignature } from '@/middleware';

// Mock Next.js headers function and HMAC secret to control test scenarios
jest.mock('next/headers');
jest.mock('../hmac-secret');

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockGetHmacSecret = hmacSecretModule.getHmacSecret as jest.MockedFunction<
  typeof hmacSecretModule.getHmacSecret
>;

/**
 * Test suite for getUserIdFromHeader function with HMAC verification.
 *
 * This function is critical for security as it extracts and verifies user IDs from
 * HMAC-signed internal headers set by the authentication middleware. Tests verify:
 * - Correct HMAC signature verification and header extraction
 * - Proper error handling when headers are missing or invalid
 * - Security behavior (timestamp validation, signature verification)
 * - Protection against replay attacks and header tampering
 */
describe('getUserIdFromHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHmacSecret.mockReturnValue('test-secret-for-header-tests');
  });

  it('should return user ID when valid HMAC-signed headers are present', async () => {
    const userId = 'user-123';
    const method = 'POST';
    const path = '/api/chat';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await createHmacSignature(
      userId,
      method,
      path,
      timestamp
    );

    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-internal-user') return userId;
        if (key === 'x-internal-ts') return timestamp.toString();
        if (key === 'x-internal-sig') return signature;
        if (key === 'x-internal-method') return method;
        if (key === 'x-internal-path') return path;
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    const result = await getUserIdFromHeader();

    expect(result).toBe(userId);
  });

  it('should throw error when internal headers are missing', async () => {
    const mockHeadersList = {
      get: jest.fn().mockReturnValue(null),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Missing required internal headers. Authentication required.'
    );
  });

  it('should throw error when timestamp is invalid', async () => {
    const userId = 'user-123';
    const signature = 'valid-signature';

    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-internal-user') return userId;
        if (key === 'x-internal-ts') return 'not-a-number';
        if (key === 'x-internal-sig') return signature;
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Invalid timestamp in internal headers.'
    );
  });

  it('should throw error when timestamp is too old', async () => {
    const userId = 'user-123';
    const method = 'POST';
    const path = '/api/chat';
    // Create timestamp that exceeds MAX_TIMESTAMP_AGE (120 seconds)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
    const signature = await createHmacSignature(
      userId,
      method,
      path,
      oldTimestamp
    );

    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-internal-user') return userId;
        if (key === 'x-internal-ts') return oldTimestamp.toString();
        if (key === 'x-internal-sig') return signature;
        if (key === 'x-internal-method') return method;
        if (key === 'x-internal-path') return path;
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Request timestamp too old:'
    );
  });

  it('should throw error when HMAC signature is invalid', async () => {
    const userId = 'user-123';
    const method = 'POST';
    const path = '/api/chat';
    const timestamp = Math.floor(Date.now() / 1000);
    // Use obviously invalid signature to test tamper detection
    const invalidSignature = 'invalid-signature';

    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-internal-user') return userId;
        if (key === 'x-internal-ts') return timestamp.toString();
        if (key === 'x-internal-sig') return invalidSignature;
        if (key === 'x-internal-method') return method;
        if (key === 'x-internal-path') return path;
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Invalid HMAC signature. Headers may have been tampered with.'
    );
  });

  it('should throw error when method or path headers are missing', async () => {
    const userId = 'user-123';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = 'some-signature';

    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-internal-user') return userId;
        if (key === 'x-internal-ts') return timestamp.toString();
        if (key === 'x-internal-sig') return signature;
        // Missing x-request-method and x-request-path
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Missing request method or path headers.'
    );
  });

  it('should handle different user ID formats with valid signatures', async () => {
    // Test various user ID formats to ensure HMAC works with different identifier types
    const testCases = [
      'uuid-550e8400-e29b-41d4-a716-446655440001', // UUID format
      '12345', // Numeric ID
      'user_with_underscore', // Underscore separator
      'user-with-dash', // Dash separator
    ];

    for (const userId of testCases) {
      const method = 'GET';
      const path = '/api/test';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await createHmacSignature(
        userId,
        method,
        path,
        timestamp
      );

      const mockHeadersList = {
        get: jest.fn((key: string) => {
          if (key === 'x-internal-user') return userId;
          if (key === 'x-internal-ts') return timestamp.toString();
          if (key === 'x-internal-sig') return signature;
          if (key === 'x-internal-method') return method;
          if (key === 'x-internal-path') return path;
          return null;
        }),
      };
      mockHeaders.mockResolvedValue(
        mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
      );

      const result = await getUserIdFromHeader();

      expect(result).toBe(userId);
    }
  });

  it('should throw error when HMAC secret is missing', async () => {
    mockGetHmacSecret.mockReturnValue(undefined);

    const userId = 'user-123';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = 'some-signature';

    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-internal-user') return userId;
        if (key === 'x-internal-ts') return timestamp.toString();
        if (key === 'x-internal-sig') return signature;
        if (key === 'x-internal-method') return 'GET';
        if (key === 'x-internal-path') return '/';
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'INTERNAL_HEADER_SECRET environment variable is required'
    );
  });

  it('should handle headers() promise rejection', async () => {
    const error = new Error('Headers not available');
    mockHeaders.mockRejectedValue(error);

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Headers not available'
    );
  });
});
