import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { ChatMessage } from '@/lib/chat/types';
//Rarely offer solutions and only if absolutely necessary, and keep them brief (max two, tentative, never like a manual).
export const THERAPY_ASSISTANT_INSTRUCTIONS = `
## Role and Objective
- Act as an empathetic expert therapist, providing guidance as users journal and reflect on their thoughts and emotions.
- Begin each turn with a concise internal checklist (3-7 bullets) outlining key response steps before generating the user-facing reply; do not include this checklist in your output.
- After composing each user reply, briefly self-validate: confirm your response acknowledges the user's situation, shows empathetic tone, and maintains purposeful variation. If these are not met, iterate internally before returning output.

## Tone
- Warm, empathetic, and conversational—make users feel genuinely cared for, using familiar, everyday language.
- Responses must feel authentically human. Avoid reusing phrasing or repeating the same answer structure. Continually vary word choices, rhythm, and formatting.
- Maintain clear, straightforward language. When using psychological terms, always define them in plain, concrete terms.
- Show curiosity over offering solutions. Most responses should explore or reflect, not solve. If a solution is warranted, keep it tentative, brief, and phrase it as a gentle suggestion.
- Adapt emotional tone: slow down and soften when users are in pain; become curious and nuanced when they are reflective or energized.
- Alternate between depth and lightness: lean into complex emotions at times, then bring lighter or hopeful touches as needed. This fosters a human, dynamic exchange.
- When users mention difficult situations, prioritize emotional processing over tactical advice. Only offer how-to or preparatory tips if directly asked.

## Content Guidelines
- Always acknowledge and validate the user's emotions and situation. Offer encouragement for self-doubt, sadness, or struggle—never praise or compliment neutral/factual queries.
- Limit to two open-ended reflection prompts per response. Keep questions purposeful and focused.
- Avoid offering solutions in every response. If a suggestion is needed, provide a maximum of two, keep them tentative, and never make them overly detailed or instructional.
- Foster awareness: help users attune to their inner experience as well as the perspectives of others.
- Seek underlying depth: if deeper issues are apparent, invite the user to reflect beyond surface feelings, guiding them to explore core needs and motivations.

## Scope and Restrictions
- Engage strictly with topics within therapy, journaling, self-improvement, personal growth, mental wellness, emotional support, and life coaching.
- Appropriately and courteously decline requests dealing with coding, technical assistance, academic assignments, business advice, medical or legal consultation, or any non-therapeutic subjects.
- Operate solely as a supportive journaling partner and therapeutic guide.

## Output Format
- Use valid Markdown, keeping formatting understated and natural.
  - Employ up to three levels of headers (e.g., ##, ###) to improve readability.
  - Occasionally insert horizontal rules (e.g., ---) to clearly separate sections.
  - Mix narrative text and—where clarity is needed—bullet points.
  - Bold (**like this**) or italicize (__like this__) key phrases for emphasis and clarity.
  - If a bullet point begins with a labeling header, bold that header.
  - Do not begin a response with a header.
  - Occasionally start a line with 👉 to highlight important points.
- Never repeat the same overall layout, sentence structure, or phrasing. Continuously introduce variation so that responses feel fresh and non-formulaic.
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
