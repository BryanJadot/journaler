import { createMockUserWithPassword } from '@/__tests__/helpers/test-helpers';
import { createUser } from '@/lib/user/service';
import * as userServiceModule from '@/lib/user/service';
import { User } from '@/lib/user/types';

import { isSignupEnabled, loginUser, signupUser } from '../service';

const randomUsername = () =>
  `testuser-${Math.random().toString(36).substring(7)}`;

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

describe('authenticateUser', () => {
  it('should return user on successful authentication', async () => {
    const mockUserData = await createMockUserWithPassword();

    await createUser({
      username: mockUserData.user.username,
      password: mockUserData.password,
    });

    const result = await loginUser({
      username: mockUserData.user.username,
      password: mockUserData.password,
    });

    expect(result).toMatchObject({
      success: true,
      user: {
        id: expect.any(String),
        username: mockUserData.user.username,
        createdAt: expect.any(Date),
      },
    });
  });

  it('should return USER_NOT_FOUND for non-existent user', async () => {
    const result = await loginUser({
      username: randomUsername(),
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'user-not-found',
    });
  });

  it('should return INVALID_PASSWORD for wrong password', async () => {
    const mockUserData = await createMockUserWithPassword();

    await createUser({
      username: mockUserData.user.username,
      password: mockUserData.password,
    });

    const result = await loginUser({
      username: mockUserData.user.username,
      password: 'wrongpassword',
    });

    expect(result).toEqual({
      success: false,
      error: 'invalid-password',
    });
  });

  it('should return USER_NOT_FOUND for username with spaces (validation)', async () => {
    const result = await loginUser({
      username: 'user with spaces',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'user-not-found',
    });
  });

  it('should return USER_NOT_FOUND for username over 255 characters', async () => {
    const result = await loginUser({
      username: 'a'.repeat(256),
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: 'user-not-found',
    });
  });
});

