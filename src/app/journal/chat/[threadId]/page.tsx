import { notFound } from 'next/navigation';

import ChatContainer from '@/app/journal/chat/[threadId]/components/ChatContainer';
import MessageList from '@/app/journal/chat/[threadId]/components/MessageList';
import ThreadInitializer from '@/app/journal/chat/[threadId]/components/ThreadInitializer';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { ChatMessage } from '@/lib/chat/types';
import { getThreadWithMessages } from '@/lib/db/threads';

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
 * @see {@link ChatContainer} Client component for interactive chat features
 * @see {@link ChatMessage} Unified message type used across server/client boundary
 */
export default async function Page({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const userId = await getUserIdFromHeader();

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
    <>
      {/* Initialize thread store with server data */}
      <ThreadInitializer
        threadId={threadId}
        threadName={thread.name}
        messages={initialMessages}
      />
      <ChatContainer>
        {/* Server-rendered initial messages */}
        {initialMessages.length > 0 && (
          <MessageList messages={initialMessages} />
        )}
      </ChatContainer>
    </>
  );
}
