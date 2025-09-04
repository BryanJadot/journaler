import { setAuthCookie } from '@/lib/auth/cookies';
import { authenticateUser } from '@/lib/user/service';
import { NextRequest, NextResponse } from 'next/server';

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
  // Extract login credentials from request body
  let username, password;

  try {
    ({ username, password } = await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON in request body',
      },
      { status: 400 }
    );
  }

  // Validate input: Ensure username and password are provided, are strings, and not just whitespace
  if (
    !username ||
    !password ||
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password.trim()
  ) {
    // Respond with 400 Bad Request if credentials are incomplete
    return NextResponse.json(
      {
        success: false,
        error: 'Username and password are required',
      },
      { status: 400 } // Bad Request status code
    );
  }

  try {
    // Attempt to authenticate user using credentials
    const result = await authenticateUser({ username, password });

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
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
