'use client';

import { useRef, useEffect, useImperativeHandle, useCallback } from 'react';

import { useStreamingChat } from '@/lib/chat/hooks/useStreamingChat';
import { useThreadNamePolling } from '@/lib/chat/hooks/useThreadNamePolling';
import { useInputValue, useSetInputValue } from '@/lib/store/thread-store';

/**
 * Handle interface for programmatic focus control of the chat textarea.
 *
 * Provides imperative access to focus functionality for use cases like
 * focusing after quoting text or keyboard shortcuts.
 */
export type ChatTextareaFocusHandle = {
  /** Focuses the textarea and positions the cursor at the end of existing content */
  focusTextareaAndJumpToEnd: () => void;
};

/**
 * Props interface for the ChatTextarea component.
 */
interface ChatTextareaProps {
  /** Current value of the textarea, following controlled component pattern */
  value: string;

  /** Callback fired when textarea value changes */
  onChange: (value: string) => void;
  /** Placeholder text displayed when textarea is empty */
  placeholder?: string;
  /** Whether the textarea should be disabled */
  disabled?: boolean;
  /** Key event handler for capturing special key combinations */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  /** Ref for accessing focus control methods */
  ref?: React.Ref<ChatTextareaFocusHandle>;
}

/**
 * An auto-resizing textarea component optimized for chat applications.
 *
 * Key features:
 * - Dynamic height adjustment based on content length
 * - Global keyboard focus from anywhere in the application (intelligent filtering)
 * - Imperative focus control through ref interface
 *
 * Design rationale:
 * - Global focus creates intuitive messaging experience similar to modern chat apps
 * - Auto-resize prevents internal scrolling while maintaining clean appearance
 * - Exposes focus control for workflows like text quoting where focus should return to input
 */
function ChatTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  onKeyDown,
  ref,
}: ChatTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Focuses the textarea and positions cursor at the end of existing content */
  const focusTextareaAndJumpToEnd = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    focusTextareaAndJumpToEnd,
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if the event target is an input, textarea, or contenteditable element
      const target = e.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true';

      // If not typing in another input and it's a printable character
      if (
        !isInputElement &&
        textareaRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        focusTextareaAndJumpToEnd();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusTextareaAndJumpToEnd]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="textarea textarea-primary w-full text-base min-h-[2.5rem] py-2 overflow-hidden"
      style={{ resize: 'none' }}
      rows={1}
    />
  );
}

/**
 * Props for the ChatInputForm component
 */
interface ChatInputFormProps {
  /** Optional callback invoked after a message is successfully sent */
  onMessageSent?: () => void;
  /** Ref to the textarea element for focus management */
  ref?: React.Ref<ChatTextareaFocusHandle>;
}

/**
 * A comprehensive chat input form that orchestrates user message submission.
 *
 * Integrates multiple systems for a seamless chat experience:
 * - Streaming chat for real-time message processing
 * - Global input state for persistence across re-renders and quote insertion
 * - Thread naming for automatic first message detection
 * - Focus management through imperative ref interface
 *
 * Design decisions:
 * - Uses global state to prevent losing input during streaming responses
 * - Enter submits, Shift+Enter creates new lines (standard messaging UX)
 * - Disables input during processing to prevent duplicate submissions
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ChatInputForm onMessageSent={() => console.log('Message sent!')} />
 *
 * // With focus management
 * const formRef = useRef<ChatTextareaFocusHandle>(null);
 * <ChatInputForm ref={formRef} onMessageSent={() => formRef.current?.focusTextareaAndJumpToEnd()} />
 * ```
 */
export function ChatInputForm({ onMessageSent, ref }: ChatInputFormProps) {
  const { status, sendMessage } = useStreamingChat();
  const input = useInputValue();
  const setInput = useSetInputValue();
  const { handleFirstMessage } = useThreadNamePolling(status);

  /** Handles form submission - validates, sends message, clears input, and invokes callback */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent submission of empty or whitespace-only messages
    if (!input.trim()) return;

    // Check if this is the first message and start polling for auto-generated thread name
    handleFirstMessage();

    // Send the message through the streaming chat system
    sendMessage(input);

    // Clear the input field for the next message
    setInput('');

    // Notify parent component that a message was sent
    onMessageSent?.();
  };

  /** Handles Enter to submit, Shift+Enter for new lines (standard messaging UX) */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pb-1 px-3">
      <ChatTextarea
        value={input}
        placeholder="What’s on your mind?"
        onChange={setInput}
        disabled={status === 'loading'}
        onKeyDown={handleKeyDown}
        ref={ref}
      />
    </form>
  );
}
