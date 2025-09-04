import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '../db';
import { users } from '../db/schema';
import { createUser } from '../user/service';
import type {
  CreateUserData,
  LoginCredentials,
  LoginResult,
  SignupResult,
} from '../user/types';
import { LoginError, SignupError } from '../user/types';

/**
 * Validates username format and constraints
 * @param username - The username to validate
 * @returns Object with validation result and error type if invalid
 */
function validateUsername(
  username: string
):
  | { valid: true }
  | {
      valid: false;
      error: SignupError.INVALID_USERNAME | SignupError.USERNAME_TOO_LONG;
    } {
  // Check for whitespace characters
  if (/\s/.test(username)) {
    return { valid: false, error: SignupError.INVALID_USERNAME };
  }

  // Check length constraint (database limit)
  if (username.length > 255) {
    return { valid: false, error: SignupError.USERNAME_TOO_LONG };
  }

  return { valid: true };
}

export async function loginUser(
  credentials: LoginCredentials
): Promise<LoginResult> {
  // Validate username format first
  const validation = validateUsername(credentials.username);
  if (!validation.valid) {
    // For login, we treat all validation errors as USER_NOT_FOUND
    // This prevents username enumeration attacks
    return { success: false, error: LoginError.USER_NOT_FOUND };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, credentials.username));

  if (!user) {
    return { success: false, error: LoginError.USER_NOT_FOUND };
  }

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: LoginError.INVALID_PASSWORD };
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    },
  };
}

/**
 * Registers a new user in the system with comprehensive username validation.
 *
 * @param {CreateUserData} userData - The user registration data containing username and password
 * @returns {Promise<SignupResult>} Result of the signup process, indicating success or specific signup error
 *
 * @description
 * This function performs multiple validation checks before creating a new user:
 * - Ensures username does not contain spaces
 * - Checks username length (max 255 characters)
 * - Verifies username is not already taken
 * - Hashes the user's password securely before storage
 *
 * @throws {SignupError} Indicates specific validation or creation failure
 *   - INVALID_USERNAME: Username contains spaces
 *   - USERNAME_TOO_LONG: Username exceeds 255 characters
 *   - USERNAME_TAKEN: Username already exists in the system
 *
 * @example
 * const result = await signupUser({
 *   username: 'newuser123',
 *   password: 'securePassword123'
 * });
 * if (result.success) {
 *   console.log('User registered successfully');
 * } else {
 *   console.error('Signup failed:', result.error);
 * }
 *
 * @remarks
 * - Usernames cannot contain spaces or be empty
 * - Maximum username length is 255 characters
 * - Existing usernames will be rejected
 * - Password is securely hashed before storage
 */
export async function signupUser(
  userData: CreateUserData
): Promise<SignupResult> {
  // Validate username format and constraints
  const validation = validateUsername(userData.username);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Check if username already exists
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, userData.username));

  if (existingUser.length > 0) {
    return { success: false, error: SignupError.USERNAME_TAKEN };
  }

  try {
    const user = await createUser(userData);
    return { success: true, user };
  } catch {
    return { success: false, error: SignupError.USERNAME_TAKEN };
  }
}
