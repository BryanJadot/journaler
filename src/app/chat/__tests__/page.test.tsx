import { redirect } from 'next/navigation';

import { createUniqueUserId } from '@/__tests__/helpers/test-helpers';
import * as requireAuthServerModule from '@/lib/auth/require-auth-server';
import * as chatServiceModule from '@/lib/chat/service';

import Page from '../page';

// Mock external dependencies for isolated unit testing
jest.mock('@/lib/auth/require-auth-server');
jest.mock('@/lib/chat/service');
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Type-safe mock function references for better IDE support and type checking
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

/**
 * Test suite for the main chat page that handles thread routing logic.
 *
 * This page serves as a router that either redirects to the most recent thread
 * or creates a new thread if none exists. It's the entry point for /chat route.
 */
describe('/chat page', () => {
  beforeEach(() => {
    // Reset all mock call counts and return values before each test
    jest.clearAllMocks();
  });

  /**
   * Test that the page redirects to the most recent thread when user has existing threads.
   * This implements the UX pattern of returning users to their latest conversation.
   */
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

  /**
   * Test that the page creates a new thread when user has no existing threads.
   * This ensures new users or users who have deleted all threads get a fresh start.
   */
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

  /**
   * Test that authentication failures are properly handled and propagated.
   * This ensures unauthorized users cannot access the chat functionality.
   */
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
