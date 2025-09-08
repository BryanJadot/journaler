'use client';

import { useEffect } from 'react';

import { ChatMessage } from '@/lib/chat/types';
import { useThread } from '@/lib/store/thread-store';

/**
 * Props for the ThreadInitializer component
 */
interface ThreadInitializerProps {
  threadId: string;
  threadName: string;
  messages: ChatMessage[];
}

/**
 * Client component that initializes the thread store with server data.
 *
 * This component runs once on mount to populate the Zustand store
 * with the thread data from the server. It doesn't render anything visible.
 *
 * @param props - Component props
 * @param props.threadId - The thread ID
 * @param props.threadName - The thread name
 * @param props.messages - Initial messages for the thread
 */
export default function ThreadInitializer({
  threadId,
  threadName,
  messages,
}: ThreadInitializerProps) {
  const initializeThread = useThread((state) => state.initializeThread);

  useEffect(() => {
    initializeThread(threadId, threadName, messages);
  }, [threadId, threadName, messages, initializeThread]);

  // This component doesn't render anything
  return null;
}
