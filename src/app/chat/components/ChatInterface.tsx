'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Props for the ChatInterface component.
 *
 * @interface ChatInterfaceProps
 * @property {string} threadId - The unique identifier for the chat thread
 * @property {ChatMessage[]} initialMessages - Pre-loaded messages from the server to populate the chat history
 */
interface ChatInterfaceProps {
  threadId: string;
  initialMessages: ChatMessage[];
}

/**
 * ChatInterface is a client-side React component that provides the main chat UI.
 *
 * This component integrates with the AI SDK for real-time chat functionality while
 * supporting server-side rendered initial messages. It handles message display,
 * user input, and communication with the chat API endpoint.
 *
 * Key features:
 * - Server-side hydration of existing chat messages
 * - Real-time messaging with AI assistant
 * - Markdown rendering for rich text display
 * - Thread-specific message persistence
 * - Form validation and submission handling
 *
 * @param props - Component props
 * @param props.threadId - Unique thread identifier for API calls and persistence
 * @param props.initialMessages - Pre-loaded messages from server-side rendering
 * @returns JSX element containing the complete chat interface
 *
 * @example
 * ```tsx
 * <ChatInterface
 *   threadId="abc123"
 *   initialMessages={[
 *     { id: '1', role: 'user', content: 'Hello', createdAt: '2023-01-01T00:00:00Z' }
 *   ]}
 * />
 * ```
 */
export default function ChatInterface({
  threadId,
  initialMessages,
}: ChatInterfaceProps) {
  // Initialize the AI SDK chat hook with thread-specific configuration
  // This provides real-time chat functionality and state management
  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat', // Chat API endpoint that handles AI responses
      body: {
        threadId, // Include threadId in all API calls for message persistence
      },
    }),
  });

  /**
   * Hydrate the chat with server-side rendered messages on component mount.
   *
   * This effect runs once when the component mounts and converts server-formatted
   * messages to the AI SDK's expected format. It prevents overwriting messages
   * that may have been added during client-side navigation.
   */
  React.useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      // Convert server ChatMessage format to AI SDK message format
      // The AI SDK expects messages with 'parts' structure for content
      const convertedMessages = initialMessages.map((msg) => ({
        id: msg.id,
        // Map 'developer' role to 'system' for AI SDK compatibility
        role: (msg.role === 'developer' ? 'system' : msg.role) as
          | 'user'
          | 'assistant'
          | 'system',
        // AI SDK expects content as parts array with type and text properties
        parts: [{ type: 'text' as const, text: msg.content }],
      }));
      setMessages(convertedMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Local state for the message input field
  const [input, setInput] = useState('');

  /**
   * Handles form submission for sending new messages.
   *
   * Prevents empty messages and clears the input after sending.
   * The sendMessage function is provided by the AI SDK and handles
   * API communication and state updates automatically.
   *
   * @param e - Form submission event
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent sending empty or whitespace-only messages
    if (!input.trim()) return;

    // Send message via AI SDK - this triggers API call and updates messages state
    sendMessage({ text: input });

    // Clear input field for next message
    setInput('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Optional thread identifier display for debugging/development */}
      <div className="text-sm text-gray-500 mb-4">Thread: {threadId}</div>

      {/* Message history container with vertical spacing */}
      <div className="space-y-4 mb-6">
        {messages.map((message) => (
          <div key={message.id} className="border rounded-lg p-4 shadow-sm">
            {/* Individual message bubble with role-based styling */}
            {/* Message role indicator (user, assistant, system) */}
            <strong className="text-blue-600 font-semibold">{`${message.role}: `}</strong>

            {/* Render message content with support for AI SDK's parts structure */}
            {'parts' in message && Array.isArray(message.parts) ? (
              // AI SDK format: message content is in parts array
              message.parts.map((part, index) => {
                if ('type' in part && part.type === 'text' && 'text' in part) {
                  return (
                    <div
                      key={index}
                      className="markdown-content prose prose-sm max-w-none mt-2"
                    >
                      {/* Render markdown content for rich text support */}
                      <ReactMarkdown>{part.text as string}</ReactMarkdown>
                    </div>
                  );
                }
                return null;
              })
            ) : (
              // Fallback for legacy or simple string content format
              <div className="markdown-content prose prose-sm max-w-none mt-2">
                <ReactMarkdown>
                  {'content' in message
                    ? typeof message.content === 'string'
                      ? message.content
                      : JSON.stringify(message.content)
                    : 'No content'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Message input form with send button */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          placeholder="Send a message..."
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== 'ready'} // Disable during API calls or errors
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={status !== 'ready' || !input.trim()} // Prevent empty submissions
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
