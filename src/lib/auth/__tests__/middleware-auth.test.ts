import { NextRequest } from 'next/server';

import { silenceConsoleWarnings } from '@/__tests__/helpers/console-helpers';
import * as cookiesModule from '@/lib/auth/cookies';
import { extractHmacHeaders } from '@/lib/auth/hmac-headers';
import * as hmacSecretModule from '@/lib/auth/hmac-secret';
import { verifyHmacSignature } from '@/lib/auth/hmac-verify';
import * as jwtModule from '@/lib/auth/jwt';
import {
  authenticateRequest,
  setInternalHeaders,
} from '@/lib/auth/middleware-auth';

// Mock all dependencies
jest.mock('../cookies');
jest.mock('../hmac-secret');
jest.mock('../hmac-verify');
jest.mock('../jwt');

const mockGetAuthToken = cookiesModule.getAuthToken as jest.MockedFunction<
  typeof cookiesModule.getAuthToken
>;
const mockGetHmacSecret = hmacSecretModule.getHmacSecret as jest.MockedFunction<
  typeof hmacSecretModule.getHmacSecret
>;
const mockVerifyHmacSignature = verifyHmacSignature as jest.MockedFunction<
  typeof verifyHmacSignature
>;
const mockVerifyAuthToken = jwtModule.verifyAuthToken as jest.MockedFunction<
  typeof jwtModule.verifyAuthToken
>;

/**
 * Test suite for middleware authentication functions.
 *
 * This suite tests the core authentication logic used by the middleware
 * to handle both service-to-service and user session authentication.
 */
