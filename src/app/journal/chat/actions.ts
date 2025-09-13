'use server';

import { redirect } from 'next/navigation';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/redirect-helpers';
import { createThread } from '@/lib/chat/service';

/**
 * Server action to create a new chat thread and redirect to it.
 *
 * This action is triggered by the sidebar's "New Chat" button and implements:
 * 1. Authentication verification via middleware-set headers
 * 2. Thread creation in the database with default name
 * 3. Immediate redirect to the new thread's chat page
 *
 * The redirect ensures users start interacting with the new thread immediately,
 * providing a smooth UX flow from clicking "New Chat" to typing their first message.
 *
 * @throws {Error} If user is not authenticated or thread creation fails
 * @returns {Promise<never>} Always redirects, never returns
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
