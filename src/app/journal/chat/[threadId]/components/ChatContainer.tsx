'use client';

import {
  useCallback,
  useRef,
  ReactNode,
  RefObject,
  useState,
  useEffect,
  useDeferredValue,
} from 'react';
import { useInView } from 'react-intersection-observer';

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
  // Intersection observer to detect when user is at bottom of chat
  const { ref: sentinelRef, inView } = useInView();

  // State to track whether auto-scroll should be active
  const [shouldFollow, setShouldFollow] = useState(inView);

  // Store previous scroll position to detect scroll direction
  const previousScrollTop: RefObject<number | null> = useRef(
    containerRef.current?.scrollTop ?? null
  );

  /**
   * Handles scroll events to determine whether to enable/disable auto-scroll.
   * Disables auto-scroll when user scrolls up manually.
   * Re-enables when user scrolls back to bottom area.
   */
  const onContainerScroll = useCallback(() => {
    if (
      previousScrollTop.current &&
      containerRef.current?.scrollTop &&
      previousScrollTop.current > containerRef.current.scrollTop
    ) {
      // User scrolled up - disable auto-follow to let them read
      setShouldFollow(false);
    } else if (inView) {
      // User is near bottom and not scrolling up - re-enable auto-follow
      setShouldFollow(true);
    }

    // Update stored scroll position for next comparison
    if (containerRef.current !== null) {
      previousScrollTop.current = containerRef.current.scrollTop;
    }
  }, [containerRef, inView]);

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

  // Defer updates to newest message length to avoid blocking UI updates
  const newestMessageLength = useDeferredValue(
    newMessages.length > 0
      ? newMessages[newMessages.length - 1].content.length
      : 0
  );

  // Auto-scroll effect: triggers when new message content changes
  useEffect(() => {
    if (newestMessageLength === 0) {
      return;
    }

    // Only auto-scroll if user is already near the bottom (shouldFollow is true)
    if (shouldFollow) {
      scrollToBottom();
    }
  }, [shouldFollow, newestMessageLength, scrollToBottom]);

  return {
    scrollToBottom: scrollToBottomDelayed,
    onContainerScroll,
    sentinelRef,
  };
};

/**
 * Main chat interface component that displays messages and handles user input.
 * Combines server-rendered messages with live updates and provides auto-scrolling.
 *
 * @param children - Server-rendered message content to display
 * @returns Chat container with message list, input form, and auto-scroll behavior
 */
export default function ChatContainer({ children }: ChatContainerProps) {
  // Ref to the scrollable container for programmatic scroll control
  const containerRef = useRef<HTMLDivElement>(null);

  // Get live messages from the client-side store
  const newMessages = useNewMessages();

  // Set up auto-scroll behavior with smart follow detection
  const { scrollToBottom, onContainerScroll, sentinelRef } = useAutoScroll(
    newMessages,
    containerRef
  );

  return (
    <div className="flex flex-col h-screen w-full bg-base-100">
      {/* Scrollable message container */}
      <div
        ref={containerRef}
        onScroll={onContainerScroll}
        className="overflow-y-auto flex flex-col items-center flex-1"
      >
        {/* Message content wrapper with responsive width */}
        <div className="flex flex-col-reverse gap-8 w-4xl my-8">
          {/* Invisible sentinel element for intersection observer */}
          <div ref={sentinelRef} />

          {/* Client-side messages (new messages added after page load) */}
          {newMessages.length > 0 && <MessageList messages={newMessages} />}

          {/* Server-rendered messages (initial page load content) */}
          {children}
        </div>
      </div>

      {/* Fixed input area at bottom */}
      <div className="shrink-0">
        <ChatInputForm onMessageSent={scrollToBottom} />
      </div>
    </div>
  );
}
