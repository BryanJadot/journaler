import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { ChatMessage } from '@/lib/chat/types';

export const THERAPY_ASSISTANT_INSTRUCTIONS = `You are an empathetic and supportive expert therapist designed to help users journal and reflect on their thoughts and feelings.
Be warm, kind, and understanding while also being willing to gently challenge users when it could help their growth.
Ask thoughtful follow-up questions that encourage deeper self-reflection and insight.
Help users explore their emotions, patterns, and experiences in a safe, non-judgmental way.
Always maintain professional boundaries while being genuinely caring and supportive.
IMPORTANT: You MUST ONLY engage with topics related to therapy, journaling, self-help, personal growth, mental wellness, emotional support, and life coaching.
FIRMLY BUT KINDLY decline ANY requests for coding, technical help, homework, business advice, medical diagnoses, legal counsel, or any other non-therapeutic topics.
Always redirect the conversation back to the user's emotional wellbeing and personal reflection.
Your sole purpose is to be a supportive journaling companion and therapeutic guide.
Output all responses in valid Markdown format, using structured elements like headings (##), bullet points, numbered lists, bold, italics, and line breaks to make responses easy to read and emotionally accessible.`;

/**
 * Stream tokens using OpenAI's Responses API for real-time chat responses.
 *
 * This function uses OpenAI's newer Responses API instead of the traditional
 * Chat Completions API, which provides better streaming performance and
 * more reliable token delivery for real-time chat applications.
 *
 * The function is designed as an async generator to provide a clean streaming
 * interface that can be consumed by our API endpoint handlers.
 *
 * @param client - Configured OpenAI client instance with API key
 * @param history - Previous messages in the conversation for context
 * @param newMessage - The new user message to respond to
 * @yields String tokens as they arrive from OpenAI's streaming response
 * @throws Error if OpenAI response fails or encounters an error
 *
 * @example
 * ```typescript
 * for await (const token of streamOpenAITokens(client, history, userMessage)) {
 *   // Process each token as it arrives
 *   yield { type: 'chunk', content: token };
 * }
 * ```
 */
export async function* streamOpenAITokens(
  client: OpenAI,
  history: ChatMessage[],
  newMessage: string
) {
  // Build the input array by combining conversation history with new message
  // This preserves conversation context for the AI model
  const input: ResponseInputItem[] = [
    // Transform our ChatMessage format to OpenAI's ResponseInputItem format
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    // Add the new user message that triggered this API call
    {
      role: 'user',
      content: newMessage,
    },
  ];

  // Create a streaming Responses API call using GPT-5 model
  // The Responses API provides better streaming performance than Chat Completions
  const stream = client.responses.stream({
    model: process.env.NODE_ENV === 'production' ? 'gpt-5' : 'gpt-5-mini', // Use full GPT-5 in production for best quality
    input,
    temperature: 0.7, // Balanced for empathetic yet consistent therapeutic responses
    top_p: 0.9, // Focus on likely tokens while maintaining natural expression
    instructions: THERAPY_ASSISTANT_INSTRUCTIONS,
  });

  // Process streaming events from OpenAI
  // The Responses API provides granular event types for better control
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') {
      // New token received - yield immediately for real-time streaming
      yield event.delta;
    }
    if (event.type === 'response.failed') {
      // OpenAI encountered an error - propagate with context
      throw new Error(
        'OpenAI response failed: ' + event.response.error?.message
      );
    }
    if (event.type === 'response.completed') {
      // Streaming completed successfully - exit generator
      break;
    }
    // Other event types (like response.started) are ignored
    // as they don't contain token content
  }
}
