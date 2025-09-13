import { createHmac, timingSafeEqual } from 'crypto';

import { headers } from 'next/headers';

import { getHmacSecret } from './hmac-secret';

// Maximum age for timestamps (120 seconds) - prevents replay attacks
const MAX_TIMESTAMP_AGE = 120;

/**
 * Verifies HMAC signature using Node.js crypto module for constant-time comparison.
 *
 * This function recomputes the HMAC signature and uses timing-safe comparison
 * to prevent timing attacks. The signature includes userId, method, path, and timestamp
 * to prevent reuse across different requests.
 *
 * @param {string} userId - The user ID from headers
 * @param {string} method - HTTP method from headers
 * @param {string} path - Request path from headers
 * @param {number} timestamp - Unix timestamp from headers
 * @param {string} receivedSignature - The signature to verify
 * @returns {boolean} True if signature is valid
 */
export function verifyHmacSignature(
  userId: string,
  method: string,
  path: string,
  timestamp: number,
  receivedSignature: string
): boolean {
  const secret = getHmacSecret();
  if (!secret) {
    throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
  }

  // Recompute the expected signature using identical message format as middleware
  const message = `${userId}|${method}|${path}|${timestamp}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  const signature = hmac.digest('base64');

  // Convert to base64url encoding to match middleware
  const expectedSignature = signature
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // SECURITY CRITICAL: Use constant-time comparison to prevent timing attacks
  // timingSafeEqual prevents attackers from measuring comparison time to guess signatures
  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch {
    // Return false for any error (length mismatch, invalid base64, etc.)
    return false;
  }
}

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
 * @returns {Promise<string>} The authenticated user's ID
 * @throws {Error} When headers are missing, invalid, or signature verification fails
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

  // Extract internal headers set by middleware
  const userId = headersList.get('x-internal-user');
  const timestampStr = headersList.get('x-internal-ts');
  const signature = headersList.get('x-internal-sig');

  // Verify all required headers are present
  if (!userId || !timestampStr || !signature) {
    throw new Error(
      'Missing required internal headers. Authentication required.'
    );
  }

  // Parse and validate timestamp
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    throw new Error('Invalid timestamp in internal headers.');
  }

  // SECURITY: Check timestamp age to prevent replay attacks
  // Reject requests with timestamps older than MAX_TIMESTAMP_AGE seconds
  const currentTime = Math.floor(Date.now() / 1000);
  const age = currentTime - timestamp;
  if (age > MAX_TIMESTAMP_AGE) {
    throw new Error(
      `Request timestamp too old: ${age}s (max ${MAX_TIMESTAMP_AGE}s)`
    );
  }

  // Get current request details for signature verification
  // The middleware stores these in headers for verification
  const method = headersList.get('x-internal-method');
  const path = headersList.get('x-internal-path');

  if (!method || !path) {
    throw new Error('Missing request method or path headers.');
  }

  // Verify HMAC signature using constant-time comparison
  const isValidSignature = verifyHmacSignature(
    userId,
    method,
    path,
    timestamp,
    signature
  );
  if (!isValidSignature) {
    throw new Error(
      'Invalid HMAC signature. Headers may have been tampered with.'
    );
  }

  return userId;
}
