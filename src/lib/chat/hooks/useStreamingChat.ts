import { useCallback, useState } from 'react';

import { StreamingResponse } from '@/lib/chat/types/streaming';
import { useThread, useThreadId } from '@/lib/store/thread-store';

/**
 * Status of the streaming chat operation
 */
type StreamingStatus = 'idle' | 'loading' | 'error';

/**
 * Makes the API request to send a message to our chat endpoint.
 *
 * Sends the message content along with thread context. The conversation
 * history is loaded server-side from the database for better security
 * and reduced payload size.
 *
 * **Architecture Note:** Unlike many chat implementations that send full
 * conversation history with each request, this design loads history on
 * the server. This approach provides:
 * - Reduced network payload (only new message sent)
 * - Better security (server controls message access)
 * - Simplified client state management
 * - Protection against tampering with conversation history
 *
 * @param trimmedContent The user's message content (whitespace removed)
 * @param threadId Unique identifier for the conversation thread
 * @returns Promise resolving to the fetch Response object
 */
async function sendMessageRequest(
  trimmedContent: string,
  threadId: string
): Promise<Response> {
  return fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: trimmedContent,
      threadId,
    }),
  });
}

/**
 * Processes a single streaming response chunk from the AI API.
 *
 * Handles different types of streaming events (chunk, complete, error)
 * and accumulates content for real-time message updates. This enables
 * the user to see the AI response being typed in real-time.
 *
 * @param data - Parsed streaming response object
 * @param accumulatedContent - Content accumulated so far
 * @param assistantMessageId - ID of the message being updated
 * @param updateAssistantMessage - Function to update message in store
 * @param setStatus - Function to update streaming status
 * @returns Updated accumulated content string
 * @throws Error when streaming encounters an error response
 */
function processStreamChunk(
  data: StreamingResponse,
  accumulatedContent: string,
  assistantMessageId: string,
  updateAssistantMessage: (id: string, content: string) => void,
  setStatus: (status: StreamingStatus) => void
): string {
  switch (data.type) {
    case 'chunk':
      // Append new content token and update the message in real-time
      accumulatedContent += data.content;
      updateAssistantMessage(assistantMessageId, accumulatedContent);
      return accumulatedContent;

    case 'complete':
      // Streaming finished successfully, reset to idle state
      setStatus('idle');
      return accumulatedContent;

    case 'error':
      // Streaming encountered an error, propagate it up
      throw new Error(data.error || 'Streaming error occurred');

    default:
      // Unknown event type, ignore and continue
      return accumulatedContent;
  }
}

/**
 * Processes the JSON stream from the API response.
 *
 * Handles the complexities of streaming JSON over HTTP, including:
 * - Buffering incomplete JSON lines across HTTP chunks
 * - Parsing line-delimited JSON objects (JSONL format)
 * - Error handling for malformed JSON vs intentional streaming errors
 * - Graceful handling of partial reads and multi-byte characters
 *
 * **Why this complexity is necessary:**
 * HTTP streams don't guarantee complete JSON objects in each chunk. A single
 * JSON line might be split across multiple HTTP chunks, or multiple complete
 * JSON lines might arrive in one chunk. This function handles reassembly.
 *
 * **Error handling strategy:**
 * - JSON parse errors: Log and skip (network corruption, partial reads)
 * - Streaming errors: Propagate up (intentional errors from AI API)
 * - Network errors: Propagate up (connection issues)
 *
 * @param response The fetch Response with a readable stream body
 * @param assistantMessageId ID of the message being updated
 * @param updateAssistantMessage Function to update message content
 * @param setStatus Function to update streaming status
 * @throws Error for network issues or streaming errors (not JSON parse errors)
 */
async function processJsonStream(
  response: Response,
  assistantMessageId: string,
  updateAssistantMessage: (id: string, content: string) => void,
  setStatus: (status: StreamingStatus) => void
): Promise<void> {
  if (!response.body) {
    throw new Error('No response body available');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedContent = ''; // Accumulates the complete AI response
  let buffer = ''; // Buffers incomplete JSON lines between chunks

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    // Decode the binary chunk to text and append to buffer
    // The 'stream: true' option handles multi-byte characters correctly
    buffer += decoder.decode(value, { stream: true });

    // Split on newlines to process complete JSON objects
    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in buffer for next iteration
    buffer = lines.pop() || '';

    // Process each complete line as a separate JSON object
    for (const line of lines) {
      if (line.trim()) {
        try {
          const data: StreamingResponse = JSON.parse(line);
          // Process the streaming chunk - allow streaming errors to bubble up
          // This updates the UI in real-time as tokens arrive
          accumulatedContent = processStreamChunk(
            data,
            accumulatedContent,
            assistantMessageId,
            updateAssistantMessage,
            setStatus
          );
        } catch (parseError) {
          // Distinguish between JSON parsing errors and streaming errors
          if (parseError instanceof SyntaxError) {
            // Skip malformed JSON lines (network corruption, etc.)
            // Don't fail the entire stream for individual parsing issues
            console.warn('Failed to parse JSON line:', line, parseError);
          } else {
            // Re-throw streaming errors (from processStreamChunk)
            // These are intentional errors from the AI API
            throw parseError;
          }
        }
      }
    }
  }
}

