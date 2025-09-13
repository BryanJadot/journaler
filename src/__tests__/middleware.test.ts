import { NextRequest, NextResponse } from 'next/server';

import * as cookiesModule from '@/lib/auth/cookies';
import * as jwtModule from '@/lib/auth/jwt';
import { middleware } from '@/middleware';

// Mock auth dependencies to control authentication flow in tests
jest.mock('@/lib/auth/cookies');
jest.mock('@/lib/auth/jwt');

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
  });

  describe('header security', () => {
    // This test verifies critical security behavior: preventing header injection attacks
    it('should strip x-user-id header from incoming requests on public routes', async () => {
      const request = new NextRequest('http://localhost/login', {
        headers: {
          'x-user-id': 'malicious-user-id', // Potential security threat
          'other-header': 'should-remain',
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

      // Critical security check: malicious header must be stripped
      expect(headers!.get('x-user-id')).toBeNull();
      // Ensure legitimate headers are preserved
      expect(headers!.get('other-header')).toBe('should-remain');
    });

    it('should strip malicious x-user-id and set authenticated user ID on protected routes', async () => {
      const userId = 'authenticated-user-123';
      mockGetAuthToken.mockResolvedValue('valid-token');
      mockVerifyAuthToken.mockResolvedValue({
        success: true,
        payload: { userId, username: 'testuser' },
      });

      const request = new NextRequest('http://localhost/journal/chat/123', {
        headers: {
          'x-user-id': 'malicious-user-id',
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

      // Verify the malicious header was replaced with the authenticated user ID
      expect(headers!.get('x-user-id')).toBe(userId);
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

      // Verify the authenticated user ID was set in the header
      expect(headers!.get('x-user-id')).toBe(userId);
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

      // Verify the authenticated user ID was set in the header
      expect(headers!.get('x-user-id')).toBe(userId);
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

      // Verify the authenticated user ID was set in the header
      expect(headers!.get('x-user-id')).toBe(userId);
    });
  });
});
