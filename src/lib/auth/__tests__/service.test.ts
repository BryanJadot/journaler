/**
 * Authentication service test suite.
 *
 * Tests core authentication functionality including signup configuration,
 * user login flows, and user registration flows. Uses comprehensive mocking
 * to isolate authentication logic from database and external dependencies.
 *
 * Testing strategy:
 * - Environment variable configuration testing
 * - Success and failure paths for login/signup
 * - Input validation and security edge cases
 * - Error handling and user enumeration prevention
 */

import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';

import { isSignupEnabled, loginUser, signupUser } from '@/lib/auth/service';
import { findUserByUsernameWithPassword, usernameExists } from '@/lib/db/user';
import { createUser } from '@/lib/user/service';

// Mock the dependencies
jest.mock('@/lib/db/user', () => ({
  findUserByUsernameWithPassword: jest.fn(),
  usernameExists: jest.fn(),
}));

jest.mock('@/lib/user/service', () => ({
  createUser: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

const mockFindUserByUsernameWithPassword =
  findUserByUsernameWithPassword as jest.MockedFunction<
    typeof findUserByUsernameWithPassword
  >;
const mockUsernameExists = usernameExists as jest.MockedFunction<
  typeof usernameExists
>;
const mockCreateUser = createUser as jest.MockedFunction<typeof createUser>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<
  (data: string, encrypted: string) => Promise<boolean>
>;

/**
 * Tests signup feature toggle functionality.
 *
 * Verifies that signup can be enabled/disabled via environment variables
 * with exact string matching for security. Tests various edge cases to ensure
 * only the exact value "true" enables signup, preventing accidental enablement.
 */
describe('isSignupEnabled', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return true when ENABLE_SIGNUP is exactly "true"', () => {
    process.env.ENABLE_SIGNUP = 'true';
    expect(isSignupEnabled()).toBe(true);
  });

  it('should return false for all other values', () => {
    const testValues = [
      'false',
      'TRUE',
      'True',
      '1',
      'yes',
      'enabled',
      '',
      undefined,
    ];

    testValues.forEach((value) => {
      if (value === undefined) {
        delete process.env.ENABLE_SIGNUP;
      } else {
        process.env.ENABLE_SIGNUP = value;
      }
      expect(isSignupEnabled()).toBe(false);
    });
  });
});

/**
 * Tests user authentication and login flows.
 *
 * Covers complete login scenarios including successful authentication,
 * user-not-found cases, invalid password handling, and username validation.
 * Ensures proper security measures like username enumeration prevention
 * and secure password comparison.
 */
describe('loginUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user on successful authentication', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      createdAt: new Date(),
    };

    mockFindUserByUsernameWithPassword.mockResolvedValue(mockUser);
    mockBcryptCompare.mockResolvedValue(true);

    const result = await loginUser({
      username: 'testuser',
      password: 'password123',
    });

    expect(result).toEqual({
      success: true,
      user: {
        id: 'user-123',
        username: 'testuser',
        createdAt: mockUser.createdAt,
      },
    });

    expect(mockFindUserByUsernameWithPassword).toHaveBeenCalledWith('testuser');
    expect(mockBcryptCompare).toHaveBeenCalledWith(
      'password123',
      'hashedpassword'
    );
  });

  it('should return user-not-found for non-existent user', async () => {
    mockFindUserByUsernameWithPassword.mockResolvedValue(null);

    const result = await loginUser({
      username: 'nonexistent',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'user-not-found',
    });

    expect(mockFindUserByUsernameWithPassword).toHaveBeenCalledWith(
      'nonexistent'
    );
    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });

  it('should return invalid-password for wrong password', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      createdAt: new Date(),
    };

    mockFindUserByUsernameWithPassword.mockResolvedValue(mockUser);
    mockBcryptCompare.mockResolvedValue(false);

    const result = await loginUser({
      username: 'testuser',
      password: 'wrongpassword',
    });

    expect(result).toEqual({
      success: false,
      error: 'invalid-password',
    });

    expect(mockBcryptCompare).toHaveBeenCalledWith(
      'wrongpassword',
      'hashedpassword'
    );
  });

  it('should return user-not-found for username with spaces', async () => {
    const result = await loginUser({
      username: 'user with spaces',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'user-not-found',
    });

    // Should not even call the database function due to validation
    expect(mockFindUserByUsernameWithPassword).not.toHaveBeenCalled();
  });

  it('should return user-not-found for username over 255 characters', async () => {
    const result = await loginUser({
      username: 'a'.repeat(256),
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'user-not-found',
    });

    // Should not even call the database function due to validation
    expect(mockFindUserByUsernameWithPassword).not.toHaveBeenCalled();
  });
});

/**
 * Tests user registration and signup flows.
 *
 * Verifies comprehensive user creation including username validation,
 * duplicate prevention, and error handling. Tests edge cases like
 * invalid usernames, length constraints, and database error scenarios
 * to ensure robust user registration.
 */
describe('signupUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create user with valid credentials', async () => {
    const mockUser = {
      id: 'user-123',
      username: 'testuser',
      createdAt: new Date(),
    };

    mockUsernameExists.mockResolvedValue(false);
    mockCreateUser.mockResolvedValue(mockUser);

    const result = await signupUser({
      username: 'testuser',
      password: 'password123',
    });

    expect(result).toEqual({
      success: true,
      user: mockUser,
    });

    expect(mockUsernameExists).toHaveBeenCalledWith('testuser');
    expect(mockCreateUser).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123',
    });
  });

  it('should reject username with spaces', async () => {
    const result = await signupUser({
      username: 'user with spaces',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'invalid-username',
    });

    // Should not call database functions due to validation
    expect(mockUsernameExists).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('should reject username that is too long', async () => {
    const result = await signupUser({
      username: 'a'.repeat(256),
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'username-too-long',
    });

    // Should not call database functions due to validation
    expect(mockUsernameExists).not.toHaveBeenCalled();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('should reject duplicate username', async () => {
    mockUsernameExists.mockResolvedValue(true);

    const result = await signupUser({
      username: 'existinguser',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'username-taken',
    });

    expect(mockUsernameExists).toHaveBeenCalledWith('existinguser');
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('should handle createUser errors gracefully', async () => {
    mockUsernameExists.mockResolvedValue(false);
    mockCreateUser.mockRejectedValue(new Error('Database error'));

    const result = await signupUser({
      username: 'testuser',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'username-taken',
    });

    expect(mockCreateUser).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123',
    });
  });
});
