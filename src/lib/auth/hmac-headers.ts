import {
  HEADER_PREFIXES,
  type HeaderPrefix,
  type HmacAuthHeaders,
} from '@/lib/auth/hmac-types';

/**
 * Header manipulation utilities for HMAC authentication system.
 *
 * These functions handle the low-level details of setting, extracting, and
 * sanitizing HTTP headers that carry HMAC authentication data. They form
 * the bridge between the cryptographic operations and the HTTP transport layer.
 */

/**
 * Sets HMAC authentication headers with the specified prefix.
 *
 * Creates a complete set of authentication headers that can be verified
 * by the recipient. The headers are structured to prevent tampering while
 * remaining readable for debugging and monitoring.
 *
 * ## Header Structure
 * - `{prefix}-user`: The authenticated user ID
 * - `{prefix}-ts`: Unix timestamp for replay protection
 * - `{prefix}-sig`: HMAC signature of all other fields
 * - `{prefix}-method`: HTTP method (prevents method confusion)
 * - `{prefix}-path`: Request path (binds signature to endpoint)
 *
 * @param headers The Headers object to modify
 * @param auth Complete authentication data including signature
 * @param prefix Either 'x-internal' (middleware) or 'x-service' (API calls)
 *
 * @example
 * ```typescript
 * const headers = new Headers();
 * setHmacHeaders(headers, {
 *   userId: 'user123',
 *   method: 'POST',
 *   path: '/api/threads',
 *   timestamp: Math.floor(Date.now() / 1000),
 *   signature: 'abc123...'
 * }, 'x-service');
 *
 * // Results in headers:
 * // x-service-user: user123
 * // x-service-ts: 1699123456
 * // x-service-sig: abc123...
 * // x-service-method: POST
 * // x-service-path: /api/threads
 * ```
 */
export function setHmacHeaders(
  headers: Headers,
  auth: HmacAuthHeaders,
  prefix: HeaderPrefix
): void {
  headers.set(`${prefix}-user`, auth.userId);
  headers.set(`${prefix}-ts`, auth.timestamp.toString());
  headers.set(`${prefix}-sig`, auth.signature);
  headers.set(`${prefix}-method`, auth.method);
  headers.set(`${prefix}-path`, auth.path);
}

/**
 * Extracts HMAC authentication data from HTTP headers.
 *
 * Safely parses authentication headers and validates that all required
 * fields are present. Returns null if any field is missing, ensuring
 * that partial authentication attempts are rejected.
 *
 * ## Validation Behavior
 * - All five headers must be present (user, timestamp, signature, method, path)
 * - Timestamp is parsed as integer (invalid numbers will cause rejection)
 * - Empty string values are treated as missing
 * - Case-insensitive header name matching
 *
 * @param headers The Headers object to read from
 * @param prefix Either 'x-internal' or 'x-service' to determine header set
 * @returns Complete authentication data or null if any field is missing
 *
 * @example
 * ```typescript
 * // Extract service authentication from incoming request
 * const serviceAuth = extractHmacHeaders(request.headers, 'x-service');
 * if (serviceAuth) {
 *   // All required headers present, proceed with verification
 *   const isValid = await verifyHmacSignature(serviceAuth, serviceAuth.signature);
 * } else {
 *   // Missing headers, reject request
 *   return new Response('Unauthorized', { status: 401 });
 * }
 * ```
 */
export function extractHmacHeaders(
  headers: Headers,
  prefix: HeaderPrefix
): HmacAuthHeaders | null {
  const userId = headers.get(`${prefix}-user`);
  const timestamp = headers.get(`${prefix}-ts`);
  const signature = headers.get(`${prefix}-sig`);
  const method = headers.get(`${prefix}-method`);
  const path = headers.get(`${prefix}-path`);

  // All fields are required - missing any field means invalid auth
  if (!userId || !timestamp || !signature || !method || !path) {
    return null;
  }

  return {
    userId,
    method,
    path,
    timestamp: parseInt(timestamp, 10), // Parse timestamp as integer
    signature,
  };
}

/**
 * Strips all internal authentication headers from incoming requests.
 *
 * This is a critical security function that prevents header injection attacks
 * where malicious clients attempt to bypass authentication by setting internal
 * headers directly. Must be called before setting trusted internal headers.
 *
 * ## Security Importance
 * Without this function, attackers could send requests with pre-set x-internal-*
 * headers, potentially bypassing the authentication middleware entirely. This
 * creates a "clean slate" where only the middleware can set trusted headers.
 *
 * ## Implementation Details
 * - Removes headers matching any prefix in HEADER_PREFIXES
 * - Case-insensitive matching for robust protection
 * - Two-pass approach (collect then delete) to avoid iterator modification
 * - Removes all variants (x-internal-*, x-service-*, etc.)
 *
 * @param headers The Headers object to sanitize (modified in place)
 *
 * @example
 * ```typescript
 * // In middleware - always strip before setting internal headers
 * const headers = new Headers(request.headers);
 * stripInternalHeaders(headers); // Remove any malicious headers
 *
 * // Now safe to set trusted internal headers
 * await setInternalHeaders(headers, authResult, request);
 * ```
 */
export function stripInternalHeaders(headers: Headers): void {
  const headersToDelete = [];

  // First pass: collect all headers that match internal prefixes
  // Cannot delete during iteration as it modifies the iterator
  for (const [name] of headers.entries()) {
    const lowerName = name.toLowerCase();
    if (HEADER_PREFIXES.some((prefix) => lowerName.startsWith(`${prefix}-`))) {
      headersToDelete.push(name);
    }
  }

  // Second pass: remove all collected headers
  // This ensures complete removal of potentially malicious headers
  for (const name of headersToDelete) {
    headers.delete(name);
  }
}
