'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import React, { useState } from 'react';

import { ChatMessage } from '@/lib/chat/types';

import MessageList from './MessageList';

/**
 * Props for the ClientChatInput component.
 */
interface ClientChatInputProps {
  threadId: string;
}

/**
 * Convert AI SDK UIMessage to application ChatMessage format.
 *
 * Extracts text content from parts array and normalizes format for MessageList component.
 *
 * @param msg - AI SDK message with parts array
 * @returns ChatMessage compatible with our MessageList component
 */
function convertAIMessageToChatMessage(
  msg: ReturnType<typeof useChat>['messages'][0]
): ChatMessage {
  //The AI SDK uses a "parts" array to support multi-modal messages (text, images, etc.).
  //For our current text-only chat implementation, we extract and combine all text parts.
  const content = msg.parts
    .map((part) => {
      switch (part.type) {
        case 'text':
          return part.text; // Extract text content from text parts
        default:
          return ''; // Ignore unsupported part types (images, files, etc.)
      }
    })
    .join(''); // Combine all text parts into single content string

  // Transform AI SDK message structure to application's ChatMessage format.
  return {
    id: msg.id, // Unique message identifier from AI SDK
    role: msg.role as 'user' | 'assistant' | 'developer', // Role type assertion for TypeScript
    content, // Flattened text content from parts processing
    // TODO: Extract actual message timestamp from AI SDK response metadata
    // Currently using empty string, but AI SDK may provide timestamp in future versions
    createdAt: '',
  };
}

/**
 * Client-side component that handles interactive chat functionality.
 *
 * Manages real-time chat input and displays new messages from the current session.
 * Works alongside server-rendered existing messages for optimal performance.
 *
 * @param props - Component props
 * @param props.threadId - Unique identifier for the chat thread
 * @returns JSX element containing chat input form and new messages
 *
 * @see {@link MessageList} - Shared component for consistent message display
 */
export default function ClientChatInput({ threadId }: ClientChatInputProps) {
  // Initialize AI SDK chat hook with thread-specific configuration
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      body: {
        threadId,
      },
    }),
  });

  // Local state for message input field
  const [input, setInput] = useState('');

  // Handle form submission - validate input, send message, clear field
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div>
      {/* Render new messages from current session */}
      {messages.length > 0 && (
        <div className="mb-6">
          <MessageList messages={messages.map(convertAIMessageToChatMessage)} />
        </div>
      )}

      {/* Chat input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          placeholder="Send a message..."
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'ready'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status !== 'ready' || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {status === 'streaming' || status === 'submitted'
            ? 'Sending...'
            : 'Send'}
        </button>
      </form>
    </div>
  );
}
