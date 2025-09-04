import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../require-auth';
import * as cookiesModule from '../cookies';
import * as jwtModule from '../jwt';

jest.mock('../cookies');
jest.mock('../jwt');

const mockGetAuthToken = cookiesModule.getAuthToken as jest.MockedFunction<
  typeof cookiesModule.getAuthToken
>;
const mockVerifyAuthToken = jwtModule.verifyAuthToken as jest.MockedFunction<
  typeof jwtModule.verifyAuthToken
>;

describe('requireAuth', () => {
  const mockHandler = jest.fn();
  const mockRequest = new NextRequest('http://localhost/api/test');

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandler.mockResolvedValue(NextResponse.json({ success: true }));
  });

  it('should call handler with userId when token is valid', async () => {
    const userId = 'user-123';
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    const wrappedHandler = requireAuth(mockHandler);
    await wrappedHandler(mockRequest);

    expect(mockHandler).toHaveBeenCalledWith(mockRequest, userId);
  });

  it('should return 401 when no token is present', async () => {
    mockGetAuthToken.mockResolvedValue(undefined);

    const wrappedHandler = requireAuth(mockHandler);
    const response = await wrappedHandler(mockRequest);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: 'Authentication required' });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', async () => {
    mockGetAuthToken.mockResolvedValue('invalid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: jwtModule.TokenVerificationError.INVALID_TOKEN,
    });

    const wrappedHandler = requireAuth(mockHandler);
    const response = await wrappedHandler(mockRequest);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: 'Invalid or expired token' });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should return 401 when token has invalid payload', async () => {
    mockGetAuthToken.mockResolvedValue('token-with-bad-payload');
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: jwtModule.TokenVerificationError.INVALID_PAYLOAD,
    });

    const wrappedHandler = requireAuth(mockHandler);
    const response = await wrappedHandler(mockRequest);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: 'Invalid or expired token' });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should let handler errors pass through unchanged', async () => {
    const userId = 'user-123';
    const handlerError = new Error('Handler specific error');
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });
    mockHandler.mockRejectedValue(handlerError);

    const wrappedHandler = requireAuth(mockHandler);

    await expect(wrappedHandler(mockRequest)).rejects.toThrow(
      'Handler specific error'
    );
  });

  it('should return handler response when authentication succeeds', async () => {
    const userId = 'user-123';
    const expectedResponse = NextResponse.json({ data: 'test-data' });
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });
    mockHandler.mockResolvedValue(expectedResponse);

    const wrappedHandler = requireAuth(mockHandler);
    const response = await wrappedHandler(mockRequest);

    expect(response).toBe(expectedResponse);
  });
});
