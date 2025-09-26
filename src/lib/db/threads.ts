import { and, eq, desc } from 'drizzle-orm';
import { unstable_cache, revalidateTag } from 'next/cache';
import { validate as isValidUUID } from 'uuid';

import type { ThreadSummary } from '@/lib/chat/types';
import { db } from '@/lib/db';
import { threads, messages } from '@/lib/db/schema';

/**
 * Thread data with first user message for auto-naming.
 */
export interface ThreadWithFirstMessage {
  thread: {
    id: string;
    name: string;
    userId: string;
    updatedAt: Date;
  };
  firstMessage: {
    content: string;
    role: string;
  } | null;
}

/**
 * Creates a new chat thread for a user.
 *
 * This function initializes a new conversation thread with the provided name
 * and associates it with the specified user. The thread's updatedAt timestamp
 * is set to the current time to establish when it was created.
 *
 * @param userId - The unique identifier of the user creating the thread
 * @param name - The display name/title for the new thread
 * @returns A promise that resolves to the newly created thread object
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

  // Invalidate user's thread cache to refresh sidebar
  const cacheTag = getUserThreadsCacheTag(userId);
  revalidateTag(cacheTag);

  return thread;
}

/**
 * Retrieves all chat threads for a specific user, ordered by most recent activity.
 *
 * This function returns all threads belonging to the specified user, sorted by
 * their last update time (most recent first). Each thread includes only its
 * most recent message to provide a preview for thread listing interfaces.
 *
 * @param userId - The unique identifier of the user whose threads to retrieve
 * @returns A promise that resolves to an array of threads,
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
        orderBy: [desc(messages.id)], // Get the latest message (ID is monotonic)
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
 * @param userId - The unique identifier of the user whose threads to retrieve
 * @returns A promise that resolves to an array of thread summaries
 *   containing only id, name, updatedAt, and starred fields, sorted by starred status then most recent activity
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
    // Dual-level sorting: starred threads always appear first regardless of update time,
    // then within each group (starred/unstarred) sort by most recent activity
    orderBy: [desc(threads.starred), desc(threads.updatedAt)],
    columns: {
      id: true, // Required for navigation links
      name: true, // Thread display title
      updatedAt: true, // For sorting and timestamp display
      starred: true, // For displaying star status
    },
  });
}

/**
 * Helper function to generate consistent cache tags for user thread summaries.
 * Used for both caching and cache invalidation.
 *
 * @param userId - The user ID to generate a cache tag for
 * @returns Cache tag string for the user's threads
 */
export function getUserThreadsCacheTag(userId: string): string {
  return `user-threads:${userId}`;
}

/**
 * Cached version of getThreadSummariesForUser with user-specific cache invalidation.
 *
 * Uses Next.js unstable_cache to cache thread summaries per user.
 * Cache can be invalidated using the user-specific tag from getUserThreadsCacheTag.
 *
 * @param userId - The unique identifier of the user whose threads to retrieve
 * @returns Cached array of thread summaries
 */
export function getCachedThreadSummaries(userId: string) {
  const cacheTag = getUserThreadsCacheTag(userId);
  return unstable_cache(
    async () => {
      return getThreadSummariesForUser(userId);
    },
    [cacheTag], // User-specific cache key
    {
      tags: [cacheTag], // User-specific tag for cache invalidation
    }
  )();
}

/**
 * Retrieves the most recently updated thread for a user with all its messages.
 *
 * This function finds the user's most recently active thread and returns it
 * with all associated messages in chronological order. This is typically used
 * when resuming a conversation or displaying the current active chat.
 *
 * @param userId - The unique identifier of the user
 * @returns A promise that resolves to the most recent thread
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
        orderBy: [messages.id], // Messages in chronological order (ID is monotonic)
      },
    },
  });
}

/**
 * Retrieves a thread by its ID without any related data.
 *
 * This function performs a lightweight query to fetch only the thread data
 * without joining messages or other related entities. Ideal for operations
 * that only need thread metadata like name checks or status updates.
 *
 * @param threadId - The unique identifier of the thread to retrieve
 * @returns A promise that resolves to the thread or undefined if not found
 *
 * @example
 * ```typescript
 * const thread = await getThreadById('thread123');
 * if (thread) {
 *   console.log(`Thread name: ${thread.name}`);
 * }
 * ```
 *
 * @throws {Error} Database error if query fails
 */
