import { redirect } from 'next/navigation';

import { silenceConsoleErrors } from '@/__tests__/helpers/console-helpers';
import {
  createNewThreadAction,
  renameThreadAction,
  setThreadStarredAction,
} from '@/app/journal/chat/actions';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import {
  createThread,
  setThreadStarred,
  updateThreadName,
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
  updateThreadName: jest.fn(),
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

/**
 * Test suite for renameThreadAction server action.
 *
 * This server action handles renaming threads and must:
 * - Verify user authentication before proceeding
 * - Validate the new thread name (not empty, not too long)
 * - Check thread ownership before allowing updates
 * - Update the thread name in the database
 * - Return appropriate success/error responses
 * - Handle authentication, validation, and database errors gracefully
 */
describe('renameThreadAction', () => {
  const mockUserId = 'test-user-123';
  const mockThreadId = 'thread-456';

  // Silence console errors for error handling tests
  const { expectConsoleError } = silenceConsoleErrors();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should rename a thread when user is owner', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    (updateThreadName as jest.Mock).mockResolvedValue(true);

    // Execute the action
    const result = await renameThreadAction(mockThreadId, 'New Thread Name');

    // Verify authentication was checked
    expect(getUserIdFromHeader).toHaveBeenCalledTimes(1);

    // Verify ownership was checked
    expect(verifyThreadOwnership).toHaveBeenCalledWith(
      mockThreadId,
      mockUserId
    );

    // Verify thread was renamed with trimmed name
    expect(updateThreadName).toHaveBeenCalledWith(
      mockThreadId,
      'New Thread Name',
      mockUserId
    );

    // Verify success response
    expect(result).toEqual({ success: true });
  });

  it('should trim whitespace from thread names', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    (updateThreadName as jest.Mock).mockResolvedValue(true);

    // Execute the action with whitespace
    const result = await renameThreadAction(mockThreadId, '  Trimmed Name  ');

    // Verify thread was renamed with trimmed name
    expect(updateThreadName).toHaveBeenCalledWith(
      mockThreadId,
      'Trimmed Name',
      mockUserId
    );

    // Verify success response
    expect(result).toEqual({ success: true });
  });

  it('should return error for empty thread name', async () => {
    // Execute the action with empty name
    const result = await renameThreadAction(mockThreadId, '');

    // Verify no authentication or database calls were made
    expect(getUserIdFromHeader).not.toHaveBeenCalled();
    expect(verifyThreadOwnership).not.toHaveBeenCalled();
    expect(updateThreadName).not.toHaveBeenCalled();

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Thread name cannot be empty',
    });
  });

  it('should return error for whitespace-only thread name', async () => {
    // Execute the action with whitespace-only name
    const result = await renameThreadAction(mockThreadId, '   ');

    // Verify no authentication or database calls were made
    expect(getUserIdFromHeader).not.toHaveBeenCalled();
    expect(verifyThreadOwnership).not.toHaveBeenCalled();
    expect(updateThreadName).not.toHaveBeenCalled();

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Thread name cannot be empty',
    });
  });

  it('should return error for thread name exceeding 255 characters', async () => {
    // Create a string with 256 characters
    const longName = 'a'.repeat(256);

    // Execute the action
    const result = await renameThreadAction(mockThreadId, longName);

    // Verify no authentication or database calls were made
    expect(getUserIdFromHeader).not.toHaveBeenCalled();
    expect(verifyThreadOwnership).not.toHaveBeenCalled();
    expect(updateThreadName).not.toHaveBeenCalled();

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Thread name is too long (max 255 characters)',
    });
  });

  it('should accept thread name at maximum length of 255 characters', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    (updateThreadName as jest.Mock).mockResolvedValue(true);

    // Create a string with exactly 255 characters
    const maxLengthName = 'a'.repeat(255);

    // Execute the action
    const result = await renameThreadAction(mockThreadId, maxLengthName);

    // Verify thread was renamed
    expect(updateThreadName).toHaveBeenCalledWith(
      mockThreadId,
      maxLengthName,
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
    const result = await renameThreadAction(mockThreadId, 'New Name');

    // Verify ownership was checked
    expect(verifyThreadOwnership).toHaveBeenCalledWith(
      mockThreadId,
      mockUserId
    );

    // Verify updateThreadName was not called
    expect(updateThreadName).not.toHaveBeenCalled();

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
    const result = await renameThreadAction(mockThreadId, 'New Name');

    // Verify auth error was caught
    expect(result).toEqual({
      success: false,
      error: 'Failed to rename thread',
    });

    // Verify console error was logged
    expectConsoleError('Error renaming thread');

    // Verify no database operations were attempted
    expect(verifyThreadOwnership).not.toHaveBeenCalled();
    expect(updateThreadName).not.toHaveBeenCalled();
  });

  it('should return error when updateThreadName returns false', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    (updateThreadName as jest.Mock).mockResolvedValue(false);

    // Execute the action
    const result = await renameThreadAction(mockThreadId, 'New Name');

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Failed to update thread name',
    });

    // Verify updateThreadName was called
    expect(updateThreadName).toHaveBeenCalledWith(
      mockThreadId,
      'New Name',
      mockUserId
    );
  });

  it('should handle database errors', async () => {
    // Setup mocks
    (getUserIdFromHeader as jest.Mock).mockResolvedValue(mockUserId);
    (verifyThreadOwnership as jest.Mock).mockResolvedValue(true);
    const dbError = new Error('Database connection failed');
    (updateThreadName as jest.Mock).mockRejectedValue(dbError);

    // Execute the action
    const result = await renameThreadAction(mockThreadId, 'New Name');

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Failed to rename thread',
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
    const result = await renameThreadAction(mockThreadId, 'New Name');

    // Verify error response
    expect(result).toEqual({
      success: false,
      error: 'Failed to rename thread',
    });

    // Verify updateThreadName was not called
    expect(updateThreadName).not.toHaveBeenCalled();

    // Verify console error was logged
    expectConsoleError('Database query failed');
  });
});
