import { redirect } from 'next/navigation';

import { createNewThreadAction } from '@/app/journal/chat/actions';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import { createThread } from '@/lib/db/threads';

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
