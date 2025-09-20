import { NextRequest, NextResponse } from 'next/server';

import { silenceConsoleWarnings } from '@/__tests__/helpers/console-helpers';
import * as cookiesModule from '@/lib/auth/cookies';
import * as hmacSecretModule from '@/lib/auth/hmac-secret';
import { createHmacSignature } from '@/lib/auth/hmac-sign';
import * as jwtModule from '@/lib/auth/jwt';
import { middleware } from '@/middleware';

// Mock auth dependencies to control authentication flow in tests
jest.mock('@/lib/auth/cookies');
jest.mock('@/lib/auth/jwt');
jest.mock('@/lib/auth/hmac-secret');

// Mock NextResponse methods to verify correct response generation
const mockNext = jest.spyOn(NextResponse, 'next');
const mockRedirect = jest.spyOn(NextResponse, 'redirect');

// Create typed mock functions for better test safety and IDE support
const mockGetAuthToken = cookiesModule.getAuthToken as jest.MockedFunction<
  typeof cookiesModule.getAuthToken
>;
const mockVerifyAuthToken = jwtModule.verifyAuthToken as jest.MockedFunction<
  typeof jwtModule.verifyAuthToken
>;
const mockGetHmacSecret = hmacSecretModule.getHmacSecret as jest.MockedFunction<
  typeof hmacSecretModule.getHmacSecret
>;

/**
 * Test suite for Next.js middleware authentication and header security.
 *
 * This middleware handles:
 * - Header security: strips malicious x-user-id headers from incoming requests
 * - Authentication: verifies JWT tokens and sets authenticated user headers
 * - Route protection: redirects unauthenticated users to login page
 * - Public route access: allows certain routes without authentication
 */
