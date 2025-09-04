import type { User } from '@/lib/user/types';

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
