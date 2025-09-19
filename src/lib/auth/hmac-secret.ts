/**
 * Retrieves the HMAC secret key used for signing and verifying internal headers.
 *
 * This function provides access to the cryptographic secret that protects internal
 * headers from tampering and forgery. The secret is used by both the middleware
 * (Edge runtime) and route handlers (Node.js runtime) to create and verify HMAC
 * signatures that ensure header authenticity.
 *
 * Security considerations:
 * - The secret should be a cryptographically strong random string (at least 32 bytes)
 * - Must be identical across all application instances for proper operation
 * - Should be stored securely in environment variables, never in source code
 * - Changing this secret will invalidate all existing signed headers
 *
 * @returns The HMAC secret key, or undefined if INTERNAL_HEADER_SECRET is not configured
 *
 * @example
 * const secret = getHmacSecret();
 * if (!secret) {
 *   throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
 * }
 * // Use secret for HMAC operations...
 */
export function getHmacSecret(): string | undefined {
  return process.env.INTERNAL_HEADER_SECRET;
}
