import ReactMarkdown from 'react-markdown';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Props for the MessageBubble component and its internal variants.
 *
 * @interface MessageBubbleProps
 */
interface MessageBubbleProps {
  /** The chat message object containing role, content, and metadata */
  message: ChatMessage;
}

/**
 * Core markdown renderer with therapy-specific customizations.
 *
 * This internal component handles the actual message content rendering with
 * domain-specific constraints. Since this is a therapy application, code blocks
 * are deliberately stripped of special formatting to maintain a conversational,
 * non-technical atmosphere that's appropriate for therapeutic interactions.
 *
 * The component transforms code/pre elements into plain text fragments to prevent
 * syntax highlighting or monospace formatting that might feel clinical or intimidating
 * to users seeking therapeutic support.
 *
 * @param message - The chat message object to render as markdown
 * @returns A React component rendering the message content without code formatting
 * @internal
 */
function MessageBubbleInner({ message }: MessageBubbleProps) {
  return (
    <div className="prose prose-md leading-snug max-w-full">
      <ReactMarkdown
        components={{
          // Strip code formatting to maintain conversational tone in therapy context
          code({ children }) {
            return <>{children}</>;
          },
          // Remove preformatted block styling for the same therapeutic UX reasons
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {message.content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Renders a user message with chat bubble styling.
 *
 * Uses DaisyUI's chat components to create a right-aligned message bubble
 * with appropriate spacing and visual treatment. The "chat-end" class
 * positions the bubble on the right side to indicate it's from the user.
 *
 * @param message - The user's chat message to display in a bubble
 * @returns A DaisyUI chat bubble positioned on the right side
 * @internal
 */
function UserMessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className="chat chat-end">
      <div className="chat-bubble max-w-lg">
        <MessageBubbleInner message={message} />
      </div>
    </div>
  );
}

/**
 * Renders an assistant message with prose styling instead of chat bubbles.
 *
 * Uses Tailwind Typography (prose) classes to provide natural reading experience
 * for longer AI responses. The prose styling includes:
 * - Optimized line heights and spacing for readability
 * - Proper heading, paragraph, and list formatting
 * - Enhanced typography for extended therapeutic conversations
 *
 * The max-w-full ensures the content can use available width without
 * being constrained by prose's default max-width limitations.
 *
 * @param message - The assistant's chat message to display with prose formatting
 * @returns A prose-styled container for enhanced readability of longer responses
 * @internal
 */
function AssistantMessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className="max-w-full">
      <MessageBubbleInner message={message} />
    </div>
  );
}

/**
 * Individual message bubble component for displaying a single chat message.
 *
 * This is a pure presentational component that handles the visual rendering
 * of chat messages with role-based styling differentiation. The component
 * provides a consistent interface while delegating to specialized sub-components
 * for different message types.
 *
 * Key features:
 * - Markdown support with therapy-specific customizations (no code highlighting)
 * - Role-based visual differentiation (user bubbles vs assistant prose)
 * - Graceful handling of unknown message roles
 * - Optimized for therapeutic conversation UX
 *
 * Design decisions:
 * - User messages use chat bubbles for familiar messaging app experience
 * - Assistant messages use prose styling for better readability of longer responses
 * - Code blocks are rendered as plain text to maintain conversational tone
 *
 * @param message - The chat message object containing role, content, and metadata
 * @returns A React component rendering the message with role-appropriate styling, or null for unknown roles
 * @throws No exceptions - gracefully handles all message types including unknown roles
 *
 * @example
 * ```tsx
 * // User message with markdown formatting
 * <MessageBubble
 *   message={{
 *     id: '123',
 *     role: 'user',
 *     content: 'Hello **world**!',
 *     createdAt: '2024-01-15T10:30:00Z'
 *   }}
 * />
 *
 * // Assistant message with longer response
 * <MessageBubble
 *   message={{
 *     id: '456',
 *     role: 'assistant',
 *     content: 'Thank you for sharing. Here are some thoughts...',
 *     createdAt: '2024-01-15T10:31:00Z'
 *   }}
 * />
 * ```
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  // Route to appropriate sub-component based on message role for different visual treatments
  switch (message.role) {
    case 'user':
      // User messages get chat bubble styling for familiar messaging UX
      return <UserMessageBubble message={message} />;

    case 'assistant':
      // Assistant messages get prose styling for better readability of longer responses
      return <AssistantMessageBubble message={message} />;

    default:
      // Gracefully handle unknown roles (developer, system) by rendering nothing
      // This prevents UI breaks if new roles are added or data contains unexpected values
      return null;
  }
}
