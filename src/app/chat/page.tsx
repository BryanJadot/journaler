import { redirect } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getMostRecentThread, createThread } from '@/lib/chat/service';

export default async function Page() {
  const userId = await requireAuthServer();

  const recentThread = await getMostRecentThread(userId);

  if (recentThread) {
    redirect(`/chat/${recentThread.id}`);
  } else {
    const newThread = await createThread(userId, 'New Chat');
    redirect(`/chat/${newThread.id}`);
  }
}
