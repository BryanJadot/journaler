import { notFound } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getThreadWithMessages } from '@/lib/chat/service';
import { ChatMessage } from '@/lib/chat/types';

import ChatInterface from '../components/ChatInterface';

/**
 * Dynamic chat thread page component that renders a specific chat conversation.
 *
 * This page implements Next.js 13+ dynamic routing using the [threadId] folder structure.
 * It loads an existing chat thread with its message history and renders the ChatInterface
 * component with the thread data pre-populated.
 *
 * @param params - Next.js dynamic route parameters containing the threadId
 * @param params.threadId - The unique identifier for the chat thread to load
 * @returns JSX element rendering the chat interface for the specified thread
 *
 * @throws {Error} Redirects to 404 if thread doesn't exist or user lacks access
 *
 * @example
 * // URL: /chat/abc123-def456-ghi789
 * // Will load thread with ID "abc123-def456-ghi789" and its message history
 */
export default async function Page({
  params,
}: {
  params: { threadId: string };
}) {
  // Ensure user is authenticated and get their ID
  const userId = await requireAuthServer();

  // Extract threadId from dynamic route parameters (Next.js 13+ async params)
  const { threadId } = await params;

  // Fetch the thread with all its messages from the database
  const thread = await getThreadWithMessages(threadId);

  // Return 404 if thread doesn't exist
  if (!thread) {
    notFound();
  }

  // Security check: ensure the thread belongs to the authenticated user
  // This prevents unauthorized access to other users' chat threads
  if (thread.userId !== userId) {
    notFound();
  }

  // Transform database message format to client-side ChatMessage format
  // This ensures compatibility between server-side data and client components
  const initialMessages: ChatMessage[] = thread.messages.map((msg) => ({
    id: msg.id.toString(), // Convert database ID to string for client compatibility
    role: msg.role, // Preserve message role (user, assistant, developer)
    content: msg.content, // Message text content
    createdAt: msg.createdAt.toISOString(), // Convert Date to ISO string for serialization
  }));

  return (
    <ChatInterface threadId={threadId} initialMessages={initialMessages} />
  );
}
