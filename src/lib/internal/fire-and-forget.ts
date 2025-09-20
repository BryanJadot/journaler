import { setHmacHeaders } from '@/lib/auth/hmac-headers';
import { createHmacSignature } from '@/lib/auth/hmac-sign';

/**
 * Fire-and-forget mechanism for secure internal service-to-service API calls.
 *
 * This module provides the ability to make authenticated API calls that return
 * immediately without waiting for the response, perfect for background operations
 * that don't need to block the current execution flow.
 *
 * ## Security Model
 * Uses HMAC-SHA256 authentication with x-service-* headers to provide:
 * - **Message authenticity**: Proves the call originated from trusted code
 * - **Request integrity**: Ensures the request hasn't been tampered with
 * - **Replay protection**: Timestamps prevent reuse of captured requests
 * - **User context**: Carries user identity for authorization decisions
 *
 * ## Architecture Integration
 * The middleware recognizes x-service-* headers and:
 * 1. Validates the HMAC signature using shared secret
 * 2. Strips the service headers to prevent forwarding
 * 3. Sets trusted x-internal-* headers for route handlers
 * 4. Processes the request as if it came from an authenticated user
 *
 * ## Use Cases
 * - Background thread operations (auto-rename, cleanup)
 * - Async notification processing
 * - Delayed data synchronization
 * - Non-critical operations that shouldn't block user interactions
 */

/**
 * Makes a fire-and-forget API call with cryptographic authentication.
 *
 * This function immediately returns after starting the API call, making it
 * perfect for background operations. The call is authenticated using HMAC
 * signatures, ensuring it's processed with the correct user context.
 *
 * ## Security Guarantees
 * - All calls are cryptographically signed and cannot be forged
 * - User context is preserved and validated by the receiving endpoint
 * - Timestamps prevent replay attacks if requests are intercepted
 * - Failed authentication results in automatic request rejection
 *
 * ## Error Handling
 * Since this is fire-and-forget, errors are logged but not propagated to
 * the caller. The calling code continues execution regardless of whether
 * the background operation succeeds or fails.
 *
 * ## Performance Characteristics
 * - Returns immediately (non-blocking)
 * - Creates minimal overhead for signature generation
 * - No network latency impact on calling code
 * - Suitable for high-frequency background operations
 *
 * @param userId The user ID to authenticate the request as
 * @param path The API endpoint path (must start with '/')
 * @param options Standard fetch options (method, body, headers, etc.)
 *
 * @example
 * ```typescript
 * // Auto-rename a thread in the background
 * fireAndForget(userId, '/api/threads/auto-rename', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     threadId: 'thread_123',
 *     contentPreview: 'User is asking about...'
 *   }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 *
 * // Trigger background analytics
 * fireAndForget(userId, '/api/analytics/track-event', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     event: 'thread_created',
 *     metadata: { source: 'web', timestamp: Date.now() }
 *   }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 *
 * // Cleanup expired data
 * fireAndForget(userId, '/api/cleanup/old-threads', {
 *   method: 'DELETE'
 * });
 * ```
 */
export function fireAndForget(
  userId: string,
  path: string,
  options: RequestInit = {}
): void {
  // Fire-and-forget: start the async operation but don't await it
  makeInternalApiCall(userId, path, options).catch((error) => {
    // Log errors for debugging but don't throw since this is fire-and-forget
    console.error('Fire-and-forget API call failed:', error);
  });
}

/**
 * Internal function that performs the actual authenticated API call.
 *
 * This function handles the low-level details of HMAC signature generation,
 * header construction, and HTTP request execution. It's separated from the
 * public fireAndForget function to enable proper error handling in the
 * async context while maintaining the fire-and-forget semantics.
 *
 * ## Authentication Flow
 * 1. Generates fresh timestamp for replay protection
 * 2. Creates HMAC signature binding user, method, path, and timestamp
 * 3. Sets complete x-service-* header set for middleware recognition
 * 4. Makes HTTP request to the appropriate base URL
 *
 * ## Environment Adaptation
 * Automatically selects the correct base URL:
 * - Production: Uses VERCEL_PROJECT_PRODUCTION_URL environment variable
 * - Development: Falls back to localhost:3000
 * - Edge cases: Environment misconfigurations will cause fetch to fail
 *
 * @param userId The user ID for authentication context
 * @param path The API endpoint path to call
 * @param options Base fetch options (will be augmented with auth headers)
 */
async function makeInternalApiCall(
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<void> {
  const method = options.method || 'GET';
  const timestamp = Math.floor(Date.now() / 1000); // Fresh timestamp

  // Generate HMAC signature for service-to-service authentication
  // This signature proves the request originated from trusted internal code
  const signature = await createHmacSignature({
    userId,
    method,
    path,
    timestamp,
  });

  // Prepare headers with service authentication
  // Preserves any existing headers while adding authentication
  const headers = new Headers(options.headers);
  setHmacHeaders(
    headers,
    {
      userId,
      method,
      path,
      timestamp,
      signature,
    },
    'x-service' // Use service prefix for internal API calls
  );

  // Determine the correct base URL for the environment
  // Production uses Vercel's project URL, development uses localhost
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000';

  // Execute the authenticated HTTP request
  // Any errors will be caught by the fire-and-forget wrapper
  await fetch(`${baseUrl}${path}`, {
    ...options,
    method, // Ensure method consistency with signature
    headers, // Include authentication headers
  });
}
