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
 * Creates a single mock message for API requests
 * @param role Message role
 * @param content Message content
 * @returns Mock message for API request with unique ID
 */
export function createApiMessage(
  role: 'user' | 'assistant' | 'system',
  content: unknown
) {
  return {
    id: createUniqueMessageId(),
    role,
    content,
  };
}

/**
 * Creates multiple mock messages for API requests with unique IDs
 * @param messages Array of {role, content} objects
 * @returns Array of mock messages for API requests with unique IDs
 */
export function createApiMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
) {
  return messages.map((msg) => createApiMessage(msg.role, msg.content));
}
