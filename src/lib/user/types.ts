/**
 * Represents a user's core information in the system
 * Contains non-sensitive details about a registered user
 *
 * @interface User
 * @property {string} id - Unique identifier for the user, typically a UUID
 * @property {string} username - User's chosen username for identification
 * @property {Date} createdAt - Timestamp of user account creation
 */
export interface User {
  id: string;
  username: string;
  createdAt: Date;
}

/**
 * Represents the data required to create a new user account
 * Includes authentication credentials for initial registration
 *
 * @interface CreateUserData
 * @property {string} username - Proposed username for the new account
 * @property {string} password - User's chosen password (will be hashed before storage)
 */
export interface CreateUserData {
  username: string;
  password: string;
}

/**
 * Represents credentials used for user login authentication
 * Similar to CreateUserData but semantically distinct for login processes
 *
 * @interface LoginCredentials
 * @property {string} username - User's registered username
 * @property {string} password - User's password for authentication
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Enumeration of possible login failure scenarios
 * Provides granular error categorization for authentication attempts
 *
 * @enum {string} LoginError
 * @property {string} USER_NOT_FOUND - Indicates no user exists with the given username
 * @property {string} INVALID_PASSWORD - Indicates incorrect password for existing user
 */
export enum LoginError {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
}

/**
 * Enumeration of possible signup failure scenarios
 * Provides specific validation errors during user registration
 *
 * @enum {string} SignupError
 * @property {string} USERNAME_TAKEN - Indicates username is already registered
 * @property {string} INVALID_USERNAME - Indicates username does not meet format requirements
 * @property {string} USERNAME_TOO_LONG - Indicates username exceeds maximum allowed length
 */
export enum SignupError {
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  INVALID_USERNAME = 'INVALID_USERNAME',
  USERNAME_TOO_LONG = 'USERNAME_TOO_LONG',
}

/**
 * Represents the result of a login authentication attempt
 * Uses a discriminated union type to handle both successful and failed scenarios
 *
 * @typedef {LoginResult}
 * @property {boolean} success - Indicates whether login was successful
 * @property {User} [user] - User object if login succeeded
 * @property {LoginError} [error] - Specific error if login failed
 */
export type LoginResult =
  | { success: true; user: User }
  | { success: false; error: LoginError };

/**
 * Represents the result of a user signup attempt
 * Uses a discriminated union type to handle both successful and failed scenarios
 *
 * @typedef {SignupResult}
 * @property {boolean} success - Indicates whether signup was successful
 * @property {User} [user] - User object if signup succeeded
 * @property {SignupError} [error] - Specific error if signup failed
 */
export type SignupResult =
  | { success: true; user: User }
  | { success: false; error: SignupError };
