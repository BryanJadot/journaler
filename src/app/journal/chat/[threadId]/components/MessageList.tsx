import { MessageBubble } from '@/app/journal/chat/[threadId]/components/MessageBubble';
import { ChatMessage } from '@/lib/chat/types';

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
  return messages.length === 0 ? (
    <p className="text-gray-500 text-center py-4" role="status">
      No messages yet. Start a conversation!
    </p>
  ) : (
    messages
      .slice()
      .reverse()
      .map((message) => <MessageBubble key={message.id} message={message} />)
  );
}
