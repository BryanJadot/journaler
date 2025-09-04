import { requireAuthServer } from '../require-auth-server';
import * as cookiesModule from '../cookies';
import * as jwtModule from '../jwt';
import { redirect } from 'next/navigation';

jest.mock('../cookies');
jest.mock('../jwt');
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

const mockGetAuthToken = cookiesModule.getAuthToken as jest.MockedFunction<
  typeof cookiesModule.getAuthToken
>;
const mockVerifyAuthToken = jwtModule.verifyAuthToken as jest.MockedFunction<
  typeof jwtModule.verifyAuthToken
>;
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('requireAuthServer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock redirect to throw so we can test it was called
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT: ${url}`);
    });
  });

  it('should return userId when token is valid', async () => {
    const userId = 'user-123';
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    const result = await requireAuthServer();

    expect(result).toBe(userId);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('should redirect to /login when no token is present', async () => {
    mockGetAuthToken.mockResolvedValue(undefined);

    await expect(requireAuthServer()).rejects.toThrow('REDIRECT: /login');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /login when token is invalid', async () => {
    mockGetAuthToken.mockResolvedValue('invalid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: jwtModule.TokenVerificationError.INVALID_TOKEN,
    });

    await expect(requireAuthServer()).rejects.toThrow('REDIRECT: /login');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /login when token has invalid payload', async () => {
    mockGetAuthToken.mockResolvedValue('token-with-bad-payload');
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: jwtModule.TokenVerificationError.INVALID_PAYLOAD,
    });

    await expect(requireAuthServer()).rejects.toThrow('REDIRECT: /login');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
