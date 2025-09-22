'use client';

import { useState } from 'react';

import { useStreamingChat } from '@/lib/chat/hooks/useStreamingChat';
import { useThreadNamePolling } from '@/lib/chat/hooks/useThreadNamePolling';

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-row pb-1 px-3">
      <input
        value={input}
        placeholder="Send a message..."
        onChange={(e) => setInput(e.target.value)}
        className="input input-primary flex-1 text-md"
        disabled={status === 'loading'}
      />
    </form>
  );
}
