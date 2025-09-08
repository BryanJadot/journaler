'use client';

import { useThreadMessages } from '@/lib/store/thread-store';

import MessageList from './MessageList';

/**
 * Live message list component that subscribes to thread store.
 *
 * Displays messages from the thread store, automatically updating
 * when new messages are added via the AI chat integration.
 */
export default function LiveMessageList() {
  const messages = useThreadMessages();

  // Only render if there are messages from the store
  if (messages.length === 0) {
    return null;
  }

  return <MessageList messages={messages} />;
}
