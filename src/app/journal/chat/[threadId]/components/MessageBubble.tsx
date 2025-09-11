import ReactMarkdown from 'react-markdown';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Props for the MessageBubble component.
 */
interface MessageBubbleProps {
  message: ChatMessage;
}

function UserMessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className="chat chat-end">
      <div className="chat-bubble text-md">{message.content}</div>
    </div>
  );
}

function AssistantMessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className="prose prose-md max-w-full">
      {/* Message content with markdown support */}
      <ReactMarkdown>{message.content}</ReactMarkdown>
    </div>
  );
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
export function MessageBubble({ message }: MessageBubbleProps) {
  switch (message.role) {
    case 'user':
      return <UserMessageBubble message={message} />;

    case 'assistant':
      return <AssistantMessageBubble message={message} />;

    default:
      return null;
  }
}
