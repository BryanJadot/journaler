import OpenAI from 'openai';
import { ResponseInputItem } from 'openai/resources/responses/responses.mjs';

import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import type { ThreadWithFirstMessage } from '@/lib/db/threads';

/**
 * Validates if a thread is eligible for auto-naming.
 *
 * @param threadData - Thread data with first message
 * @param userId - The authenticated user ID
 * @returns Validation result with reason if not eligible
 */
export function validateThreadForAutoNaming(
  threadData: ThreadWithFirstMessage,
  userId: string
): { eligible: boolean; reason?: string; statusCode?: number } {
  const { thread, firstMessage } = threadData;

  // Verify thread belongs to authenticated user
  if (thread.userId !== userId) {
    return { eligible: false, reason: 'Thread not found', statusCode: 404 };
  }

  // Only auto-name threads that still have the default name
  if (thread.name !== DEFAULT_THREAD_NAME) {
    return {
      eligible: false,
      reason: 'Thread already has a custom name',
      statusCode: 409,
    };
  }

  // Only auto-name if there's a first message from the user
  if (!firstMessage || firstMessage.role !== 'user') {
    return {
      eligible: false,
      reason: 'No user message found to base name on',
      statusCode: 422,
    };
  }

  return { eligible: true };
}

/**
 * Generates a thread name using OpenAI Responses API based on the first user message.
 *
 * @param firstMessage - The first user message content
 * @returns Generated thread name
 * @throws Error if OpenAI call fails
 */
export async function generateThreadName(
  firstMessage: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const input: ResponseInputItem[] = [
    {
      role: 'user',
      content: firstMessage,
    },
  ];

  const response = await openai.responses.create({
    model: 'gpt-5-mini',
    input,
    instructions:
      'Generate a concise, descriptive title for a conversation that starts with this user message. The title should capture the main topic or intent. Maximum 50 characters. Return only the title, no quotes or extra formatting.',
  });

  const generatedName = response.output_text?.trim();

  if (!generatedName) {
    throw new Error('OpenAI returned empty response');
  }

  // Validate length constraint - fail hard if OpenAI doesn't follow instructions
  if (generatedName.length > 50) {
    throw new Error(`Generated name exceeds 50 characters: "${generatedName}"`);
  }

  return generatedName;
}
