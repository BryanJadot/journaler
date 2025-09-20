import { headers } from 'next/headers';

import { extractHmacHeaders } from '@/lib/auth/hmac-headers';
import { verifyHmacSignature } from '@/lib/auth/hmac-verify';

/**
 * Extracts and verifies the authenticated user ID from HMAC-signed internal headers.
 *
 * This function validates the trusted internal headers set by the authentication middleware.
 * It performs comprehensive security checks including:
 * - HMAC signature verification to prevent header spoofing
 * - Timestamp validation to prevent replay attacks (max 120 seconds old)
 * - Constant-time comparison to prevent timing attacks
 *
 * Security features:
 * - All x-internal-* headers are stripped by middleware, only middleware can set them
 * - HMAC includes method, path, timestamp to prevent cross-request reuse
 * - Timestamp check prevents replay of old signed headers
 * - Constant-time comparison prevents signature timing attacks
 *
 * @returns The authenticated user's ID
 * @throws When headers are missing, invalid, or signature verification fails
 *
 * @example
 * // In a server component or API route
 * try {
 *   const userId = await getUserIdFromHeader();
 *   // User is authenticated and headers are cryptographically verified
 * } catch (error) {
 *   // Authentication failed or headers were tampered with
 * }
 */
export async function getUserIdFromHeader(): Promise<string> {
  const headersList = await headers();

  // Extract internal headers set by middleware (works for both user session and service auth)
  const authHeaders = extractHmacHeaders(headersList, 'x-internal');

  if (!authHeaders) {
    throw new Error(
      'Missing required internal headers. Authentication required.'
    );
  }

  // Verify HMAC signature using the unified verification system
  const isValidSignature = await verifyHmacSignature(
    {
      userId: authHeaders.userId,
      method: authHeaders.method,
      path: authHeaders.path,
      timestamp: authHeaders.timestamp,
    },
    authHeaders.signature
  );

  if (!isValidSignature) {
    throw new Error(
      'Invalid HMAC signature. Headers may have been tampered with.'
    );
  }

  return authHeaders.userId;
}
