import { NextRequest } from 'next/server';

import {
  createUniqueUserId,
  createUniqueThreadId,
  createUniqueMessageId,
} from '@/__tests__/helpers/test-helpers';
import * as cookiesModule from '@/lib/auth/cookies';
import * as jwtModule from '@/lib/auth/jwt';

import { POST } from '../route';

jest.mock('@/lib/auth/cookies');
jest.mock('@/lib/auth/jwt');

// Mock the chat service functions
jest.mock('@/lib/chat/service', () => ({
  getMostRecentThread: jest.fn(),
  createThread: jest.fn(),
  createThreadWithFirstMessage: jest.fn(),
  saveMessage: jest.fn(),
}));

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

// Get mock chat service functions
const chatService = jest.requireMock('@/lib/chat/service');
const mockGetMostRecentThread =
  chatService.getMostRecentThread as jest.MockedFunction<
    () => Promise<unknown>
  >;
const _mockCreateThread = chatService.createThread as jest.MockedFunction<
  () => Promise<unknown>
>;
const mockCreateThreadWithFirstMessage =
  chatService.createThreadWithFirstMessage as jest.MockedFunction<
    () => Promise<unknown>
  >;
const _mockSaveMessage = chatService.saveMessage as jest.MockedFunction<
  () => Promise<unknown>
>;

describe('/api/chat POST', () => {
  const createRequest = (messages = [{ role: 'user', content: 'Hello' }]) => {
    return new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Generate unique IDs for each test run
    const userId = createUniqueUserId();
    const threadId = createUniqueThreadId();
    const messageId = createUniqueMessageId();

    // Mock database responses with unique IDs
    mockGetMostRecentThread.mockResolvedValue(null); // No existing threads
    mockCreateThreadWithFirstMessage.mockResolvedValue({
      thread: {
        id: threadId,
        name: 'New Chat',
        userId: userId,
        updatedAt: new Date(),
      },
      message: {
        id: messageId,
        threadId: threadId,
        role: 'user',
        content: 'Hello, AI!',
        outputType: 'text',
        createdAt: new Date(),
      },
    });

    // Mock successful AI response
    const mockResponse = new Response('mock stream response');
    // Add mutable headers to the response
    Object.defineProperty(mockResponse, 'headers', {
      value: {
        set: jest.fn(),
        get: jest.fn(),
      },
      writable: true,
    });

    const mockResult = {
      toUIMessageStreamResponse: jest.fn().mockReturnValue(mockResponse),
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
    const userId = createUniqueUserId();
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    const messages = [{ role: 'user', content: 'Hello, AI!' }];
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
