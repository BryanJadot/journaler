import { headers } from 'next/headers';

/**
 * Extracts the authenticated user ID from request headers.
 *
 * This function retrieves the user ID that was set by the authentication middleware.
 * The middleware validates JWT tokens and sets the 'x-user-id' header for authenticated requests.
 *
 * Security considerations:
 * - The x-user-id header is stripped from all incoming requests by middleware
 * - Only the middleware can set this header after successful authentication
 * - This prevents header injection attacks from malicious clients
 *
 * @returns {Promise<string>} The authenticated user's ID
 * @throws {Error} When user is not authenticated or header is missing
 *
 * @example
 * // In a server component or API route
 * try {
 *   const userId = await getUserIdFromHeader();
 *   // User is authenticated, proceed with protected operation
 * } catch (error) {
 *   // User is not authenticated, handle accordingly
 * }
 */
export async function getUserIdFromHeader(): Promise<string> {
  const headersList = await headers();
  const userId = headersList.get('x-user-id');

  if (!userId) {
    throw new Error('User ID not found in headers. Authentication required.');
  }

  return userId;
}