describe('Middleware Authentication', () => {
  silenceConsoleWarnings();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHmacSecret.mockReturnValue('test-secret-key');
  });

  describe('authenticateRequest', () => {
    function createMockRequest(headers: Record<string, string> = {}) {
      const request = {
        headers: new Headers(headers),
        nextUrl: { pathname: '/api/test' },
        method: 'POST',
      } as NextRequest;
      return request;
    }

    describe('service-to-service authentication', () => {
      it('should authenticate valid service request', async () => {
        const headers = {
          'x-service-user': 'service-user-123',
          'x-service-method': 'POST',
          'x-service-path': '/api/test',
          'x-service-ts': Math.floor(Date.now() / 1000).toString(),
          'x-service-sig': 'valid-signature',
        };

        const request = createMockRequest(headers);
        mockVerifyHmacSignature.mockResolvedValue(true);

        const result = await authenticateRequest(request);

        expect(result).toEqual({
          userId: 'service-user-123',
          authMethod: 'service',
        });
        expect(mockVerifyHmacSignature).toHaveBeenCalledWith(
          {
            userId: 'service-user-123',
            method: 'POST',
            path: '/api/test',
            timestamp: parseInt(headers['x-service-ts']),
          },
          'valid-signature'
        );
      });

      it('should reject invalid service signature', async () => {
        const headers = {
          'x-service-user': 'service-user-123',
          'x-service-method': 'POST',
          'x-service-path': '/api/test',
          'x-service-ts': Math.floor(Date.now() / 1000).toString(),
          'x-service-sig': 'invalid-signature',
        };

        const request = createMockRequest(headers);
        mockVerifyHmacSignature.mockResolvedValue(false);
        mockGetAuthToken.mockResolvedValue('user-jwt-token');
        mockVerifyAuthToken.mockResolvedValue({
          success: true,
          payload: { userId: 'user-123', username: 'testuser' },
        });

        const result = await authenticateRequest(request);

        // Should fall back to user session auth
        expect(result).toEqual({
          userId: 'user-123',
          authMethod: 'user-session',
        });
      });

      it('should handle incomplete service headers', async () => {
        const headers = {
          'x-service-user': 'service-user-123',
          // Missing other required headers
        };

        const request = createMockRequest(headers);
        mockGetAuthToken.mockResolvedValue('user-jwt-token');
        mockVerifyAuthToken.mockResolvedValue({
          success: true,
          payload: { userId: 'user-123', username: 'testuser' },
        });

        const result = await authenticateRequest(request);

        // Should fall back to user session auth since service headers are incomplete
        expect(result).toEqual({
          userId: 'user-123',
          authMethod: 'user-session',
        });
        expect(mockVerifyHmacSignature).not.toHaveBeenCalled();
      });
    });

    describe('user session authentication', () => {
      it('should authenticate valid user session', async () => {
        const request = createMockRequest();
        mockGetAuthToken.mockResolvedValue('valid-jwt-token');
        mockVerifyAuthToken.mockResolvedValue({
          success: true,
          payload: { userId: 'user-123', username: 'testuser' },
        });

        const result = await authenticateRequest(request);

        expect(result).toEqual({
          userId: 'user-123',
          authMethod: 'user-session',
        });
        expect(mockGetAuthToken).toHaveBeenCalled();
        expect(mockVerifyAuthToken).toHaveBeenCalledWith('valid-jwt-token');
      });

      it('should reject invalid JWT token', async () => {
        const request = createMockRequest();
        mockGetAuthToken.mockResolvedValue('invalid-jwt-token');
        mockVerifyAuthToken.mockResolvedValue({
          success: false,
          error: 'invalid-token',
        });

        const result = await authenticateRequest(request);

        expect(result).toBeNull();
      });

      it('should handle missing JWT token', async () => {
        const request = createMockRequest();
        mockGetAuthToken.mockResolvedValue(undefined);

        const result = await authenticateRequest(request);

        expect(result).toBeNull();
        expect(mockVerifyAuthToken).not.toHaveBeenCalled();
      });
    });

    describe('authentication priority', () => {
      it('should prefer service auth over user session when both are present', async () => {
        const headers = {
          'x-service-user': 'service-user-123',
          'x-service-method': 'POST',
          'x-service-path': '/api/test',
          'x-service-ts': Math.floor(Date.now() / 1000).toString(),
          'x-service-sig': 'valid-signature',
        };

        const request = createMockRequest(headers);
        mockVerifyHmacSignature.mockResolvedValue(true);
        mockGetAuthToken.mockResolvedValue('user-jwt-token');
        mockVerifyAuthToken.mockResolvedValue({
          success: true,
          payload: { userId: 'user-456', username: 'testuser' },
        });

        const result = await authenticateRequest(request);

        // Should use service auth, not user session
        expect(result).toEqual({
          userId: 'service-user-123',
          authMethod: 'service',
        });
        expect(mockGetAuthToken).not.toHaveBeenCalled();
      });
    });
  });

  describe('setInternalHeaders', () => {
    function createMockRequest(pathname = '/api/test', method = 'POST') {
      return {
        nextUrl: { pathname },
        method,
      } as NextRequest;
    }

    it('should set internal headers with correct HMAC signature', async () => {
      const headers = new Headers();
      const authResult = {
        userId: 'user-123',
        authMethod: 'user-session' as const,
      };
      const request = createMockRequest('/api/chat', 'POST');

      await setInternalHeaders(headers, authResult, request);

      expect(headers.get('x-internal-user')).toBe('user-123');
      expect(headers.get('x-internal-method')).toBe('POST');
      expect(headers.get('x-internal-path')).toBe('/api/chat');
      expect(headers.get('x-internal-ts')).toBeTruthy();
      expect(headers.get('x-internal-sig')).toBeTruthy();

      // Verify timestamp is recent (within last few seconds)
      const timestamp = parseInt(headers.get('x-internal-ts')!);
      const now = Math.floor(Date.now() / 1000);
      expect(now - timestamp).toBeLessThan(5);
    });

    it('should work with different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const headers = new Headers();
        const authResult = {
          userId: 'user-123',
          authMethod: 'user-session' as const,
        };
        const request = createMockRequest('/api/test', method);

        await setInternalHeaders(headers, authResult, request);

        expect(headers.get('x-internal-method')).toBe(method);
      }
    });

    it('should work with different paths', async () => {
      const paths = ['/api/chat', '/api/users/123', '/api/threads/create', '/'];

      for (const path of paths) {
        const headers = new Headers();
        const authResult = {
          userId: 'user-123',
          authMethod: 'user-session' as const,
        };
        const request = createMockRequest(path);

        await setInternalHeaders(headers, authResult, request);

        expect(headers.get('x-internal-path')).toBe(path);
      }
    });

    it('should work with service authentication', async () => {
      const headers = new Headers();
      const authResult = {
        userId: 'service-user-456',
        authMethod: 'service' as const,
      };
      const request = createMockRequest('/api/service-call', 'GET');

      await setInternalHeaders(headers, authResult, request);

      expect(headers.get('x-internal-user')).toBe('service-user-456');
      expect(headers.get('x-internal-method')).toBe('GET');
      expect(headers.get('x-internal-path')).toBe('/api/service-call');
    });

    it('should overwrite existing internal headers', async () => {
      const headers = new Headers();
      headers.set('x-internal-user', 'old-user');
      headers.set('x-internal-method', 'OLD-METHOD');

      const authResult = {
        userId: 'new-user',
        authMethod: 'user-session' as const,
      };
      const request = createMockRequest('/api/new', 'POST');

      await setInternalHeaders(headers, authResult, request);

      expect(headers.get('x-internal-user')).toBe('new-user');
      expect(headers.get('x-internal-method')).toBe('POST');
      expect(headers.get('x-internal-path')).toBe('/api/new');
    });

    it('should handle special characters in user ID and path', async () => {
      const headers = new Headers();
      const authResult = {
        userId: 'user@example.com',
        authMethod: 'user-session' as const,
      };
      const request = createMockRequest(
        '/api/chat/thread-with-special_chars-123',
        'GET'
      );

      await setInternalHeaders(headers, authResult, request);

      expect(headers.get('x-internal-user')).toBe('user@example.com');
      expect(headers.get('x-internal-path')).toBe(
        '/api/chat/thread-with-special_chars-123'
      );
    });

    it('should create valid signatures that can be verified', async () => {
      // Reset mocks to use real functions for this integration test
      jest.unmock('../hmac-secret');
      jest.unmock('../hmac-verify');

      const realHmacSecret = jest.requireActual('../hmac-secret');
      const realHmacVerify = jest.requireActual('../hmac-verify');

      mockGetHmacSecret.mockImplementation(realHmacSecret.getHmacSecret);

      const headers = new Headers();
      const authResult = {
        userId: 'user-123',
        authMethod: 'user-session' as const,
      };
      const request = createMockRequest('/api/test', 'POST');

      await setInternalHeaders(headers, authResult, request);

      // Extract the headers and verify the signature
      const extractedHeaders = extractHmacHeaders(headers, 'x-internal');
      expect(extractedHeaders).not.toBeNull();

      if (extractedHeaders) {
        const isValid = await realHmacVerify.verifyHmacSignature(
          {
            userId: extractedHeaders.userId,
            method: extractedHeaders.method,
            path: extractedHeaders.path,
            timestamp: extractedHeaders.timestamp,
          },
          extractedHeaders.signature
        );
        expect(isValid).toBe(true);
      }
    });
  });
});
