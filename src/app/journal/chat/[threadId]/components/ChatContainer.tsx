'use client';

import { useCallback, useEffect, useRef, ReactNode } from 'react';

import {
  ChatInputForm,
  ChatTextareaFocusHandle,
} from '@/app/journal/chat/[threadId]/components/ChatInputForm';
import MessageList from '@/app/journal/chat/[threadId]/components/MessageList';
import SelectionTooltip from '@/app/journal/chat/[threadId]/components/SelectionTooltip';
import { useTextSelection } from '@/lib/chat/hooks/useTextSelection';
import { useNewMessages } from '@/lib/store/thread-store';

/**
 * Props interface for the ChatContainer component.
 */
interface ChatContainerProps {
  /** Server-rendered message content, typically initial thread messages from page load */
  children?: ReactNode;
}

/**
 * Main chat interface component orchestrating the complete chat experience.
 *
 * Implements a hybrid rendering system combining server-side rendering for
 * initial messages with client-side state management for real-time updates.
 * Coordinates message display, user input, text selection, and auto-scrolling.
 *
 * Key architectural decisions:
 * - Hybrid SSR/client rendering to prevent message duplication
 * - Reverse chronological layout (newest messages at top)
 * - Text selection integration with scroll-following tooltip
 * - Auto-scroll to bottom on mount and after sending messages
 *
 * @example
 * ```tsx
 * // With server-rendered messages
 * <ChatContainer>
 *   {serverMessages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
 * </ChatContainer>
 *
 * // Empty thread
 * <ChatContainer />
 * ```
 */
export default function ChatContainer({ children }: ChatContainerProps) {
  const newMessages = useNewMessages();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chatInputFormRef = useRef<ChatTextareaFocusHandle>(null);
  const { repositionTooltip } = useTextSelection();

  /** Scrolls to bottom with configurable animation - instant for mount, smooth for user actions */
  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => scrollToBottom('instant'), [scrollToBottom]);

  return (
    <div className="flex flex-col items-center h-screen w-full bg-base-100">
      <SelectionTooltip
        onQuote={chatInputFormRef.current?.focusTextareaAndJumpToEnd}
      />

      <div
        ref={containerRef}
        className="overflow-y-auto flex flex-col items-center flex-1 w-full"
        onScroll={repositionTooltip}
      >
        <div className="flex flex-col gap-8 lg:w-4xl p-4 my-8">
          {children}
          {newMessages.length > 0 && <MessageList messages={newMessages} />}
        </div>
      </div>

      <div className="shrink-0 lg:w-4xl w-full">
        <ChatInputForm
          ref={chatInputFormRef}
          onMessageSent={() =>
            requestAnimationFrame(() => scrollToBottom('smooth'))
          }
        />
      </div>
    </div>
  );
}
