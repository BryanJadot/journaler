import { setHmacHeaders } from '@/lib/auth/hmac-headers';
import { createHmacSignature } from '@/lib/auth/hmac-sign';

/**
 * Fire-and-forget mechanism for internal service-to-service API calls.
 *
 * Uses HMAC authentication with x-service-* headers to securely authenticate
 * internal requests. The middleware will validate the HMAC and set the
 * appropriate internal headers.
 *
 * This utility immediately returns without waiting for the API response,
 * making it perfect for background tasks like auto-renaming threads.
 */

/**
 * Makes a fire-and-forget API call with HMAC authentication.
 * Returns immediately without waiting for the response.
 *
 * @param userId - The user ID to authenticate as
 * @param path - The API path (e.g., '/api/threads/rename')
 * @param options - Fetch options (method, body, etc.)
 *
 * @example
 * // Fire-and-forget call to rename a thread
 * fireAndForget(userId, '/api/threads/rename', {
 *   method: 'POST',
 *   body: JSON.stringify({ threadId: 'thread123', newName: 'New Name' }),
 *   headers: { 'Content-Type': 'application/json' }
 * });
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
 * Internal function that makes the actual authenticated API call.
 */
async function makeInternalApiCall(
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<void> {
  const method = options.method || 'GET';
  const timestamp = Math.floor(Date.now() / 1000);

  // Create HMAC signature for authentication
  const signature = await createHmacSignature({
    userId,
    method,
    path,
    timestamp,
  });

  // Set up headers for service-to-service HMAC authentication
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
    'x-service'
  );

  // Make the API call (base URL will be resolved by fetch)
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000';

  await fetch(`${baseUrl}${path}`, {
    ...options,
    method,
    headers,
  });
}
