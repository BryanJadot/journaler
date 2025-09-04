import { NextRequest, NextResponse } from 'next/server';

import { getAuthToken } from './cookies';
import { verifyAuthToken } from './jwt';

/**
 * Represents a handler function for authenticated routes that receives a request and user ID.
 *
 * @typedef {Function} AuthenticatedHandler
 * @param {Object} params - Parameters object
 * @param {NextRequest} params.request - The incoming Next.js server request
 * @param {string} params.userId - The authenticated user's unique identifier
 * @returns {Promise<NextResponse> | NextResponse} The response to be sent back to the client
 */
export type AuthenticatedHandler = (params: {
  request: NextRequest;
  userId: string;
}) => Promise<NextResponse | Response> | NextResponse | Response;

/**
 * A higher-order function that wraps API route handlers with authentication middleware.
 *
 * This function provides a reusable authentication layer for API routes. It:
 * - Checks for the presence of an authentication token
 * - Verifies the token's validity
 * - Injects the authenticated user's ID into the original handler
 *
 * @template {AuthenticatedHandler} T
 * @param {T} handler - The original route handler function to be wrapped
 * @returns {(request: NextRequest) => Promise<NextResponse>} A new handler function with authentication checks
 *
 * @throws {NextResponse} Returns a 401 Unauthorized response if:
 * - No authentication token is present
 * - The authentication token is invalid or has expired
 *
 * @example
 * // Wrap an existing API route handler with authentication
 * export const GET = requireAuth(async ({ request, userId }) => {
 *   // This handler will only be called for authenticated requests
 *   return NextResponse.json({ message: 'Protected route', userId });
 * });
 */
export function requireAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse | Response> => {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const verificationResult = await verifyAuthToken(token);

    if (!verificationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return handler({ request, userId: verificationResult.payload.userId });
  };
}
