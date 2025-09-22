import bcrypt from 'bcryptjs';

import { insertUser, findUserById } from '@/lib/db/user';
import type { CreateUserData, User } from '@/lib/user/types';

/**
 * Creates a new user in the database with a securely hashed password.
 *
 * Business logic layer for user creation that orchestrates password security
 * and data persistence. Uses production-grade bcrypt hashing with 12 salt rounds
 * to ensure password security meets industry standards. Abstracts database
 * implementation details while maintaining security principles.
 *
 * @param userData The data required to create a new user
 * @returns The newly created user with sensitive information omitted
 * @throws Error if database insertion fails or password hashing encounters an issue
 *
 * @example
 * const newUser = await createUser({ username: 'johndoe', password: 'securepass123' });
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  // Generate a secure password hash using bcrypt
  const hashedPassword = await bcrypt.hash(userData.password, 12);

  // Insert user into database and return the created user object
  return insertUser({
    username: userData.username,
    passwordHash: hashedPassword,
  });
}

/**
 * Retrieves a user from the database by their unique identifier.
 *
 * Service layer wrapper for user retrieval that provides a clean abstraction
 * over database operations. Ensures consistent error handling and data
 * formatting across the application while maintaining security through
 * the underlying database layer's field filtering.
 *
 * @param id The unique identifier of the user
 * @returns The user object if found, null otherwise
 *
 * @example
 * const user = await getUserById('user123');
 * if (user) {
 *   // User found, proceed with operations
 * }
 */
export async function getUserById(id: string): Promise<User | null> {
  return findUserById(id);
}
