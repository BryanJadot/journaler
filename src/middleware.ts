import { NextRequest, NextResponse } from 'next/server';

import { stripInternalHeaders } from '@/lib/auth/hmac-headers';
import {
  authenticateRequest,
  setInternalHeaders,
} from '@/lib/auth/middleware-auth';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/signup'];

/**
 * Next.js middleware that handles authentication and secure internal header forwarding.
 *
 * This middleware runs on every request and provides:
 * 1. Header security: Strips any malicious internal headers from incoming requests
 * 2. Authentication: Supports both service-to-service and user session auth
 * 3. Secure user context: Sets HMAC-signed internal headers for route handlers
 *
 * Authentication precedence:
 * 1. Service-to-service authentication (x-service-* headers)
 * 2. User session authentication (JWT cookies)
 *
 * @param request - The incoming request object
 * @returns Either continues request with signed headers or redirects to login
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without authentication
  if (PUBLIC_ROUTES.includes(pathname)) {
    const headers = new Headers(request.headers);
    stripInternalHeaders(headers);
    return NextResponse.next({
      request: {
        headers,
      },
    });
  }

  // 1. Authenticate the request (service auth takes precedence over user session)
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Strip all internal headers to prevent injection attacks
  const headers = new Headers(request.headers);
  stripInternalHeaders(headers);

  // 3. Set clean internal headers based on authentication
  await setInternalHeaders(headers, authResult, request);

  // 4. Continue with authenticated request
  return NextResponse.next({
    request: {
      headers,
    },
  });
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
