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
