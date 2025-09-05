import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getMostRecentThread } from '@/lib/chat/service';

import ChatInterface from './components/ChatInterface';

export default async function Page() {
  // Get the authenticated user (this handles auth and redirects if needed)
  const userId = await requireAuthServer();

  // Fetch the most recent thread and its messages on the server
  let initialThreadId: number | undefined;
  let initialMessages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'developer';
    content: string;
    createdAt: string;
  }> = [];

  try {
    const recentThread = await getMostRecentThread(userId);
    if (recentThread) {
      initialThreadId = recentThread.id;
      initialMessages = (recentThread.messages || []).map((msg) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      }));
    }
  } catch (error) {
    console.warn('Failed to load recent thread on server:', error);
    // Continue without initial data - client will create new thread on first message
  }

  return (
    <ChatInterface
      initialThreadId={initialThreadId}
      initialMessages={initialMessages}
    />
  );
}