describe('middleware', () => {
  silenceConsoleWarnings();

  beforeEach(() => {
    // Clear all mock call history and reset mock implementations
    jest.clearAllMocks();
    mockNext.mockClear();
    mockRedirect.mockClear();

    // Set up HMAC secret for tests
    mockGetHmacSecret.mockReturnValue('test-secret-for-middleware-tests');
  });

  describe('header security', () => {
    /**
     * Critical security test: verifies prevention of header injection attacks.
     *
     * Attackers might try to inject malicious x-internal-* headers to bypass
     * authentication or impersonate other users. This test ensures the middleware
     * strips ALL x-internal-* headers from incoming requests before processing.
     */
    it('should strip x-internal-* headers from incoming requests on public routes', async () => {
      const request = new NextRequest('http://localhost/login', {
        headers: {
          'x-internal-user': 'malicious-user-id', // Simulated attack: fake user ID
          'x-internal-sig': 'malicious-signature', // Simulated attack: fake signature
          'x-internal-ts': '123456789', // Simulated attack: fake timestamp
          'x-internal-method': 'malicious-method', // Simulated attack: fake method
          'x-internal-path': 'malicious-path', // Simulated attack: fake path
          'other-header': 'should-remain', // Legitimate header should be preserved
        },
      });

      await middleware(request);

      // Verify NextResponse.next was called with sanitized headers
      expect(mockNext).toHaveBeenCalledWith({
        request: {
          headers: expect.any(Headers),
        },
      });

      const callArgs = mockNext.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.request).toBeDefined();
      const headers = callArgs!.request!.headers;
      expect(headers).toBeDefined();

      // Critical security verification: all x-internal-* headers must be removed
      expect(headers!.get('x-internal-user')).toBeNull();
      expect(headers!.get('x-internal-sig')).toBeNull();
      expect(headers!.get('x-internal-ts')).toBeNull();
      expect(headers!.get('x-internal-method')).toBeNull();
      expect(headers!.get('x-internal-path')).toBeNull();
      // Verify legitimate headers remain untouched
      expect(headers!.get('other-header')).toBe('should-remain');
    });

    it('should strip all x-service-* headers from incoming requests', async () => {
      const request = new NextRequest('http://localhost/login', {
        headers: {
          'x-service-user': 'malicious-service-user',
          'x-service-sig': 'malicious-service-signature',
          'x-service-ts': '123456789',
          'x-service-method': 'malicious-method',
          'x-service-path': 'malicious-path',
          'content-type': 'application/json',
        },
      });

      await middleware(request);

      const callArgs = mockNext.mock.calls[0]?.[0];
      const headers = callArgs!.request!.headers;

      // All x-service-* headers must be stripped
      expect(headers!.get('x-service-user')).toBeNull();
      expect(headers!.get('x-service-sig')).toBeNull();
      expect(headers!.get('x-service-ts')).toBeNull();
      expect(headers!.get('x-service-method')).toBeNull();
      expect(headers!.get('x-service-path')).toBeNull();
      // Legitimate headers should remain
      expect(headers!.get('content-type')).toBe('application/json');
    });

    it('should strip malicious x-internal-* headers and set HMAC-signed headers on protected routes', async () => {
      const userId = 'authenticated-user-123';
      mockGetAuthToken.mockResolvedValue('valid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId, username: 'testuser' },
      });

      const request = new NextRequest('http://localhost/journal/chat/123', {
        headers: {
          'x-internal-user': 'malicious-user-id',
          'x-internal-sig': 'malicious-signature',
          authorization: 'Bearer valid-token',
        },
      });

      await middleware(request);

      // Verify NextResponse.next was called with properly modified headers
      expect(mockNext).toHaveBeenCalledWith({
        request: {
          headers: expect.any(Headers),
        },
      });

      const callArgs = mockNext.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.request).toBeDefined();
      const headers = callArgs!.request!.headers;
      expect(headers).toBeDefined();

      // Verify the authenticated user's internal headers are set with HMAC protection
      expect(headers!.get('x-internal-user')).toBe(userId);
      expect(headers!.get('x-internal-ts')).toBeDefined();
      expect(headers!.get('x-internal-sig')).toBeDefined();
      expect(headers!.get('x-internal-method')).toBe('GET');
      expect(headers!.get('x-internal-path')).toBe('/journal/chat/123');
      // Verify other headers remain
      expect(headers!.get('authorization')).toBe('Bearer valid-token');
    });
  });

  describe('public routes', () => {
    it('should allow access to /login without authentication', async () => {
      const request = new NextRequest('http://localhost/login');

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(mockGetAuthToken).not.toHaveBeenCalled();
      expect(mockVerifyAuthToken).not.toHaveBeenCalled();
    });

    it('should allow access to /signup without authentication', async () => {
      const request = new NextRequest('http://localhost/signup');

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(mockGetAuthToken).not.toHaveBeenCalled();
      expect(mockVerifyAuthToken).not.toHaveBeenCalled();
    });
  });

  describe('homepage (/) special behavior', () => {
    it('should redirect to /login when no token is present', async () => {
      mockGetAuthToken.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
      expect(mockGetAuthToken).toHaveBeenCalled();
    });

    it('should redirect to /login when token is invalid', async () => {
      mockGetAuthToken.mockResolvedValue('invalid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: false,
        error: 'invalid-token',
      });

      const request = new NextRequest('http://localhost/');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
      expect(mockVerifyAuthToken).toHaveBeenCalled();
    });

    it('should pass through with user header when authenticated', async () => {
      const userId = 'user-123';
      mockGetAuthToken.mockResolvedValue('valid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId, username: 'testuser' },
      });

      const request = new NextRequest('http://localhost/');

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(mockGetAuthToken).toHaveBeenCalled();
      expect(mockVerifyAuthToken).toHaveBeenCalled();

      // Verify NextResponse.next was called with the authenticated user's ID
      expect(mockNext).toHaveBeenCalledWith({
        request: {
          headers: expect.any(Headers),
        },
      });

      const callArgs = mockNext.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.request).toBeDefined();
      const headers = callArgs!.request!.headers;
      expect(headers).toBeDefined();

      // Verify the authenticated user's internal headers are set with HMAC protection
      expect(headers!.get('x-internal-user')).toBe(userId);
      expect(headers!.get('x-internal-ts')).toBeDefined();
      expect(headers!.get('x-internal-sig')).toBeDefined();
    });
  });

  describe('protected routes', () => {
    it('should redirect to /login when no token is present', async () => {
      mockGetAuthToken.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/journal/chat/123');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('should redirect to /login when token is invalid', async () => {
      mockGetAuthToken.mockResolvedValue('invalid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: false,
        error: 'invalid-token',
      });

      const request = new NextRequest('http://localhost/journal/chat/123');

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('should pass through when token is valid', async () => {
      const userId = 'user-123';
      mockGetAuthToken.mockResolvedValue('valid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId, username: 'testuser' },
      });

      const request = new NextRequest('http://localhost/journal/chat/123');

      const response = await middleware(request);

      // NextResponse.next() returns a response that passes through
      expect(response).toBeDefined();
      expect(mockVerifyAuthToken).toHaveBeenCalled();

      // Verify NextResponse.next was called with the authenticated user's ID
      expect(mockNext).toHaveBeenCalledWith({
        request: {
          headers: expect.any(Headers),
        },
      });

      const callArgs = mockNext.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.request).toBeDefined();
      const headers = callArgs!.request!.headers;
      expect(headers).toBeDefined();

      // Verify the authenticated user's internal headers are set with HMAC protection
      expect(headers!.get('x-internal-user')).toBe(userId);
      expect(headers!.get('x-internal-ts')).toBeDefined();
      expect(headers!.get('x-internal-sig')).toBeDefined();
    });

    it('should handle protected API routes', async () => {
      const userId = 'user-456';
      mockGetAuthToken.mockResolvedValue('valid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId, username: 'apiuser' },
      });

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
      });

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(mockVerifyAuthToken).toHaveBeenCalled();

      // Verify NextResponse.next was called with the authenticated user's ID
      expect(mockNext).toHaveBeenCalledWith({
        request: {
          headers: expect.any(Headers),
        },
      });

      const callArgs = mockNext.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();
      expect(callArgs?.request).toBeDefined();
      const headers = callArgs!.request!.headers;
      expect(headers).toBeDefined();

      // Verify the authenticated user's internal headers are set with HMAC protection
      expect(headers!.get('x-internal-user')).toBe(userId);
      expect(headers!.get('x-internal-ts')).toBeDefined();
      expect(headers!.get('x-internal-sig')).toBeDefined();
    });

    it('should redirect unauthenticated API requests to login', async () => {
      mockGetAuthToken.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
      expect(mockGetAuthToken).toHaveBeenCalled();
    });

    it('should redirect API requests with invalid tokens to login', async () => {
      mockGetAuthToken.mockResolvedValue('invalid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: false,
        error: 'invalid-token',
      });

      const request = new NextRequest('http://localhost/api/users/profile', {
        method: 'GET',
      });

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
      expect(mockVerifyAuthToken).toHaveBeenCalled();
    });
  });

  describe('service-to-service authentication', () => {
    async function createValidServiceHeaders(
      userId: string,
      method: string,
      path: string
    ) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await createHmacSignature({
        userId,
        method,
        path,
        timestamp,
      });

      return {
        'x-service-user': userId,
        'x-service-method': method,
        'x-service-path': path,
        'x-service-ts': timestamp.toString(),
        'x-service-sig': signature,
      };
    }

    it('should authenticate valid service-to-service requests', async () => {
      const serviceUserId = 'service-user-123';
      const method = 'POST';
      const path = '/api/chat';

      const headers = await createValidServiceHeaders(
        serviceUserId,
        method,
        path
      );
      const request = new NextRequest(`http://localhost${path}`, {
        method,
        headers,
      });

      const response = await middleware(request);

      expect(response).toBeDefined();
      expect(mockGetAuthToken).not.toHaveBeenCalled(); // Service auth should skip JWT check

      // Verify NextResponse.next was called with internal headers
      expect(mockNext).toHaveBeenCalledWith({
        request: {
          headers: expect.any(Headers),
        },
      });

      const callArgs = mockNext.mock.calls[0]?.[0];
      const responseHeaders = callArgs!.request!.headers;

      // Service headers should be stripped and replaced with internal headers
      expect(responseHeaders!.get('x-service-user')).toBeNull();
      expect(responseHeaders!.get('x-service-sig')).toBeNull();
      expect(responseHeaders!.get('x-service-ts')).toBeNull();
      expect(responseHeaders!.get('x-service-method')).toBeNull();
      expect(responseHeaders!.get('x-service-path')).toBeNull();

      // Should have internal headers for the service user
      expect(responseHeaders!.get('x-internal-user')).toBe(serviceUserId);
      expect(responseHeaders!.get('x-internal-method')).toBe(method);
      expect(responseHeaders!.get('x-internal-path')).toBe(path);
      expect(responseHeaders!.get('x-internal-ts')).toBeDefined();
      expect(responseHeaders!.get('x-internal-sig')).toBeDefined();
    });

    it('should fallback to user session auth when service auth fails', async () => {
      const userId = 'user-123';
      const invalidHeaders = {
        'x-service-user': 'service-user',
        'x-service-method': 'POST',
        'x-service-path': '/api/chat',
        'x-service-ts': '123456789',
        'x-service-sig': 'invalid-signature',
      };

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: invalidHeaders,
      });

      // Mock user session auth success
      mockGetAuthToken.mockResolvedValue('valid-user-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId, username: 'testuser' },
      });

      const response = await middleware(request);

      expect(response).toBeDefined();
      // Should have fallen back to user session auth
      expect(mockGetAuthToken).toHaveBeenCalled();
      expect(mockVerifyAuthToken).toHaveBeenCalled();

      const callArgs = mockNext.mock.calls[0]?.[0];
      const responseHeaders = callArgs!.request!.headers;

      // Should have internal headers for the user (not service user)
      expect(responseHeaders!.get('x-internal-user')).toBe(userId);
    });

    it('should reject service requests with invalid signature', async () => {
      const invalidHeaders = {
        'x-service-user': 'service-user',
        'x-service-method': 'POST',
        'x-service-path': '/api/chat',
        'x-service-ts': Math.floor(Date.now() / 1000).toString(),
        'x-service-sig': 'completely-invalid-signature',
      };

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: invalidHeaders,
      });

      // No user session fallback
      mockGetAuthToken.mockResolvedValue(undefined);

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('should reject service requests with missing headers', async () => {
      const incompleteHeaders = {
        'x-service-user': 'service-user',
        'x-service-method': 'POST',
        // Missing x-service-path, x-service-ts, x-service-sig
      };

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        headers: incompleteHeaders,
      });

      // No user session fallback
      mockGetAuthToken.mockResolvedValue(undefined);

      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/login');
    });

    it('should handle service auth on different HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        jest.clearAllMocks();

        const serviceUserId = 'service-user-456';
        const path = '/api/test';
        const headers = await createValidServiceHeaders(
          serviceUserId,
          method,
          path
        );

        const request = new NextRequest(`http://localhost${path}`, {
          method,
          headers,
        });

        const response = await middleware(request);

        expect(response).toBeDefined();
        expect(mockGetAuthToken).not.toHaveBeenCalled();

        const callArgs = mockNext.mock.calls[0]?.[0];
        const responseHeaders = callArgs!.request!.headers;

        expect(responseHeaders!.get('x-internal-user')).toBe(serviceUserId);
        expect(responseHeaders!.get('x-internal-method')).toBe(method);
        expect(responseHeaders!.get('x-internal-path')).toBe(path);
      }
    });

    it('should prioritize service auth over user session when both are present', async () => {
      const serviceUserId = 'service-user-123';
      const userUserId = 'user-456';
      const method = 'POST';
      const path = '/api/chat';

      const headers = await createValidServiceHeaders(
        serviceUserId,
        method,
        path
      );

      const request = new NextRequest(`http://localhost${path}`, {
        method,
        headers,
      });

      // Setup user session auth that would also succeed
      mockGetAuthToken.mockResolvedValue('valid-user-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId: userUserId, username: 'testuser' },
      });

      const response = await middleware(request);

      expect(response).toBeDefined();
      // Service auth should take priority - user auth shouldn't be called
      expect(mockGetAuthToken).not.toHaveBeenCalled();
      expect(mockVerifyAuthToken).not.toHaveBeenCalled();

      const callArgs = mockNext.mock.calls[0]?.[0];
      const responseHeaders = callArgs!.request!.headers;

      // Should use service user ID, not user session ID
      expect(responseHeaders!.get('x-internal-user')).toBe(serviceUserId);
    });
  });
});
