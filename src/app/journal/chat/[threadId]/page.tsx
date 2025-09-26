import { notFound } from 'next/navigation';

import ChatContainer from '@/app/journal/chat/[threadId]/components/ChatContainer';
import MessageList from '@/app/journal/chat/[threadId]/components/MessageList';
import ThreadInitializer from '@/app/journal/chat/[threadId]/components/ThreadInitializer';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { convertDatabaseMessagesToChatMessages } from '@/lib/chat/message-helpers';
import { getThreadWithMessages } from '@/lib/db/threads';

/**
 * Dynamic chat thread page component that renders a specific chat conversation.
 *
 * This page implements a hybrid server/client architecture for optimal performance:
 * - **Server-side (SSR)**: Pre-renders existing messages for instant display and better SEO
 * - **Client-side (CSR)**: Handles interactive chat input and real-time AI communication
 * - **Shared Components**: Uses MessageList component for consistent message rendering across both contexts
 *
 * **Architecture Benefits:**
 * - Fast initial page load with server-rendered messages
 * - SEO-friendly content for chat conversations
 * - Seamless transition to client-side interactivity
 * - Shared message rendering logic prevents UI inconsistencies
 *
 * **Security Model:**
 * - Authentication handled by middleware before this component runs
 * - Thread ownership verified both server-side and in database query
 * - 404 response for any unauthorized access attempts
 *
 * @param params Next.js dynamic route parameters containing the threadId
 * @param params.threadId The unique identifier for the chat thread to load
 * @returns JSX element rendering the chat interface for the specified thread
 *
 * @throws Redirects to 404 if thread doesn't exist or user lacks access
 *
 * @see {@link ChatContainer} Client component for interactive chat features
 * @see {@link convertDatabaseMessagesToChatMessages} Message format conversion
 * @see {@link ThreadInitializer} Hydrates client store with server data
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
  // This includes the complete conversation history for immediate display
  const thread = await getThreadWithMessages(threadId);

  // Return 404 if thread doesn't exist or user doesn't own it
  // This provides security isolation between users' conversations
  if (!thread) {
    notFound();
  }

  if (thread.userId !== userId) {
    notFound();
  }

  // Transform database messages to ChatMessage format for client compatibility
  // This ensures consistent data shape between server and client rendering
  const initialMessages = convertDatabaseMessagesToChatMessages(
    thread.messages
  );

  return (
    <>
      {/* Initialize thread store with server data for client hydration */}
      {/* This ensures client state matches server-rendered content */}
      <ThreadInitializer
        threadId={threadId}
        threadName={thread.name}
        messages={initialMessages}
      />
      <ChatContainer>
        {/* Server-rendered initial messages for immediate display */}
        {/* Client-side components will take over after hydration */}
        {initialMessages.length > 0 && (
          <MessageList messages={initialMessages} />
        )}
      </ChatContainer>
    </>
  );
}
