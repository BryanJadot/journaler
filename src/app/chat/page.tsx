import { redirect } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getMostRecentThread, createThread } from '@/lib/chat/service';

/**
 * Main chat page component that serves as the entry point for /chat route.
 *
 * This page implements a smart routing strategy:
 * 1. If user has existing threads, redirect to the most recent one
 * 2. If user has no threads, create a new one and redirect to it
 *
 * This approach provides a seamless UX where users always land in a chat interface
 * without needing to manually select or create threads. The page itself never renders
 * UI - it only performs redirects to specific thread pages.
 *
 * @returns Never returns JSX - always redirects to a thread-specific page
 *
 * @throws {Error} May throw authentication errors that cause redirect to login
 *
 * @example
 * // User visits /chat
 * // → If threads exist: redirects to /chat/most-recent-thread-id
 * // → If no threads: creates new thread, redirects to /chat/new-thread-id
 */
export default async function Page() {
  // Ensure user is authenticated before proceeding
  const userId = await requireAuthServer();

  // Check if user has any existing chat threads
  const recentThread = await getMostRecentThread(userId);

  if (recentThread) {
    // User has existing threads - redirect to the most recently updated one
    // This provides continuity by returning users to their latest conversation
    redirect(`/chat/${recentThread.id}`);
  } else {
    // User has no existing threads - create a new one with default name
    // This ensures new users or users with no threads get a fresh start
    const newThread = await createThread(userId, 'New Chat');
    redirect(`/chat/${newThread.id}`);
  }
}
