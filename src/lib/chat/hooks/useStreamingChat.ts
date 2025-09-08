import { useCallback, useState } from 'react';

import { useSetMessages, useThreadId, useThreadMessages } from '@/lib/store/thread-store';
import { ChatMessage } from '@/lib/chat/types';

/**
 * Status of the streaming chat operation
 */
type StreamingStatus = 'idle' | 'loading' | 'error';

/**
 * Custom hook for streaming chat with OpenAI integration.
 *
 * This hook provides streaming chat functionality that:
 * - Sends messages to our custom API endpoint
 * - Handles Server-Sent Events streaming responses
 * - Automatically syncs messages to the thread store
 * - Manages loading and error states
 *
 * @returns Object with chat status and sendMessage function
 *
 * @example
 * ```tsx
 * const { status, sendMessage } = useStreamingChat();
 * const messages = useThreadMessages(); // Get messages from store
 * 
 * const handleSend = () => {
 *   sendMessage("Hello, how are you?");
 * };
 * ```
 */
export function useStreamingChat() {
  const [status, setStatus] = useState<StreamingStatus>('idle');
  const threadId = useThreadId();
  const messages = useThreadMessages();
  const setMessages = useSetMessages();

  /**
   * Sends a message and streams the AI response.
   *
   * This function:
   * 1. Validates that we have a thread ID
   * 2. Adds the user message to the store immediately
   * 3. Calls our streaming API endpoint
   * 4. Processes the Server-Sent Events stream
   * 5. Updates the store with the assistant's response as it streams
   *
   * @param content - The message content to send
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!threadId) {
        console.error('Cannot send message: no thread ID available');
        return;
      }

      if (!content.trim()) {
        console.error('Cannot send empty message');
        return;
      }

      setStatus('loading');

      // Create user message and add it to store immediately
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      // Create placeholder assistant message for streaming
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      };

      try {
        // Call our streaming API endpoint
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content.trim(),
            threadId,
            // Send message history (excluding the user message we just added)
            history: messages || [],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        if (!response.body) {
          throw new Error('No response body available');
        }

        // Process Server-Sent Events stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Add placeholder message to store
        const messagesWithPlaceholder = [...updatedMessages, assistantMessage];
        setMessages(messagesWithPlaceholder);

        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode the chunk and process Server-Sent Events
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'chunk') {
                  // Update accumulated content
                  accumulatedContent += data.content;

                  // Update the assistant message in the store
                  const updatedAssistantMessage: ChatMessage = {
                    ...assistantMessage,
                    content: accumulatedContent,
                  };

                  const finalMessages = [
                    ...updatedMessages,
                    updatedAssistantMessage,
                  ];

                  setMessages(finalMessages);
                } else if (data.type === 'complete') {
                  // Streaming completed successfully
                  setStatus('idle');
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Streaming error occurred');
                }
              } catch (parseError) {
                // Skip malformed JSON lines
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      } catch (error) {
        console.error('Chat streaming error:', error);
        setStatus('error');

        // Update the assistant message with error content
        const errorMessage: ChatMessage = {
          ...assistantMessage,
          content: error instanceof Error ? error.message : 'An error occurred',
        };

        const errorMessages = [...updatedMessages, errorMessage];
        setMessages(errorMessages);

        // Reset status after a delay
        setTimeout(() => setStatus('idle'), 3000);
      }
    },
    [threadId, messages, setMessages]
  );

  return {
    status,
    sendMessage,
  };
}