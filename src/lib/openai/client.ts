import OpenAI from 'openai';

/**
 * Centralized OpenAI client instance.
 *
 * This singleton client can be shared across the application
 * and injected into functions for better testability.
 */
export const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
