import React from 'react';

import * as authModule from '@/app/(authed)/get-authed-user';

import AuthedLayout from '../layout';

// Mock the auth module
jest.mock('@/app/(authed)/get-authed-user');
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

const mockGetCachedAuthedUserOrRedirect =
  authModule.getCachedAuthedUserOrRedirect as jest.MockedFunction<
    typeof authModule.getCachedAuthedUserOrRedirect
  >;

describe('AuthedLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when user is authenticated', async () => {
    const mockUserId = 'user-123';
    mockGetCachedAuthedUserOrRedirect.mockResolvedValue(mockUserId);

    const TestChild = () => <div>Test Child Component</div>;
    const result = await AuthedLayout({ children: <TestChild /> });

    expect(mockGetCachedAuthedUserOrRedirect).toHaveBeenCalledTimes(1);
    expect(result).toBeTruthy();
  });

  it('should handle authentication check', async () => {
    const mockUserId = 'user-456';
    mockGetCachedAuthedUserOrRedirect.mockResolvedValue(mockUserId);

    await AuthedLayout({ children: <div>Protected Content</div> });

    expect(mockGetCachedAuthedUserOrRedirect).toHaveBeenCalledTimes(1);
  });

  it('should propagate auth errors when authentication fails', async () => {
    const authError = new Error('REDIRECT: /login');
    mockGetCachedAuthedUserOrRedirect.mockRejectedValue(authError);

    await expect(
      AuthedLayout({ children: <div>Protected Content</div> })
    ).rejects.toThrow('REDIRECT: /login');

    expect(mockGetCachedAuthedUserOrRedirect).toHaveBeenCalledTimes(1);
  });
});
