'use client';

import React, { useState } from 'react';

import { useAIChat } from '@/lib/chat/hooks/useAIChat';
import { useThreadId, useThreadMessages } from '@/lib/store/thread-store';

import MessageList from './MessageList';

/**
 * Client-side chat input component with message display.
 *
 * Handles real-time chat with AI, including message submission and display.
 * Gets thread data from the store for consistent state management.
 *
 * @example
 * ```tsx
 * <ClientChatInput />
 * ```
 */
export default function ClientChatInput() {
  // Get thread data from store
  const threadId = useThreadId();
  const messages = useThreadMessages();

  // Initialize AI chat integration
  const { status, sendMessage } = useAIChat(threadId);

  // Local input state
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div>
      {/* Display messages */}
      {messages.length > 0 && (
        <div className="mb-6">
          <MessageList messages={messages} />
        </div>
      )}

      {/* Chat input form with status-aware UI */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          placeholder="Send a message..."
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'ready'} // Disable during AI processing
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status !== 'ready' || !input.trim()} // Validate input and status
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {/* Dynamic button text based on AI SDK status */}
          {status === 'streaming' || status === 'submitted'
            ? 'Sending...'
            : 'Send'}
        </button>
      </form>
    </div>
  );
}

/**
 * This component demonstrates the complete integration pattern:
 *
 * ## Data Flow
 * User Input → sendMessage() → AI SDK → API → Response → useAIChat → Store → UI Update
 *
 * ## Key Benefits
 * - **No Manual State Management**: Messages automatically sync from AI to UI
 * - **Status Awareness**: Form disables during processing
 * - **Error Resilience**: Store provides consistent state regardless of network issues
 * - **Performance**: Granular selectors prevent unnecessary re-renders
 * - **Scalability**: Multiple components can use the same store data
 */