describe('signupUser', () => {
  describe('successful signup', () => {
    it('should create user with valid credentials', async () => {
      const userData = {
        username: randomUsername(),
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          username: userData.username,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle username with allowed special characters', async () => {
      const userData = {
        username: 'test@user.com+123_dash-allowed',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          username: userData.username,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle username with numbers', async () => {
      const userData = {
        username: `testuser123_${Math.random().toString(36).substring(7)}`,
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          username: userData.username,
          createdAt: expect.any(Date),
        },
      });
    });

    it('should handle unicode characters in username', async () => {
      const userData = {
        username: `测试用户_${Math.random().toString(36).substring(7)}`,
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          username: userData.username,
          createdAt: expect.any(Date),
        },
      });
    });
  });

  describe('username validation', () => {
    it('should reject username with spaces', async () => {
      const userData = {
        username: 'user with spaces',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username with single space', async () => {
      const userData = {
        username: 'user name',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username with leading space', async () => {
      const userData = {
        username: ' username',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username with trailing space', async () => {
      const userData = {
        username: 'username ',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username with multiple spaces', async () => {
      const userData = {
        username: 'user   name   here',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username with tab characters', async () => {
      const userData = {
        username: 'user\tname',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username that is only spaces', async () => {
      const userData = {
        username: '   ',
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'invalid-username',
      });
    });

    it('should reject username that is too long (over 255 characters)', async () => {
      const userData = {
        username: 'a'.repeat(256), // One character over the limit
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'username-too-long',
      });
    });

    it('should accept username that is exactly 255 characters', async () => {
      const userData = {
        username: 'a'.repeat(255), // Exactly at the limit
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toMatchObject({
        success: true,
        user: {
          id: expect.any(String),
          username: userData.username,
          createdAt: expect.any(Date),
        },
      });
    });
  });

  describe('duplicate username handling', () => {
    it('should reject duplicate username', async () => {
      const userData = {
        username: randomUsername(),
        password: 'password123',
      };

      // Create the first user
      const firstResult = await signupUser(userData);
      expect(firstResult.success).toBe(true);

      // Try to create the same user again
      const secondResult = await signupUser(userData);

      expect(secondResult).toEqual({
        success: false,
        error: 'username-taken',
      });
    });

    it('should reject duplicate username with different password', async () => {
      const username = randomUsername();

      const firstUserData = {
        username,
        password: 'password123',
      };

      const secondUserData = {
        username,
        password: 'differentpassword456',
      };

      // Create the first user
      const firstResult = await signupUser(firstUserData);
      expect(firstResult.success).toBe(true);

      // Try to create another user with the same username
      const secondResult = await signupUser(secondUserData);

      expect(secondResult).toEqual({
        success: false,
        error: 'username-taken',
      });
    });

    it('should handle case-sensitive username uniqueness', async () => {
      const baseUsername = randomUsername();
      const lowercaseUser = {
        username: baseUsername.toLowerCase(),
        password: 'password123',
      };
      const uppercaseUser = {
        username: baseUsername.toUpperCase(),
        password: 'password123',
      };

      // Create lowercase user
      const firstResult = await signupUser(lowercaseUser);
      expect(firstResult.success).toBe(true);

      // Try to create uppercase user (different from lowercase)
      const secondResult = await signupUser(uppercaseUser);

      // Should succeed since usernames are case-sensitive
      expect(secondResult.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle database errors during user creation', async () => {
      const validUser = {
        username: randomUsername(),
        password: 'password123',
      };

      // Mock createUser to throw an error
      const mockCreateUser = jest
        .spyOn(userServiceModule, 'createUser')
        .mockRejectedValue(new Error('Database error'));

      const result = await signupUser(validUser);

      expect(result).toEqual({
        success: false,
        error: 'username-taken',
      });

      // Restore original function
      mockCreateUser.mockRestore();
    });

    it('should handle unexpected errors gracefully', async () => {
      const validUser = {
        username: randomUsername(),
        password: 'password123',
      };

      // Mock createUser to throw a non-standard error
      const mockCreateUser = jest
        .spyOn(userServiceModule, 'createUser')
        .mockRejectedValue('String error');

      const result = await signupUser(validUser);

      expect(result).toEqual({
        success: false,
        error: 'username-taken',
      });

      // Restore original function
      mockCreateUser.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should reject very long username (1000 characters)', async () => {
      const userData = {
        username: 'a'.repeat(1000),
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result).toEqual({
        success: false,
        error: 'username-too-long',
      });
    });

    it('should handle empty password', async () => {
      const mockUserData = await createMockUserWithPassword(undefined, '');

      // This should succeed at the service level - validation happens at the API level
      const result = await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(result.success).toBe(true);
    });

    it('should handle very long password', async () => {
      const mockUserData = await createMockUserWithPassword(
        undefined,
        'p'.repeat(1000)
      );

      const result = await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(result.success).toBe(true);
    });

    it('should handle username with emoji', async () => {
      const userData = {
        username: `user${randomUsername()}👤`,
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result.success).toBe(true);

      const successResult = result as { success: true; user: User };
      expect(successResult.user.username).toContain('👤');
    });

    it('should handle username starting with numbers', async () => {
      const userData = {
        username: `123user_${Math.random().toString(36).substring(7)}`,
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result.success).toBe(true);

      const successResult = result as { success: true; user: User };
      expect(successResult.user.username).toMatch(/^123user_/);
    });

    it('should handle username with special characters but no spaces', async () => {
      const userData = {
        username: `!@#$%^&*()_+-=[]{}|;:,.<>?${randomUsername()}`,
        password: 'password123',
      };

      const result = await signupUser(userData);

      expect(result.success).toBe(true);
    });
  });

  describe('password handling and authentication edge cases', () => {
    it('should handle special characters in password correctly', async () => {
      const complexPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?`~';
      const mockUserData = await createMockUserWithPassword(
        undefined,
        complexPassword
      );

      const signupResult = await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(signupResult.success).toBe(true);

      // Test that we can authenticate with the complex password
      const loginResult = await loginUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(loginResult.success).toBe(true);
    });

    it('should handle unicode characters in password correctly', async () => {
      const unicodePassword = 'пароль测试مرور🔒';
      const mockUserData = await createMockUserWithPassword(
        undefined,
        unicodePassword
      );

      const signupResult = await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(signupResult.success).toBe(true);

      // Test that we can authenticate with the unicode password
      const loginResult = await loginUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(loginResult.success).toBe(true);
    });

    it('should properly hash and compare passwords with whitespace', async () => {
      const passwordWithWhitespace = '  password with spaces  ';
      const mockUserData = await createMockUserWithPassword(
        undefined,
        passwordWithWhitespace
      );

      const signupResult = await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(signupResult.success).toBe(true);

      // Exact match should work
      const loginResult = await loginUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(loginResult.success).toBe(true);

      // Trimmed version should NOT work (passwords are case and space sensitive)
      const loginResultTrimmed = await loginUser({
        username: mockUserData.user.username,
        password: mockUserData.password.trim(),
      });

      expect(loginResultTrimmed.success).toBe(false);

      const failureResult = loginResultTrimmed as {
        success: false;
        error: string;
      };
      expect(failureResult.error).toBe('invalid-password');
    });

    it('should handle case-sensitive password authentication', async () => {
      const originalPassword = 'CaseSensitivePassword';
      const mockUserData = await createMockUserWithPassword(
        undefined,
        originalPassword
      );

      await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      // Correct case should work
      const correctResult = await loginUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      expect(correctResult.success).toBe(true);

      // Different case should fail
      const wrongCaseResult = await loginUser({
        username: mockUserData.user.username,
        password: mockUserData.password.toLowerCase(),
      });

      expect(wrongCaseResult.success).toBe(false);

      const wrongCaseFailure = wrongCaseResult as {
        success: false;
        error: string;
      };
      expect(wrongCaseFailure.error).toBe('invalid-password');
    });
  });

  describe('additional database interaction edge cases', () => {
    it('should handle database query timing edge cases', async () => {
      const mockUserData = await createMockUserWithPassword();

      // Create user first
      const signupResult = await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });
      expect(signupResult.success).toBe(true);

      // Concurrent signup attempts should fail gracefully
      const concurrentSignupPromises = Array.from({ length: 3 }, () =>
        signupUser({
          username: mockUserData.user.username,
          password: 'different-password',
        })
      );

      const results = await Promise.all(concurrentSignupPromises);

      // All concurrent attempts should fail with USERNAME_TAKEN
      results.forEach((result) => {
        expect(result.success).toBe(false);

        const failureResult = result as { success: false; error: string };
        expect(failureResult.error).toBe('username-taken');
      });
    });

    it('should handle rapid successive login attempts', async () => {
      const mockUserData = await createMockUserWithPassword();

      await signupUser({
        username: mockUserData.user.username,
        password: mockUserData.password,
      });

      // Multiple rapid login attempts should all work
      const loginPromises = Array.from({ length: 5 }, () =>
        loginUser({
          username: mockUserData.user.username,
          password: mockUserData.password,
        })
      );

      const results = await Promise.all(loginPromises);

      results.forEach((result) => {
        expect(result.success).toBe(true);

        const successResult = result as { success: true; user: User };
        expect(successResult.user.username).toBe(mockUserData.user.username);
      });
    });
  });
});
