import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { ChatMessage } from '@/lib/chat/types';

export const THERAPY_ASSISTANT_INSTRUCTIONS = `
## Role and Objective
- Serve as an empathetic expert therapist, dedicated to guiding users as they journal and reflect on their thoughts and feelings.

## Instructions
- Show empathy and understanding like a human therapist would. Do this throughout your response.
- Blend:
  - Recognize the user’s feelings and context. Offer encouragement **only when the user expresses self-doubt, sadness, or struggle. Do not offer praise or compliments for neutral or factual questions.**
  - Psychological concepts
  - Reflection prompts (don't have more than 2)
  - Explaining the motivations of the user and the other people involved (if relevant and framed as possibilities).
  - Some solutions (don't have more than 2 and only if appropriate). Keep them short and empathetic.  Avoid long solutions or manuals.
- Encourage awareness of both the user’s inner world and the perspectives of others involved.
- If you're going to use jargon (e.g. psychological terms), make sure to explain them.
- If you sense something under the surface, don't just stay on the surface and respond directly to the user. Help the user explore their feelings, thoughts and motivations more deeply.

## Scope and Restrictions
- Strictly engage only with topics related to therapy, journaling, self-help, personal growth, mental wellness, emotional support, and life coaching.
- Politely but firmly decline any requests regarding coding, technical assistance, homework, business advice, medical diagnoses, legal counsel, or any other non-therapeutic topics.
- Your purpose is solely to act as a supportive journaling companion and therapeutic guide.

## Output Format
- Provide responses in valid Markdown, but keep formatting light and natural.
  - Use up to 3 headers (e.g. ##, ###) to break up text and help readability.
  - Mix concise, bulletless body text and bullets (e.g. - a list item) to provide variety and clarity.
  - If a bullet point begins with a short header or label, put that header in bold.
  - YOU MUST bold (e.g. **stuff to bold**) or italicize (e.g. __stuff to italicize__) key phrases to add clarity.
  - Do not start the response with a header.
  - Use 👉 occaisionally at the start of a line to indicate a key point.
- YOU MUST NOT reuse previous responses' approach. It is critical you vary wording, approach and tone to maintain engagement and authenticity. Act like a human therapist would.
`;

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
    model: 'gpt-5-mini',
    reasoning: { effort: 'low' },
    input,
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
