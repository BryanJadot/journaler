import { getHmacSecret } from '@/lib/auth/hmac-secret';
import type { HmacSignatureData } from '@/lib/auth/hmac-types';

/**
 * Maximum age for timestamps (120 seconds) to prevent replay attacks.
 *
 * This window balances security with practical considerations:
 * - Prevents attackers from reusing captured requests after 2 minutes
 * - Allows for reasonable clock skew between services
 * - Accounts for network latency in distributed systems
 * - Short enough to limit the replay attack window
 */
const MAX_TIMESTAMP_AGE = 120;

/**
 * Verifies HMAC-SHA256 signatures with comprehensive security protections.
 *
 * This function is the security-critical counterpart to createHmacSignature,
 * responsible for validating that incoming requests are authentic and haven't
 * been tampered with. It implements multiple layers of protection against
 * common cryptographic attacks.
 *
 * ## Security Protections
 * - **Replay Attack Prevention**: Rejects timestamps older than 120 seconds
 * - **Timing Attack Resistance**: Uses constant-time comparison to prevent
 *   attackers from inferring signature bytes through response timing
 * - **Clock Skew Tolerance**: Accepts timestamps slightly in the future
 * - **Signature Recomputation**: Validates by recreating the expected signature
 *
 * ## Verification Process
 * 1. Validates timestamp freshness (within ±120 seconds)
 * 2. Recomputes expected signature using identical algorithm
 * 3. Performs timing-safe comparison of signatures
 * 4. Returns boolean result without leaking timing information
 *
 * ## Critical Security Note
 * The timing-safe comparison is essential - even nanosecond differences in
 * comparison time can be exploited by sophisticated attackers to gradually
 * reconstruct valid signatures byte by byte.
 *
 * @param data The signature data to verify (user, method, path, timestamp)
 * @param receivedSignature The base64url signature to validate
 * @returns True if signature is valid and timestamp is fresh
 *
 * @throws When INTERNAL_HEADER_SECRET environment variable is missing
 *
 * @example
 * ```typescript
 * // Verify a service-to-service request
 * const isValid = await verifyHmacSignature(
 *   {
 *     userId: 'user123',
 *     method: 'POST',
 *     path: '/api/threads/create',
 *     timestamp: Math.floor(Date.now() / 1000)
 *   },
 *   receivedSignature
 * );
 *
 * if (isValid) {
 *   // Request is authentic and fresh
 *   proceedWithRequest();
 * } else {
 *   // Signature invalid or timestamp too old
 *   rejectRequest();
 * }
 * ```
 */
export async function verifyHmacSignature(
  data: HmacSignatureData,
  receivedSignature: string
): Promise<boolean> {
  const secret = getHmacSecret();
  if (!secret) {
    throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
  }

  // STEP 1: Timestamp validation - prevent replay attacks
  // Check if timestamp is within acceptable window (±120 seconds)
  const now = Math.floor(Date.now() / 1000);
  const age = now - data.timestamp;
  if (age > MAX_TIMESTAMP_AGE || age < -MAX_TIMESTAMP_AGE) {
    console.warn(`HMAC timestamp too old or in future: ${age}s`);
    return false;
  }

  // STEP 2: Signature recomputation using identical algorithm
  // Must match createHmacSignature exactly for verification to work
  const message = `${data.userId}|${data.method}|${data.path}|${data.timestamp}`;
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  // Import secret key for HMAC-SHA256 verification (same as signing)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, // Not extractable for security
    ['sign'] // Use 'sign' operation for verification too
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);

  // Convert to base64url encoding to match createHmacSignature output
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const expectedSignature = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // STEP 3: SECURITY CRITICAL - Constant-time signature comparison
  // Prevents timing attacks where response time differences leak signature bytes
  try {
    // Convert signatures to byte arrays for bitwise comparison
    const receivedBytes = new TextEncoder().encode(receivedSignature);
    const expectedBytes = new TextEncoder().encode(expectedSignature);

    // Fast-fail on length mismatch (still timing-safe for different lengths)
    if (receivedBytes.length !== expectedBytes.length) {
      return false;
    }

    // Manual XOR-based comparison ensures constant execution time
    // All bytes are always compared regardless of early mismatches
    let result = 0;
    for (let i = 0; i < receivedBytes.length; i++) {
      result |= receivedBytes[i] ^ expectedBytes[i];
    }

    // Only equal if XOR result is zero (all bits matched)
    return result === 0;
  } catch (error) {
    console.error('HMAC signature verification failed:', error);
    return false;
  }
}
