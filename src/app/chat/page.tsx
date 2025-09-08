import { redirect } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getMostRecentThread } from '@/lib/chat/service';

/**
 * Main chat page component that serves as the entry point for /chat route.
 *
 * This page implements a smart routing strategy:
 * 1. If user has existing threads, redirect to the most recent one
 * 2. If user has no threads, redirect to /chat/new for thread creation
 *
 * This approach provides clean separation of concerns where this route only
 * handles redirection logic, while /chat/new handles new thread creation.
 * The page itself never renders UI - it only performs redirects.
 *
 * @returns Never returns JSX - always redirects to another page
 *
 * @throws {Error} May throw authentication errors that cause redirect to login
 *
 * @example
 * // User visits /chat
 * // → If threads exist: redirects to /chat/most-recent-thread-id
 * // → If no threads: redirects to /chat/new
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
    // User has no existing threads - redirect to new chat creation page
    // This provides clean separation where /chat/new handles all creation logic
    redirect('/chat/new');
  }
}
