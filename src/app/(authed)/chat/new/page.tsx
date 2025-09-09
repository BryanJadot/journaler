import { redirect } from 'next/navigation';

import { getCachedAuthedUserOrRedirect } from '@/app/(authed)/get-authed-user';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { createThread } from '@/lib/chat/service';

/**
 * New chat page component that creates a fresh chat thread.
 *
 * This server component handles the creation of new chat threads by:
 * 1. Verifying user authentication
 * 2. Creating a new thread with the default name
 * 3. Redirecting to the newly created thread's page
 *
 * The component never renders any UI - it performs server-side actions
 * and immediately redirects, providing a seamless user experience for
 * starting new conversations.
 *
 * @returns {Promise<never>} Never returns JSX - always redirects to the new thread page
 * @throws {Error} Authentication errors that cause redirect to login page
 * @throws {Error} Database errors during thread creation
 *
 * @example
 * // This route is accessed when users click "New Chat" or navigate to /chat/new
 * // GET /chat/new -> creates thread -> redirects to /chat/[threadId]
 */
export default async function NewChatPage() {
  const userId = await getCachedAuthedUserOrRedirect();

  // Create a new thread with default name
  const newThread = await createThread(userId, DEFAULT_THREAD_NAME);

  // Redirect to the newly created thread
  redirect(`/chat/${newThread.id}`);
}
