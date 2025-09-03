'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function Page() {
  const { messages, status, sendMessage } = useChat(); // Uses /api/chat by default
  const [input, setInput] = useState('');
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="space-y-4 mb-6">
        {messages.map((message) => (
          <div key={message.id} className="border rounded-lg p-4 shadow-sm">
            <strong className="text-blue-600 font-semibold">{`${message.role}: `}</strong>
            {message.parts.map((part, index) => {
              switch (part.type) {
                case 'text':
                  return (
                    <div
                      key={index}
                      className="markdown-content prose prose-sm max-w-none mt-2"
                    >
                      <ReactMarkdown>{part.text}</ReactMarkdown>
                    </div>
                  );

                // other cases can handle images, tool calls, etc
                default:
                  return null;
              }
            })}
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
          disabled={status !== 'ready'}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
