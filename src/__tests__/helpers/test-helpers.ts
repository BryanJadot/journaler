import { randomUUID } from 'crypto';

import bcrypt from 'bcryptjs';

import type { User } from '@/lib/user/types';

/**
 * Complete user mock data including both plain text password and bcrypt hash.
 *
 * Essential for authentication testing where both the original password
 * and its hashed equivalent are needed to verify login flows and password
 * comparison operations work correctly.
 */
export interface MockUserWithPassword {
  user: User;
  password: string;
  passwordHash: string;
}

/**
 * Creates a mock user with randomly generated ID and username.
 *
 * Essential for test isolation - each test gets a unique user that won't
 * conflict with other tests running in parallel or previously executed tests.
 * Uses fixed creation date for deterministic testing behavior.
 *
 * @returns Mock user object with unique properties but predictable structure
 */
export function createMockUser(): User {
  return {
    id: createUniqueUserId(),
    username: createUniqueUsername(),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };
}

/**
 * Creates multiple mock users with unique properties for bulk testing scenarios.
 *
 * Useful for testing operations that work with multiple users, such as
 * user listing, search functionality, or database operations that need
 * to verify behavior across different user records.
 *
 * @param count Number of users to create
 * @returns Array of mock user objects, each with unique identifiers
 */
export function createMockUsers(count: number): User[] {
  return Array.from({ length: count }, () => createMockUser());
}

/**
 * Creates a mock user with password information for authentication testing.
 *
 * Generates both the plain text password and bcrypt hash, which is crucial
 * for testing login flows where the password needs to be verified against
 * the stored hash. Uses bcrypt with 12 salt rounds to match production
 * password hashing behavior.
 *
 * @param username Optional username (defaults to random from createMockUser)
 * @param password Optional password (defaults to 'password123')
 * @returns Promise resolving to mock user with password data
 */
export async function createMockUserWithPassword(
  username?: string,
  password: string = 'password123'
): Promise<MockUserWithPassword> {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = createMockUser();

  if (username) {
    user.username = username;
  }

  return {
    user,
    password,
    passwordHash,
  };
}

/**
 * Generates a unique message ID to prevent test conflicts.
 *
 * Uses UUID to ensure message IDs never collide across test runs,
 * preventing false test failures from ID conflicts in message-related
 * operations and database constraints.
 *
 * @returns Unique string ID for messages
 */
export function createUniqueMessageId(): string {
  return `msg_${randomUUID()}`;
}

/**
 * Generates a unique thread ID to prevent test conflicts.
 *
 * Combines current timestamp with random number to create unique numeric IDs
 * that won't conflict across test runs. The timestamp component ensures
 * uniqueness over time while random component handles concurrent execution.
 *
 * @returns Unique numeric ID for threads (using timestamp + random)
 */
export function createUniqueThreadId(): number {
  return Math.floor(Date.now() + Math.random() * 1000);
}

/**
 * Generates a unique user ID to prevent test conflicts.
 *
 * Uses UUID v4 for cryptographically strong uniqueness guarantees,
 * ensuring user IDs never collide across parallel test execution
 * or multiple test runs.
 *
 * @returns Unique string ID for users
 */
export function createUniqueUserId(): string {
  return randomUUID();
}

/**
 * Creates a mock message object with unique ID for basic chat testing.
 *
 * Generates messages in the standard chat format used throughout the application.
 * Each message gets a unique ID to prevent conflicts when testing chat flows
 * that involve multiple messages or message operations.
 *
 * @param role Message role (user, assistant, or system)
 * @param content Message content
 * @returns Mock message object with unique ID
 */
export function createMockMessage(
  role: 'user' | 'assistant' | 'system',
  content: string
) {
  return {
    id: createUniqueMessageId(),
    role,
    content,
  };
}

/**
 * Creates multiple mock messages with unique IDs for conversation testing.
 *
 * Useful for testing chat flows that involve multiple message exchanges,
 * conversation history, or batch message operations. Each message gets
 * a unique ID to prevent conflicts in database operations.
 *
 * @param messages Array of role and content objects
 * @returns Array of mock messages with unique IDs
 */
export function createMockMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
) {
  return messages.map((msg) => createMockMessage(msg.role, msg.content));
}

