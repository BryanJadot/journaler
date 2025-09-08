import { notFound } from 'next/navigation';

import { requireAuthServer } from '@/lib/auth/require-auth-server';
import { getThreadWithMessages } from '@/lib/chat/service';
import { ChatMessage } from '@/lib/chat/types';

import ChatInterface from '../components/ChatInterface';

export default async function Page({
  params,
}: {
  params: { threadId: string };
}) {
  const userId = await requireAuthServer();
  const { threadId } = await params;

  const thread = await getThreadWithMessages(threadId);

  if (!thread) {
    notFound();
  }

  if (thread.userId !== userId) {
    notFound();
  }

  const initialMessages: ChatMessage[] = thread.messages.map((msg) => ({
    id: msg.id.toString(),
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  }));

  return (
    <ChatInterface threadId={threadId} initialMessages={initialMessages} />
  );
}
