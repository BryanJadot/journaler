import { redirect } from 'next/navigation';

import * as cookiesModule from '@/lib/auth/cookies';
import { getCachedAuthedUserOrRedirect } from '@/lib/auth/get-authed-user';
import * as jwtModule from '@/lib/auth/jwt';

// Mock dependencies
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));
jest.mock('@/lib/auth/cookies');
jest.mock('@/lib/auth/jwt');

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
const mockGetAuthToken = cookiesModule.getAuthToken as jest.MockedFunction<
  typeof cookiesModule.getAuthToken
>;
const mockVerifyAuthToken = jwtModule.verifyAuthToken as jest.MockedFunction<
  typeof jwtModule.verifyAuthToken
>;

describe('getCachedAuthedUserOrRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return userId when token is valid', async () => {
    const mockToken = 'valid-token';
    const mockUserId = 'user-123';

    mockGetAuthToken.mockResolvedValue(mockToken);
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId: mockUserId, username: 'testuser' },
    });

    const result = await getCachedAuthedUserOrRedirect();

    expect(result).toBe(mockUserId);
    expect(mockGetAuthToken).toHaveBeenCalledTimes(1);
    expect(mockVerifyAuthToken).toHaveBeenCalledWith(mockToken);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('should redirect to login when no token exists', async () => {
    mockGetAuthToken.mockResolvedValue(undefined);
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT: /login');
    });

    await expect(getCachedAuthedUserOrRedirect()).rejects.toThrow(
      'REDIRECT: /login'
    );

    expect(mockGetAuthToken).toHaveBeenCalledTimes(1);
    expect(mockVerifyAuthToken).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to login when token verification fails', async () => {
    const mockToken = 'invalid-token';

    mockGetAuthToken.mockResolvedValue(mockToken);
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: 'invalid-token',
    });
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT: /login');
    });

    await expect(getCachedAuthedUserOrRedirect()).rejects.toThrow(
      'REDIRECT: /login'
    );

    expect(mockGetAuthToken).toHaveBeenCalledTimes(1);
    expect(mockVerifyAuthToken).toHaveBeenCalledWith(mockToken);
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
