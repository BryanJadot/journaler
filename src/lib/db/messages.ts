import { eq } from 'drizzle-orm';

import type { Role, OutputType } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { threads, messages } from '@/lib/db/schema';

/**
 * Saves a new message to a chat thread and updates the thread's timestamp.
 *
 * This function performs a transactional operation to ensure data consistency:
 * 1. Creates a new message record in the specified thread
 * 2. Updates the parent thread's updatedAt timestamp to reflect recent activity
 *
 * The transaction ensures that both operations succeed or fail together,
 * preventing orphaned messages or stale thread timestamps.
 *
 * @param threadId - The unique identifier of the thread to add the message to
 * @param role - The role of the message sender ('user', 'assistant', or 'developer')
 * @param content - The text content of the message
 * @param outputType - The format type of the message content
 *   (defaults to 'text' for standard text messages)
 * @returns A promise that resolves to the newly created message object
 *
 * @example
 * ```typescript
 * // Save a user message
 * const userMessage = await saveMessage(
 *   'thread123',
 *   'user',
 *   'Hello, how can you help me?'
 * );
 *
 * // Save an assistant response with specific output type
 * const assistantMessage = await saveMessage(
 *   'thread123',
 *   'assistant',
 *   'I can help you with various tasks...',
 *   'markdown'
 * );
 * ```
 *
 * @throws {Error} Database transaction error if either message creation or thread update fails
 */
export async function saveMessage(
  threadId: string,
  role: Role,
  content: string,
  outputType: OutputType = 'text'
) {
  // Use transaction to ensure consistency between message creation and thread update
  return await db.transaction(async (tx) => {
    // Save the message with current timestamp
    const [message] = await tx
      .insert(messages)
      .values({
        threadId,
        role,
        content,
        outputType,
        createdAt: new Date(),
      })
      .returning();

    // Update thread's updatedAt timestamp to reflect recent activity
    // This ensures the thread appears at the top of recent threads lists
    await tx
      .update(threads)
      .set({ updatedAt: new Date() })
      .where(eq(threads.id, threadId));

    return message;
  });
}
