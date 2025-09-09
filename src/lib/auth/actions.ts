'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { redirect } from 'next/navigation';

import { setAuthCookie } from '@/lib/auth/cookies';
import { isSignupEnabled, loginUser, signupUser } from '@/lib/auth/service';
import { getOrCreateChatUrl } from '@/lib/chat/redirect-helpers';

export interface AuthActionResult {
  success: false;
  error: string;
}

/**
 * Server action for user login
 */
export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const username = formData.get('username');
  const password = formData.get('password');

  // Validate credentials
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username ||
    !password
  ) {
    return {
      success: false,
      error: 'Username and password are required',
    };
  }

  // Trim whitespace
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!trimmedUsername || !trimmedPassword) {
    return {
      success: false,
      error: 'Username and password are required',
    };
  }

  try {
    const result = await loginUser({
      username: trimmedUsername,
      password: trimmedPassword,
    });

    if (result.success) {
      await setAuthCookie(result.user);
      const chatUrl = await getOrCreateChatUrl(result.user.id);
      redirect(chatUrl);
    } else {
      return {
        success: false,
        error: result.error || 'Authentication failed',
      };
    }
  } catch (error) {
    // Re-throw redirect errors to allow them to work properly
    if (isRedirectError(error)) {
      throw error;
    }
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}

/**
 * Server action for user signup
 */
export async function signupAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  // Check if signup is enabled
  if (!isSignupEnabled()) {
    return {
      success: false,
      error: 'Signup is currently disabled',
    };
  }

  const username = formData.get('username');
  const password = formData.get('password');

  // Validate credentials
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username ||
    !password
  ) {
    return {
      success: false,
      error: 'Username and password are required',
    };
  }

  // Trim whitespace
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  if (!trimmedUsername || !trimmedPassword) {
    return {
      success: false,
      error: 'Username and password are required',
    };
  }

  try {
    const result = await signupUser({
      username: trimmedUsername,
      password: trimmedPassword,
    });

    if (result.success) {
      await setAuthCookie(result.user);
      const chatUrl = await getOrCreateChatUrl(result.user.id);
      redirect(chatUrl);
    } else {
      let errorMessage = 'Signup failed';

      switch (result.error) {
        case 'username-taken':
          errorMessage = 'Username is already taken';
          break;
        case 'invalid-username':
          errorMessage = 'Username cannot contain spaces';
          break;
        case 'username-too-long':
          errorMessage = 'Username must be 255 characters or less';
          break;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    // Re-throw redirect errors to allow them to work properly
    if (isRedirectError(error)) {
      throw error;
    }
    console.error('Signup error:', error);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}
