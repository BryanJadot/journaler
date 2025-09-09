import { redirect } from 'next/navigation';

import { createUniqueUserId } from '@/__tests__/helpers/test-helpers';
import * as authModule from '@/app/(authed)/get-authed-user';
import * as chatServiceModule from '@/lib/chat/service';

import Page from '../page';

// Mock external dependencies for isolated unit testing
jest.mock('@/app/(authed)/get-authed-user');
jest.mock('@/lib/chat/service');
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Type-safe mock function references for better IDE support and type checking
const mockGetCachedAuthedUserOrRedirect =
  authModule.getCachedAuthedUserOrRedirect as jest.MockedFunction<
    typeof authModule.getCachedAuthedUserOrRedirect
  >;

const mockGetMostRecentThread =
  chatServiceModule.getMostRecentThread as jest.MockedFunction<
    typeof chatServiceModule.getMostRecentThread
  >;

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;

/**
 * Test suite for the main chat page that handles thread routing logic.
 *
 * This page serves as a router that either redirects to the most recent thread
 * or redirects to /chat/new for thread creation. It's the entry point for /chat route.
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

    mockGetCachedAuthedUserOrRedirect.mockResolvedValue(userId);
    mockGetMostRecentThread.mockResolvedValue({
      id: threadId,
      userId,
      name: 'Test Thread',
      updatedAt: new Date(),
      messages: [],
    });

    await Page();

    expect(mockGetCachedAuthedUserOrRedirect).toHaveBeenCalled();
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(userId);
    expect(mockRedirect).toHaveBeenCalledWith(`/chat/${threadId}`);
  });

  /**
   * Test that the page redirects to /chat/new when user has no existing threads.
   * This ensures new users or users who have deleted all threads are sent to the
   * dedicated thread creation page for better separation of concerns.
   */
  it('should redirect to /chat/new when no threads exist', async () => {
    const userId = createUniqueUserId();

    mockGetCachedAuthedUserOrRedirect.mockResolvedValue(userId);
    mockGetMostRecentThread.mockResolvedValue(undefined);

    await Page();

    expect(mockGetCachedAuthedUserOrRedirect).toHaveBeenCalled();
    expect(mockGetMostRecentThread).toHaveBeenCalledWith(userId);
    expect(mockRedirect).toHaveBeenCalledWith('/chat/new');
  });

  /**
   * Test that authentication failures are properly handled and propagated.
   * This ensures unauthorized users cannot access the chat functionality.
   */
  it('should handle auth failure', async () => {
    const authError = new Error('REDIRECT: /login');
    mockGetCachedAuthedUserOrRedirect.mockRejectedValue(authError);

    await expect(Page()).rejects.toThrow('REDIRECT: /login');

    expect(mockGetCachedAuthedUserOrRedirect).toHaveBeenCalled();
    expect(mockGetMostRecentThread).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
