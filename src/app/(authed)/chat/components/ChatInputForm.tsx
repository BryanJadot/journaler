'use client';

import { useState } from 'react';

import { useStreamingChat } from '@/lib/chat/hooks/useStreamingChat';

/**
 * Props for the ChatInputForm component
 */
interface ChatInputFormProps {
  onMessageSent?: () => void;
}

/**
 * Chat input form component.
 *
 * Handles message submission to the AI chat system.
 * Gets thread ID from the store and manages the input state.
 */
export default function ChatInputForm({ onMessageSent }: ChatInputFormProps) {
  const { status, sendMessage } = useStreamingChat();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage(input);
    setInput('');

    // Call the callback after sending message
    onMessageSent?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 mt-4 shrink-0 border-t p-4"
    >
      <input
        value={input}
        placeholder="Send a message..."
        onChange={(e) => setInput(e.target.value)}
        className="flex-1 rounded border p-2"
        disabled={status === 'loading'}
      />
      <button
        type="submit"
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400"
        disabled={!input.trim() || status === 'loading'}
      >
        {status === 'loading' ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
