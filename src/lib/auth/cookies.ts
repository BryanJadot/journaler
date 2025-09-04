import type { User } from '@/lib/user/types';
import { cookies } from 'next/headers';
import { createAuthToken } from './jwt';

/** Name of the authentication cookie */
const AUTH_COOKIE_NAME = 'auth-token';

/**
 * Gets secure configuration for authentication cookies
 * Configures cookie security, expiration, and scope
 *
 * @returns {Object} Cookie options object
 * @property {boolean} httpOnly - Prevents client-side JavaScript access
 * @property {boolean} secure - Only transmit over HTTPS in production
 * @property {'strict'} sameSite - Prevents cross-site request forgery
 * @property {number} maxAge - Cookie expiration time (24 hours)
 * @property {string} path - Cookie available across entire application
 */
function getAuthCookieOptions() {
  return {
    httpOnly: true, // Mitigate XSS risks
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict' as const, // Prevent CSRF attacks
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/', // Available site-wide
  };
}

/**
 * Sets an authentication cookie for a user
 * Creates a JWT and stores it as a secure, HTTP-only cookie
 *
 * @param {User} user - User to authenticate
 * @returns {Promise<void>} Promise resolving when cookie is set
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
 * @returns {Promise<void>} Promise that resolves when cookie is cleared
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
 * @returns {Promise<string | undefined>} Promise resolving to auth token or undefined
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
