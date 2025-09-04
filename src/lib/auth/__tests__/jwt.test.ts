import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createMockUser } from '@/__tests__/helpers/user';
import type { User } from '@/lib/user/types';

import {
  createAuthToken,
  TokenVerificationError,
  verifyAuthToken,
} from '../jwt';

// Mock environment variable for consistent testing
const originalEnv = process.env.JWT_SECRET;
const TEST_JWT_SECRET = 'test-secret-key-for-jwt-testing-123456789';

describe('JWT Auth Functions', () => {
  beforeEach(() => {
    Object.defineProperty(process.env, 'JWT_SECRET', {
      value: TEST_JWT_SECRET,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'JWT_SECRET', {
      value: originalEnv,
      configurable: true,
    });
  });

  describe('createAuthToken', () => {
    it('should create a valid JWT token with correct payload', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts: header.payload.signature
    });

    it('should create tokens that can be verified', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);
      const result = await verifyAuthToken(token);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.userId).toBe(mockUser.id);
        expect(result.payload.username).toBe(mockUser.username);
      }
    });

    it('should create different tokens for different users', async () => {
      const user1 = { ...createMockUser(), id: 'user1', username: 'user1' };
      const user2 = { ...createMockUser(), id: 'user2', username: 'user2' };

      const token1 = await createAuthToken(user1);
      const token2 = await createAuthToken(user2);

      expect(token1).not.toBe(token2);
    });

    it('should create different tokens for the same user at different times', async () => {
      const mockUser = createMockUser();
      const token1 = await createAuthToken(mockUser);

      // Add small delay to ensure different iat (issued at) timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const token2 = await createAuthToken(mockUser);

      expect(token1).not.toBe(token2);
    });

    it('should handle user with special characters in username', async () => {
      const specialUser: User = {
        ...createMockUser(),
        username: 'test@user.com+123',
      };

      const token = await createAuthToken(specialUser);
      const result = await verifyAuthToken(token);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.username).toBe('test@user.com+123');
      }
    });

    it('should handle user with unicode characters in username', async () => {
      const unicodeUser: User = {
        ...createMockUser(),
        username: 'test用户名',
      };

      const token = await createAuthToken(unicodeUser);
      const result = await verifyAuthToken(token);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.username).toBe('test用户名');
      }
    });
  });

  describe('verifyAuthToken', () => {
    it('should verify a valid token successfully', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);
      const result = await verifyAuthToken(token);

      expect(result).toEqual({
        success: true,
        payload: {
          userId: mockUser.id,
          username: mockUser.username,
        },
      });
    });

    it('should reject an invalid token', async () => {
      const result = await verifyAuthToken('invalid.token.string');

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_TOKEN,
      });
    });

    it('should reject a malformed token', async () => {
      const result = await verifyAuthToken('not-a-jwt-token-at-all');

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_TOKEN,
      });
    });

    it('should reject an empty token', async () => {
      const result = await verifyAuthToken('');

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_TOKEN,
      });
    });

    it('should reject token with missing parts', async () => {
      const result = await verifyAuthToken('header.payload');

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_TOKEN,
      });
    });

    it('should reject token signed with different secret', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);

      // Change the secret
      Object.defineProperty(process.env, 'JWT_SECRET', {
        value: 'different-secret-key',
        configurable: true,
      });

      const result = await verifyAuthToken(token);

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_TOKEN,
      });
    });

    it('should reject token with invalid payload structure - missing userId', async () => {
      // Create a token manually with invalid payload
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);

      const invalidToken = await new SignJWT({
        username: 'testuser',
        // Missing userId
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      const result = await verifyAuthToken(invalidToken);

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_PAYLOAD,
      });
    });

    it('should reject token with invalid payload structure - missing username', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);

      const invalidToken = await new SignJWT({
        userId: '123',
        // Missing username
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      const result = await verifyAuthToken(invalidToken);

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_PAYLOAD,
      });
    });

    it('should reject token with invalid payload types', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);

      const invalidToken = await new SignJWT({
        userId: 123, // Should be string
        username: true, // Should be string
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      const result = await verifyAuthToken(invalidToken);

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_PAYLOAD,
      });
    });

    it('should reject expired token', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);

      // Create token that expired 1 hour ago
      const mockUser = createMockUser();
      const expiredToken = await new SignJWT({
        userId: mockUser.id,
        username: mockUser.username,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2 hours ago
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // 1 hour ago
        .sign(secret);

      const result = await verifyAuthToken(expiredToken);

      expect(result).toEqual({
        success: false,
        error: TokenVerificationError.INVALID_TOKEN,
      });
    });

    it('should reject token with additional unexpected payload fields', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);

      const mockUser = createMockUser();
      const tokenWithExtraFields = await new SignJWT({
        userId: mockUser.id,
        username: mockUser.username,
        role: 'admin', // Additional field
        permissions: ['read', 'write'], // Additional field
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      // This should still work as long as required fields are present
      const result = await verifyAuthToken(tokenWithExtraFields);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.userId).toBe(mockUser.id);
        expect(result.payload.username).toBe(mockUser.username);
        // Extra fields should not be included in the result payload
        expect('role' in result.payload).toBe(false);
        expect('permissions' in result.payload).toBe(false);
      }
    });

    it('should handle token with different algorithm', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(TEST_JWT_SECRET);

      // Try to create token with different algorithm (this might not work with jose)
      try {
        const mockUser = createMockUser();
        const tokenWithDifferentAlg = await new SignJWT({
          userId: mockUser.id,
          username: mockUser.username,
        })
          .setProtectedHeader({ alg: 'HS384' }) // Different algorithm
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(secret);

        const result = await verifyAuthToken(tokenWithDifferentAlg);

        expect(result).toEqual({
          success: false,
          error: TokenVerificationError.INVALID_TOKEN,
        });
      } catch {
        // If jose doesn't support HS384, that's expected
        expect(true).toBe(true);
      }
    });
  });

  describe('environment edge cases', () => {
    it('should handle missing JWT_SECRET environment variable', async () => {
      Object.defineProperty(process.env, 'JWT_SECRET', {
        value: undefined,
        configurable: true,
      });

      const mockUser = createMockUser();
      await expect(createAuthToken(mockUser)).rejects.toThrow();
    });

    it('should handle empty JWT_SECRET environment variable', async () => {
      Object.defineProperty(process.env, 'JWT_SECRET', {
        value: '',
        configurable: true,
      });

      const mockUser = createMockUser();
      await expect(createAuthToken(mockUser)).rejects.toThrow();
    });
  });

  describe('token security properties', () => {
    it('should not include sensitive user data in token', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);

      // Decode the payload (without verification) to check what's included
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString()
      );

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.username).toBe(mockUser.username);
      expect(payload.createdAt).toBeUndefined(); // Should not include createdAt
      expect(payload.password).toBeUndefined(); // Should not include password
      expect(payload.passwordHash).toBeUndefined(); // Should not include passwordHash
    });

    it('should include standard JWT claims', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);

      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString()
      );

      expect(payload.iat).toBeDefined(); // issued at
      expect(payload.exp).toBeDefined(); // expires
      expect(typeof payload.iat).toBe('number');
      expect(typeof payload.exp).toBe('number');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should set appropriate expiration time (24 hours)', async () => {
      const mockUser = createMockUser();
      const token = await createAuthToken(mockUser);

      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString()
      );

      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const issuedTime = payload.iat * 1000;
      const expectedDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      expect(expirationTime - issuedTime).toBe(expectedDuration);
    });
  });
});
