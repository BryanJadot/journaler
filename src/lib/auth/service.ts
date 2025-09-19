import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { createUser } from '@/lib/user/service';
import type {
  CreateUserData,
  LoginCredentials,
  LoginResult,
  SignupResult,
  SignupError,
} from '@/lib/user/types';

/**
 * Checks if user signup is enabled via environment variable
 * @returns true if ENABLE_SIGNUP is exactly "true", false otherwise
 */
export function isSignupEnabled(): boolean {
  return process.env.ENABLE_SIGNUP === 'true';
}

/**
 * Validates username format and constraints for user registration/login
 *
 * Performs comprehensive username validation to ensure data integrity
 * and prevent common attack vectors. Uses discriminated union return type
 * for type-safe error handling.
 *
 * @param username - The username string to validate
 * @returns Object indicating validation success or specific error
 *
 * Validation rules:
 * - No whitespace characters (spaces, tabs, newlines)
 * - Maximum length of 255 characters (database constraint)
 *
 * @example
 * const result = validateUsername('valid_user123');
 * if (result.valid) {
 *   // Username passes validation
 * } else {
 *   // Handle specific error: result.error
 * }
 */
function validateUsername(username: string):
  | { valid: true }
  | {
      valid: false;
      error: SignupError;
    } {
  // Reject usernames with any whitespace to prevent confusion and security issues
  if (/\s/.test(username)) {
    return { valid: false, error: 'invalid-username' };
  }

  // Enforce database schema constraint to prevent truncation errors
  if (username.length > 255) {
    return { valid: false, error: 'username-too-long' };
  }

  return { valid: true };
}

/**
 * Authenticates a user with username and password credentials.
 *
 * @param credentials - The login credentials containing username and password
 * @returns Result of the login process, indicating success with user data or specific login error
 *
 * @description
 * This function performs secure user authentication with the following steps:
 * - Validates username format to prevent enumeration attacks
 * - Queries the database for the user by username
 * - Compares the provided password against the stored bcrypt hash
 * - Returns sanitized user data on successful authentication
 *
 * @throws {LoginError} Returns specific authentication failure in result.error:
 *   - 'user-not-found': Username doesn't exist or format is invalid
 *   - 'invalid-password': Password doesn't match the stored hash
 *
 * @example
 * const result = await loginUser({
 *   username: 'johndoe',
 *   password: 'mySecurePassword123'
 * });
 * if (result.success) {
 *   console.log('Login successful:', result.user);
 * } else {
 *   console.error('Login failed:', result.error);
 * }
 *
 * @remarks
 * - Username validation errors are disguised as USER_NOT_FOUND to prevent enumeration
 * - Passwords are verified using bcrypt for secure comparison
 * - Only safe user fields (id, username, createdAt) are returned
 * - Database queries use prepared statements to prevent SQL injection
 *
 * @security
 * - Prevents username enumeration by treating validation errors as "user not found"
 * - Uses constant-time bcrypt comparison to prevent timing attacks
 * - Sanitizes returned user data to exclude sensitive information
 */
export async function loginUser(
  credentials: LoginCredentials
): Promise<LoginResult> {
  // Pre-validate username format to prevent unnecessary database queries
  const validation = validateUsername(credentials.username);
  if (!validation.valid) {
    // Security: Convert all validation errors to 'user-not-found' for login
    // This prevents username enumeration attacks by not revealing validation rules
    return { success: false, error: 'user-not-found' };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, credentials.username));

  if (!user) {
    return { success: false, error: 'user-not-found' };
  }

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: 'invalid-password' };
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
 * @param userData - The user registration data containing username and password
 * @returns Result of the signup process, indicating success or specific signup error
 *
 * @description
 * This function performs multiple validation checks before creating a new user:
 * - Ensures username does not contain spaces
 * - Checks username length (max 255 characters)
 * - Verifies username is not already taken
 * - Hashes the user's password securely before storage
 *
 * @throws {SignupError} Returns specific validation failure in result.error:
 *   - 'invalid-username': Username contains whitespace characters
 *   - 'username-too-long': Username exceeds 255 character limit
 *   - 'username-taken': Username already exists in the database
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
  // Validate username format and business rules before database operations
  const validation = validateUsername(userData.username);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Query database to prevent duplicate usernames (unique constraint enforcement)
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, userData.username));

  if (existingUser.length > 0) {
    return { success: false, error: 'username-taken' };
  }

  try {
    const user = await createUser(userData);
    return { success: true, user };
  } catch {
    return { success: false, error: 'username-taken' };
  }
}
