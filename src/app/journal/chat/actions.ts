'use server';

import { redirect } from 'next/navigation';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import {
  createThread,
  deleteThread,
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