export async function getThreadById(threadId: string) {
  return db.query.threads.findFirst({
    where: eq(threads.id, threadId),
  });
}

/**
 * Retrieves a specific thread by ID along with all its messages.
 *
 * This function fetches a complete thread record including all associated
 * messages in chronological order. This is the primary function used when
 * displaying a specific conversation thread to the user.
 *
 * @param threadId - The unique identifier of the thread to retrieve
 * @returns A promise that resolves to the thread
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
        orderBy: [messages.id], // Messages in chronological order (ID is monotonic)
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
 * @param threadId - The unique identifier of the thread to verify
 * @param userId - The user ID to check ownership against
 * @returns A promise that resolves to true if the user owns the thread
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
 * Retrieves a thread with its first user message for auto-naming purposes.
 *
 * This function is specifically designed for the auto-naming feature, which analyzes
 * the first message in a conversation to generate an appropriate thread title.
 * It performs a left join to handle threads that might not have any messages yet.
 *
 * The query is optimized to fetch only the essential data needed for auto-naming:
 * - Complete thread metadata (id, name, userId, updatedAt)
 * - First message content and role for AI analysis
 *
 * @param threadId The UUID of the thread to retrieve
 * @returns Promise resolving to thread data with first message, or null if thread doesn't exist
 *
 * @example
 * ```typescript
 * const threadData = await getThreadWithFirstMessage('thread-uuid');
 * if (threadData?.firstMessage) {
 *   const autoName = await generateThreadName(threadData.firstMessage.content);
 * }
 * ```
 */
export async function getThreadWithFirstMessage(
  threadId: string
): Promise<ThreadWithFirstMessage | null> {
  const threadWithMessages = await db
    .select({
      thread: threads,
      firstMessage: {
        content: messages.content,
        role: messages.role,
      },
    })
    .from(threads)
    .leftJoin(messages, eq(messages.threadId, threads.id))
    .where(eq(threads.id, threadId))
    .orderBy(messages.id)
    .limit(1);

  if (threadWithMessages.length === 0) {
    return null;
  }

  return threadWithMessages[0];
}

/**
 * Updates a thread's name in the database with optional conditional update capability.
 *
 * This function provides atomic thread name updates with built-in race condition protection.
 * It can optionally check the current thread name before updating to prevent overwrites
 * during concurrent operations (e.g., auto-naming vs. manual renaming).
 *
 * Key behaviors:
 * - Updates name and updatedAt timestamp atomically
 * - Returns boolean indicating whether update actually occurred
 * - Invalidates user's thread cache only if update succeeds
 * - Supports conditional updates to prevent race conditions
 *
 * @param threadId The UUID of the thread to update
 * @param newName The new name to set for the thread
 * @param userId The user ID for cache invalidation purposes
 * @param onlyIfCurrentNameIs Optional condition - only updates if current name matches this exact value
 * @returns Promise resolving to true if thread was updated, false if no rows were affected
 *
 * @example
 * ```typescript
 * // Unconditional update
 * const updated = await updateThreadName('uuid', 'New Name', 'userId');
 *
 * // Conditional update (prevents auto-naming from overwriting user changes)
 * const updated = await updateThreadName(
 *   'uuid',
 *   'Auto-generated Name',
 *   'userId',
 *   'New Chat' // Only update if still has default name
 * );
 * ```
 *
 * @throws Error if database operation fails or returns undefined rowCount
 */
