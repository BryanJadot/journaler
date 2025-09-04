import type { User } from '@/lib/user/types';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Gets and validates the JWT secret from environment variables
 * @returns {Uint8Array} Encoded JWT secret
 * @throws {Error} If JWT_SECRET is missing or empty
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
 * @property {string} userId - Unique identifier for the authenticated user
 * @property {string} username - User's username for display and identification
 */
export interface AuthTokenPayload {
  userId: string;
  username: string;
}

/**
 * Enum for token verification error types
 * Provides specific error categories for authentication failures
 *
 * @enum {string} TokenVerificationError
 */
export enum TokenVerificationError {
  /** Indicates the token is structurally invalid or cannot be verified */
  INVALID_TOKEN = 'INVALID_TOKEN',
  /** Indicates the token payload does not match expected structure */
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
}

/**
 * Represents the result of token verification
 * Union type allowing for both successful and failed verification scenarios
 *
 * @typedef {Object} TokenVerificationResult
 * @property {boolean} success - Indicates whether token verification was successful
 * @property {AuthTokenPayload} [payload] - User payload if verification succeeds
 * @property {TokenVerificationError} [error] - Verification error if verification fails
 */
export type TokenVerificationResult =
  | { success: true; payload: AuthTokenPayload }
  | { success: false; error: TokenVerificationError };

/**
 * Creates a JSON Web Token (JWT) for user authentication
 * Generates a secure, time-limited token with user identification
 *
 * @param {User} user - User object containing authentication details
 * @returns {Promise<string>} Signed JWT token valid for 24 hours
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
    .setExpirationTime('24h') // Token expires after 24 hours
    .sign(secret); // Sign with secure secret

  return token;
}

/**
 * Validates the structure of an authentication token payload
 * Performs runtime type checking to ensure payload integrity
 *
 * @param {unknown} payload - Token payload to validate
 * @returns {boolean} Whether payload matches AuthTokenPayload structure
 *
 * @internal
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
 * @param {string} token - JWT token to verify
 * @returns {Promise<TokenVerificationResult>} Token verification result
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

    // Additional payload structure validation
    if (isValidAuthTokenPayload(payload)) {
      // Extract only the expected payload fields to maintain clean interface
      const authPayload: AuthTokenPayload = {
        userId: payload.userId,
        username: payload.username,
      };
      return { success: true, payload: authPayload };
    }

    // Reject tokens with invalid payload structure
    return { success: false, error: TokenVerificationError.INVALID_PAYLOAD };
  } catch {
    // Catch any verification errors (signature mismatch, expired token)
    return { success: false, error: TokenVerificationError.INVALID_TOKEN };
  }
}
