/**
 * Database username existence validation test suite.
 *
 * Tests the usernameExists function which is critical for preventing
 * duplicate user registrations and supporting secure login flows.
 * Covers edge cases including case sensitivity, special characters,
 * unicode support, and concurrent access patterns.
 *
 * Testing strategy:
 * - Existence detection after user creation
 * - Non-existence verification for random usernames
 * - Case sensitivity validation
 * - Special character and unicode handling
 * - Boundary conditions (empty, long usernames)
 * - Concurrent access patterns
 * - Multiple user scenarios
 */

import { describe, expect, it } from '@jest/globals';

import {
  createUserInsertData,
  createUniqueUsername,
} from '@/__tests__/helpers/test-helpers';
import { insertUser, usernameExists } from '@/lib/db/user';

/**
 * Tests username existence checking functionality.
 *
 * Critical for user registration flow to prevent duplicate usernames
 * and for login validation. Tests various edge cases to ensure
 * reliable username uniqueness enforcement across different
 * character sets and usage patterns.
 */
describe('Database: usernameExists', () => {
  it('should return true when username exists', async () => {
    const userData = await createUserInsertData();
    const username = userData.username;

    await insertUser(userData);

    const exists = await usernameExists(username);
    expect(exists).toBe(true);
  });

  it('should return false when username does not exist', async () => {
    const exists = await usernameExists('nonexistent-user-xyz');
    expect(exists).toBe(false);
  });

  it('should be case-sensitive', async () => {
    const userData = await createUserInsertData();
    const username = userData.username;

    await insertUser(userData);

    const existsOriginal = await usernameExists(username);
    expect(existsOriginal).toBe(true);

    // Check with different cases
    if (username !== username.toUpperCase()) {
      const existsUpper = await usernameExists(username.toUpperCase());
      // Should not exist if case is different
      expect(existsUpper).toBe(false);
    }

    if (username !== username.toLowerCase()) {
      const existsLower = await usernameExists(username.toLowerCase());
      // Should not exist if case is different
      expect(existsLower).toBe(false);
    }
  });

  it('should handle special characters in username', async () => {
    const specialUsername = `user@test.com-${createUniqueUsername()}`;
    const userData = await createUserInsertData();
    userData.username = specialUsername;

    await insertUser(userData);

    const exists = await usernameExists(specialUsername);
    expect(exists).toBe(true);
  });

  it('should handle unicode characters in username', async () => {
    const unicodeUsername = `测试用户_${createUniqueUsername()}`;
    const userData = await createUserInsertData();
    userData.username = unicodeUsername;

    await insertUser(userData);

    const exists = await usernameExists(unicodeUsername);
    expect(exists).toBe(true);
  });

  it('should return false for empty string', async () => {
    const exists = await usernameExists('');
    expect(exists).toBe(false);
  });

  it('should return false for very long non-existent username', async () => {
    const longUsername = 'a'.repeat(255);
    const exists = await usernameExists(longUsername);
    expect(exists).toBe(false);
  });

  it('should correctly identify multiple existing users', async () => {
    const userData1 = await createUserInsertData();
    const userData2 = await createUserInsertData();
    const username3 = createUniqueUsername();

    await insertUser(userData1);
    await insertUser(userData2);

    const username1 = userData1.username;
    const username2 = userData2.username;

    expect(await usernameExists(username1)).toBe(true);
    expect(await usernameExists(username2)).toBe(true);
    expect(await usernameExists(username3)).toBe(false);
  });

  it('should handle concurrent checks correctly', async () => {
    const userData = await createUserInsertData();
    const username = userData.username;

    await insertUser(userData);

    // Perform multiple concurrent checks
    const checkPromises = Array.from({ length: 10 }, () =>
      usernameExists(username)
    );

    const results = await Promise.all(checkPromises);

    results.forEach((exists) => {
      expect(exists).toBe(true);
    });
  });

  it('should correctly report non-existence for similar usernames', async () => {
    const userData = await createUserInsertData();
    const baseUsername = userData.username;

    await insertUser(userData);

    // Check similar but different usernames
    expect(await usernameExists(baseUsername)).toBe(true);
    expect(await usernameExists(baseUsername + '1')).toBe(false);
    expect(await usernameExists('1' + baseUsername)).toBe(false);
    expect(await usernameExists(baseUsername.slice(0, -1))).toBe(false);
  });

  it('should work correctly after multiple inserts', async () => {
    const userDataList = await Promise.all(
      Array.from({ length: 5 }, () => createUserInsertData())
    );
    const usernames = userDataList.map((data) => data.username);

    // Initially none should exist
    for (const username of usernames) {
      expect(await usernameExists(username)).toBe(false);
    }

    // Insert all users
    for (const userData of userDataList) {
      await insertUser(userData);
    }

    // Now all should exist
    for (const username of usernames) {
      expect(await usernameExists(username)).toBe(true);
    }
  });
});