/**
 * Creates a single mock message for API requests with proper AI SDK message structure.
 *
 * This function is crucial for testing because it creates messages in the exact format
 * expected by the AI SDK and chat API:
 *
 * - User messages use 'parts' array format to support multi-modal content
 * - Assistant/system messages use 'content' property for backward compatibility
 * - Each message gets a unique ID to prevent test conflicts
 *
 * The different formats reflect the AI SDK's requirements:
 * - User messages: { role: 'user', parts: [{ type: 'text', text: string }] }
 * - Other messages: { role: string, content: unknown }
 *
 * @param role - The message role determining format
 * @param content - Message content (converted to string for user messages)
 * @returns Mock message formatted according to AI SDK requirements
 * @example
 * // Creates user message with parts array
 * const userMsg = createApiMessage('user', 'Hello world');
 * // Result: { id: 'msg_abc123', role: 'user', parts: [{ type: 'text', text: 'Hello world' }] }
 *
 * // Creates assistant message with content property
 * const assistantMsg = createApiMessage('assistant', 'Hi there!');
 * // Result: { id: 'msg_def456', role: 'assistant', content: 'Hi there!' }
 */
export function createApiMessage(
  role: 'user' | 'assistant' | 'system',
  content: unknown
) {
  // Base message structure with unique ID for test isolation
  const baseMessage = {
    id: createUniqueMessageId(),
    role,
  };

  // User messages MUST use parts array format for AI SDK compatibility
  // This format supports multi-modal content (text, images, etc.)
  if (role === 'user') {
    return {
      ...baseMessage,
      // Parts array with single text part (current system limitation)
      // Type assertion ensures TypeScript recognizes the literal type
      parts: [{ type: 'text' as const, text: String(content) }],
    };
  }

  // Assistant and system messages use legacy content property
  // This maintains backward compatibility with existing test infrastructure
  return {
    ...baseMessage,
    content,
  };
}

/**
 * Creates multiple mock messages for API requests with unique IDs and proper AI SDK formatting.
 *
 * This helper is essential for testing conversation flows where multiple message types
 * are present. It automatically applies the correct format for each role:
 * - User messages get parts[] array structure
 * - Assistant/system messages get content property
 *
 * @param messages - Array of message objects to convert
 * @returns Array of mock messages formatted for AI SDK compatibility
 * @example
 * const conversation = createApiMessages([
 *   { role: 'system', content: 'You are helpful' },
 *   { role: 'user', content: 'Hello' },
 *   { role: 'assistant', content: 'Hi there!' }
 * ]);
 * // Results in properly formatted messages for each role type
 */
export function createApiMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
) {
  return messages.map((msg) => createApiMessage(msg.role, msg.content));
}

/**
 * Generates a unique username to prevent test conflicts.
 *
 * Creates usernames with a predictable format (testuser_ + UUID prefix)
 * that are guaranteed to be unique across test runs. The format makes
 * it easy to identify test data while ensuring uniqueness constraints
 * in the database are never violated.
 *
 * @returns Unique username string
 */
export function createUniqueUsername(): string {
  return `testuser_${randomUUID().substring(0, 8)}`;
}

/**
 * Creates user data for database insertion with unique username.
 *
 * Generates the exact data structure needed for database user insertion,
 * including pre-hashed password using bcrypt with production-level
 * salt rounds. Essential for testing database operations without
 * going through the full user creation service layer.
 *
 * @param password Optional password (defaults to 'password123')
 * @returns Promise resolving to user data with hashed password
 */
export async function createUserInsertData(password: string = 'password123') {
  const passwordHash = await bcrypt.hash(password, 12);
  return {
    username: createUniqueUsername(),
    passwordHash,
  };
}

/**
 * Creates a username that is exactly the specified length using a unique base.
 *
 * Essential for testing username validation rules and database constraints
 * that enforce length limits. Uses a unique base to prevent conflicts
 * while ensuring the exact length for boundary testing scenarios.
 *
 * @param length Desired length of the username
 * @returns Unique username of exact length
 */
export function createUsernameOfLength(length: number): string {
  const baseUsername = createUniqueUsername();
  if (baseUsername.length >= length) {
    return baseUsername.substring(0, length);
  }
  const padding = 'a'.repeat(length - baseUsername.length);
  return baseUsername + padding;
}