export async function updateThreadName(
  threadId: string,
  newName: string,
  userId: string,
  onlyIfCurrentNameIs?: string
): Promise<boolean> {
  // Build where conditions dynamically based on parameters
  const whereConditions = [eq(threads.id, threadId)];

  // Add conditional name check if specified (prevents race conditions)
  if (onlyIfCurrentNameIs !== undefined) {
    whereConditions.push(eq(threads.name, onlyIfCurrentNameIs));
  }

  // Perform the atomic update with all conditions
  const result = await db
    .update(threads)
    .set({
      name: newName,
      updatedAt: new Date(),
    })
    .where(and(...whereConditions));

  // Verify the database operation completed successfully
  if (result.rowCount === null || result.rowCount === undefined) {
    throw new Error('Database update operation returned undefined rowCount');
  }
  const updated = result.rowCount > 0;

  // Only invalidate cache if rows were actually modified (optimization)
  if (updated) {
    const cacheTag = getUserThreadsCacheTag(userId);
    revalidateTag(cacheTag);
  }

  return updated;
}

/**
 * Toggles the starred status of a thread.
 *
 * This function updates the starred field of a thread to the specified value,
 * which determines whether the thread appears at the top of the thread list.
 * The operation also updates the thread's updatedAt timestamp and invalidates
 * the user's thread cache to trigger UI updates.
 *
 * @param threadId - The unique identifier of the thread to update
 * @param starred - The new starred status (true to star, false to unstar)
 * @param userId - The user ID for cache invalidation
 * @returns A promise that resolves when the update is complete
 *
 * @example
 * ```typescript
 * // Star a thread
 * await setThreadStarred('thread123', true, 'user456');
 *
 * // Unstar a thread
 * await setThreadStarred('thread123', false, 'user456');
 * ```
 *
 * @throws {Error} Database error if update fails
 */
export async function setThreadStarred(
  threadId: string,
  starred: boolean,
  userId: string
): Promise<void> {
  await db
    .update(threads)
    .set({
      starred,
      updatedAt: new Date(),
    })
    .where(eq(threads.id, threadId));

  // Invalidate user's thread cache to refresh sidebar
  const cacheTag = getUserThreadsCacheTag(userId);
  revalidateTag(cacheTag);
}

/**
 * Permanently deletes a thread and all associated messages from the database.
 *
 * This function performs a complete thread deletion operation using a database
 * transaction to ensure data integrity. It first deletes all messages associated
 * with the thread (to satisfy foreign key constraints), then deletes the thread
 * itself. The operation is atomic - either both operations succeed or both fail.
 *
 * Safety features:
 * - Validates thread ID is a proper UUID format before attempting deletion
 * - Uses database transaction to maintain referential integrity
 * - Throws an error for invalid or empty thread IDs to catch bugs early
 * - Invalidates user's thread cache to trigger UI updates
 *
 * This function does NOT perform ownership verification - that should be handled
 * at the application layer (e.g., in server actions) before calling this function.
 *
 * @param threadId The UUID of the thread to delete
 * @param userId The user ID for cache invalidation purposes
 * @throws When threadId is empty or not a valid UUID format
 *
 * @example
 * ```typescript
 * // Typically called from a server action after ownership verification
 * const isOwner = await verifyThreadOwnership(threadId, userId);
 * if (isOwner) {
 *   await deleteThread(threadId, userId);
 * }
 * ```
 */
export async function deleteThread(
  threadId: string,
  userId: string
): Promise<void> {
  // Validate threadId is a valid UUID format
  if (!threadId || !isValidUUID(threadId)) {
    throw new Error(`Invalid thread ID: ${threadId}`);
  }

  await db.transaction(async (tx) => {
    // Delete all messages associated with the thread first
    await tx.delete(messages).where(eq(messages.threadId, threadId));

    // Then delete the thread
    await tx.delete(threads).where(eq(threads.id, threadId));
  });

  // Invalidate user's thread cache to refresh sidebar
  const cacheTag = getUserThreadsCacheTag(userId);
  revalidateTag(cacheTag);
}
