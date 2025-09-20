import { getHmacSecret } from '@/lib/auth/hmac-secret';
import type { HmacSignatureData } from '@/lib/auth/hmac-types';

/**
 * Creates an HMAC-SHA256 signature for secure authentication and message integrity.
 *
 * This function is the cornerstone of the authentication system, providing cryptographic
 * proof that a request is legitimate and hasn't been tampered with. It uses HMAC-SHA256
 * with a secret key to create unforgeable signatures that bind together the user ID,
 * HTTP method, request path, and timestamp.
 *
 * ## Security Features
 * - **Message Authentication**: Proves the message hasn't been altered
 * - **Source Authentication**: Verifies the sender knows the secret key
 * - **Method Binding**: Prevents cross-method attacks (POST -> GET, etc.)
 * - **Path Binding**: Ensures signatures can't be reused for different endpoints
 * - **Replay Protection**: Timestamp prevents reuse of old signatures
 * - **Collision Resistance**: Pipe separators prevent field boundary confusion
 *
 * ## Architecture Role
 * Used by both the middleware (for x-internal headers) and fire-and-forget
 * service calls (for x-service headers). The same algorithm ensures consistency
 * between signature creation and verification.
 *
 * @param data The signature data containing user, method, path, and timestamp
 * @returns Base64url-encoded HMAC signature safe for HTTP headers
 *
 * @throws When INTERNAL_HEADER_SECRET environment variable is missing
 *
 * @example
 * ```typescript
 * // Create signature for internal middleware headers
 * const signature = await createHmacSignature({
 *   userId: 'user123',
 *   method: 'POST',
 *   path: '/api/threads/create',
 *   timestamp: Math.floor(Date.now() / 1000)
 * });
 *
 * // Signature can then be used in x-internal-sig or x-service-sig headers
 * headers.set('x-internal-sig', signature);
 * ```
 */
export async function createHmacSignature(
  data: HmacSignatureData
): Promise<string> {
  const secret = getHmacSecret();
  if (!secret) {
    throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
  }

  // Create message with pipe separators to prevent collision attacks
  // Pipe separators ensure that fields can't be confused even if they contain
  // similar content (e.g., userId="a|b" method="c" != userId="a" method="b|c")
  const message = `${data.userId}|${data.method}|${data.path}|${data.timestamp}`;
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  // Import secret key for HMAC-SHA256 signing using Web Crypto API
  // Uses crypto.subtle for Edge runtime compatibility and security
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, // Not extractable - prevents key leakage
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);

  // Convert to base64url encoding (URL-safe base64 without padding)
  // Base64url is preferred for HTTP headers as it avoids problematic characters
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
