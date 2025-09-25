import { redirect } from 'next/navigation';

import { silenceConsoleErrors } from '@/__tests__/helpers/console-helpers';
import {
  createNewThreadAction,
  setThreadStarredAction,
} from '@/app/journal/chat/actions';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import {
  createThread,
  setThreadStarred,
  verifyThreadOwnership,
} from '@/lib/db/threads';

// Mock all external dependencies to isolate the server action logic
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}));

jest.mock('@/lib/db/threads', () => ({
  createThread: jest.fn(),
  getUserThreadsCacheTag: jest.fn(),
  setThreadStarred: jest.fn(),
  verifyThreadOwnership: jest.fn(),
}));

jest.mock('@/lib/auth/get-user-from-header', () => ({
  getUserIdFromHeader: jest.fn(),
}));

/**
 * Test suite for createNewThreadAction server action.
 *
 * This server action is triggered by the sidebar's "New Chat" button and must:
 * - Verify user authentication before proceeding
 * - Create a new thread in the database
 * - Redirect user to the new thread's chat page
 * - Handle authentication and database errors appropriately
 */
describe('createNewThreadAction', () => {
  const mockUserId = 'test-user-123';
  const mockThreadId = 'thread-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new thread and redirect to it', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockResolvedValue({ id: mockThreadId });

    // Execute the action
    await createNewThreadAction();

    // Verify authentication was checked
    expect(getUserIdFromHeader).toHaveBeenCalledTimes(1);

    // Verify thread was created with correct parameters
    expect(createThread).toHaveBeenCalledWith(mockUserId, DEFAULT_THREAD_NAME);

    // Verify redirect to the new thread
    expect(redirect).toHaveBeenCalledWith(getChatUrl(mockThreadId));
  });

  it('should propagate authentication errors', async () => {
    const authError = new Error(
      'User ID not found in headers. Authentication required.'
    );
    (getUserIdFromHeader as jest.Mock).mockRejectedValue(authError);

    await expect(createNewThreadAction()).rejects.toThrow(
      'User ID not found in headers. Authentication required.'
    );

    expect(createThread).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('should propagate thread creation errors', async () => {
    const createError = new Error('Database error');
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (createThread as jest.Mock).mockRejectedValue(createError);

    await expect(createNewThreadAction()).rejects.toThrow('Database error');

    expect(redirect).not.toHaveBeenCalled();
  });
});

/**
 * Test suite for setThreadStarredAction server action.
 *
 * This server action handles starring/unstarring threads and must:
 * - Verify user authentication before proceeding
 * - Check thread ownership before allowing updates
 * - Update the thread's starred status in the database
 * - Return appropriate success/error responses
 * - Handle authentication and authorization errors gracefully
 */
describe('setThreadStarredAction', () => {
  const mockUserId = 'test-user-123';
  const mockThreadId = 'thread-456';

  // Silence console errors for error handling tests
  const { expectConsoleError } = silenceConsoleErrors();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should star a thread when user is owner', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    (setThreadStarred as jest.Mock).mockResolvedValue(undefined);

    // Execute the action
    const result = await setThreadStarredAction(mockThreadId, true);

    // Verify authentication was checked
    expect(getUserIdFromHeader).toHaveBeenCalledTimes(1);

    // Verify ownership was checked
    expect(verifyThreadOwnership).toHaveBeenCalledWith(
      mockThreadId,
      mockUserId
    );

    // Verify thread was starred
    expect(setThreadStarred).toHaveBeenCalledWith(
      mockThreadId,
      true,
      mockUserId
    );

    // Verify success response
    expect(result).toEqual({ success: true });
  });

  it('should unstar a thread when user is owner', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    (setThreadStarred as jest.Mock).mockResolvedValue(undefined);

    // Execute the action
    const result = await setThreadStarredAction(mockThreadId, false);

    // Verify thread was unstarred
    expect(setThreadStarred).toHaveBeenCalledWith(
      mockThreadId,
      false,
      mockUserId
    );

    // Verify success response
    expect(result).toEqual({ success: true });
  });

  it('should return error when user is not owner', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(false);

    // Execute the action
    const result = await setThreadStarredAction(mockThreadId, true);

    // Verify ownership was checked
    expect(verifyThreadOwnership).toHaveBeenCalledWith(
      mockThreadId,
      mockUserId
    );

    // Verify setThreadStarred was not called
    expect(setThreadStarred).not.toHaveBeenCalled();

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Thread not found or access denied',
    });
  });

  it('should handle authentication errors', async () => {
    // Setup mocks
    const authError = new Error(
      'User ID not found in headers. Authentication required.'
    );
    (getUserIdFromHeader as jest.Mock).mockRejectedValue(authError);

    // Execute the action
    const result = await setThreadStarredAction(mockThreadId, true);

    // Verify auth error was caught
    expect(result).toEqual({
      success: false,
      error: 'Failed to update starred status',
    });

    // Verify console error was logged
    expectConsoleError('Error updating thread starred status');

    // Verify no database operations were attempted
    expect(verifyThreadOwnership).not.toHaveBeenCalled();
    expect(setThreadStarred).not.toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    const dbError = new Error('Database connection failed');
    (setThreadStarred as jest.Mock).mockRejectedValue(dbError);

    // Execute the action
    const result = await setThreadStarredAction(mockThreadId, true);

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Failed to update starred status',
    });

    // Verify console error was logged
    expectConsoleError('Database connection failed');
  });

  it('should handle ownership check errors', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    const ownershipError = new Error('Database query failed');
    (verifyThreadOwnership as jest.Mock).mockRejectedValue(ownershipError);

    // Execute the action
    const result = await setThreadStarredAction(mockThreadId, true);

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Failed to update starred status',
    });

    // Verify setThreadStarred was not called
    expect(setThreadStarred).not.toHaveBeenCalled();

    // Verify console error was logged
    expectConsoleError('Database query failed');
  });
});
