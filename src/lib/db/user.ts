import { eq } from 'drizzle-orm';
import { validate as isValidUUID } from 'uuid';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import type { User } from '@/lib/user/types';

/**
 * Database operations for user management.
 *
 * Low-level database access layer that handles direct user table operations.
 * Implements secure data retrieval patterns, proper field filtering, and
 * input validation to prevent security vulnerabilities and data exposure.
 *
 * Key security principles:
 * - Password hashes are only returned when explicitly needed for authentication
 * - UUID validation prevents malformed ID queries
 * - Field selection limits data exposure
 * - Case-sensitive username matching maintains data integrity
 */

/**
 * Inserts a new user into the database with secure data handling.
 *
 * Creates new user records while maintaining data security by filtering
 * sensitive fields from the returned data. The password hash is stored
 * in the database but excluded from the return value to prevent
 * accidental exposure in logs or API responses.
 *
 * @param userData User data containing username and pre-hashed password
 * @returns The created user without sensitive information (password hash excluded)
 */
export async function insertUser(userData: {
  username: string;
  passwordHash: string;
}): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      username: userData.username,
      passwordHash: userData.passwordHash,
    })
    .returning({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    });

  return user;
}

/**
 * Finds a user by their unique identifier with strict validation.
 *
 * Retrieves user data for profile operations and session management.
 * Includes UUID validation to prevent malformed queries and potential
 * security issues. Returns only safe user fields, excluding sensitive
 * information like password hashes.
 *
 * @param id The user ID to search for (must be valid UUID)
 * @returns The user if found, null otherwise
 * @throws Error when id is empty or not a valid UUID format
 */
export async function findUserById(id: string): Promise<User | null> {
  // Throw error for empty or invalid UUID strings
  if (!id || !isValidUUID(id)) {
    throw new Error(`Invalid user ID: ${id}`);
  }

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id));

  return user || null;
}

/**
 * Finds a user by username with password hash for authentication.
 *
 * Special retrieval function that includes the password hash field,
 * used exclusively for login authentication where password verification
 * is required. The password hash inclusion allows bcrypt comparison
 * without exposing the hash in general user operations.
 *
 * @param username The username to search for (case-sensitive)
 * @returns The user with password hash if found, null otherwise
 */
export async function findUserByUsernameWithPassword(
  username: string
): Promise<{
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
} | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  return user || null;
}

/**
 * Checks if a username already exists in the database.
 *
 * Essential for user registration validation to enforce username uniqueness.
 * Uses case-sensitive matching to maintain data integrity and prevent
 * confusion between similar usernames. Performs minimal data retrieval
 * for efficiency in high-frequency validation scenarios.
 *
 * @param username The username to check for existence
 * @returns True if the username exists, false otherwise
 */
export async function usernameExists(username: string): Promise<boolean> {
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));

  return result.length > 0;
}
