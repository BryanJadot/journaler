import { SignJWT, jwtVerify } from 'jose';

import type { User } from '@/lib/user/types';

/**
 * Gets and validates the JWT secret from environment variables
 * @returns Encoded JWT secret
 * @throws If JWT_SECRET is missing or empty
 */
function getJwtSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '') {
    throw new Error(
      'JWT_SECRET environment variable is required and cannot be empty'
    );
  }
  return new TextEncoder().encode(jwtSecret);
}

/**
 * Represents the payload structure for authentication tokens
 * Contains essential user identification information
 *
 * @interface AuthTokenPayload
 * @property userId - Unique identifier for the authenticated user
 * @property username - User's username for display and identification
 */
export interface AuthTokenPayload {
  userId: string;
  username: string;
}

/**
 * Token verification error types using string literals for consistent error handling
 *
 * String literal types provide better integration with error handling middleware
 * and frontend components compared to traditional enums. They serialize directly
 * to JSON and enable cleaner discriminated union patterns.
 *
 * @typedef {TokenVerificationError}
 * Error codes returned during JWT token verification:
 * - 'invalid-token': Token signature is invalid, expired, or malformed
 * - 'invalid-payload': Token payload structure doesn't match expected AuthTokenPayload
 *
 * @example
 * const result = await verifyAuthToken(token);
 * if (!result.success) {
 *   switch (result.error) {
 *     case 'invalid-token':
 *       // Handle expired or tampered tokens
 *       break;
 *     case 'invalid-payload':
 *       // Handle corrupted token payload
 *       break;
 *   }
 * }
 */
export type TokenVerificationError = 'invalid-token' | 'invalid-payload';

/**
 * Represents the result of token verification
 * Union type allowing for both successful and failed verification scenarios
 *
 * @typedef {Object} TokenVerificationResult
 * @property success - Indicates whether token verification was successful
 * @property [payload] - User payload if verification succeeds
 * @property [error] - Verification error if verification fails
 */
export type TokenVerificationResult =
  | { success: true; payload: AuthTokenPayload }
  | { success: false; error: TokenVerificationError };

/**
 * Creates a JSON Web Token (JWT) for user authentication
 * Generates a secure, time-limited token with user identification
 *
 * @param user - User object containing authentication details
 * @returns Signed JWT token valid for 7 days
 *
 * @example
 * const token = await createAuthToken(user);
 * // Returns a JWT token for the given user
 */
export async function createAuthToken(user: User): Promise<string> {
  // Get validated JWT secret
  const secret = getJwtSecret();

  // Create a JWT with user details, using HMAC-SHA256 algorithm
  const token = await new SignJWT({
    userId: user.id,
    username: user.username,
  })
    .setProtectedHeader({ alg: 'HS256' }) // Use HMAC-SHA256 for signing
    .setIssuedAt() // Record token creation time
    .setExpirationTime('7d') // Token expires after 7 days
    .sign(secret); // Sign with secure secret

  return token;
}

/**
 * Validates the structure of an authentication token payload
 *
 * Performs runtime type checking to ensure payload integrity using TypeScript's
 * type guard pattern. This validation prevents malformed tokens from causing
 * runtime errors and ensures type safety throughout the authentication flow.
 *
 * @param payload - Token payload to validate (from JWT.verify)
 * @returns Type guard indicating valid payload structure
 *
 * @internal This function is only used internally by verifyAuthToken
 *
 * Validation checks:
 * - Payload is a non-null object
 * - Contains required 'userId' and 'username' properties
 * - Both properties are non-empty strings
 *
 * @example
 * // Internal usage within verifyAuthToken:
 * if (isValidAuthTokenPayload(payload)) {
 *   // payload is now typed as AuthTokenPayload
 *   const userId = payload.userId; // TypeScript knows this exists
 * }
 */
function isValidAuthTokenPayload(
  payload: unknown
): payload is AuthTokenPayload {
  // Strict type checking to prevent malformed tokens
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'userId' in payload &&
    'username' in payload &&
    typeof payload.userId === 'string' &&
    typeof payload.username === 'string'
  );
}

/**
 * Verifies the authenticity and validity of a JWT token
 * Checks token signature, expiration, and payload structure
 *
 * @param token - JWT token to verify
 * @returns Token verification result
 *
 * @example
 * const result = await verifyAuthToken(token);
 * if (result.success) {
 *   // Token is valid, use result.payload
 * } else {
 *   // Handle verification failure
 * }
 */
export async function verifyAuthToken(
  token: string
): Promise<TokenVerificationResult> {
  try {
    // Get validated JWT secret
    const secret = getJwtSecret();

    // Verify token using the secret key and extract payload
    const { payload } = await jwtVerify(token, secret);

    // Validate payload structure using type guard to ensure data integrity
    if (isValidAuthTokenPayload(payload)) {
      // Create clean payload object with only expected fields for security
      const authPayload: AuthTokenPayload = {
        userId: payload.userId,
        username: payload.username,
      };
      return { success: true, payload: authPayload };
    }

    // Return specific error for malformed payload structure
    return { success: false, error: 'invalid-payload' };
  } catch {
    // Handle all JWT verification failures (expired, invalid signature, wrong algorithm, etc.)
    return { success: false, error: 'invalid-token' };
  }
}
