'use server';

import { redirect } from 'next/navigation';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import { createThread } from '@/lib/db/threads';

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
