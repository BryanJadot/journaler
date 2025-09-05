import bcrypt from 'bcryptjs';

import type { User } from '@/lib/user/types';

export interface MockUserWithPassword {
  user: User;
  password: string;
  passwordHash: string;
}

/**
 * Creates a mock user with randomly generated ID and username
 * to prevent test pollution and clashing between tests
 *
 * @returns {User} Mock user object with unique properties
 */
export function createMockUser(): User {
  return {
    id: `${Math.random().toString(36).substring(2)}-${Date.now()}`,
    username: `testuser_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };
}

/**
 * Creates multiple mock users with unique properties
 *
 * @param count Number of users to create
 * @returns Array of mock user objects
 */
export function createMockUsers(count: number): User[] {
  return Array.from({ length: count }, () => createMockUser());
}

/**
 * Creates a mock user with password information for authentication testing
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
 * Generates a unique message ID to prevent test conflicts
 * @returns Unique string ID for messages
 */
export function createUniqueMessageId(): string {
  return `msg_${Math.random().toString(36).substring(2)}_${Date.now()}`;
}

/**
 * Generates a unique thread ID to prevent test conflicts
 * @returns Unique numeric ID for threads (using timestamp + random)
 */
export function createUniqueThreadId(): number {
  return Math.floor(Date.now() + Math.random() * 1000);
}

/**
 * Generates a unique user ID to prevent test conflicts
 * @returns Unique string ID for users
 */
export function createUniqueUserId(): string {
  return `usr_${Math.random().toString(36).substring(2)}_${Date.now()}`;
}

/**
 * Creates a mock message object with unique ID
 * @param role Message role
 * @param content Message content
 * @returns Mock message object
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
 * Creates multiple mock messages with unique IDs
 * @param messages Array of {role, content} objects
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
 * @param {'user' | 'assistant' | 'system'} role - The message role determining format
 * @param {unknown} content - Message content (converted to string for user messages)
 * @returns {object} Mock message formatted according to AI SDK requirements
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
 * @param {Array<{role: string, content: string}>} messages - Array of message objects to convert
 * @returns {Array<object>} Array of mock messages formatted for AI SDK compatibility
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
