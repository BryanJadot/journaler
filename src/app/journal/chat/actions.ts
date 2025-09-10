'use server';

import { redirect } from 'next/navigation';

import { getCachedAuthedUserOrRedirect } from '@/lib/auth/get-authed-user';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import { getChatUrl } from '@/lib/chat/redirect-helpers';
import { createThread } from '@/lib/chat/service';

/**
 * Server action to create a new chat thread and redirect to it.
 * Used by the Sidebar's "New Chat" button.
 */
export async function createNewThreadAction() {
  const userId = await getCachedAuthedUserOrRedirect();
  const newThread = await createThread(userId, DEFAULT_THREAD_NAME);
  redirect(getChatUrl(newThread.id));
}
