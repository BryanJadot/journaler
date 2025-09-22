/**
 * Database user insertion operations test suite.
 *
 * Tests the foundational user creation functionality that underpins
 * the entire user registration system. Verifies data integrity,
 * security measures, and proper handling of various username formats.
 *
 * Testing strategy:
 * - Basic user insertion with password hashing
 * - Data field security (password hash exclusion from returned data)
 * - Unique ID generation and collision prevention
 * - Timestamp accuracy for audit trails
 * - Character encoding support (special chars, unicode)
 * - Boundary testing (maximum username length)
 * - Password hash uniqueness verification
 * - Database constraint validation
 */

import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';

import {
  createUserInsertData,
  createUniqueUsername,
  createUsernameOfLength,
} from '@/__tests__/helpers/test-helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { insertUser } from '@/lib/db/user';

/**
 * Tests user creation in the database layer.
 *
 * Fundamental operation for user registration that must handle
 * data security, unique constraints, and proper field mapping.
 * Critical for ensuring user data integrity and system security.
 */
describe('Database: insertUser', () => {
  it('should insert a user with hashed password', async () => {
    const userData = await createUserInsertData();

    const user = await insertUser(userData);

    expect(user).toMatchObject({
      id: expect.any(String),
      username: userData.username,
      createdAt: expect.any(Date),
    });
    expect(user.id).toBeTruthy();

    // Verify the user was actually inserted in the database
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    expect(dbUser).toBeTruthy();
    expect(dbUser.username).toBe(userData.username);
    expect(dbUser.passwordHash).toBe(userData.passwordHash);
  });

  it('should return only safe user fields', async () => {
    const userData = await createUserInsertData();

    const user = await insertUser(userData);

    // Ensure password hash is not returned
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('createdAt');
  });

  it('should generate unique IDs for each user', async () => {
    const userData1 = await createUserInsertData();
    const userData2 = await createUserInsertData();

    const user1 = await insertUser(userData1);
    const user2 = await insertUser(userData2);

    expect(user1.id).toBeTruthy();
    expect(user2.id).toBeTruthy();
    expect(user1.id).not.toBe(user2.id);
  });

  it('should set createdAt timestamp', async () => {
    const userData = await createUserInsertData();
    const beforeInsert = new Date();

    const user = await insertUser(userData);

    const afterInsert = new Date();

    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(
      beforeInsert.getTime() - 5000
    );
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(
      afterInsert.getTime() + 5000
    );
  });

  it('should handle usernames with special characters', async () => {
    const specialUsername = `user@test.com-${createUniqueUsername()}`;
    const userData = await createUserInsertData();
    userData.username = specialUsername;

    const user = await insertUser(userData);

    expect(user.username).toBe(specialUsername);

    // Verify in database
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

    expect(dbUser.username).toBe(specialUsername);
  });

  it('should handle unicode characters in username', async () => {
    const unicodeUsername = `测试用户_${createUniqueUsername()}`;
    const userData = await createUserInsertData();
    userData.username = unicodeUsername;

    const user = await insertUser(userData);

    expect(user.username).toBe(unicodeUsername);
  });

  it('should handle very long usernames (up to 255 chars)', async () => {
    const longUsername = createUsernameOfLength(255);
    const userData = await createUserInsertData();
    userData.username = longUsername;

    const user = await insertUser(userData);

    expect(user.username).toBe(longUsername);
    expect(user.username.length).toBe(255);
  });

  it('should store different password hashes for different users', async () => {
    const password = 'samePassword123';
    const userData1 = await createUserInsertData(password);
    const userData2 = await createUserInsertData(password);

    const user1 = await insertUser(userData1);
    const user2 = await insertUser(userData2);

    // Verify the hashes are stored correctly
    const [dbUser1] = await db
      .select()
      .from(users)
      .where(eq(users.id, user1.id));

    const [dbUser2] = await db
      .select()
      .from(users)
      .where(eq(users.id, user2.id));

    // Same password but different hashes (due to salt)
    expect(dbUser1.passwordHash).not.toBe(dbUser2.passwordHash);
    expect(dbUser1.passwordHash).toBe(userData1.passwordHash);
    expect(dbUser2.passwordHash).toBe(userData2.passwordHash);
  });
});
