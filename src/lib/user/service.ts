import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import type { CreateUserData, User } from '@/lib/user/types';

/**
 * Creates a new user in the database with a securely hashed password
 *
 * @param userData - The data required to create a new user
 * @returns The newly created user with sensitive information omitted
 *
 * @throws {Error} If database insertion fails or password hashing encounters an issue
 *
 * @description
 * - Hashes the password using bcrypt with 12 rounds of salt
 * - Stores the username and password hash in the database
 * - Returns the user object without the password hash
 *
 * @example
 * const newUser = await createUser({ username: 'johndoe', password: 'securepass123' });
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  // Generate a secure password hash using bcrypt
  const hashedPassword = await bcrypt.hash(userData.password, 12);
  const database = db;

  // Insert user into database and return the created user object
  const [user] = await database
    .insert(users)
    .values({
      username: userData.username,
      passwordHash: hashedPassword,
    })
    .returning({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    });

  return user;
}

/**
 * Retrieves a user from the database by their unique identifier
 *
 * @param id - The unique identifier of the user
 * @returns The user object if found, null otherwise
 *
 * @description
 * - Queries the users table using the provided ID
 * - Returns only non-sensitive user information
 * - Returns null if no user is found with the given ID
 *
 * @example
 * const user = await getUserById('user123');
 * if (user) {
 *   // User found, proceed with operations
 * }
 */
export async function getUserById(id: string): Promise<User | null> {
  // Select specific user fields to avoid exposing sensitive information
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
