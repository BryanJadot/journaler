'use client';

import {
  useCallback,
  useRef,
  ReactNode,
  RefObject,
  useEffect,
  useDeferredValue,
} from 'react';

import ChatInputForm from '@/app/journal/chat/[threadId]/components/ChatInputForm';
import MessageList from '@/app/journal/chat/[threadId]/components/MessageList';
import { ChatMessage } from '@/lib/chat/types';
import { useNewMessages } from '@/lib/store/thread-store';

interface ChatContainerProps {
  children?: ReactNode;
}

/**
 * Hook that provides auto-scrolling functionality for chat messages.
 * Automatically scrolls to bottom when new messages arrive, but only if user is already near the bottom.
 *
 * @param newMessages - Array of chat messages to monitor for changes
 * @param containerRef - React ref to the scrollable container element
 * @returns Object containing scrollToBottom function for manual scrolling
 */
const useAutoScroll = (
  newMessages: ChatMessage[],
  containerRef: RefObject<HTMLDivElement | null>
) => {
  /**
   * Smoothly scrolls the container to the bottom (newest messages).
   */
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [containerRef]);

  /**
   * Scrolls to bottom after waiting for DOM updates to complete.
   * Uses requestAnimationFrame to ensure rendering is finished.
   */
  const scrollToBottomDelayed = useCallback(() => {
    // Use requestAnimationFrame to wait for DOM update
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [scrollToBottom]);

  const newestMessageLength = useDeferredValue(
    newMessages.length > 0
      ? newMessages[newMessages.length - 1].content.length
      : 0
  );

  useEffect(() => {
    // With flex-col-reverse, we need a negative threshold
    const threshold = 60;
    if (!containerRef.current || newestMessageLength === 0) {
      return;
    }

    // Only auto-scroll if user is already near the bottom
    if (
      containerRef.current.scrollTop >=
      containerRef.current.scrollHeight -
        containerRef.current.clientHeight -
        threshold
    ) {
      scrollToBottom();
    }
  }, [containerRef, newestMessageLength, scrollToBottom]);

  return { scrollToBottom: scrollToBottomDelayed };
};

/**
 * Main chat interface component that displays messages and handles user input.
 * Combines server-rendered messages with live updates and provides auto-scrolling.
 *
 * @param children - Server-rendered message content to display
 * @returns Chat container with message list, input form, and auto-scroll behavior
 */
export default function ChatContainer({ children }: ChatContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const newMessages = useNewMessages();
  const { scrollToBottom } = useAutoScroll(newMessages, containerRef);

  return (
    <div className="flex flex-col h-screen w-full bg-base-100">
      <div
        ref={containerRef}
        className="overflow-y-auto flex flex-col items-center flex-1"
      >
        <div className="flex flex-col-reverse gap-8 w-4xl my-8">
          {/* Live messages from store */}
          {newMessages.length > 0 && <MessageList messages={newMessages} />}

          {/* Server-rendered content passed as children */}
          {children}
        </div>
      </div>

      {/* Chat input form */}
      <div className="shrink-0">
        <ChatInputForm onMessageSent={scrollToBottom} />
      </div>
    </div>
  );
}
