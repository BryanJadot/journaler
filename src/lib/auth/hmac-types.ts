/**
 * Type definitions for HMAC authentication system.
 */

export const HEADER_PREFIXES = ['x-internal', 'x-service'] as const;
export type HeaderPrefix = (typeof HEADER_PREFIXES)[number];

export interface AuthResult {
  userId: string;
  authMethod: 'service' | 'user-session';
}

export type AuthenticationResult = AuthResult | null;

export interface HmacSignatureData {
  userId: string;
  method: string;
  path: string;
  timestamp: number;
}

export interface HmacAuthHeaders extends HmacSignatureData {
  signature: string;
}
