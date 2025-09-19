import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the format and content of a signup request, ensuring proper JSON structure and input requirements.
 *
 * @param request - The incoming Next.js server request to validate
 * @returns Validation result indicating success or failure with appropriate response
 *
 * @description
 * Performs comprehensive validation of signup request:
 * - Checks for valid JSON body
 * - Ensures username and password are present
 * - Validates input types (string)
 * - Trims and checks for non-empty credentials
 *
 * @throws {Error} When request body cannot be parsed as JSON
 * @internal
 * @category Validation
 *
 * @example
 * // Valid request
 * const validation = await validateRequestFormat(request);
 * if (validation.valid) {
 *   const { username, password } = validation;
 *   // Proceed with user registration
 * }
 *
 * @remarks
 * - Provides granular error responses
 * - Prevents processing of malformed signup requests
 * - First line of defense in request validation
 */
export async function validateRequestFormat(
  request: NextRequest
): Promise<
  | { valid: true; username: string; password: string }
  | { valid: false; response: NextResponse }
> {
  let username, password;

  try {
    ({ username, password } = await request.json());
  } catch {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      ),
    };
  }

  if (
    !username ||
    !password ||
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password.trim()
  ) {
    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Username and password are required',
        },
        { status: 400 }
      ),
    };
  }

  // Validation successful, return sanitized username and password
  return { valid: true, username, password };
}
