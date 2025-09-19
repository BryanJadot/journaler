import { NextRequest, NextResponse } from 'next/server';

import { getAuthToken } from '@/lib/auth/cookies';
import { getHmacSecret } from '@/lib/auth/hmac-secret';
import { verifyAuthToken } from '@/lib/auth/jwt';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup'];

/**
 * Creates an HMAC signature for internal headers using Web Crypto API (Edge runtime).
 *
 * This prevents header spoofing and replay attacks by:
 * - Including the HTTP method in signature (different methods fail verification)
 * - Including the request path in signature (different paths fail verification)
 * - Including timestamp in signature (old requests fail verification)
 * - Using HMAC with shared secret (prevents forgery without the secret)
 *
 * @param userId - The authenticated user's ID
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - Request path
 * @param timestamp - Unix timestamp in seconds
 * @returns Base64url encoded HMAC signature
 */
export async function createHmacSignature(
  userId: string,
  method: string,
  path: string,
  timestamp: number
): Promise<string> {
  const secret = getHmacSecret();
  if (!secret) {
    throw new Error('INTERNAL_HEADER_SECRET environment variable is required');
  }

  // Create message with pipe separators to prevent collision attacks
  const message = `${userId}|${method}|${path}|${timestamp}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  // Import secret key for HMAC-SHA256 signing (Edge runtime Web Crypto API)
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);

  // Convert to base64url encoding (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Next.js middleware that handles authentication and secure internal header forwarding.
 *
 * This middleware runs on every request and provides:
 * 1. Header security: Strips any malicious x-internal-* headers from incoming requests
 * 2. Authentication: Verifies JWT tokens and redirects unauthenticated users
 * 3. Secure user context: Sets HMAC-signed internal headers for route handlers
 *
 * Security features:
 * - Prevents header injection by removing all x-internal-* headers from requests
 * - Uses HMAC signatures to prevent header spoofing and replay attacks
 * - Includes method, path, and timestamp in signature to prevent reuse
 * - Only trusted route handlers can verify and use the internal headers
 *
 * @param request - The incoming request object
 * @returns Either continues request with signed headers or redirects to login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // SECURITY CRITICAL: Remove all x-internal-* headers to prevent header injection attacks
  // Attackers could try to inject malicious headers to bypass authentication or impersonate users
  const headers = new Headers(request.headers);
  const headersToDelete = [];
  // Collect headers to delete (cannot modify during iteration)
  for (const [name] of headers.entries()) {
    if (name.toLowerCase().startsWith('x-internal-')) {
      headersToDelete.push(name);
    }
  }
  // Remove all potentially malicious internal headers
  for (const name of headersToDelete) {
    headers.delete(name);
  }

  // Allow public routes without authentication
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next({
      request: {
        headers,
      },
    });
  }

  // Get authentication token from cookies
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify the JWT token and extract user information
  const verificationResult = await verifyAuthToken(token);

  if (!verificationResult.success) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Create HMAC-signed internal headers for secure user identification
  // Current timestamp in seconds (prevents replay attacks beyond 120s window)
  const timestamp = Math.floor(Date.now() / 1000);
  const userId = verificationResult.payload.userId;

  try {
    // Generate HMAC signature that includes method, path, and timestamp
    // This prevents reuse of headers across different requests
    const signature = await createHmacSignature(
      userId,
      method,
      pathname,
      timestamp
    );

    // Set trusted internal headers that route handlers can verify
    headers.set('x-internal-user', userId);
    headers.set('x-internal-ts', timestamp.toString());
    headers.set('x-internal-sig', signature);
    // Store method and path for verification by route handlers
    headers.set('x-internal-method', method);
    headers.set('x-internal-path', pathname);

    return NextResponse.next({
      request: {
        headers,
      },
    });
  } catch (error) {
    console.error('Failed to create HMAC signature:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

/**
 * Next.js middleware configuration that defines which routes this middleware runs on.
 *
 * The matcher uses a negative lookahead regex to exclude static assets and files:
 * - _next/static: Next.js static files (JS, CSS, etc.)
 * - _next/image: Next.js Image optimization API
 * - favicon.ico: Browser favicon requests
 * - Image files: svg, png, jpg, jpeg, gif, webp extensions
 *
 * All other routes will have authentication middleware applied, ensuring proper
 * security for dynamic pages and API routes while avoiding unnecessary processing
 * of static content.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
