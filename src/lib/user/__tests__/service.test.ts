import { describe, it, expect } from '@jest/globals';
import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { users } from '../../db/schema';
import { createUser, getUserById, authenticateUser } from '../service';
import { AuthError } from '../types';

const randomUsername = () =>
  `testuser-${Math.random().toString(36).substring(7)}`;

describe('User Service', () => {
  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const userData = {
        username: randomUsername(),
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
        username: randomUsername(),
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

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const userData = {
        username: randomUsername(),
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

  describe('authenticateUser', () => {
    it('should return user on successful authentication', async () => {
      const userData = {
        username: randomUsername(),
        password: 'password123',
      };

      await createUser(userData);

      const result = await authenticateUser({
        username: userData.username,
        password: 'password123',
      });

      expect(result).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          username: userData.username,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should return USER_NOT_FOUND for non-existent user', async () => {
      const result = await authenticateUser({
        username: randomUsername(),
        password: 'password123',
      });

      expect(result).toEqual({
        success: false,
        error: AuthError.USER_NOT_FOUND,
      });
    });

    it('should return INVALID_PASSWORD for wrong password', async () => {
      const userData = {
        username: randomUsername(),
        password: 'password123',
      };

      await createUser(userData);

      const result = await authenticateUser({
        username: userData.username,
        password: 'wrongpassword',
      });

      expect(result).toEqual({
        success: false,
        error: AuthError.INVALID_PASSWORD,
      });
    });
  });
});
