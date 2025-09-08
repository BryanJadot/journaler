import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect } from 'react';

import { useSetMessages } from '@/lib/store/thread-store';

import { convertAIMessageToChatMessage } from '../utils/message-conversion';

/**
 * Custom hook that integrates AI SDK chat with the thread store.
 *
 * Handles AI communication and automatically syncs messages to the store.
 * Components can get messages from the store using useThreadMessages.
 *
 * @param threadId - Unique identifier for the chat thread
 * @returns Object with chat status and sendMessage function
 *
 * @example
 * ```tsx
 * const { status, sendMessage } = useAIChat(threadId);
 * const messages = useThreadMessages(); // Get messages from store
 * ```
 */
export function useAIChat(threadId: string) {
  // Initialize AI SDK chat hook
  const {
    messages: aiMessages,
    status,
    sendMessage,
  } = useChat({
    transport: new DefaultChatTransport({
      body: {
        threadId,
      },
    }),
  });

  // Get store action
  const setMessages = useSetMessages();

  // Sync AI messages to store
  useEffect(() => {
    const convertedMessages = aiMessages.map(convertAIMessageToChatMessage);
    setMessages(convertedMessages);
  }, [aiMessages, setMessages]);

  return {
    status,
    sendMessage,
  };
}
