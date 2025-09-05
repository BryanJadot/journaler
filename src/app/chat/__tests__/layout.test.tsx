import { createUniqueUserId } from '@/__tests__/helpers/test-helpers';
import * as requireAuthServerModule from '@/lib/auth/require-auth-server';

jest.mock('@/lib/auth/require-auth-server');

const mockRequireAuthServer =
  requireAuthServerModule.requireAuthServer as jest.MockedFunction<
    typeof requireAuthServerModule.requireAuthServer
  >;

describe('ChatLayout (auth behavior)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return userId when requireAuthServer succeeds', async () => {
    const userId = createUniqueUserId();
    mockRequireAuthServer.mockResolvedValue(userId);

    const result = await requireAuthServerModule.requireAuthServer();

    expect(result).toBe(userId);
    expect(mockRequireAuthServer).toHaveBeenCalled();
  });

  it('should throw redirect error when requireAuthServer fails', async () => {
    const redirectError = new Error('REDIRECT: /login');
    mockRequireAuthServer.mockRejectedValue(redirectError);

    await expect(requireAuthServerModule.requireAuthServer()).rejects.toThrow(
      'REDIRECT: /login'
    );

    expect(mockRequireAuthServer).toHaveBeenCalled();
  });
});
