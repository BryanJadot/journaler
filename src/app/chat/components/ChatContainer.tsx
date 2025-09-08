'use client';

import { useCallback, useEffect, useRef, ReactNode } from 'react';

import ChatInputForm from './ChatInputForm';
import LiveMessageList from './LiveMessageList';

interface ChatContainerProps {
  children?: ReactNode;
}

/**
 * Client-side chat container component with scrollable messages.
 *
 * Combines server-rendered content (children) with live messages from store,
 * provides scrollable container with auto-scroll, and input form.
 */
export default function ChatContainer({ children }: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  // Scroll to bottom on initial mount
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const handleMessageSent = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    <>
      <div ref={containerRef} className="max-h-96 overflow-y-auto">
        {/* Server-rendered content passed as children */}
        {children}

        {/* Live messages from store */}
        <LiveMessageList />
      </div>

      {/* Chat input form */}
      <ChatInputForm onMessageSent={handleMessageSent} />
    </>
  );
}
