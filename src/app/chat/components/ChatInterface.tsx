'use client';

import { useChat } from '@ai-sdk/react';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  initialThreadId?: number;
  initialMessages?: Array<{
    id: string;
    role: 'user' | 'assistant' | 'developer';
    content: string;
    createdAt: string;
  }>;
}

export default function ChatInterface({
  initialThreadId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [_currentThreadId, _setCurrentThreadId] = useState<number | undefined>(
    initialThreadId
  );

  const { messages, status, sendMessage, setMessages } = useChat();

  // Set initial messages from server on component mount
  React.useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      // Convert server messages to AI SDK format
      const convertedMessages = initialMessages.map((msg) => ({
        id: msg.id,
        role: (msg.role === 'developer' ? 'system' : msg.role) as
          | 'user'
          | 'assistant'
          | 'system',
        parts: [{ type: 'text' as const, text: msg.content }],
      }));
      setMessages(convertedMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Thread info display (optional) */}
      {_currentThreadId && (
        <div className="text-sm text-gray-500 mb-4">
          Thread: {_currentThreadId}
        </div>
      )}

      <div className="space-y-4 mb-6">
        {messages.map((message) => (
          <div key={message.id} className="border rounded-lg p-4 shadow-sm">
            <strong className="text-blue-600 font-semibold">{`${message.role}: `}</strong>
            {'parts' in message && Array.isArray(message.parts) ? (
              message.parts.map((part, index) => {
                if ('type' in part && part.type === 'text' && 'text' in part) {
                  return (
                    <div
                      key={index}
                      className="markdown-content prose prose-sm max-w-none mt-2"
                    >
                      <ReactMarkdown>{part.text as string}</ReactMarkdown>
                    </div>
                  );
                }
                return null;
              })
            ) : (
              // Fallback for simple string content
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
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
