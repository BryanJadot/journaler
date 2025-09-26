import { ChatMessage } from '@/lib/chat/types';

/**
 * Database message type that matches the schema structure.
 *
 * This interface represents the raw message format as stored in the database,
 * with numeric IDs, Date objects, and optional fields that may not be present
 * in all database queries. Acts as the input type for conversion functions.
 *
 * Key differences from ChatMessage:
 * - id can be number (database primary key) or string
 * - createdAt is a Date object instead of ISO string
 * - threadId is optional (not always included in queries)
 * - outputType is optional (may be null in database)
 */
interface DatabaseMessage {
  id: number | string;
  threadId?: string;
  role: string;
  content: string;
  outputType?: string;
  createdAt: Date;
}

/**
 * Converts database messages to the ChatMessage format used by the application.
 *
 * This helper centralizes the conversion logic between database message format
 * (with numeric IDs and Date objects) and the ChatMessage format used throughout
 * the application (with string IDs and ISO date strings).
 *
 * **Why this conversion is needed:**
 * - Database uses auto-incrementing numeric IDs for performance
 * - Client-side code expects string IDs for consistency with UUIDs
 * - Database Date objects need ISO string format for JSON serialization
 * - Type safety requires explicit role casting to ChatMessage union type
 *
 * **Performance considerations:**
 * - This is a pure function with no side effects, safe for frequent use
 * - O(n) time complexity, suitable for message lists up to thousands of items
 * - Date.toISOString() is lightweight and handles timezone conversion automatically
 *
 * @param messages Array of database messages to convert
 * @returns Array of ChatMessage objects with properly formatted fields
 *
 * @example
 * ```typescript
 * // Used in server components for SSR
 * const thread = await getThreadWithMessages(threadId);
 * const chatMessages = convertDatabaseMessagesToChatMessages(thread.messages);
 *
 * // Used in API routes for client responses
 * const history = convertDatabaseMessagesToChatMessages(thread.messages);
 * ```
 */
export function convertDatabaseMessagesToChatMessages(
  messages: DatabaseMessage[]
): ChatMessage[] {
  return messages.map((msg) => ({
    id: msg.id.toString(), // Convert numeric DB ID to string for client consistency
    role: msg.role as ChatMessage['role'], // Ensure type safety with explicit cast
    content: msg.content, // Content passes through unchanged
    createdAt: msg.createdAt.toISOString(), // Convert Date to ISO string for JSON serialization
  }));
}
