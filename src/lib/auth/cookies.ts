import { cookies } from 'next/headers';

import { createAuthToken } from '@/lib/auth/jwt';
import type { User } from '@/lib/user/types';

/** Name of the authentication cookie */
const AUTH_COOKIE_NAME = 'auth-token';

/**
 * Gets secure configuration for authentication cookies
 * Configures cookie security, expiration, and scope
 *
 * @returns Cookie options object
 * @property httpOnly - Prevents client-side JavaScript access
 * @property secure - Only transmit over HTTPS in production
 * @property sameSite - Prevents cross-site request forgery
 * @property maxAge - Cookie expiration time (7 days)
 * @property path - Cookie available across entire application
 */
function getAuthCookieOptions() {
  return {
    httpOnly: true, // Mitigate XSS risks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict' as const, // Prevent CSRF attacks
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/', // Available site-wide
  };
}

/**
 * Sets an authentication cookie for a user
 * Creates a JWT and stores it as a secure, HTTP-only cookie
 *
 * @param user - User to authenticate
 * @returns Promise resolving when cookie is set
 *
 * @example
 * await setAuthCookie(user);
 * // User is now authenticated via a secure cookie
 */
export async function setAuthCookie(user: User): Promise<void> {
  // Generate a JWT for the user
  const token = await createAuthToken(user);
  const cookieStore = await cookies();

  // Set the authentication token as a secure cookie
  cookieStore.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

/**
 * Removes the authentication cookie
 * Effectively logs out the current user
 *
 * @returns Promise that resolves when cookie is cleared
 *
 * @example
 * await clearAuthCookie();
 * // User is now logged out
 */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  // Delete the authentication cookie
  cookieStore.delete(AUTH_COOKIE_NAME);
}

/**
 * Retrieves the current authentication token from cookies
 *
 * @returns Promise resolving to auth token or undefined
 *
 * @example
 * const token = await getAuthToken();
 * if (token) {
 *   // User is authenticated
 * }
 */
export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  // Safely extract token value, returning undefined if not present
  return cookieStore.get(AUTH_COOKIE_NAME)?.value;
}
