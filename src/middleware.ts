import { NextRequest, NextResponse } from 'next/server';

import { getAuthToken } from '@/lib/auth/cookies';
import { verifyAuthToken } from '@/lib/auth/jwt';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup'];

/**
 * Next.js middleware that handles authentication and header security.
 *
 * This middleware runs on every request and provides:
 * 1. Header security: Strips malicious 'x-user-id' headers from incoming requests
 * 2. Authentication: Verifies JWT tokens and redirects unauthenticated users
 * 3. User context: Sets 'x-user-id' header with authenticated user's ID
 *
 * Security features:
 * - Prevents header injection by always removing x-user-id from incoming requests
 * - Only sets x-user-id header after successful JWT verification
 * - Redirects unauthenticated users to login page for protected routes
 *
 * @param {NextRequest} request - The incoming request object
 * @returns {NextResponse} Either continues request with headers or redirects to login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create new headers object and remove any malicious x-user-id header
  // This is a critical security measure to prevent header injection attacks
  const headers = new Headers(request.headers);
  headers.delete('x-user-id');

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

  // Set authenticated user's ID in headers for downstream components
  // This header can be trusted because it's set by the middleware after authentication
  headers.set('x-user-id', verificationResult.payload.userId);

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
