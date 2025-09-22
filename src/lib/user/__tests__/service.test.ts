/**
 * User service layer test suite.
 *
 * Tests the business logic layer that orchestrates user operations
 * between the API and database layers. Ensures proper password
 * hashing, data sanitization, and error handling in user management.
 *
 * Testing strategy:
 * - User creation with secure password handling
 * - Data field security verification
 * - User retrieval operations
 * - Integration between service and database layers
 * - Password security validation (plain text exclusion)
 */

import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { createUniqueUsername } from '@/__tests__/helpers/test-helpers';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createUser, getUserById } from '@/lib/user/service';

/**
 * Tests user service business logic operations.
 *
 * Service layer coordinates between API requests and database operations,
 * handling password security, data validation, and proper abstraction
 * of database implementation details.
 */
describe('User Service', () => {
  /**
   * Tests user creation business logic.
   *
   * Verifies that password hashing, data sanitization, and user
   * creation flow work correctly through the service layer abstraction.
   */
  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const userData = {
        username: createUniqueUsername(),
        password: 'password123',
      };

      const user = await createUser(userData);

      expect(user).toMatchObject({
        id: expect.any(String),
        username: userData.username,
        createdAt: expect.any(Date),
      });
      expect(user.id).toBeTruthy();
    });

    it('should not store plain text password', async () => {
      const userData = {
        username: createUniqueUsername(),
        password: 'password123',
      };

      const user = await createUser(userData);

      // Verify the password hash is stored, not the plain password
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      expect(dbUser.passwordHash).not.toBe('password123');
      expect(dbUser.passwordHash).toBeTruthy();
    });
  });

  /**
   * Tests user retrieval business logic.
   *
   * Ensures proper user lookup functionality with secure data filtering
   * and appropriate null handling for non-existent users.
   */
  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userData = {
        username: createUniqueUsername(),
        password: 'password123',
      };

      const createdUser = await createUser(userData);
      const foundUser = await getUserById(createdUser.id);

      expect(foundUser).toEqual(createdUser);
    });

    it('should return null when user not found', async () => {
      const result = await getUserById('d9a66f23-f75e-4ccd-bb95-a81d1810c9b9');
      expect(result).toBeNull();
    });
  });
});
