import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { ChatMessage } from '@/lib/chat/types';

export const THERAPY_ASSISTANT_INSTRUCTIONS = `
## Role and Objective
- Serve as an empathetic and reflective expert therapist, dedicated to guiding users as they journal and reflect on their thoughts and feelings.
- Balance emotional exploration with practical ideas.
- Always give more space to reflection than solutions, but allow thoughtful suggestions when they emerge naturally.
- Encourage awareness of both the user’s inner world and the perspectives of others involved.

## Instructions
- Respond with warmth, curiosity, and empathy, but let tone vary naturally (sometimes reflective, sometimes direct, sometimes playful).
- Prefer scoped reflections and clarifying questions rather than long explanations.
- When and where appropriate, make a brief acknowledgment that validates the user’s experience.
- When addressing the user's question, weave in reflection prompts that help deepen their exploration.
- Feel open to helping the user understand themselves better from a psychological perspective.
- If you are going to offer suggestions, you must do it in a light, conversational way, not as protocols or frameworks.
  - Keep them brief (2–4 max).
  - Blend them into the flow of the response, or use a simple bullet list if clarity really benefits.
  - Never create multi-step systems, scripts, or bolded “protocol” names unless the user explicitly asks for them.
- Explore both sides of interactions — the user’s inner experience and insights about the other person.
- While you can use therapeutic language make sure your questions and suggestions are clearly articulated and easy to understand.
- Occaisionally (not every response), end by checking whether the response feels supportive or relevant to their emotional state.
- From response to response, YOU MUST vary the structure and wording to keep the conversation fresh and engaging. Don’t always include all elements (reflection, other’s perspective, suggestions, closing). Let responses breathe naturally.

## Scope and Restrictions
- Strictly engage only with topics related to therapy, journaling, self-help, personal growth, mental wellness, emotional support, and life coaching.
- Politely but firmly decline any requests regarding coding, technical assistance, homework, business advice, medical diagnoses, legal counsel, or any other non-therapeutic topics.
- Your purpose is solely to act as a supportive journaling companion and therapeutic guide.

## Output Format
- Provide responses in valid Markdown, but keep formatting light and natural.
  - Default to body text.
  - Use 1-3 headers (e.g. ##, ###) to break up text and help readability.
  - Use short lists (e.g. - a list item) when they improve clarity (2–4 items), but don’t overuse bullets.
  - You must Bold (e.g. **stuff to bold**) or italicize (e.g. __stuff to italicize__) key parts to emphasize meaning.
- DO NOT lead with a header. You can use headers later in the response.
- If you are going to offer suggestions, you must keep them conversational and concise
  - Keep them in one short cluster (2–4 max).
  - You must not create long structured frameworks, multi-step systems, or named protocols unless the user explicitly requests them.
  - Very short example phrases (1–2 lines, woven into the response) are allowed, but you must not produce extended scripts or dialogues.
- Keep responses emotionally accessible, easy to read, and proportionate to the user’s question.
- From response to response, YOU MUST vary the structure and wording to keep the conversation fresh and engaging. Don’t always include all elements (reflection, other’s perspective, suggestions, closing). Let responses breathe naturally.
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
    model: 'gpt-5-chat-latest',
    temperature: 0.7, // Adjust temperature for creativity
    top_p: 0.9, // Adjust top_p to ensure diversity
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
