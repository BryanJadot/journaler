'use client';

import {
  forwardRef,
  RefObject,
  useCallback,
  useDeferredValue,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { ChatMessage } from '@/lib/chat/types';

import MessageList from './MessageList';

/**
 * Ref handle for ScrollableMessageList component
 */
export interface ScrollableMessageListRef {
  scrollToBottom: () => void;
}

/**
 * Props for the ScrollableMessageList component
 */
interface ScrollableMessageListProps {
  messages: ChatMessage[];
}

/**
 * Custom hook for handling scroll-to-bottom functionality in a scrollable container
 */
function useScrollToBottom(
  containerRef: RefObject<HTMLDivElement | null>,
  messages: ChatMessage[]
) {
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [containerRef]);

  const latestMessageLength: number = useDeferredValue(
    messages.length > 0 ? messages[messages.length - 1].content.length : 0
  );

  // No matter what, scroll on first load.
  useEffect(scrollToBottom, [scrollToBottom]);

  // Scroll as messages stream in if the user is scrolled to the bottom.
  useEffect(() => {
    if (latestMessageLength % 50 !== 0) {
      return;
    }
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const threshold = 100;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distance = scrollHeight - (scrollTop + clientHeight);

    if (distance <= threshold) {
      scrollToBottom();
    }
  }, [latestMessageLength, scrollToBottom, containerRef]);

  return { scrollToBottom };
}

/**
 * Client-side scrollable wrapper for MessageList component.
 * 
 * This component provides scroll-to-bottom functionality and automatic scrolling
 * during message streaming. It wraps the base MessageList component which can
 * still be used independently in server components.
 * 
 * @param props - Component props
 * @param props.messages - Array of chat messages to display
 * @param ref - Forwarded ref with scrollToBottom method
 */
const ScrollableMessageList = forwardRef<
  ScrollableMessageListRef,
  ScrollableMessageListProps
>(({ messages }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollToBottom } = useScrollToBottom(containerRef, messages);

  useImperativeHandle(ref, () => ({
    scrollToBottom,
  }));

  return (
    <div 
      ref={containerRef} 
      className="max-h-96 overflow-y-auto"
    >
      <MessageList messages={messages} />
    </div>
  );
});

ScrollableMessageList.displayName = 'ScrollableMessageList';

export default ScrollableMessageList;