import { notFound } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getThreadWithMessages } from '@/lib/chat/service';
import { ChatMessage } from '@/lib/chat/types';

import ClientChatInput from '../components/ClientChatInput';
import MessageList from '../components/MessageList';

/**
 * Dynamic chat thread page component that renders a specific chat conversation.
 *
 * This page implements a hybrid server/client architecture:
 * - Server-side: Pre-renders existing messages for instant display and better SEO
 * - Client-side: Handles interactive chat input and real-time AI communication
 * - Shared: Uses MessageList component for consistent message rendering
 *
 * @param params - Next.js dynamic route parameters containing the threadId
 * @param params.threadId - The unique identifier for the chat thread to load
 * @returns JSX element rendering the chat interface for the specified thread
 *
 * @throws {Error} Redirects to 404 if thread doesn't exist or user lacks access
 *
 * @see {@link ClientChatInput} Client component for interactive chat features
 * @see {@link ChatMessage} Unified message type used across server/client boundary
 */
export default async function Page({
  params,
}: {
  params: { threadId: string };
}) {
  // Authenticate user and get their ID
  const userId = await requireAuthServer();

  // Extract threadId from dynamic route parameters
  const { threadId } = await params;

  // Fetch thread with all messages for server-side rendering
  const thread = await getThreadWithMessages(threadId);

  // Return 404 if thread doesn't exist or user doesn't own it
  if (!thread) {
    notFound();
  }

  if (thread.userId !== userId) {
    notFound();
  }

  // Transform database messages to ChatMessage format for client compatibility
  const initialMessages: ChatMessage[] = thread.messages.map((msg) => ({
    id: msg.id.toString(),
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  }));
  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Thread identifier for debugging */}
      <div className="text-sm text-gray-500 mb-4">Thread: {threadId}</div>

      {/* Server-rendered existing messages */}
      {initialMessages.length > 0 && (
        <div className="mb-6">
          <MessageList messages={initialMessages} />
        </div>
      )}

      {/* Client-side chat input and new messages */}
      <ClientChatInput threadId={threadId} />
    </div>
  );
}
