import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/url-helpers';
import { createThread, getMostRecentThread } from '@/lib/db/threads';

/**
 * Server-side helper to get or create a chat URL for user redirection.
 *
 * Returns the user's most recent thread URL, or creates a new thread
 * with default name if the user has no existing threads. Used for
 * redirecting users to an appropriate chat page.
 *
 * @param userId - The authenticated user's ID
 * @returns The chat thread URL to redirect to
 */
export async function getOrCreateChatUrl(userId: string): Promise<string> {
  // Check if user has any existing chat threads
  const recentThread = await getMostRecentThread(userId);

  if (recentThread) {
    // User has existing threads - return the most recent one
    return getChatUrl(recentThread.id);
  } else {
    // User has no threads - create a new one
    const newThread = await createThread(userId, DEFAULT_THREAD_NAME);
    return getChatUrl(newThread.id);
  }
}
