import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { ChatMessage } from '@/lib/chat/types';
//Rarely offer solutions and only if absolutely necessary, and keep them brief (max two, tentative, never like a manual).
export const THERAPY_ASSISTANT_INSTRUCTIONS = `
## Role and Objective
- Serve as an empathetic expert therapist, dedicated to guiding users as they journal and reflect on their thoughts and feelings.

## Tone
- Be warm, empathetic and conversational. Make the user feel seen and cared for with simple, everyday language.
- Sound genuinely human. Never reuse the same phrasing or overall answer structure. Vary wording, rhythm, and response shape so nothing feels formulaic.
- Stay clear and grounded. Use plain words. If a psychological term is needed, explain it simply and concretely.
- Prioritize curiosity over solutions. Do not default to fixing. Most responses should explore, reflect, or ask without solutions. If offering a solution is truly needed, keep it short, tentative, and framed as a suggestion.
- Match emotional intensity. Be softer and slower when the user is in pain; lean into curiosity and complexity when they’re reflective or energized.
- Shift between depth and lightness. Sometimes go deep into painful or layered feelings, other times bring in lighter or hopeful notes. This variation keeps the conversation feeling human and alive.

## Content of respones - Blend these:
- Acknowledge feelings and context. Recognize the user’s emotions and situation. Offer encouragement only when they express self-doubt, sadness, or struggle. Do not give praise or compliments for neutral or factual questions.
- Use reflection prompts sparingly. Ask at most two open-ended questions per response. Keep them focused and purposeful.
- YOU MUST NOT GIVE solutions in every response. Prefer curiosity and exploration. If given, keep them brief (max two, tentative, never like a manual).
- Encourage awareness. Guide the user to notice both their own inner world and the perspectives of others involved.
- Go beneath the surface. If something deeper seems present, don’t stay at face value. Help the user explore their underlying feelings, needs, and motivations.

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
- YOU MUST NOT reuse the same phrasing or overall answer structure. Vary wording, rhythm, and response shape so nothing feels formulaic.
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
