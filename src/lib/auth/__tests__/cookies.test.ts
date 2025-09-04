import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { cookies } from 'next/headers';

import { createMockUser } from '@/__tests__/helpers/user';
import type { User } from '@/lib/user/types';

import { clearAuthCookie, getAuthToken, setAuthCookie } from '../cookies';
import { createAuthToken } from '../jwt';

// Mock Next.js cookies() function
const mockCookieStore = {
  set: jest.fn(),
  delete: jest.fn(),
  get: jest.fn(),
};

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

// Mock JWT functions for isolation
jest.mock('../jwt', () => ({
  createAuthToken: jest.fn(),
}));

const mockedCreateAuthToken = createAuthToken as jest.MockedFunction<
  typeof createAuthToken
>;
const mockedCookies = cookies as jest.MockedFunction<typeof cookies>;

describe('Cookie Management Functions', () => {
  const mockToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE2NDEwODE2MDB9.signature';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateAuthToken.mockResolvedValue(mockToken);
    mockedCookies.mockResolvedValue(
      mockCookieStore as unknown as ReadonlyRequestCookies
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('setAuthCookie', () => {
    it('should create auth token and set cookie with correct options', async () => {
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      expect(mockedCreateAuthToken).toHaveBeenCalledWith(mockUser);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        mockToken,
        {
          httpOnly: true,
          secure: false, // development mode
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 24 hours
          path: '/',
        }
      );
    });

    it('should set secure flag in production environment', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true,
      });

      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      // Restore original value
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalNodeEnv,
        configurable: true,
      });

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        mockToken,
        {
          httpOnly: true,
          secure: true, // production mode
          sameSite: 'strict',
          maxAge: 60 * 60 * 24,
          path: '/',
        }
      );
    });

    it('should handle createAuthToken failure', async () => {
      const error = new Error('JWT creation failed');
      mockedCreateAuthToken.mockRejectedValue(error);

      const mockUser = createMockUser();
      await expect(setAuthCookie(mockUser)).rejects.toThrow(
        'JWT creation failed'
      );
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it('should handle cookie store set failure', async () => {
      mockCookieStore.set.mockImplementation(() => {
        throw new Error('Cookie set failed');
      });

      const mockUser = createMockUser();
      await expect(setAuthCookie(mockUser)).rejects.toThrow(
        'Cookie set failed'
      );
      expect(mockedCreateAuthToken).toHaveBeenCalledWith(mockUser);
    });

    it('should call cookie store with different tokens for different users', async () => {
      const user1 = { ...createMockUser(), id: 'user1', username: 'user1' };
      const user2 = { ...createMockUser(), id: 'user2', username: 'user2' };
      const token1 = 'token1';
      const token2 = 'token2';

      mockedCreateAuthToken
        .mockResolvedValueOnce(token1)
        .mockResolvedValueOnce(token2);

      await setAuthCookie(user1);
      await setAuthCookie(user2);

      expect(mockCookieStore.set).toHaveBeenNthCalledWith(
        1,
        'auth-token',
        token1,
        expect.any(Object)
      );

      expect(mockCookieStore.set).toHaveBeenNthCalledWith(
        2,
        'auth-token',
        token2,
        expect.any(Object)
      );
    });

    it('should use correct cookie options in test environment', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'test',
        configurable: true,
      });

      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        mockToken,
        {
          httpOnly: true,
          secure: false, // not production
          sameSite: 'strict',
          maxAge: 60 * 60 * 24,
          path: '/',
        }
      );
    });

    it('should handle user with minimal required fields', async () => {
      const minimalUser: User = {
        id: '456',
        username: 'minimal',
        createdAt: new Date(),
      };

      await setAuthCookie(minimalUser);

      expect(mockedCreateAuthToken).toHaveBeenCalledWith(minimalUser);
      expect(mockCookieStore.set).toHaveBeenCalled();
    });
  });

  describe('clearAuthCookie', () => {
    it('should delete the auth cookie', async () => {
      await clearAuthCookie();

      expect(mockCookieStore.delete).toHaveBeenCalledWith('auth-token');
    });

    it('should handle cookie store delete failure gracefully', async () => {
      mockCookieStore.delete.mockImplementation(() => {
        throw new Error('Cookie delete failed');
      });

      await expect(clearAuthCookie()).rejects.toThrow('Cookie delete failed');
    });

    it('should call delete only once per invocation', async () => {
      await clearAuthCookie();
      await clearAuthCookie();

      expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
      expect(mockCookieStore.delete).toHaveBeenNthCalledWith(1, 'auth-token');
      expect(mockCookieStore.delete).toHaveBeenNthCalledWith(2, 'auth-token');
    });

    it('should not require any parameters', async () => {
      await expect(clearAuthCookie()).resolves.not.toThrow();
      expect(mockCookieStore.delete).toHaveBeenCalledWith('auth-token');
    });
  });

  describe('getAuthToken', () => {
    it('should return token value when cookie exists', async () => {
      const expectedToken = 'some-auth-token-value';
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: expectedToken,
      });

      const result = await getAuthToken();

      expect(mockCookieStore.get).toHaveBeenCalledWith('auth-token');
      expect(result).toBe(expectedToken);
    });

    it('should return undefined when cookie does not exist', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const result = await getAuthToken();

      expect(mockCookieStore.get).toHaveBeenCalledWith('auth-token');
      expect(result).toBeUndefined();
    });

    it('should return undefined when cookie exists but has no value', async () => {
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: undefined,
      });

      const result = await getAuthToken();

      expect(result).toBeUndefined();
    });

    it('should return empty string when cookie has empty value', async () => {
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: '',
      });

      const result = await getAuthToken();

      expect(result).toBe('');
    });

    it('should handle cookie store get failure', async () => {
      mockCookieStore.get.mockImplementation(() => {
        throw new Error('Cookie get failed');
      });

      await expect(getAuthToken()).rejects.toThrow('Cookie get failed');
    });

    it('should return token with special characters', async () => {
      const specialToken = 'token.with-special_chars+123=';
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: specialToken,
      });

      const result = await getAuthToken();

      expect(result).toBe(specialToken);
    });

    it('should handle very long token values', async () => {
      const longToken = 'a'.repeat(1000); // Very long token
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: longToken,
      });

      const result = await getAuthToken();

      expect(result).toBe(longToken);
    });

    it('should call cookie store get only once per invocation', async () => {
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: 'token',
      });

      await getAuthToken();
      await getAuthToken();

      expect(mockCookieStore.get).toHaveBeenCalledTimes(2);
      expect(mockCookieStore.get).toHaveBeenNthCalledWith(1, 'auth-token');
      expect(mockCookieStore.get).toHaveBeenNthCalledWith(2, 'auth-token');
    });
  });

  describe('cookie security properties', () => {
    it('should always set httpOnly to true for security', async () => {
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      const callArgs = mockCookieStore.set.mock.calls[0];
      const options = callArgs[2] as { httpOnly: boolean };
      expect(options.httpOnly).toBe(true);
    });

    it('should always set sameSite to strict', async () => {
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      const callArgs = mockCookieStore.set.mock.calls[0];
      const options = callArgs[2] as { sameSite: string };
      expect(options.sameSite).toBe('strict');
    });

    it('should always set path to root', async () => {
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      const callArgs = mockCookieStore.set.mock.calls[0];
      const options = callArgs[2] as { path: string };
      expect(options.path).toBe('/');
    });

    it('should set maxAge to 24 hours (86400 seconds)', async () => {
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);

      const callArgs = mockCookieStore.set.mock.calls[0];
      const options = callArgs[2] as { maxAge: number };
      expect(options.maxAge).toBe(60 * 60 * 24);
    });

    it('should use correct cookie name consistently', async () => {
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);
      await clearAuthCookie();
      await getAuthToken();

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        expect.any(String),
        expect.any(Object)
      );
      expect(mockCookieStore.delete).toHaveBeenCalledWith('auth-token');
      expect(mockCookieStore.get).toHaveBeenCalledWith('auth-token');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete cookie lifecycle', async () => {
      // Set cookie
      const mockUser = createMockUser();
      await setAuthCookie(mockUser);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        mockToken,
        expect.any(Object)
      );

      // Get cookie
      mockCookieStore.get.mockReturnValue({
        name: 'auth-token',
        value: mockToken,
      });

      const retrievedToken = await getAuthToken();
      expect(retrievedToken).toBe(mockToken);

      // Clear cookie
      await clearAuthCookie();
      expect(mockCookieStore.delete).toHaveBeenCalledWith('auth-token');

      // Try to get cleared cookie
      mockCookieStore.get.mockReturnValue(undefined);
      const clearedToken = await getAuthToken();
      expect(clearedToken).toBeUndefined();
    });

    it('should handle overwriting existing cookie', async () => {
      const user1 = { ...createMockUser(), id: 'user1' };
      const user2 = { ...createMockUser(), id: 'user2' };
      const token1 = 'token1';
      const token2 = 'token2';

      mockedCreateAuthToken
        .mockResolvedValueOnce(token1)
        .mockResolvedValueOnce(token2);

      // Set first cookie
      await setAuthCookie(user1);
      expect(mockCookieStore.set).toHaveBeenLastCalledWith(
        'auth-token',
        token1,
        expect.any(Object)
      );

      // Set second cookie (should overwrite)
      await setAuthCookie(user2);
      expect(mockCookieStore.set).toHaveBeenLastCalledWith(
        'auth-token',
        token2,
        expect.any(Object)
      );

      expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should propagate JWT creation errors', async () => {
      const jwtError = new Error('JWT secret not found');
      mockedCreateAuthToken.mockRejectedValue(jwtError);

      const mockUser = createMockUser();
      await expect(setAuthCookie(mockUser)).rejects.toThrow(
        'JWT secret not found'
      );
    });

    it('should handle async JWT creation properly', async () => {
      let resolveJWT: (value: string) => void = () => {};
      const jwtPromise = new Promise<string>((resolve) => {
        resolveJWT = resolve;
      });

      mockedCreateAuthToken.mockReturnValue(jwtPromise);

      const mockUser = createMockUser();
      const setPromise = setAuthCookie(mockUser);

      // Cookie should not be set yet
      expect(mockCookieStore.set).not.toHaveBeenCalled();

      // Resolve JWT creation
      resolveJWT('delayed-token');
      await setPromise;

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'auth-token',
        'delayed-token',
        expect.any(Object)
      );
    });
  });
});
