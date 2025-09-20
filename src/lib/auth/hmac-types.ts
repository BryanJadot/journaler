/**
 * Core type definitions and constants for the HMAC-based authentication system.
 *
 * This system provides secure service-to-service and internal header authentication
 * using HMAC-SHA256 signatures to prevent tampering and ensure message authenticity.
 * The dual-prefix design (x-internal vs x-service) enables different trust levels
 * for middleware-generated headers vs external service calls.
 */

/**
 * Header prefixes that define different authentication contexts.
 *
 * - `x-internal`: Headers set by the middleware after successful authentication.
 *   These are trusted and cannot be spoofed from external requests due to header stripping.
 *
 * - `x-service`: Headers used for service-to-service authentication.
 *   These require valid HMAC signatures and are used by fire-and-forget API calls.
 *
 * The separation prevents header injection attacks where malicious clients
 * attempt to bypass authentication by setting internal headers directly.
 */
export const HEADER_PREFIXES = ['x-internal', 'x-service'] as const;

/**
 * Type-safe header prefix union derived from the HEADER_PREFIXES constant.
 */
export type HeaderPrefix = (typeof HEADER_PREFIXES)[number];

/**
 * Authentication result containing the authenticated user and the method used.
 *
 * The authMethod field helps downstream code understand the trust level:
 * - `service`: Direct service-to-service call with HMAC verification
 * - `user-session`: Browser session authenticated via JWT cookie
 */
export interface AuthResult {
  userId: string;
  authMethod: 'service' | 'user-session';
}

/**
 * Authentication result type that can be null when authentication fails.
 * Used by middleware functions to represent authentication outcomes.
 */
export type AuthenticationResult = AuthResult | null;

/**
 * Core data structure for HMAC signature generation and verification.
 *
 * Contains all the fields that are cryptographically signed to prevent
 * message tampering. The timestamp provides replay attack protection.
 *
 * @example
 * ```typescript
 * const signatureData: HmacSignatureData = {
 *   userId: 'user123',
 *   method: 'POST',
 *   path: '/api/threads/create',
 *   timestamp: Math.floor(Date.now() / 1000)
 * };
 * ```
 */
export interface HmacSignatureData {
  /** The authenticated user ID */
  userId: string;
  /** HTTP method (GET, POST, etc.) - prevents method confusion attacks */
  method: string;
  /** Request path - ensures signature is bound to specific endpoint */
  path: string;
  /** Unix timestamp in seconds - provides replay attack protection */
  timestamp: number;
}

/**
 * Complete HMAC authentication header set including the computed signature.
 *
 * Extends HmacSignatureData with the actual HMAC signature computed from
 * the other fields. This represents the full set of headers that need to
 * be transmitted for authentication.
 */
export interface HmacAuthHeaders extends HmacSignatureData {
  /** Base64url-encoded HMAC-SHA256 signature of the other fields */
  signature: string;
}
