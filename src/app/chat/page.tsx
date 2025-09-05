import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getMostRecentThread, createThread } from '@/lib/chat/service';

import ChatInterface from './components/ChatInterface';

export default async function Page() {
  // Get the authenticated user (this handles auth and redirects if needed)
  const userId = await requireAuthServer();

  // Fetch the most recent thread and its messages on the server
  let initialThreadId: string;
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
    } else {
      // No existing thread, create a new one
      const newThread = await createThread(userId, 'New Chat');
      initialThreadId = newThread.id;
    }
  } catch (error) {
    console.error('Failed to load or create thread on server:', error);
    throw error; // Let error boundary handle this
  }

  return (
    <ChatInterface
      threadId={initialThreadId}
      initialMessages={initialMessages}
    />
  );
}
