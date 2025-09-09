import { redirect } from 'next/navigation';

import { getCachedAuthedUserOrRedirect } from '@/lib/auth/get-authed-user';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { createThread } from '@/lib/chat/service';

import { createNewThreadAction } from '../actions';

// Mock dependencies
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/lib/chat/service', () => ({
  createThread: jest.fn(),
}));

jest.mock('@/lib/auth/get-authed-user', () => ({
  getCachedAuthedUserOrRedirect: jest.fn(),
}));

describe('createNewThreadAction', () => {
  const mockUserId = 'test-user-123';
  const mockThreadId = 'thread-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new thread and redirect to it', async () => {
    // Setup mocks
    (getCachedAuthedUserOrRedirect as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockResolvedValue({ id: mockThreadId });

    // Execute the action
    await createNewThreadAction();

    // Verify authentication was checked
    expect(getCachedAuthedUserOrRedirect).toHaveBeenCalledTimes(1);

    // Verify thread was created with correct parameters
    expect(createThread).toHaveBeenCalledWith(mockUserId, DEFAULT_THREAD_NAME);

    // Verify redirect to the new thread
    expect(redirect).toHaveBeenCalledWith(`/chat/${mockThreadId}`);
  });

  it('should propagate authentication errors', async () => {
    const authError = new Error('REDIRECT: /login');
    (getCachedAuthedUserOrRedirect as jest.Mock).mockRejectedValue(authError);

    await expect(createNewThreadAction()).rejects.toThrow('REDIRECT: /login');

    expect(createThread).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('should propagate thread creation errors', async () => {
    const createError = new Error('Database error');
    (getCachedAuthedUserOrRedirect as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockRejectedValue(createError);

    await expect(createNewThreadAction()).rejects.toThrow('Database error');

    expect(redirect).not.toHaveBeenCalled();
  });
});
