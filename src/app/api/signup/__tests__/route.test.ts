import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';

import { silenceConsoleErrors } from '@/__tests__/helpers/console-helpers';
import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { setAuthCookie } from '@/lib/auth/cookies';
import { validateRequestFormat } from '@/lib/auth/request-validation';
import { isSignupEnabled, signupUser } from '@/lib/auth/service';
import type { SignupError } from '@/lib/user/types';

import { POST } from '../route';

// Mock dependencies
jest.mock('@/lib/auth/service', () => ({
  isSignupEnabled: jest.fn(),
  signupUser: jest.fn(),
}));

jest.mock('@/lib/auth/cookies', () => ({
  setAuthCookie: jest.fn(),
}));

jest.mock('@/lib/auth/request-validation', () => ({
  validateRequestFormat: jest.fn(),
}));

const mockIsSignupEnabled = isSignupEnabled as jest.MockedFunction<
  typeof isSignupEnabled
>;
const mockSignupUser = signupUser as jest.MockedFunction<typeof signupUser>;
const mockSetAuthCookie = setAuthCookie as jest.MockedFunction<
  typeof setAuthCookie
>;
const mockValidateRequestFormat = validateRequestFormat as jest.MockedFunction<
  typeof validateRequestFormat
>;

describe('Signup API Route', () => {
  silenceConsoleErrors();

  const validCredentials = {
    username: 'testuser',
    password: 'password123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default to signup enabled
    mockIsSignupEnabled.mockReturnValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const createMockRequest = (body: Record<string, unknown>): NextRequest => {
    const request = new NextRequest('http://localhost:3000/api/signup', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return request;
  };

  describe('successful signup', () => {
    it('should return user data and set auth cookie on successful signup', async () => {
      const mockUser = createMockUser();

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
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

      expect(mockSignupUser).toHaveBeenCalledWith(validCredentials);
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

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: specialCredentials.username,
        password: specialCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
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

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: unicodeCredentials.username,
        password: unicodeCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
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

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
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
    it('should return validation error response when validation fails', async () => {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: 'Username and password are required',
        },
        { status: 400 }
      );

      mockValidateRequestFormat.mockResolvedValue({
        valid: false,
        response: errorResponse,
      });

      const request = createMockRequest({
        password: 'password123',
        // Missing username
      });

      const response = await POST(request);

      expect(response).toBe(errorResponse);
      expect(mockSignupUser).not.toHaveBeenCalled();
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON validation error', async () => {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );

      mockValidateRequestFormat.mockResolvedValue({
        valid: false,
        response: errorResponse,
      });

      const request = createMockRequest({});

      const response = await POST(request);

      expect(response).toBe(errorResponse);
      expect(mockSignupUser).not.toHaveBeenCalled();
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });
  });

  describe('signup failures', () => {
    it('should return 409 for username already taken', async () => {
      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'username-taken',
      });

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(409);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username is already taken',
      });

      expect(mockSignupUser).toHaveBeenCalledWith(validCredentials);
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid username (with spaces)', async () => {
      const invalidCredentials = {
        username: 'user with spaces',
        password: 'password123',
      };

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: invalidCredentials.username,
        password: invalidCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'invalid-username',
      });

      const request = createMockRequest(invalidCredentials);
      const response = await POST(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username cannot contain spaces',
      });

      expect(mockSignupUser).toHaveBeenCalledWith(invalidCredentials);
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should return 400 for username too long (over 255 characters)', async () => {
      const longUsernameCredentials = {
        username: 'a'.repeat(256), // One character over the limit
        password: 'password123',
      };

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: longUsernameCredentials.username,
        password: longUsernameCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'username-too-long',
      });

      const request = createMockRequest(longUsernameCredentials);
      const response = await POST(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Username must be 255 characters or less',
      });

      expect(mockSignupUser).toHaveBeenCalledWith(longUsernameCredentials);
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });
  });

  describe('service integration errors', () => {
    it('should return 500 for signupUser service failure', async () => {
      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Internal server error',
      });

      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should return 500 for setAuthCookie failure', async () => {
      const mockUser = createMockUser();

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      mockSetAuthCookie.mockRejectedValue(new Error('Cookie setting failed'));

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Internal server error',
      });

      expect(mockSignupUser).toHaveBeenCalledWith(validCredentials);
      expect(mockSetAuthCookie).toHaveBeenCalledWith(mockUser);
    });

    it('should return 500 for validation service failure', async () => {
      mockValidateRequestFormat.mockRejectedValue(
        new Error('Validation service error')
      );

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Internal server error',
      });

      expect(mockSignupUser).not.toHaveBeenCalled();
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and request handling', () => {
    it('should handle very long username through validation', async () => {
      const longUsername = 'a'.repeat(1000);
      const credentials = {
        username: longUsername,
        password: 'password123',
      };

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: credentials.username,
        password: credentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: { ...createMockUser(), username: longUsername },
      });

      const request = createMockRequest(credentials);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSignupUser).toHaveBeenCalledWith(credentials);
    });

    it('should handle very long password through validation', async () => {
      const longPassword = 'p'.repeat(1000);
      const credentials = {
        username: 'testuser',
        password: longPassword,
      };

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: credentials.username,
        password: credentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: createMockUser(),
      });

      const request = createMockRequest(credentials);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSignupUser).toHaveBeenCalledWith(credentials);
    });

    it('should pass through validated credentials exactly', async () => {
      const specialCredentials = {
        username: 'test@user.com+123',
        password: 'p@ssw0rd!#$%^&*()',
      };

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: specialCredentials.username,
        password: specialCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: { ...createMockUser(), username: specialCredentials.username },
      });

      const request = createMockRequest(specialCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSignupUser).toHaveBeenCalledWith(specialCredentials);
    });
  });

  describe('response format consistency', () => {
    it('should always return JSON with success field on success', async () => {
      const mockUser = createMockUser();

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const request = createMockRequest(validCredentials);
      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('username');
      expect(data.user).toHaveProperty('createdAt');
      expect(typeof data.user.createdAt).toBe('string'); // ISO string format
    });

    it('should return consistent error format for signup failures', async () => {
      const testCases: Array<{
        signupError: SignupError;
        expectedStatus: number;
        expectedMessage: string;
      }> = [
        {
          signupError: 'username-taken',
          expectedStatus: 409,
          expectedMessage: 'Username is already taken',
        },
        {
          signupError: 'invalid-username',
          expectedStatus: 400,
          expectedMessage: 'Username cannot contain spaces',
        },
        {
          signupError: 'username-too-long',
          expectedStatus: 400,
          expectedMessage: 'Username must be 255 characters or less',
        },
      ];

      for (const testCase of testCases) {
        mockValidateRequestFormat.mockResolvedValue({
          valid: true,
          username: validCredentials.username,
          password: validCredentials.password,
        });

        mockSignupUser.mockResolvedValue({
          success: false,
          error: testCase.signupError,
        });

        const request = createMockRequest(validCredentials);
        const response = await POST(request);

        expect(response.status).toBe(testCase.expectedStatus);

        const data = await response.json();
        expect(data).toMatchObject({
          success: false,
          error: testCase.expectedMessage,
        });
      }
    });

    it('should return consistent 500 error format for service failures', async () => {
      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockRejectedValue(new Error('Service error'));

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toMatchObject({
        success: false,
        error: 'Internal server error',
      });
    });
  });

  describe('signup enable/disable functionality', () => {
    it('should return 403 when signup is disabled', async () => {
      mockIsSignupEnabled.mockReturnValue(false);

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(403);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: 'Signup is currently disabled',
      });

      expect(mockIsSignupEnabled).toHaveBeenCalled();
      expect(mockValidateRequestFormat).not.toHaveBeenCalled();
      expect(mockSignupUser).not.toHaveBeenCalled();
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should proceed normally when signup is enabled', async () => {
      mockIsSignupEnabled.mockReturnValue(true);
      const mockUser = createMockUser();

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const request = createMockRequest(validCredentials);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);

      expect(mockIsSignupEnabled).toHaveBeenCalled();
      expect(mockValidateRequestFormat).toHaveBeenCalled();
      expect(mockSignupUser).toHaveBeenCalled();
      expect(mockSetAuthCookie).toHaveBeenCalled();
    });
  });

  describe('authentication cookie handling', () => {
    it('should set auth cookie with correct user data', async () => {
      const mockUser = createMockUser();

      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const request = createMockRequest(validCredentials);
      await POST(request);

      expect(mockSetAuthCookie).toHaveBeenCalledTimes(1);
      expect(mockSetAuthCookie).toHaveBeenCalledWith(mockUser);
    });

    it('should not attempt to set cookie on signup failure', async () => {
      mockValidateRequestFormat.mockResolvedValue({
        valid: true,
        username: validCredentials.username,
        password: validCredentials.password,
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'username-taken',
      });

      const request = createMockRequest(validCredentials);
      await POST(request);

      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });

    it('should not attempt to set cookie on validation failure', async () => {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
        },
        { status: 400 }
      );

      mockValidateRequestFormat.mockResolvedValue({
        valid: false,
        response: errorResponse,
      });

      const request = createMockRequest({});
      await POST(request);

      expect(mockSetAuthCookie).not.toHaveBeenCalled();
    });
  });
});
