import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { ChatMessage } from '@/lib/chat/types';

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate streaming tokens using OpenAI's Responses API
 *
 * @param history - Previous messages in the conversation
 * @param newMessage - The new user message to respond to
 */
export async function* generateTokens(
  history: ChatMessage[],
  newMessage: string
) {
  // Build the input array: prior messages + new user message
  const input: ResponseInputItem[] = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: 'user',
      content: newMessage,
    },
  ];

  // Create a streaming Responses API call
  const stream = await client.responses.stream({
    model: 'gpt-5',
    input,
  });

  // Iterate over the stream events
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      yield event.delta; // token chunk
    }
    if (event.type === 'response.failed') {
      throw new Error(
        'OpenAI response failed: ' + event.response.error?.message
      );
    }
    if (event.type === 'response.completed') {
      break;
    }
  }
}
