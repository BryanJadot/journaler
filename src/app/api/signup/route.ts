import { NextRequest, NextResponse } from 'next/server';

import { setAuthCookie } from '@/lib/auth/cookies';
import { validateRequestFormat } from '@/lib/auth/request-validation';
import { signupUser } from '@/lib/auth/service';
import { SignupError } from '@/lib/user/types';

/**
 * Handles the HTTP POST request for user signup.
 *
 * @param {NextRequest} request - The incoming HTTP request containing signup data
 * @returns {Promise<NextResponse>} Detailed signup response with user details or error information
 *
 * @description
 * REST API endpoint for user registration with comprehensive error handling:
 * 1. Validates request format and JSON structure
 * 2. Checks username and password meet system requirements
 * 3. Attempts to create a new user via signupUser()
 * 4. Sets authentication cookie upon successful signup
 * 5. Provides detailed, meaningful error responses
 *
 * @throws {Error} On unexpected server-side issues during the signup process
 *
 * @example
 * // POST /api/signup request body:
 * // {
 * //   username: 'newuser123',
 * //   password: 'securePassword123'
 * // }
 * // Possible HTTP responses:
 * // 200 OK - Successful signup with user details
 * // 400 Bad Request - Invalid username/password format
 * // 409 Conflicts - Username already exists
 * // 500 Server Error - Unexpected server-side issue
 *
 * @remarks
 * - Supports RESTful error reporting
 * - Provides security by sanitizing and validating input
 * - Centralizes signup logic and error management
 */
export async function POST(request: NextRequest) {
  try {
    const validation = await validateRequestFormat(request);
    if (!validation.valid) {
      return validation.response;
    }

    const { username, password } = validation;
    const result = await signupUser({ username, password });

    if (result.success) {
      await setAuthCookie(result.user);

      return NextResponse.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          createdAt: result.user.createdAt,
        },
      });
    } else {
      let errorMessage = 'Signup failed';
      let statusCode = 400;

      switch (result.error) {
        case SignupError.USERNAME_TAKEN:
          errorMessage = 'Username is already taken';
          statusCode = 409;
          break;
        case SignupError.INVALID_USERNAME:
          errorMessage = 'Username cannot contain spaces';
          statusCode = 400;
          break;
        case SignupError.USERNAME_TOO_LONG:
          errorMessage = 'Username must be 255 characters or less';
          statusCode = 400;
          break;
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
