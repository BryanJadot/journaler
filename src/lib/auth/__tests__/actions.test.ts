import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { redirect } from 'next/navigation';

import { silenceConsoleErrors } from '@/__tests__/helpers/console-helpers';
import { createMockUser } from '@/__tests__/helpers/test-helpers';
import { setAuthCookie } from '@/lib/auth/cookies';
import { isSignupEnabled, loginUser, signupUser } from '@/lib/auth/service';
import { getOrCreateChatUrl } from '@/lib/chat/redirect-helpers';

import { loginAction, signupAction } from '../actions';

// Mock dependencies
jest.mock('@/lib/auth/service', () => ({
  isSignupEnabled: jest.fn(),
  loginUser: jest.fn(),
  signupUser: jest.fn(),
}));

jest.mock('@/lib/auth/cookies', () => ({
  setAuthCookie: jest.fn(),
}));

jest.mock('@/lib/chat/redirect-helpers', () => ({
  getOrCreateChatUrl: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

const mockIsSignupEnabled = isSignupEnabled as jest.MockedFunction<
  typeof isSignupEnabled
>;
const mockLoginUser = loginUser as jest.MockedFunction<typeof loginUser>;
const mockSignupUser = signupUser as jest.MockedFunction<typeof signupUser>;
const mockSetAuthCookie = setAuthCookie as jest.MockedFunction<
  typeof setAuthCookie
>;
const mockGetOrCreateChatUrl = getOrCreateChatUrl as jest.MockedFunction<
  typeof getOrCreateChatUrl
>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('Auth Actions', () => {
  silenceConsoleErrors();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSignupEnabled.mockReturnValue(true);
  });

  const createFormData = (data: Record<string, string>): FormData => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.set(key, value);
    });
    return formData;
  };

  describe('loginAction', () => {
    it('should redirect on successful login', async () => {
      const mockUser = createMockUser();
      const formData = createFormData({
        username: 'testuser',
        password: 'password123',
      });

      mockLoginUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });
      mockGetOrCreateChatUrl.mockResolvedValue('/chat/thread-123');

      await loginAction(null, formData);

      expect(mockLoginUser).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });
      expect(mockSetAuthCookie).toHaveBeenCalledWith(mockUser);
      expect(mockGetOrCreateChatUrl).toHaveBeenCalledWith(mockUser.id);
      expect(mockRedirect).toHaveBeenCalledWith('/chat/thread-123');
    });

    it('should return error for invalid credentials', async () => {
      const formData = createFormData({
        username: 'testuser',
        password: 'wrongpassword',
      });

      mockLoginUser.mockResolvedValue({
        success: false,
        error: 'invalid-password',
      });

      const result = await loginAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-password',
      });
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should return error for missing username', async () => {
      const formData = createFormData({
        password: 'password123',
      });

      const result = await loginAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(mockLoginUser).not.toHaveBeenCalled();
    });

    it('should return error for missing password', async () => {
      const formData = createFormData({
        username: 'testuser',
      });

      const result = await loginAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(mockLoginUser).not.toHaveBeenCalled();
    });

    it('should handle empty string values', async () => {
      const formData = createFormData({
        username: '   ',
        password: '   ',
      });

      const result = await loginAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(mockLoginUser).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const formData = createFormData({
        username: 'testuser',
        password: 'password123',
      });

      mockLoginUser.mockRejectedValue(new Error('Database error'));

      const result = await loginAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Internal server error',
      });
    });
  });

  describe('signupAction', () => {
    it('should redirect on successful signup', async () => {
      const mockUser = createMockUser();
      const formData = createFormData({
        username: 'newuser',
        password: 'password123',
      });

      mockSignupUser.mockResolvedValue({
        success: true,
        user: mockUser,
      });
      mockGetOrCreateChatUrl.mockResolvedValue('/chat/thread-456');

      await signupAction(null, formData);

      expect(mockSignupUser).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'password123',
      });
      expect(mockSetAuthCookie).toHaveBeenCalledWith(mockUser);
      expect(mockGetOrCreateChatUrl).toHaveBeenCalledWith(mockUser.id);
      expect(mockRedirect).toHaveBeenCalledWith('/chat/thread-456');
    });

    it('should return error when signup is disabled', async () => {
      mockIsSignupEnabled.mockReturnValue(false);
      const formData = createFormData({
        username: 'newuser',
        password: 'password123',
      });

      const result = await signupAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Signup is currently disabled',
      });
      expect(mockSignupUser).not.toHaveBeenCalled();
    });

    it('should return error for username taken', async () => {
      const formData = createFormData({
        username: 'existinguser',
        password: 'password123',
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'username-taken',
      });

      const result = await signupAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username is already taken',
      });
      expect(mockSetAuthCookie).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('should return error for invalid username', async () => {
      const formData = createFormData({
        username: 'user with spaces',
        password: 'password123',
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'invalid-username',
      });

      const result = await signupAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username cannot contain spaces',
      });
    });

    it('should return error for username too long', async () => {
      const formData = createFormData({
        username: 'a'.repeat(300),
        password: 'password123',
      });

      mockSignupUser.mockResolvedValue({
        success: false,
        error: 'username-too-long',
      });

      const result = await signupAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username must be 255 characters or less',
      });
    });

    it('should return error for missing credentials', async () => {
      const formData = createFormData({});

      const result = await signupAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Username and password are required',
      });
      expect(mockSignupUser).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const formData = createFormData({
        username: 'newuser',
        password: 'password123',
      });

      mockSignupUser.mockRejectedValue(new Error('Database error'));

      const result = await signupAction(null, formData);

      expect(result).toEqual({
        success: false,
        error: 'Internal server error',
      });
    });
  });
});
