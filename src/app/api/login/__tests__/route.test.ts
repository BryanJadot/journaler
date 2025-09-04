import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextRequest } from 'next/server';

import { createMockUser } from '@/__tests__/helpers/user';
import { setAuthCookie } from '@/lib/auth/cookies';
import { authenticateUser } from '@/lib/user/service';
import { AuthError } from '@/lib/user/types';

import { POST } from '../route';

// Mock dependencies
jest.mock('@/lib/user/service', () => ({
  authenticateUser: jest.fn(),
}));

jest.mock('@/lib/auth/cookies', () => ({
  setAuthCookie: jest.fn(),
}));

const mockAuthenticateUser = authenticateUser as jest.MockedFunction<
  typeof authenticateUser
>;
const mockSetAuthCookie = setAuthCookie as jest.MockedFunction<
  typeof setAuthCookie
>;

describe('Login API Route', () => {
  const validCredentials = {
    username: 'testuser',
    password: 'password123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const createMockRequest = (body: Record<string, unknown>): NextRequest => {
    const request = new NextRequest('http://localhost:3000/api/login', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return request;
  };

  describe('successful authentication', () => {
    it('should return user data and set auth cookie on successful login', async () => {
      const mockUser = createMockUser();
      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: true,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          createdAt: mockUser.createdAt.toISOString(),
        },
      });

      expect(mockAuthenticateUser).toHaveBeenCalledWith(validCredentials);
      expect(mockSetAuthCookie).toHaveBeenCalledWith(mockUser);
    });

    it('should handle user with special characters in username', async () => {
      const userWithSpecialChars = {
        ...createMockUser(),
        username: 'test@user.com+123',
      };

      const specialCredentials = {
        username: 'test@user.com+123',
        password: 'password123',
      };

      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: userWithSpecialChars,
      });

      const request = createMockRequest(specialCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.user.username).toBe('test@user.com+123');

      expect(mockSetAuthCookie).toHaveBeenCalledWith(userWithSpecialChars);
    });

    it('should handle user with unicode characters in username', async () => {
      const userWithUnicode = {
        ...createMockUser(),
        username: '测试用户',
      };

      const unicodeCredentials = {
        username: '测试用户',
        password: 'password123',
      };

      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: userWithUnicode,
      });

      const request = createMockRequest(unicodeCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.user.username).toBe('测试用户');
    });

    it('should not return sensitive user data', async () => {
      const mockUser = createMockUser();
      const userWithExtraData = {
        ...mockUser,
        passwordHash: 'hashed-password',
        email: 'test@example.com',
      };

      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: userWithExtraData,
      });

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      const responseData = await response.json();

      // Should only return safe user fields
      expect(responseData.user).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        createdAt: mockUser.createdAt.toISOString(),
      });

      expect(responseData.user.passwordHash).toBeUndefined();
      expect(responseData.user.email).toBeUndefined();
    });
  });

  describe('validation errors', () => {
    it('should return 400 for missing username', async () => {
      const request = createMockRequest({
        password: 'password123',
        // Missing username
      });

      const response = await POST(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });

      expect(mockAuthenticateUser).not.toHaveBeenCalled();
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should return 400 for missing password', async () => {
      const request = createMockRequest({
        username: 'testuser',
        // Missing password
      });

      const response = await POST(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });

      expect(mockAuthenticateUser).not.toHaveBeenCalled();
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should return 400 for empty username', async () => {
      const request = createMockRequest({
        username: '',
        password: 'password123',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username and password are required',
      });
    });

    it('should return 400 for empty password', async () => {
      const request = createMockRequest({
        username: 'testuser',
        password: '',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for null username', async () => {
      const request = createMockRequest({
        username: null,
        password: 'password123',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for null password', async () => {
      const request = createMockRequest({
        username: 'testuser',
        password: null,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for undefined credentials', async () => {
      const request = createMockRequest({
        username: undefined,
        password: undefined,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle whitespace-only credentials as invalid', async () => {
      const request = createMockRequest({
        username: '   ',
        password: '   ',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('authentication failures', () => {
    it('should return 401 for user not found', async () => {
      mockAuthenticateUser.mockResolvedValue({
        success: false,
        error: AuthError.USER_NOT_FOUND,
      });

      const request = createMockRequest({
        username: 'nonexistentuser',
        password: 'password123',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: AuthError.USER_NOT_FOUND,
      });

      expect(mockAuthenticateUser).toHaveBeenCalledWith({
        username: 'nonexistentuser',
        password: 'password123',
      });

      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid password', async () => {
      mockAuthenticateUser.mockResolvedValue({
        success: false,
        error: AuthError.INVALID_PASSWORD,
      });

      const request = createMockRequest({
        username: 'testuser',
        password: 'wrongpassword',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: AuthError.INVALID_PASSWORD,
      });

      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });
  });

  describe('malformed requests', () => {
    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/login', {
        method: 'POST',
        body: 'invalid-json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      // Should handle JSON parsing error gracefully
      expect([400, 500]).toContain(response.status);
    });

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/login', {
        method: 'POST',
        body: '',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect([400, 500]).toContain(response.status);
    });

    it('should handle request with extra fields', async () => {
      const request = createMockRequest({
        username: 'testuser',
        password: 'password123',
        extraField: 'should-be-ignored',
        anotherField: { nested: 'data' },
      });

      const mockUser = createMockUser();
      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Should only pass username and password to authenticateUser
      expect(mockAuthenticateUser).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });
    });
  });

  describe('service integration errors', () => {
    it('should handle authenticateUser service failure', async () => {
      mockAuthenticateUser.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle setAuthCookie failure', async () => {
      const mockUser = createMockUser();
      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      mockSetAuthCookie.mockRejectedValue(new Error('Cookie setting failed'));

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle setAuthCookie failure after successful authentication', async () => {
      const mockUser = createMockUser();
      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      mockSetAuthCookie.mockRejectedValue(new Error('JWT creation failed'));

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);

      expect(mockAuthenticateUser).toHaveBeenCalledWith(validCredentials);
      expect(mockSetAuthCookie).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('request handling edge cases', () => {
    it('should handle very long username', async () => {
      const longUsername = 'a'.repeat(1000);
      const request = createMockRequest({
        username: longUsername,
        password: 'password123',
      });

      mockAuthenticateUser.mockResolvedValue({
        success: false,
        error: AuthError.USER_NOT_FOUND,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(mockAuthenticateUser).toHaveBeenCalledWith({
        username: longUsername,
        password: 'password123',
      });
    });

    it('should handle very long password', async () => {
      const longPassword = 'p'.repeat(1000);
      const request = createMockRequest({
        username: 'testuser',
        password: longPassword,
      });

      mockAuthenticateUser.mockResolvedValue({
        success: false,
        error: AuthError.INVALID_PASSWORD,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(mockAuthenticateUser).toHaveBeenCalledWith({
        username: 'testuser',
        password: longPassword,
      });
    });

    it('should handle credentials with special characters', async () => {
      const request = createMockRequest({
        username: 'test@user.com+123',
        password: 'p@ssw0rd!#$%^&*()',
      });

      mockAuthenticateUser.mockResolvedValue({
        success: true,
        user: { ...createMockUser(), username: 'test@user.com+123' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockAuthenticateUser).toHaveBeenCalledWith({
        username: 'test@user.com+123',
        password: 'p@ssw0rd!#$%^&*()',
      });
    });

    it('should handle boolean values for credentials', async () => {
      const request = createMockRequest({
        username: true,
        password: false,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockAuthenticateUser).not.toHaveBeenCalled();
    });

    it('should handle numeric values for credentials', async () => {
      const request = createMockRequest({
        username: 123,
        password: 456,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockAuthenticateUser).not.toHaveBeenCalled();
    });

    it('should handle array values for credentials', async () => {
      const request = createMockRequest({
        username: ['user1', 'user2'],
        password: ['pass1', 'pass2'],
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockAuthenticateUser).not.toHaveBeenCalled();
    });

    it('should handle object values for credentials', async () => {
      const request = createMockRequest({
        username: { value: 'testuser' },
        password: { value: 'password123' },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(mockAuthenticateUser).not.toHaveBeenCalled();
    });
  });

  describe('response format consistency', () => {
    it('should always return JSON with success field', async () => {
      const requests = [
        createMockRequest({}), // Missing fields
        createMockRequest({ username: 'test', password: 'wrong' }), // Invalid auth
      ];

      mockAuthenticateUser.mockResolvedValue({
        success: false,
        error: AuthError.INVALID_PASSWORD,
      });

      for (const request of requests) {
        const response = await POST(request);
        const data = await response.json();

        expect(data).toHaveProperty('success');
        expect(typeof data.success).toBe('boolean');

        if (!data.success) {
          expect(data).toHaveProperty('error');
          expect(typeof data.error).toBe('string');
        }
      }
    });

    it('should return consistent error format', async () => {
      const testCases = [
        { body: {}, expectedStatus: 400 },
        { body: { username: 'test' }, expectedStatus: 400 },
        { body: { password: 'test' }, expectedStatus: 400 },
      ];

      for (const testCase of testCases) {
        const request = createMockRequest(testCase.body);
        const response = await POST(request);

        expect(response.status).toBe(testCase.expectedStatus);

        const data = await response.json();
        expect(data).toMatchObject({
          success: false,
          error: expect.any(String),
        });
      }
    });
  });
});
