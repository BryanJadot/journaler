import { NextRequest } from 'next/server';

import { getAuthToken } from '@/lib/auth/cookies';
import { extractHmacHeaders, setHmacHeaders } from '@/lib/auth/hmac-headers';
import { createHmacSignature } from '@/lib/auth/hmac-sign';
import type { AuthenticationResult, AuthResult } from '@/lib/auth/hmac-types';
import { verifyHmacSignature } from '@/lib/auth/hmac-verify';
import { verifyAuthToken } from '@/lib/auth/jwt';

/**
 * Authenticates a request using either service-to-service auth or user session auth.
 * Returns clean internal headers for the authenticated user.
 *
 * Preference order:
 * 1. Service-to-service authentication (x-service-* headers)
 * 2. User session authentication (JWT cookie)
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthenticationResult> {
  // 1. Check for service-to-service authentication first
  const serviceAuth = extractHmacHeaders(request.headers, 'x-service');
  if (serviceAuth) {
    // Validate service HMAC signature
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

  // 2. Check for user session authentication
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  const verificationResult = await verifyAuthToken(token);
  if (!verificationResult.success) {
    return null;
  }

  return {
    userId: verificationResult.payload.userId,
    authMethod: 'user-session',
  };
}

/**
 * Sets the appropriate internal headers for an authenticated request.
 */
export async function setInternalHeaders(
  headers: Headers,
  authResult: AuthResult,
  request: NextRequest
): Promise<void> {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const timestamp = Math.floor(Date.now() / 1000);

  // Generate HMAC signature for internal headers
  const signature = await createHmacSignature({
    userId: authResult.userId,
    method,
    path: pathname,
    timestamp,
  });

  // Set trusted internal headers
  setHmacHeaders(
    headers,
    {
      userId: authResult.userId,
      method,
      path: pathname,
      timestamp,
      signature,
    },
    'x-internal'
  );
}
