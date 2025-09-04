import { NextRequest, NextResponse } from 'next/server';

import { setAuthCookie } from '@/lib/auth/cookies';
import { validateRequestFormat } from '@/lib/auth/request-validation';
import { loginUser } from '@/lib/auth/service';

/**
 * Handles user login via HTTP POST request
 * Validates credentials, authenticates user, and sets authentication cookie
 *
 * @param {NextRequest} request - Incoming HTTP request
 * @returns {Promise<NextResponse>} Authentication response
 *
 * Authentication flow:
 * 1. Extract username and password from request body
 * 2. Validate credential presence
 * 3. Attempt user authentication
 * 4. Set authentication cookie on success
 * 5. Return user details or error response
 *
 * @throws {NextResponse} 400 error if credentials are missing
 * @throws {NextResponse} 401 error if authentication fails
 *
 * @example Request Body
 * {
 *   "username": "johndoe",
 *   "password": "securepassword123"
 * }
 */
export async function POST(request: NextRequest) {
  const validation = await validateRequestFormat(request);
  if (!validation.valid) {
    return validation.response;
  }

  const { username, password } = validation;

  try {
    // Attempt to authenticate user using credentials
    const result = await loginUser({ username, password });

    // Handle authentication result
    if (result.success) {
      // Authentication successful: Set secure auth cookie
      await setAuthCookie(result.user);

      // Return minimal user information
      return NextResponse.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          createdAt: result.user.createdAt,
        },
      });
    } else {
      // Authentication failed: Return error response
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Authentication failed',
        },
        { status: 401 } // Unauthorized status code
      );
    }
  } catch (error) {
    // Handle service errors (database failures, etc.)
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
