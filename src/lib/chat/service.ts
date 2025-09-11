import { eq, desc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { threads, messages } from '@/lib/db/schema';

import type { Role, OutputType, ThreadSummary } from './types';

/**
 * Creates a new chat thread for a user.
 *
 * This function initializes a new conversation thread with the provided name
 * and associates it with the specified user. The thread's updatedAt timestamp
 * is set to the current time to establish when it was created.
 *
 * @param {string} userId - The unique identifier of the user creating the thread
 * @param {string} name - The display name/title for the new thread
 * @returns {Promise<Thread>} A promise that resolves to the newly created thread object
 *
 * @example
 * ```typescript
 * const thread = await createThread('user123', 'My New Conversation');
 * console.log(thread.id); // Outputs the new thread ID
 * ```
 *
 * @throws {Error} Database error if thread creation fails
 */
export async function createThread(userId: string, name: string) {
  const [thread] = await db
    .insert(threads)
    .values({
      userId,
      name,
      updatedAt: new Date(),
    })
    .returning();

  return thread;
}

/**
 * Retrieves all chat threads for a specific user, ordered by most recent activity.
 *
 * This function returns all threads belonging to the specified user, sorted by
 * their last update time (most recent first). Each thread includes only its
 * most recent message to provide a preview for thread listing interfaces.
 *
 * @param {string} userId - The unique identifier of the user whose threads to retrieve
 * @returns {Promise<ThreadWithRecentMessage[]>} A promise that resolves to an array of threads,
 *   each containing its most recent message, sorted by updatedAt descending
 *
 * @example
 * ```typescript
 * const userThreads = await getThreadsByUser('user123');
 * userThreads.forEach(thread => {
 *   console.log(`${thread.name}: ${thread.messages[0]?.content}`);
 * });
 * ```
 *
 * @throws {Error} Database error if query fails
 */
export async function getThreadsByUser(userId: string) {
  return db.query.threads.findMany({
    where: eq(threads.userId, userId),
    orderBy: [desc(threads.updatedAt)], // Most recently updated threads first
    with: {
      messages: {
        orderBy: [desc(messages.createdAt)], // Get the latest message
        limit: 1, // Only include the most recent message for preview
      },
    },
  });
}

/**
 * Retrieves thread summaries for user sidebar navigation (no messages).
 *
 * This function returns lightweight thread information optimized for sidebar
 * navigation components where only essential metadata is needed. Unlike
 * getThreadsByUser, this excludes all message data for better performance
 * when rendering thread lists in UI components.
 *
 * @param {string} userId - The unique identifier of the user whose threads to retrieve
 * @returns {Promise<Thread[]>} A promise that resolves to an array of thread summaries
 *   containing only id, name, and updatedAt fields, sorted by most recent activity
 *
 * @example
 * ```typescript
 * // Ideal for sidebar navigation components
 * const threadList = await getThreadSummariesForUser('user123');
 * threadList.forEach(thread => {
 *   console.log(`${thread.name} (${thread.updatedAt})`);
 * });
 * ```
 *
 * @throws {Error} Database error if query fails
 */
export async function getThreadSummariesForUser(
  userId: string
): Promise<ThreadSummary[]> {
  return db.query.threads.findMany({
    where: eq(threads.userId, userId),
    orderBy: [desc(threads.updatedAt)], // Most recently updated threads first
    columns: {
      id: true, // Required for navigation links
      name: true, // Thread display title
      updatedAt: true, // For sorting and timestamp display
    },
  });
}

/**
 * Retrieves the most recently updated thread for a user with all its messages.
 *
 * This function finds the user's most recently active thread and returns it
 * with all associated messages in chronological order. This is typically used
 * when resuming a conversation or displaying the current active chat.
 *
 * @param {string} userId - The unique identifier of the user
 * @returns {Promise<ThreadWithMessages | undefined>} A promise that resolves to the most recent thread
 *   with all messages, or undefined if the user has no threads
 *
 * @example
 * ```typescript
 * const recentThread = await getMostRecentThread('user123');
 * if (recentThread) {
 *   console.log(`Resuming: ${recentThread.name}`);
 *   console.log(`Messages: ${recentThread.messages.length}`);
 * }
 * ```
 *
 * @throws {Error} Database error if query fails
 */
export async function getMostRecentThread(userId: string) {
  return db.query.threads.findFirst({
    where: eq(threads.userId, userId),
    orderBy: [desc(threads.updatedAt)], // Find the most recently updated thread
    with: {
      messages: {
        orderBy: [messages.createdAt], // Messages in chronological order (oldest first)
      },
    },
  });
}

/**
 * Retrieves a specific thread by ID along with all its messages.
 *
 * This function fetches a complete thread record including all associated
 * messages in chronological order. This is the primary function used when
 * displaying a specific conversation thread to the user.
 *
 * @param {string} threadId - The unique identifier of the thread to retrieve
 * @returns {Promise<ThreadWithMessages | undefined>} A promise that resolves to the thread
 *   with all messages, or undefined if the thread doesn't exist
 *
 * @example
 * ```typescript
 * const thread = await getThreadWithMessages('thread456');
 * if (thread) {
 *   thread.messages.forEach(msg => {
 *     console.log(`${msg.role}: ${msg.content}`);
 *   });
 * } else {
 *   console.log('Thread not found');
 * }
 * ```
 *
 * @throws {Error} Database error if query fails
 */
export async function getThreadWithMessages(threadId: string) {
  return db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    with: {
      messages: {
        orderBy: [messages.createdAt], // Messages in chronological order for conversation flow
      },
    },
  });
}

/**
 * Checks if a thread exists and belongs to a specific user (lightweight ownership verification).
 *
 * This function performs a minimal query to verify thread ownership without loading
 * all messages, making it ideal for authentication checks in API endpoints.
 * Returns only the essential thread metadata needed for ownership verification.
 *
 * @param {string} threadId - The unique identifier of the thread to verify
 * @param {string} userId - The user ID to check ownership against
 * @returns {Promise<boolean>} A promise that resolves to true if the user owns the thread
 *
 * @example
 * ```typescript
 * const canAccess = await verifyThreadOwnership('thread123', 'user456');
 * if (!canAccess) {
 *   throw new Error('Thread not found or access denied');
 * }
 * ```
 *
 * @throws {Error} Database error if query fails
 */
export async function verifyThreadOwnership(
  threadId: string,
  userId: string
): Promise<boolean> {
  // Handle empty or invalid inputs early to avoid database errors
  if (!threadId || !userId) {
    return false;
  }

  const thread = await db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    columns: {
      id: true,
      userId: true,
    },
  });

  return thread?.userId === userId;
}

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
 * @param {string} threadId - The unique identifier of the thread to add the message to
 * @param {Role} role - The role of the message sender ('user', 'assistant', or 'developer')
 * @param {string} content - The text content of the message
 * @param {OutputType} [outputType='text'] - The format type of the message content
 *   (defaults to 'text' for standard text messages)
 * @returns {Promise<Message>} A promise that resolves to the newly created message object
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
