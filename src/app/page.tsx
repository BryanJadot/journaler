import { redirect } from 'next/navigation';

import { getCachedAuthedUserOrRedirect } from '@/lib/auth/get-authed-user';
import { getOrCreateChatUrl } from '@/lib/chat/redirect-helpers';

export default async function HomePage() {
  // This will redirect to /login if not authenticated
  const userId = await getCachedAuthedUserOrRedirect();

  // If we get here, user is authenticated - redirect to their chat
  const chatUrl = await getOrCreateChatUrl(userId);
  redirect(chatUrl);
}
