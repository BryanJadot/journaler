'use server';

import { redirect } from 'next/navigation';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import {
  createThread,
  deleteThread,
  getThreadById,
  setThreadStarred,
  verifyThreadOwnership,
} from '@/lib/db/threads';

/**
 * Server action that creates a new chat thread and redirects to it.
 *
 * Triggered by the sidebar's "New Chat" button. Creates a new thread
 * with default name, invalidates the user's thread cache for immediate
 * sidebar updates, and redirects to the new thread's chat page.
 *
 * @throws If user is not authenticated or thread creation fails
 * @returns Always redirects, never returns a value
 *
 * @example
 * // In a form component
 * <form action={createNewThreadAction}>
 *   <button type="submit">+ New Chat</button>
 * </form>
 */
export async function createNewThreadAction() {
  // Verify user authentication (middleware sets headers)
  const userId = await getUserIdFromHeader();

  // Create new thread with default name - user can rename it later
  const newThread = await createThread(userId, DEFAULT_THREAD_NAME);

  // Redirect immediately to the new thread's chat page
  redirect(getChatUrl(newThread.id));
}

/**
 * Server action that permanently deletes a chat thread and all its messages.
 *
 * This action provides secure thread deletion by first verifying ownership
 * before performing the deletion operation. It's designed to be called from
 * client components (like dropdown menus) and returns a success/error status
 * for proper UI feedback. The deletion includes all associated messages to
 * maintain database integrity.
 *
 * Key behaviors:
 * - Validates user authentication via headers set by middleware
 * - Verifies thread ownership before allowing deletion
 * - Deletes thread and all associated messages in a transaction
 * - Invalidates user's thread cache for immediate sidebar refresh
 * - Returns structured response for client-side error handling
 *
 * @param threadId The UUID of the thread to delete
 * @returns Promise resolving to an object with success boolean and optional error message
 *
 * @example
 * ```typescript
 * // In a React component
 * const handleDelete = async () => {
 *   const result = await deleteThreadAction(threadId);
 *   if (result.success) {
 *     // Handle successful deletion - maybe navigate away
 *     router.push('/');
 *   } else {
 *     // Show error message to user
 *     setError(result.error);
 *   }
 * };
 * ```
 */
export async function deleteThreadAction(threadId: string) {
  const userId = await getUserIdFromHeader();

  // Verify ownership before deletion
  const isOwner = await verifyThreadOwnership(threadId, userId);
  if (!isOwner) {
    return { success: false, error: 'Thread not found or access denied' };
  }

  // Delete the thread
  await deleteThread(threadId, userId);

  return { success: true };
}

/**
 * Server action that toggles the starred status of a thread.
 *
 * This action provides secure thread starring/unstarring by verifying ownership
 * before performing the update. Starred threads appear at the top of the thread
 * list for quick access. Returns a structured response for proper UI feedback.
 *
 * Key behaviors:
 * - Validates user authentication via headers set by middleware
 * - Verifies thread ownership before allowing the star toggle
 * - Updates thread starred status and updatedAt timestamp
 * - Invalidates user's thread cache for immediate sidebar refresh
 * - Returns structured response for client-side handling
 *
 * @param threadId The UUID of the thread to star/unstar
 * @param starred Whether to star (true) or unstar (false) the thread
 * @returns Promise resolving to an object with success boolean and optional error message
 *
 * @example
 * ```typescript
 * // In a React component
 * const handleToggleStar = async () => {
 *   const result = await setThreadStarredAction(threadId, !thread.starred);
 *   if (result.success) {
 *     // Update local state or refresh
 *     router.refresh();
 *   } else {
 *     // Show error message to user
 *     setError(result.error);
 *   }
 * };
 * ```
 */
export async function setThreadStarredAction(
  threadId: string,
  starred: boolean
) {
  try {
    const userId = await getUserIdFromHeader();

    // Verify ownership before updating
    const isOwner = await verifyThreadOwnership(threadId, userId);
    if (!isOwner) {
      return { success: false, error: 'Thread not found or access denied' };
    }

    // Update the starred status
    await setThreadStarred(threadId, starred, userId);

    return { success: true };
  } catch (error) {
    console.error('Error updating thread starred status:', error);
    return { success: false, error: 'Failed to update starred status' };
  }
}

/**
 * Server action that retrieves the current name of a thread.
 *
 * Used for polling thread name updates after auto-naming occurs in the background.
 * Only returns the thread name if the user owns the thread.
 *
 * @param threadId The UUID of the thread to get the name for
 * @returns Promise resolving to an object with success status and thread name or error
 *
 * @example
 * ```typescript
 * const result = await getThreadNameAction(threadId);
 * if (result.success && result.name !== DEFAULT_THREAD_NAME) {
 *   // Thread has been renamed, refresh the UI
 *   router.refresh();
 * }
 * ```
 */
export async function getThreadNameAction(
  threadId: string
): Promise<
  { success: true; name: string } | { success: false; error: string }
> {
  try {
    const userId = await getUserIdFromHeader();

    // Verify ownership before returning thread data
    const isOwner = await verifyThreadOwnership(threadId, userId);
    if (!isOwner) {
      return {
        success: false,
        error: 'Thread not found or access denied',
      };
    }

    // Get the thread to retrieve its current name
    const thread = await getThreadById(threadId);

    if (!thread) {
      return {
        success: false,
        error: 'Thread not found',
      };
    }

    return {
      success: true,
      name: thread.name,
    };
  } catch (error) {
    console.error('Error getting thread name:', error);
    return {
      success: false,
      error: 'Failed to retrieve thread name',
    };
  }
}
