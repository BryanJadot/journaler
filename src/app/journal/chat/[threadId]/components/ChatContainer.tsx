'use client';

import { useCallback, useEffect, useRef, ReactNode } from 'react';

import ChatInputForm from '@/app/journal/chat/[threadId]/components/ChatInputForm';
import MessageList from '@/app/journal/chat/[threadId]/components/MessageList';
import { useNewMessages } from '@/lib/store/thread-store';

interface ChatContainerProps {
  children?: ReactNode;
}

/**
 * Main chat interface component that displays messages and handles user input.
 * Combines server-rendered initial messages with client-side new messages in reverse chronological order.
 * Provides automatic scrolling to bottom on mount and when new messages are sent.
 *
 * @param children - Server-rendered initial message content (typically from page load)
 * @returns Chat container with message list, input form, and auto-scroll behavior
 */
export default function ChatContainer({ children }: ChatContainerProps) {
  // Get new messages added after page load from the client-side store
  const newMessages = useNewMessages();

  // Ref to the scrollable message container for programmatic scroll control
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Scrolls to the bottom of the message container with configurable scroll behavior
  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  // Auto-scroll to bottom on component mount to show latest messages
  useEffect(() => scrollToBottom('instant'), [scrollToBottom]);

  return (
    <div className="flex flex-col h-screen w-full bg-base-100">
      {/* Scrollable message container */}
      <div
        ref={containerRef}
        className="overflow-y-auto flex flex-col items-center flex-1"
      >
        {/* Message content wrapper with responsive max-width, reverse flex to show newest first */}
        <div className="flex flex-col-reverse gap-8 w-4xl my-8">
          {/* New messages from client-side store (added after initial page load) */}
          {newMessages.length > 0 && <MessageList messages={newMessages} />}

          {/* Server-rendered initial messages passed as children from parent component */}
          {children}
        </div>
      </div>

      {/* Fixed input area at bottom */}
      <div className="shrink-0">
        {/* Delay scroll until next animation frame to ensure new message is fully rendered */}
        <ChatInputForm
          onMessageSent={() =>
            requestAnimationFrame(() => scrollToBottom('smooth'))
          }
        />
      </div>
    </div>
  );
}
