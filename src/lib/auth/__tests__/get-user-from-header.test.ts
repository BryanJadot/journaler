import { headers } from 'next/headers';

import { getUserIdFromHeader } from '../get-user-from-header';

// Mock Next.js headers function to control test scenarios
jest.mock('next/headers');

const mockHeaders = headers as jest.MockedFunction<typeof headers>;

/**
 * Test suite for getUserIdFromHeader function.
 *
 * This function is critical for security as it extracts user IDs from headers
 * that are set by the authentication middleware. Tests verify:
 * - Correct header extraction when x-user-id is present
 * - Proper error handling when header is missing or invalid
 * - Security behavior (only looks for exact header name)
 * - Edge case handling (empty strings, different formats, etc.)
 */
describe('getUserIdFromHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user ID when x-user-id header is present', async () => {
    const userId = 'user-123';
    const mockHeadersList = {
      get: jest.fn().mockReturnValue(userId),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    const result = await getUserIdFromHeader();

    expect(result).toBe(userId);
    expect(mockHeadersList.get).toHaveBeenCalledWith('x-user-id');
  });

  it('should throw error when x-user-id header is not present', async () => {
    const mockHeadersList = {
      get: jest.fn().mockReturnValue(null),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'User ID not found in headers. Authentication required.'
    );
    expect(mockHeadersList.get).toHaveBeenCalledWith('x-user-id');
  });

  it('should throw error when x-user-id header is empty string', async () => {
    const mockHeadersList = {
      get: jest.fn().mockReturnValue(''),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'User ID not found in headers. Authentication required.'
    );
  });

  it('should handle different user ID formats', async () => {
    const testCases = [
      'uuid-550e8400-e29b-41d4-a716-446655440001',
      '12345',
      'user_with_underscore',
      'user-with-dash',
    ];

    for (const userId of testCases) {
      const mockHeadersList = {
        get: jest.fn().mockReturnValue(userId),
      };
      mockHeaders.mockResolvedValue(
        mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
      );

      const result = await getUserIdFromHeader();

      expect(result).toBe(userId);
    }
  });

  it('should only look for x-user-id header, not other headers', async () => {
    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-user-id') return 'correct-user';
        if (key === 'user-id') return 'wrong-user';
        if (key === 'authorization') return 'Bearer token';
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    const result = await getUserIdFromHeader();

    expect(result).toBe('correct-user');
    expect(mockHeadersList.get).toHaveBeenCalledWith('x-user-id');
    expect(mockHeadersList.get).toHaveBeenCalledTimes(1);
  });

  it('should handle headers() promise rejection', async () => {
    const error = new Error('Headers not available');
    mockHeaders.mockRejectedValue(error);

    await expect(getUserIdFromHeader()).rejects.toThrow(
      'Headers not available'
    );
  });

  it('should be case-sensitive for header name', async () => {
    const mockHeadersList = {
      get: jest.fn((key: string) => {
        if (key === 'x-user-id') return 'user-123';
        if (key === 'X-User-Id') return 'wrong-user';
        if (key === 'X-USER-ID') return 'also-wrong';
        return null;
      }),
    };
    mockHeaders.mockResolvedValue(
      mockHeadersList as unknown as Awaited<ReturnType<typeof headers>>
    );

    const result = await getUserIdFromHeader();

    expect(result).toBe('user-123');
    expect(mockHeadersList.get).toHaveBeenCalledWith('x-user-id');
  });
});
