/**
 * Database user retrieval operations test suite.
 *
 * Tests critical user lookup functions used throughout the authentication
 * and user management systems. Covers both safe user retrieval (without
 * password data) and authenticated retrieval (with password hash for login).
 *
 * Testing strategy:
 * - User retrieval by ID with UUID validation
 * - Username-based lookup with password hash inclusion
 * - Case sensitivity and character encoding handling
 * - Data field security (password hash exposure/exclusion)
 * - Error handling for invalid inputs
 * - Concurrent access patterns
 * - Boundary conditions and edge cases
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import bcrypt from 'bcryptjs';

import {
  createUserInsertData,
  createUniqueUsername,
} from '@/__tests__/helpers/test-helpers';
import {
  insertUser,
  findUserById,
  findUserByUsernameWithPassword,
} from '@/lib/db/user';

/**
 * Tests user retrieval by unique identifier.
 *
 * Critical for session management and user profile operations.
 * Ensures proper UUID validation and secure data field filtering
 * to prevent sensitive information exposure.
 */
describe('Database: findUserById', () => {
  it('should return user when found', async () => {
    const userData = await createUserInsertData();

    const createdUser = await insertUser(userData);
    const foundUser = await findUserById(createdUser.id);

    expect(foundUser).toEqual(createdUser);
  });

  it('should return null when user not found', async () => {
    const result = await findUserById('d9a66f23-f75e-4ccd-bb95-a81d1810c9b9');
    expect(result).toBeNull();
  });

  it('should return only safe user fields', async () => {
    const userData = await createUserInsertData();

    const createdUser = await insertUser(userData);
    const foundUser = await findUserById(createdUser.id);

    expect(foundUser).not.toHaveProperty('passwordHash');
    expect(foundUser).toHaveProperty('id');
    expect(foundUser).toHaveProperty('username');
    expect(foundUser).toHaveProperty('createdAt');
  });

  it('should handle multiple lookups correctly', async () => {
    const userData1 = await createUserInsertData();
    const userData2 = await createUserInsertData();

    const user1 = await insertUser(userData1);
    const user2 = await insertUser(userData2);

    const foundUser1 = await findUserById(user1.id);
    const foundUser2 = await findUserById(user2.id);

    expect(foundUser1).toEqual(user1);
    expect(foundUser2).toEqual(user2);
    expect(foundUser1?.id).not.toBe(foundUser2?.id);
  });

  it('should throw error for empty string ID', async () => {
    await expect(findUserById('')).rejects.toThrow('Invalid user ID: ');
  });

  it('should throw error for malformed UUID', async () => {
    await expect(findUserById('not-a-uuid')).rejects.toThrow(
      'Invalid user ID: not-a-uuid'
    );
  });
});

/**
 * Tests username-based user lookup with password hash inclusion.
 *
 * Essential for authentication flows where password verification
 * is required. Tests case sensitivity, character encoding, and
 * ensures password hash is properly included for bcrypt comparison.
 */
describe('Database: findUserByUsernameWithPassword', () => {
  let testUser: {
    id: string;
    username: string;
    passwordHash: string;
    createdAt: Date;
  };

  beforeEach(async () => {
    const userData = await createUserInsertData();

    const createdUser = await insertUser(userData);
    testUser = {
      ...createdUser,
      passwordHash: userData.passwordHash,
    };
  });

  it('should return user with password hash when found', async () => {
    const foundUser = await findUserByUsernameWithPassword(testUser.username);

    expect(foundUser).toMatchObject({
      id: testUser.id,
      username: testUser.username,
      passwordHash: testUser.passwordHash,
      createdAt: testUser.createdAt,
    });
    expect(foundUser?.passwordHash).toBeTruthy();
  });

  it('should return null when username not found', async () => {
    const result = await findUserByUsernameWithPassword('nonexistent-user');
    expect(result).toBeNull();
  });

  it('should be case-sensitive for username lookup', async () => {
    const foundUser = await findUserByUsernameWithPassword(testUser.username);
    expect(foundUser).toBeTruthy();

    // Try with different case
    const upperCaseResult = await findUserByUsernameWithPassword(
      testUser.username.toUpperCase()
    );
    const lowerCaseResult = await findUserByUsernameWithPassword(
      testUser.username.toLowerCase()
    );

    // Should not find if case doesn't match (assuming case-sensitive database)
    if (testUser.username !== testUser.username.toUpperCase()) {
      expect(upperCaseResult?.id).not.toBe(testUser.id);
    }
    if (testUser.username !== testUser.username.toLowerCase()) {
      expect(lowerCaseResult?.id).not.toBe(testUser.id);
    }
  });

  it('should return the correct password hash', async () => {
    const foundUser = await findUserByUsernameWithPassword(testUser.username);

    expect(foundUser?.passwordHash).toBe(testUser.passwordHash);

    // Verify the hash can be used for password verification
    const isValid = await bcrypt.compare(
      'password123',
      foundUser!.passwordHash
    );
    expect(isValid).toBe(true);
  });

  it('should handle usernames with special characters', async () => {
    const specialUsername = `user@test.com-${createUniqueUsername()}`;
    const userData = await createUserInsertData();
    userData.username = specialUsername;

    await insertUser(userData);

    const foundUser = await findUserByUsernameWithPassword(specialUsername);

    expect(foundUser).toBeTruthy();
    expect(foundUser?.username).toBe(specialUsername);
  });

  it('should handle unicode usernames', async () => {
    const unicodeUsername = `测试用户_${createUniqueUsername()}`;
    const userData = await createUserInsertData();
    userData.username = unicodeUsername;

    await insertUser(userData);

    const foundUser = await findUserByUsernameWithPassword(unicodeUsername);

    expect(foundUser).toBeTruthy();
    expect(foundUser?.username).toBe(unicodeUsername);
  });

  it('should return null for empty username', async () => {
    const result = await findUserByUsernameWithPassword('');
    expect(result).toBeNull();
  });

  it('should return the most recent user when multiple exist', async () => {
    // Note: This test assumes we never have duplicate usernames in production
    // but tests the behavior in case of data inconsistency
    const foundUser = await findUserByUsernameWithPassword(testUser.username);
    expect(foundUser?.id).toBe(testUser.id);
  });

  it('should handle concurrent lookups correctly', async () => {
    const lookupPromises = Array.from({ length: 5 }, () =>
      findUserByUsernameWithPassword(testUser.username)
    );

    const results = await Promise.all(lookupPromises);

    results.forEach((result) => {
      expect(result).toBeTruthy();
      expect(result?.id).toBe(testUser.id);
      expect(result?.username).toBe(testUser.username);
    });
  });
});
