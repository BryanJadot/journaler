import { NextRequest, NextResponse } from 'next/server';

import * as cookiesModule from '@/lib/auth/cookies';
import * as hmacSecretModule from '@/lib/auth/hmac-secret';
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
});
