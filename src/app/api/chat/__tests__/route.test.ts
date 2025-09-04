import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as cookiesModule from '@/lib/auth/cookies';
import * as jwtModule from '@/lib/auth/jwt';

jest.mock('@/lib/auth/cookies');
jest.mock('@/lib/auth/jwt');

// Mock the AI SDK
jest.mock('ai', () => ({
  streamText: jest.fn(),
  convertToModelMessages: jest.fn(),
}));

const mockGetAuthToken = cookiesModule.getAuthToken as jest.MockedFunction<
  typeof cookiesModule.getAuthToken
>;
const mockVerifyAuthToken = jwtModule.verifyAuthToken as jest.MockedFunction<
  typeof jwtModule.verifyAuthToken
>;

describe('/api/chat POST', () => {
  const createRequest = (messages = [{ text: 'Hello' }]) => {
    return new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful AI response
    const mockResult = {
      toUIMessageStreamResponse: jest
        .fn()
        .mockReturnValue(new Response('mock stream response')),
    };

    const { streamText, convertToModelMessages } = jest.requireMock('ai');
    streamText.mockReturnValue(mockResult);
    convertToModelMessages.mockReturnValue([]);
  });

  it('should return 401 when no token is present', async () => {
    mockGetAuthToken.mockResolvedValue(undefined);

    const request = createRequest();
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: 'Authentication required' });
  });

  it('should return 401 when token is invalid', async () => {
    mockGetAuthToken.mockResolvedValue('invalid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: jwtModule.TokenVerificationError.INVALID_TOKEN,
    });

    const request = createRequest();
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: 'Invalid or expired token' });
  });

  it('should return 401 when token has invalid payload', async () => {
    mockGetAuthToken.mockResolvedValue('token-with-bad-payload');
    mockVerifyAuthToken.mockResolvedValue({
      success: false,
      error: jwtModule.TokenVerificationError.INVALID_PAYLOAD,
    });

    const request = createRequest();
    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ success: false, error: 'Invalid or expired token' });
  });

  it('should process chat request when authenticated', async () => {
    const userId = 'user-123';
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    const messages = [{ text: 'Hello, AI!' }];
    const request = createRequest(messages);

    const response = await POST(request);

    const { streamText, convertToModelMessages } = jest.requireMock('ai');
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-5',
        temperature: 0.1,
      })
    );
    expect(convertToModelMessages).toHaveBeenCalledWith(messages);
    expect(response).toBeInstanceOf(Response);
  });
});
