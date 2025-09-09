'use client';

import {
  useCallback,
  useRef,
  ReactNode,
  RefObject,
  useEffect,
  useDeferredValue,
} from 'react';

import { ChatMessage } from '@/lib/chat/types';
import { useNewMessages } from '@/lib/store/thread-store';

import ChatInputForm from './ChatInputForm';
import MessageList from './MessageList';

interface ChatContainerProps {
  children?: ReactNode;
}

const useAutoScroll = (
  newMessages: ChatMessage[],
  containerRef: RefObject<HTMLDivElement | null>
) => {
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: 0, // With flex-col-reverse, "bottom" is actually top: 0
      behavior: 'smooth',
    });
  }, [containerRef]);

  const newestMessageLength = useDeferredValue(
    newMessages.length > 0
      ? newMessages[newMessages.length - 1].content.length
      : 0
  );

  useEffect(() => {
    const threshold = 50;
    if (!containerRef.current || newestMessageLength === 0) {
      return;
    }

    // Only auto-scroll if user is already near the bottom
    const { scrollTop } = containerRef.current;
    if (scrollTop <= threshold) {
      scrollToBottom();
    }
  }, [containerRef, newestMessageLength, scrollToBottom]);

  return { scrollToBottom };
};

/**
 * Client-side chat container component with scrollable messages.
 *
 * Combines server-rendered content (children) with live messages from store,
 * provides scrollable container with auto-scroll, and input form.
 */
export default function ChatContainer({ children }: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const newMessages = useNewMessages();
  const { scrollToBottom } = useAutoScroll(newMessages, containerRef);

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto flex flex-col-reverse p-4 min-h-0"
      >
        {/* Live messages from store */}
        {newMessages.length > 0 && <MessageList messages={newMessages} />}

        {/* Server-rendered content passed as children */}
        {children}
      </div>

      {/* Chat input form */}
      <ChatInputForm onMessageSent={scrollToBottom} />
    </>
  );
}
