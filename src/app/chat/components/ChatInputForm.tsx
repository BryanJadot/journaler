'use client';

import { useState } from 'react';

import { useAIChat } from '@/lib/chat/hooks/useAIChat';
import { useThreadId } from '@/lib/store/thread-store';

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
  // Get thread data from store
  const threadId = useThreadId();

  // Initialize AI chat integration
  const { status, sendMessage } = useAIChat(threadId);

  // Local input state
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage({ text: input });
    setInput('');

    // Call the callback after sending message
    onMessageSent?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
      <input
        value={input}
        placeholder="Send a message..."
        onChange={(e) => setInput(e.target.value)}
        className="flex-1 rounded border p-2"
        disabled={status === 'streaming' || status === 'submitted'}
      />
      <button
        type="submit"
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-400"
        disabled={
          !input.trim() || status === 'streaming' || status === 'submitted'
        }
      >
        {status === 'streaming' || status === 'submitted'
          ? 'Sending...'
          : 'Send'}
      </button>
    </form>
  );
}
