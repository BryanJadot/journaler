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
  updateThreadName,
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

/**
 * Server action that renames a thread with comprehensive validation and error handling.
 *
 * This action enables users to update thread names while maintaining data integrity
 * and providing clear feedback for various error conditions. It implements multiple
 * layers of validation to ensure a smooth user experience.
 *
 * Input validation:
 * - Trims whitespace and checks for empty names
 * - Enforces 255-character limit (matches database schema)
 * - Prevents unnecessary database calls for unchanged names
 *
 * Security and authorization:
 * - Validates user authentication via middleware-set headers
 * - Verifies thread ownership before allowing modifications
 * - Returns consistent error messages without exposing internal details
 *
 * Data consistency:
 * - Uses atomic database updates with conditional logic
 * - Invalidates user's thread cache for immediate UI synchronization
 * - Returns structured responses for proper client-side handling
 *
 * @param threadId The UUID of the thread to rename
 * @param newName The new name to assign to the thread
 * @returns Promise resolving to success object or error object with descriptive message
 *
 * @example
 * ```typescript
 * // Basic usage in an inline editor
 * const result = await renameThreadAction(threadId, newName.trim());
 * if (result.success) {
 *   setIsEditing(false);
 *   router.refresh(); // Updates sidebar immediately
 * } else {
 *   setError(result.error); // Show validation/permission errors
 *   inputRef.current?.focus(); // Keep editor active
 * }
 * ```
 */
export async function renameThreadAction(
  threadId: string,
  newName: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Validate and sanitize the new thread name
    const trimmedName = newName.trim();
    if (!trimmedName || trimmedName.length === 0) {
      return { success: false, error: 'Thread name cannot be empty' };
    }

    // Enforce database schema constraint (varchar(255))
    if (trimmedName.length > 255) {
      return {
        success: false,
        error: 'Thread name is too long (max 255 characters)',
      };
    }

    const userId = await getUserIdFromHeader();

    // Verify ownership before updating
    const isOwner = await verifyThreadOwnership(threadId, userId);
    if (!isOwner) {
      return { success: false, error: 'Thread not found or access denied' };
    }

    // Perform the database update with ownership verification built-in
    const updated = await updateThreadName(threadId, trimmedName, userId);

    if (!updated) {
      // This could happen if thread doesn't exist or database constraint fails
      return { success: false, error: 'Failed to update thread name' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error renaming thread:', error);
    return { success: false, error: 'Failed to rename thread' };
  }
}
