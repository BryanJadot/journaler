import { redirect } from 'next/navigation';

import { createUniqueUserId } from '@/__tests__/helpers/test-helpers';
import * as requireAuthServerModule from '@/lib/auth/require-auth-server';
import * as chatServiceModule from '@/lib/chat/service';

import Page from '../page';

jest.mock('@/lib/auth/require-auth-server');
jest.mock('@/lib/chat/service');
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

const mockRequireAuthServer =
  requireAuthServerModule.requireAuthServer as jest.MockedFunction<
    typeof requireAuthServerModule.requireAuthServer
  >;

const mockGetMostRecentThread =
  chatServiceModule.getMostRecentThread as jest.MockedFunction<
    typeof chatServiceModule.getMostRecentThread
  >;

const mockCreateThread = chatServiceModule.createThread as jest.MockedFunction<
  typeof chatServiceModule.createThread
>;

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

describe('/chat page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect to most recent thread when one exists', async () => {
    const userId = createUniqueUserId();
    const threadId = 'thread-123';

    mockRequireAuthServer.mockResolvedValue(userId);
    mockGetMostRecentThread.mockResolvedValue({
      id: threadId,
      userId,
      name: 'Test Thread',
      updatedAt: new Date(),
      messages: [],
    });

    await Page();

    expect(mockRequireAuthServer).toHaveBeenCalled();
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(userId);
    expect(mockRedirect).toHaveBeenCalledWith(`/chat/${threadId}`);
    expect(mockCreateThread).not.toHaveBeenCalled();
  });

  it('should create new thread and redirect when no threads exist', async () => {
    const userId = createUniqueUserId();
    const newThreadId = 'new-thread-456';

    mockRequireAuthServer.mockResolvedValue(userId);
    mockGetMostRecentThread.mockResolvedValue(undefined);
    mockCreateThread.mockResolvedValue({
      id: newThreadId,
      userId,
      name: 'New Chat',
      updatedAt: new Date(),
    });

    await Page();

    expect(mockRequireAuthServer).toHaveBeenCalled();
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(userId);
    expect(mockCreateThread).toHaveBeenCalledWith(userId, 'New Chat');
    expect(mockRedirect).toHaveBeenCalledWith(`/chat/${newThreadId}`);
  });

  it('should handle auth failure', async () => {
    const authError = new Error('REDIRECT: /login');
    mockRequireAuthServer.mockRejectedValue(authError);

    await expect(Page()).rejects.toThrow('REDIRECT: /login');

    expect(mockRequireAuthServer).toHaveBeenCalled();
    expect(mockGetMostRecentThread).not.toHaveBeenCalled();
    expect(mockCreateThread).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
