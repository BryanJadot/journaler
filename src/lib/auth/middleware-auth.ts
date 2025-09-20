import { NextRequest } from 'next/server';

import { getAuthToken } from '@/lib/auth/cookies';
import { extractHmacHeaders, setHmacHeaders } from '@/lib/auth/hmac-headers';
import { createHmacSignature } from '@/lib/auth/hmac-sign';
import type { AuthenticationResult, AuthResult } from '@/lib/auth/hmac-types';
import { verifyHmacSignature } from '@/lib/auth/hmac-verify';
import { verifyAuthToken } from '@/lib/auth/jwt';

/**
 * Authenticates incoming requests using a multi-tier authentication strategy.
 *
 * This function is the main entry point for the authentication middleware,
 * coordinating between different authentication methods while maintaining
 * a clear security hierarchy. It handles both automated service calls and
 * user browser sessions seamlessly.
 *
 * ## Authentication Hierarchy
 * 1. **Service-to-service authentication** (x-service-* headers)
 *    - Used by fire-and-forget internal API calls
 *    - Requires valid HMAC signature with fresh timestamp
 *    - Takes precedence over user sessions for security
 *
 * 2. **User session authentication** (JWT cookies)
 *    - Browser-based authentication for human users
 *    - Falls back when no service auth present
 *    - Validates JWT token from secure cookies
 *
 * ## Security Design
 * Service authentication takes precedence because it represents trusted
 * internal communication. If a request has service headers, they must be
 * valid - we don't fall back to user sessions if service auth fails.
 *
 * @param request The incoming NextRequest to authenticate
 * @returns Authentication result with user ID and method, or null if failed
 *
 * @example
 * ```typescript
 * // In middleware
 * const authResult = await authenticateRequest(request);
 * if (!authResult) {
 *   return NextResponse.redirect(new URL('/login', request.url));
 * }
 *
 * // authResult.authMethod tells us how user was authenticated
 * if (authResult.authMethod === 'service') {
 *   // Internal service call - high trust level
 * } else {
 *   // User session - normal trust level
 * }
 * ```
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticationResult> {
  // TIER 1: Service-to-service authentication (highest priority)
  // Check for x-service-* headers indicating internal API call
  const serviceAuth = extractHmacHeaders(request.headers, 'x-service');
  if (serviceAuth) {
    // Validate the HMAC signature to ensure authenticity
    const isValidSignature = await verifyHmacSignature(
      {
        userId: serviceAuth.userId,
        method: serviceAuth.method,
        path: serviceAuth.path,
        timestamp: serviceAuth.timestamp,
      },
      serviceAuth.signature
    );

    if (isValidSignature) {
      return {
        userId: serviceAuth.userId,
        authMethod: 'service',
      };
    } else {
      console.warn('Invalid service HMAC signature');
      // Continue to user session auth if service auth fails
    }
  }

  // TIER 2: User session authentication (browser sessions)
  // Extract JWT token from secure HTTP-only cookies
  const token = await getAuthToken();
  if (!token) {
    return null; // No authentication token available
  }

  // Verify JWT token validity and extract user information
  const verificationResult = await verifyAuthToken(token);
  if (!verificationResult.success) {
    return null; // Invalid or expired token
  }

  return {
    userId: verificationResult.payload.userId,
    authMethod: 'user-session',
  };
}

/**
 * Sets trusted internal headers for authenticated requests.
 *
 * After successful authentication, this function creates a fresh set of
 * x-internal-* headers that route handlers can trust implicitly. These
 * headers carry the authenticated user context with cryptographic integrity.
 *
 * ## Security Properties
 * - **Fresh timestamps**: Each request gets a new timestamp for audit trails
 * - **Method binding**: Signature includes HTTP method to prevent attacks
 * - **Path binding**: Signature includes request path for endpoint-specific auth
 * - **Tamper-proof**: HMAC signature ensures headers can't be modified in transit
 *
 * ## Architecture Role
 * Route handlers can trust x-internal-* headers because:
 * 1. stripInternalHeaders() removes any malicious headers from clients
 * 2. Only this function can set x-internal-* headers after authentication
 * 3. Headers include fresh HMAC signatures that verify integrity
 *
 * @param headers The Headers object to modify (will add x-internal-* headers)
 * @param authResult The authenticated user information
 * @param request The original request for path and method extraction
 *
 * @example
 * ```typescript
 * // In middleware after successful authentication
 * const headers = new Headers(request.headers);
 * stripInternalHeaders(headers); // Remove any malicious headers
 * await setInternalHeaders(headers, authResult, request);
 *
 * // Route handlers can now trust x-internal-user header
 * // GET /api/route
 * const userId = headers.get('x-internal-user'); // Guaranteed authentic
 * ```
 */
export async function setInternalHeaders(
  headers: Headers,
  authResult: AuthResult,
  request: NextRequest
): Promise<void> {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const timestamp = Math.floor(Date.now() / 1000); // Fresh timestamp

  // Generate HMAC signature for internal headers
  // This signature proves the headers were set by trusted middleware
  const signature = await createHmacSignature({
    userId: authResult.userId,
    method,
    path: pathname,
    timestamp,
  });

  // Set complete set of trusted internal headers
  // These headers carry authenticated user context to route handlers
  setHmacHeaders(
    headers,
    {
      userId: authResult.userId,
      method,
      path: pathname,
      timestamp,
      signature,
    },
    'x-internal' // Use internal prefix for middleware-set headers
  );
}
