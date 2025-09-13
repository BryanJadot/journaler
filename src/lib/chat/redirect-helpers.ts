import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { createThread, getMostRecentThread } from '@/lib/chat/service';

/**
 * Builds a URL for a specific chat thread
 * @param threadId - The thread ID (must not be empty)
 * @returns The chat thread URL
 * @throws {Error} If threadId is empty or whitespace-only
 */
export function getChatUrl(threadId: string): string {
  if (!threadId || !threadId.trim()) {
    throw new Error('Thread ID cannot be empty');
  }
  return `/journal/chat/${threadId}`;
}

/**
 * Gets the appropriate chat URL for a user, either their most recent thread
 * or a newly created one if they have no threads.
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
