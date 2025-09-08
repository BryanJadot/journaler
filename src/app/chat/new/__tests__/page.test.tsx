import { redirect } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { createThread } from '@/lib/chat/service';

import NewChatPage from '../page';

/**
 * Test suite for the NewChatPage component.
 *
 * This test file validates the new chat page's behavior including:
 * - Successful chat thread creation and redirection
 * - Authentication error handling
 * - Thread creation failure scenarios
 * - Proper use of constants and URL formatting
 */

// Mock all external dependencies to isolate component behavior
// Mock Next.js navigation to capture redirect calls without actual navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

// Mock authentication service to control auth state in tests
jest.mock('@/lib/auth/require-auth-server', () => ({
  requireAuthServer: jest.fn(),
}));

// Mock chat service to simulate thread creation without database calls
jest.mock('@/lib/chat/service', () => ({
  createThread: jest.fn(),
}));

describe('NewChatPage', () => {
  // Test data constants for consistent mocking
  const mockUserId = 'test-user-123';
  const mockThreadId = 'thread-456';

  /**
   * Reset all mocks before each test to ensure test isolation
   * and prevent test interdependence
   */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test the happy path: authenticated user successfully creates a new thread
   * and gets redirected to it. This is the primary flow for the component.
   */
  it('should create a new thread and redirect to it when user is authenticated', async () => {
    // Setup mocks
    (requireAuthServer as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockResolvedValue({ id: mockThreadId });

    // Execute the page
    await NewChatPage();

    // Verify authentication was checked
    expect(requireAuthServer).toHaveBeenCalledTimes(1);

    // Verify thread was created with correct parameters
    expect(createThread).toHaveBeenCalledWith(mockUserId, DEFAULT_THREAD_NAME);
    expect(createThread).toHaveBeenCalledTimes(1);

    // Verify redirect to the new thread
    expect(redirect).toHaveBeenCalledWith(`/chat/${mockThreadId}`);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  /**
   * Test authentication failure scenario: ensures the component properly
   * propagates auth errors and doesn't attempt thread creation or redirect.
   */
  it('should handle authentication failure', async () => {
    // Setup mock to throw authentication error
    const authError = new Error('Unauthorized');
    (requireAuthServer as jest.Mock).mockRejectedValue(authError);

    // Execute and expect error to be thrown
    await expect(NewChatPage()).rejects.toThrow('Unauthorized');

    // Verify createThread was not called
    expect(createThread).not.toHaveBeenCalled();

    // Verify redirect was not called
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * Test thread creation failure: verifies that errors during thread creation
   * are properly propagated and don't result in invalid redirects.
   */
  it('should handle thread creation failure', async () => {
    // Setup mocks
    (requireAuthServer as jest.Mock).mockResolvedValue(mockUserId);
    const createError = new Error('Failed to create thread');
    (createThread as jest.Mock).mockRejectedValue(createError);

    // Execute and expect error to be thrown
    await expect(NewChatPage()).rejects.toThrow('Failed to create thread');

    // Verify authentication was checked
    expect(requireAuthServer).toHaveBeenCalledTimes(1);

    // Verify thread creation was attempted
    expect(createThread).toHaveBeenCalledWith(mockUserId, DEFAULT_THREAD_NAME);

    // Verify redirect was not called due to error
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * Test constant usage: ensures the component uses the correct default thread name
   * from the constants file, maintaining consistency across the application.
   */
  it('should use the correct default thread name from constants', async () => {
    // Setup mocks
    (requireAuthServer as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockResolvedValue({ id: mockThreadId });

    // Execute the page
    await NewChatPage();

    // Verify the thread was created with the constant value
    expect(createThread).toHaveBeenCalledWith(mockUserId, DEFAULT_THREAD_NAME);
  });

  /**
   * Test URL formatting: verifies that redirects use the correct URL pattern
   * with different thread IDs to ensure proper navigation.
   */
  it('should redirect to the correct thread URL format', async () => {
    // Setup mocks with different thread ID
    const customThreadId = 'custom-thread-789';
    (requireAuthServer as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockResolvedValue({ id: customThreadId });

    // Execute the page
    await NewChatPage();

    // Verify redirect URL format
    expect(redirect).toHaveBeenCalledWith(`/chat/${customThreadId}`);
  });
});
