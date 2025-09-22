'use client';

import { useState, useRef, useEffect } from 'react';

import { useStreamingChat } from '@/lib/chat/hooks/useStreamingChat';
import { useThreadNamePolling } from '@/lib/chat/hooks/useThreadNamePolling';

interface ChatTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

function ChatTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  onKeyDown,
}: ChatTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        textareaRef.current.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="textarea textarea-primary w-full text-md min-h-[2.5rem] py-2 overflow-hidden"
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
}

/**
 * A chat input form component that handles user message submission to the AI chat system.
 *
 * This component integrates with the streaming chat system and automatically manages
 * thread naming through polling. It provides a simple text input interface with
 * submission handling and loading state management.
 *
 * Key behaviors:
 * - Automatically clears input after successful submission
 * - Prevents empty message submission
 * - Disables input during message processing
 * - Triggers thread name polling for first messages in a thread
 * - Calls optional callback after message is sent
 *
 * @param props - Component props
 * @returns React functional component
 *
 * @example
 * ```tsx
 * <ChatInputForm onMessageSent={() => console.log('Message sent!')} />
 * ```
 */
export default function ChatInputForm({ onMessageSent }: ChatInputFormProps) {
  const { status, sendMessage } = useStreamingChat();
  const [input, setInput] = useState('');
  const { handleFirstMessage } = useThreadNamePolling(status);

  /**
   * Handles form submission for sending chat messages.
   *
   * This function orchestrates the entire message sending flow:
   * 1. Prevents default form submission behavior
   * 2. Validates input (prevents empty messages)
   * 3. Triggers first message handling for thread naming
   * 4. Sends the message via streaming chat
   * 5. Clears the input field
   * 6. Invokes optional callback
   *
   * @param e - Form submission event
   */
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
        placeholder="Send a message..."
        onChange={setInput}
        disabled={status === 'loading'}
        onKeyDown={handleKeyDown}
      />
    </form>
  );
}
