/**
 * Client-safe URL helper functions for chat navigation.
 *
 * Contains pure functions that can be safely used in both client and server components.
 * No database imports or server-only code should be added to maintain client compatibility.
 */

/**
 * Builds a URL for navigating to a specific chat thread.
 *
 * @param threadId - The thread ID (must not be empty)
 * @returns The chat thread URL path
 * @throws If threadId is empty or whitespace-only
 */
export function getChatUrl(threadId: string): string {
  if (!threadId || !threadId.trim()) {
    throw new Error('Thread ID cannot be empty');
  }
  return `/journal/chat/${threadId}`;
}
