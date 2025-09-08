'use client';

import React, { useRef, useState } from 'react';

import { useStreamingChat } from '@/lib/chat/hooks/useStreamingChat';
import { useNewMessages } from '@/lib/store/thread-store'; // Key to hybrid rendering

import ScrollableMessageList, {
  ScrollableMessageListRef,
} from './ScrollableMessageList';

/**
 * Client-side chat input with streaming AI responses.
 *
 * Handles user message input and displays new messages added during the current
 * session. Works alongside server-rendered initial messages to prevent duplication.
 *
 * @returns JSX element containing chat input form and new message display
 */
export default function ClientChatInput() {
  const newMessages = useNewMessages();
  const { status, sendMessage } = useStreamingChat();
  const [input, setInput] = useState('');
  const messageListRef = useRef<ScrollableMessageListRef>(null);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return; // Prevent empty message submission

    // Send message and immediately clear input for better UX
    sendMessage(input);
    setInput('');

    if (messageListRef.current) {
      messageListRef.current.scrollToBottom();
    }
  };

  return (
    <div>
      {newMessages.length > 0 && (
        <div className="mb-6">
          <ScrollableMessageList ref={messageListRef} messages={newMessages} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          placeholder="Send a message..."
          onChange={(e) => setInput(e.target.value)}
          disabled={status === 'loading'} // Prevent input during AI response
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status === 'loading' || !input.trim()} // Comprehensive validation
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {/* Dynamic button text provides clear feedback about current state */}
          {status === 'loading' ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
