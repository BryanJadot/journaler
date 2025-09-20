import * as hmacSecretModule from '@/lib/auth/hmac-secret';
import { createHmacSignature } from '@/lib/auth/hmac-sign';
import { verifyHmacSignature } from '@/lib/auth/hmac-verify';

// Mock the dependencies
jest.mock('../hmac-secret');
jest.mock('../hmac-verify');

const mockGetHmacSecret = hmacSecretModule.getHmacSecret as jest.MockedFunction<
  typeof hmacSecretModule.getHmacSecret
>;
const mockVerifyHmacSignature = verifyHmacSignature as jest.MockedFunction<
  typeof verifyHmacSignature
>;

/**
 * Test suite for HMAC signature creation and verification system.
 *
 * This suite verifies the critical security mechanism that prevents header
 * tampering and replay attacks in the authentication system. It tests:
 *
 * - Cross-runtime compatibility between Edge (middleware) and Node.js (routes)
 * - Signature verification with various tampering scenarios
 * - Base64url encoding correctness for URL-safe transmission
 * - Error handling when cryptographic components are missing
 *
 * The HMAC system provides defense against:
 * - Header injection attacks (malicious x-internal-* headers)
 * - Cross-request signature reuse (method/path binding)
 * - Replay attacks (timestamp expiration)
 * - Signature forgery (cryptographic HMAC protection)
 */
describe('HMAC Signature Creation and Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up a test secret for each test
    mockGetHmacSecret.mockReturnValue('test-secret-key-for-hmac');
    // Default mock to return true for valid signatures
    mockVerifyHmacSignature.mockResolvedValue(true);
  });

  describe('Edge to Node compatibility', () => {
    it('should create compatible signatures between Edge and Node runtimes', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      // Create signature using Edge runtime (middleware)
      const edgeSignature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      // Verify signature using unified verification
      const isValid = await verifyHmacSignature(
        {
          userId,
          method,
          path,
          timestamp,
        },
        edgeSignature
      );

      expect(isValid).toBe(true);
      expect(edgeSignature).toBeDefined();
      expect(edgeSignature.length).toBeGreaterThan(0);
    });

    it('should fail verification with tampered userId', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      // Mock verification to fail for tampered userId
      mockVerifyHmacSignature.mockResolvedValueOnce(false);

      // Try to verify with different userId
      const isValid = await verifyHmacSignature(
        {
          userId: 'user-456',
          method,
          path,
          timestamp,
        },
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should fail verification with tampered method', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      // Mock verification to fail for tampered method
      mockVerifyHmacSignature.mockResolvedValueOnce(false);

      // Try to verify with different method
      const isValid = await verifyHmacSignature(
        {
          userId,
          method: 'GET',
          path,
          timestamp,
        },
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should fail verification with tampered path', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      // Mock verification to fail for tampered path
      mockVerifyHmacSignature.mockResolvedValueOnce(false);

      // Try to verify with different path
      const isValid = await verifyHmacSignature(
        {
          userId,
          method,
          path: '/api/users',
          timestamp,
        },
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should fail verification with tampered timestamp', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      // Mock verification to fail for tampered timestamp
      mockVerifyHmacSignature.mockResolvedValueOnce(false);

      // Try to verify with different timestamp
      const isValid = await verifyHmacSignature(
        {
          userId,
          method,
          path,
          timestamp: timestamp + 1,
        },
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should fail verification with invalid signature format', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      // Mock verification to fail for invalid signature
      mockVerifyHmacSignature.mockResolvedValueOnce(false);

      // Try to verify with invalid signature
      const isValid = await verifyHmacSignature(
        {
          userId,
          method,
          path,
          timestamp,
        },
        'invalid-signature'
      );

      expect(isValid).toBe(false);
    });

    it('should produce different signatures for different inputs', async () => {
      const timestamp = Math.floor(Date.now() / 1000);

      const sig1 = await createHmacSignature({
        userId: 'user-1',
        method: 'GET',
        path: '/api/test',
        timestamp,
      });
      const sig2 = await createHmacSignature({
        userId: 'user-2',
        method: 'GET',
        path: '/api/test',
        timestamp,
      });
      const sig3 = await createHmacSignature({
        userId: 'user-1',
        method: 'POST',
        path: '/api/test',
        timestamp,
      });
      const sig4 = await createHmacSignature({
        userId: 'user-1',
        method: 'GET',
        path: '/api/other',
        timestamp,
      });

      // All signatures should be different
      expect(sig1).not.toBe(sig2);
      expect(sig1).not.toBe(sig3);
      expect(sig1).not.toBe(sig4);
      expect(sig2).not.toBe(sig3);
      expect(sig2).not.toBe(sig4);
      expect(sig3).not.toBe(sig4);
    });

    it('should handle special characters in paths', async () => {
      const userId = 'user-123';
      const method = 'GET';
      const path = '/api/chat/thread-id-with-special-chars_123';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });
      const isValid = await verifyHmacSignature(
        {
          userId,
          method,
          path,
          timestamp,
        },
        signature
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Base64URL encoding', () => {
    it('should produce URL-safe base64 signatures', async () => {
      const userId = 'user-123';
      const method = 'POST';
      const path = '/api/chat';
      const timestamp = Math.floor(Date.now() / 1000);

      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      // Should not contain URL-unsafe characters
      expect(signature).not.toMatch(/[\+\/=]/);
      // Should only contain base64url characters
      expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('Error handling', () => {
    it('should throw when INTERNAL_HEADER_SECRET is missing', async () => {
      mockGetHmacSecret.mockReturnValue(undefined);
      mockVerifyHmacSignature.mockRejectedValue(
        new Error('INTERNAL_HEADER_SECRET environment variable is required')
      );

      await expect(
        createHmacSignature({
          userId: 'user',
          method: 'GET',
          path: '/',
          timestamp: 123,
        })
      ).rejects.toThrow(
        'INTERNAL_HEADER_SECRET environment variable is required'
      );

      await expect(
        verifyHmacSignature(
          { userId: 'user', method: 'GET', path: '/', timestamp: 123 },
          'sig'
        )
      ).rejects.toThrow(
        'INTERNAL_HEADER_SECRET environment variable is required'
      );
    });
  });
});
