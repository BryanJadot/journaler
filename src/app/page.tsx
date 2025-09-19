import { redirect } from 'next/navigation';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { getOrCreateChatUrl } from '@/lib/chat/redirect-helpers';

/**
 * Homepage component that redirects authenticated users to their chat interface.
 *
 * This component serves as the application entry point and implements the following flow:
 * 1. Middleware validates authentication and sets user headers
 * 2. If user is authenticated, redirect to their most recent chat thread
 * 3. If no threads exist, create a new one and redirect there
 * 4. If user is not authenticated, middleware redirects to login
 *
 * This ensures users always land in their personalized chat interface when visiting
 * the root URL, providing a seamless experience without showing an empty landing page.
 *
 * @returns Always redirects, never renders content
 */
export default async function HomePage() {
  // Extract user ID from middleware-set headers (auth already validated)
  const userId = await getUserIdFromHeader();

  // Get URL for user's most recent chat thread or create a new one if none exists
  const chatUrl = await getOrCreateChatUrl(userId);
  redirect(chatUrl);
}
