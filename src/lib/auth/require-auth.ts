import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from './cookies';
import { verifyAuthToken } from './jwt';

export type AuthenticatedHandler = (
  request: NextRequest,
  userId: string
) => Promise<NextResponse> | NextResponse;

export function requireAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const verificationResult = await verifyAuthToken(token);

    if (!verificationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return handler(request, verificationResult.payload.userId);
  };
}