/**
 * Handles errors that occur during the streaming process.
 *
 * Provides user-friendly error handling by:
 * - Logging the error for debugging
 * - Updating the UI to show error state
 * - Displaying error message in the assistant's message
 * - Auto-recovering to idle state after a delay
 *
 * @param error - The error that occurred (can be any type)
 * @param assistantMessageId - ID of the message to update with error
 * @param updateAssistantMessage - Function to update message content
 * @param setStatus - Function to update streaming status
 */
function handleStreamingError(
  error: unknown,
  assistantMessageId: string,
  updateAssistantMessage: (id: string, content: string) => void,
  setStatus: (status: StreamingStatus) => void
): void {
  console.error('Chat streaming error:', error);
  setStatus('error');

  // Show error message to user in the assistant's message bubble
  updateAssistantMessage(
    assistantMessageId,
    error instanceof Error ? error.message : 'An error occurred'
  );

  // Auto-recover to idle state after 3 seconds
  // This allows users to try again without manual intervention
  setTimeout(() => setStatus('idle'), 3000);
}

/**
 * Custom hook for streaming chat with OpenAI integration.
 *
 * This hook orchestrates the complete streaming chat flow by coordinating
 * multiple helper functions to provide a seamless real-time chat experience.
 *
 * ## Architecture Benefits
 * The refactor into smaller helper functions provides:
 * - **Separation of Concerns**: Each function has a single responsibility
 * - **Testability**: Individual functions can be unit tested in isolation
 * - **Maintainability**: Easier to debug and modify specific parts
 * - **Reusability**: Helper functions could be used in other contexts
 *
 * ## Streaming Flow
 * 1. User submits message → addUserMessage() → store update
 * 2. Create placeholder → startAssistantMessage() → store update
 * 3. API call → sendMessageRequest() → streaming response
 * 4. Process stream → processJsonStream() → real-time UI updates
 * 5. Handle completion/errors → setStatus() → final state
 *
 * This hook integrates with the thread store's newMessageIds system to
 * support hybrid SSR/client rendering patterns.
 *
 * @returns Object containing streaming status and sendMessage function
 *
 * @example
 * ```tsx
 * const { status, sendMessage } = useStreamingChat();
 * const messages = useThreadMessages(); // All messages (server + client)
 * const newMessages = useNewMessages(); // Only client-added messages
 *
 * const handleSend = () => {
 *   sendMessage("Hello, how are you?");
 * };
 *
 * // Status can be: 'idle' | 'loading' | 'error'
 * const isStreaming = status === 'loading';
 * ```
 */
export function useStreamingChat() {
  const [status, setStatus] = useState<StreamingStatus>('idle');
  const threadId = useThreadId();
  const { addUserMessage, startAssistantMessage, updateAssistantMessage } =
    useThread();

  /**
   * Sends a message and streams the AI response in real-time.
   *
   * This function implements the complete streaming chat flow:
   * 1. **Input Validation**: Ensures content and thread ID are valid
   * 2. **Immediate UI Update**: Adds user message to store for instant feedback
   * 3. **Placeholder Creation**: Creates empty assistant message for streaming target
   * 4. **API Communication**: Sends request with full conversation context
   * 5. **Stream Processing**: Handles real-time token streaming and UI updates
   * 6. **Error Handling**: Gracefully handles network and streaming errors
   *
   * The use of helper functions makes this orchestration clear and maintainable,
   * while the store integration ensures all UI components stay synchronized.
   *
   * @param content - The user's message content to send
   */
  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        console.error('Cannot send empty message');
        return;
      }

      if (!threadId) {
        console.error('Cannot send message: no thread ID available');
        return;
      }

      setStatus('loading');

      // Add user message to store with timestamp
      addUserMessage(trimmedContent);

      // Start assistant message for streaming with timestamp
      const assistantMessage = startAssistantMessage();

      try {
        // Make API request
        const response = await sendMessageRequest(trimmedContent, threadId);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        // Process the streaming response
        await processJsonStream(
          response,
          assistantMessage.id,
          updateAssistantMessage,
          setStatus
        );
      } catch (error) {
        handleStreamingError(
          error,
          assistantMessage.id,
          updateAssistantMessage,
          setStatus
        );
      }
    },
    [addUserMessage, startAssistantMessage, threadId, updateAssistantMessage]
  );

  return {
    status,
    sendMessage,
  };
}
