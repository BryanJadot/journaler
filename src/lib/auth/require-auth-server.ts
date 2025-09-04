import { redirect } from 'next/navigation';

import { getAuthToken } from './cookies';
import { verifyAuthToken } from './jwt';

/**
 * Performs authentication checks for server-side components and server routes.
 *
 * This function handles authentication for server-side rendering and server components.
 * It verifies the presence and validity of an authentication token. If no valid token
 * is found, it automatically redirects the user to the login page.
 *
 * @returns {Promise<string>} A promise that resolves to the authenticated user's ID
 *
 * @throws {never} Redirects to '/login' if:
 * - No authentication token is present
 * - The authentication token is invalid or has expired
 *
 * @example
 * // In a server component or server route
 * export default async function ProtectedPage() {
 *   const userId = await requireAuthServer();
 *   // The following code will only run for authenticated users
 *   return <div>Welcome, user {userId}!</div>;
 * }
 *
 * @remarks
 * This function provides a seamless way to enforce authentication in server-side contexts.
 * It abstracts away token retrieval, validation, and redirection logic, allowing you to
 * focus on writing protected server components and routes.
 */
export async function requireAuthServer(): Promise<string> {
  const token = await getAuthToken();

  if (!token) {
    redirect('/login');
  }

  const verificationResult = await verifyAuthToken(token);

  if (!verificationResult.success) {
    redirect('/login');
  }

  return verificationResult.payload.userId;
}
