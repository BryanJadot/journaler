import ReactMarkdown from 'react-markdown';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Props for the MessageBubble component.
 */
interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Individual message bubble component for displaying a single chat message.
 *
 * This is a pure presentational component that handles the visual rendering
 * of a single message. It supports markdown content rendering and provides
 * consistent styling across all message types.
 *
 * @param props - Component props
 * @param props.message - The chat message to display with role, content, and timestamp
 * @returns JSX element containing the styled message bubble with markdown support
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={{
 *     id: '123',
 *     role: 'user',
 *     content: 'Hello **world**!',
 *     createdAt: '2024-01-15T10:30:00Z'
 *   }}
 * />
 * ```
 */
function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      {/* Message role indicator with role-specific styling */}
      <strong className="text-blue-600 font-semibold">{message.role}:</strong>

      {/* Message content with markdown support */}
      <div className="markdown-content prose prose-sm max-w-none mt-2">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      {/* Message timestamp */}
      <div className="text-xs text-gray-400 mt-2">
        {new Date(message.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

/**
 * Props for the MessageList component.
 */
interface MessageListProps {
  messages: ChatMessage[];
}

/**
 * Shared message list component that renders chat messages in both server and client contexts.
 *
 * This is a pure presentational component that only handles message rendering.
 * For scroll functionality, use ScrollableMessageList wrapper in client components.
 *
 * @param props - Component props
 * @param props.messages - Array of normalized ChatMessage objects in chronological order
 * @returns JSX element containing the complete message list with consistent spacing and styling
 *
 * @example
 * ```tsx
 * // Server-side usage in Thread Page
 * const initialMessages = await getThreadWithMessages(threadId);
 * return (
 *   <ChatContainer>
 *     <MessageList messages={initialMessages} />
 *   </ChatContainer>
 * );
 *
 * // Client-side usage with scrolling
 * return (
 *   <ScrollableMessageList
 *     ref={messageListRef}
 *     messages={messages.map(convertAIMessageToChatMessage)}
 *   />
 * );
 * ```
 *
 * @see {@link ChatMessage} - Unified message type used across all contexts
 * @see {@link ScrollableMessageList} - Client wrapper with scroll functionality
 */
export default function MessageList({ messages }: MessageListProps) {
  return (
    <>
      {messages.length === 0 ? (
        <p className="text-gray-500 text-center py-4" role="status">
          No messages yet. Start a conversation!
        </p>
      ) : (
        messages
          .slice()
          .reverse()
          .map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
      )}
    </>
  );
}
