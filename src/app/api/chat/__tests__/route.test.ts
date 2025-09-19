import { NextRequest } from 'next/server';
import OpenAI from 'openai';

import { createUniqueUserId } from '@/__tests__/helpers/test-helpers';
import { POST } from '@/app/api/chat/route';
import * as getUserFromHeaderModule from '@/lib/auth/get-user-from-header';
import { ChatMessage } from '@/lib/chat/types';
import { StreamingResponse } from '@/lib/chat/types/streaming';

jest.mock('@/lib/auth/get-user-from-header');

// Mock the chat service functions
jest.mock('@/lib/chat/service', () => ({
  saveMessage: jest.fn(),
  verifyThreadOwnership: jest.fn(),
}));

// Mock the OpenAI client
jest.mock('@/lib/openai/client', () => ({
  openaiClient: {} as OpenAI,
}));

// Mock the streamOpenAITokens function
jest.mock('../stream-openai-tokens', () => ({
  streamOpenAITokens: jest.fn(),
}));

const mockGetUserIdFromHeader =
  getUserFromHeaderModule.getUserIdFromHeader as jest.MockedFunction<
    typeof getUserFromHeaderModule.getUserIdFromHeader
  >;

// Get mock chat service functions
const chatService = jest.requireMock('@/lib/chat/service');
const mockSaveMessage = chatService.saveMessage as jest.MockedFunction<
  typeof chatService.saveMessage
>;
const mockVerifyThreadOwnership =
  chatService.verifyThreadOwnership as jest.MockedFunction<
    typeof chatService.verifyThreadOwnership
  >;

// Get mock streamOpenAITokens function
const streamOpenAITokensModule = jest.requireMock('../stream-openai-tokens');
const mockStreamOpenAITokens =
  streamOpenAITokensModule.streamOpenAITokens as jest.MockedFunction<
    typeof streamOpenAITokensModule.streamOpenAITokens
  >;

/**
 * Test suite for the streaming chat API endpoint.
 *
 * This suite covers the complete streaming chat functionality including:
 * - Authentication and authorization
 * - Request validation (message content and thread ID)
 * - Thread ownership verification
 * - JSON streaming response generation
 * - Message persistence to database
 *
 * The tests focus on the new JSON streaming approach with typed responses.
 */
describe('/api/chat POST', () => {
  /**
   * Helper function to create test requests with the chat API format.
   *
   * @param message - The user's message content
   * @param threadId - The thread identifier (UUID format)
   * @param history - Previous conversation messages
   * @returns Properly formatted API request for testing
   */
  const createRequest = (
    message = 'Hello',
    threadId = '550e8400-e29b-41d4-a716-446655440001', // Default UUID for testing
    history: ChatMessage[] = []
  ) => {
    return new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, threadId, history }),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  /**
   * Helper function to parse JSON streaming response.
   *
   * The chat API streams responses as newline-delimited JSON objects.
   * This helper parses the stream and returns all response objects in order.
   *
   * @param response - The streaming response from the API
   * @returns Array of parsed response objects
   */
  const parseStreamingResponse = async (
    response: Response
  ): Promise<StreamingResponse[]> => {
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const results: StreamingResponse[] = [];
    let buffer = '';

    // Read the stream chunk by chunk
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode bytes to text and accumulate in buffer
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines to get individual JSON objects
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      // Parse each complete JSON line
      for (const line of lines) {
        if (line.trim()) {
          results.push(JSON.parse(line));
        }
      }
    }

    return results;
  };

  beforeEach(() => {
    // Reset all mocks to ensure test isolation
    jest.clearAllMocks();

    // Mock successful thread ownership verification by default
    // Individual tests can override this for error scenarios
    mockVerifyThreadOwnership.mockResolvedValue(true);

    // Mock successful message saving with realistic return data
    mockSaveMessage.mockResolvedValue({
      id: 'message-id',
      threadId: '550e8400-e29b-41d4-a716-446655440001',
      role: 'user',
      content: 'Hello',
      outputType: 'text',
      createdAt: new Date(),
    });

    // Mock successful AI token generation with a simple streaming response
    // Tests can override this to simulate different AI responses or errors
    mockStreamOpenAITokens.mockImplementation(async function* (
      _client: OpenAI,
      _history: ChatMessage[],
      _message: string
    ) {
      yield 'Hello';
      yield ' world';
      yield '!';
    });
  });

  it('should return 400 when user is not authenticated', async () => {
    mockGetUserIdFromHeader.mockRejectedValue(
      new Error('User ID not found in headers. Authentication required.')
    );

    const request = createRequest();
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      error: 'User ID not found in headers. Authentication required.',
    });
  });

  it('should return 400 when message content is missing', async () => {
    const userId = createUniqueUserId();
    mockGetUserIdFromHeader.mockResolvedValue(userId);

    const request = createRequest(''); // Empty message
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Message content is required' });
  });

  it('should return 400 when thread ID is missing', async () => {
    const userId = createUniqueUserId();
    mockGetUserIdFromHeader.mockResolvedValue(userId);

    const request = createRequest('Hello', ''); // Empty threadId
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Thread ID is required' });
  });

  it('should return 400 when user does not own thread', async () => {
    const userId = createUniqueUserId();
    mockGetUserIdFromHeader.mockResolvedValue(userId);

    // Mock thread ownership verification to return false
    mockVerifyThreadOwnership.mockResolvedValue(false);

    const request = createRequest();
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ error: 'Thread not found or access denied' });
  });

  it('should stream JSON response when request is valid', async () => {
    const userId = createUniqueUserId();
    const threadId = '550e8400-e29b-41d4-a716-446655440001';
    const message = 'Hello, how are you?';

    mockGetUserIdFromHeader.mockResolvedValue(userId);

    const request = createRequest(message, threadId);
    const response = await POST(request);

    // Verify response headers
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');

    // Verify service calls
    expect(mockVerifyThreadOwnership).toHaveBeenCalledWith(threadId, userId);
    expect(mockSaveMessage).toHaveBeenCalledWith(
      threadId,
      'user',
      message,
      'text'
    );
    expect(mockStreamOpenAITokens).toHaveBeenCalledWith(
      expect.any(Object),
      [],
      message
    );

    // Parse streaming response
    const streamResponses = await parseStreamingResponse(response);

    expect(streamResponses).toEqual([
      { type: 'chunk', content: 'Hello' },
      { type: 'chunk', content: ' world' },
      { type: 'chunk', content: '!' },
      { type: 'complete' },
    ]);

    // Verify assistant response was saved
    expect(mockSaveMessage).toHaveBeenCalledWith(
      threadId,
      'assistant',
      'Hello world!',
      'text'
    );
  });

  it('should include history in streamOpenAITokens call', async () => {
    const userId = createUniqueUserId();
    const threadId = '550e8400-e29b-41d4-a716-446655440001';
    const message = 'How are you?';
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello',
        createdAt: '2023-01-01T00:00:00Z',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Hi there!',
        createdAt: '2023-01-01T00:01:00Z',
      },
    ];

    mockGetUserIdFromHeader.mockResolvedValue(userId);

    const request = createRequest(message, threadId, history);
    await POST(request);

    expect(mockStreamOpenAITokens).toHaveBeenCalledWith(
      expect.any(Object),
      history,
      message
    );
  });

  it('should handle streamOpenAITokens errors and stream error response', async () => {
    const userId = createUniqueUserId();
    const threadId = '550e8400-e29b-41d4-a716-446655440001';

    mockGetUserIdFromHeader.mockResolvedValue(userId);

    // Mock streamOpenAITokens to throw an error
    mockStreamOpenAITokens.mockImplementation(async function* () {
      throw new Error('API rate limit exceeded');
    });

    const request = createRequest();
    const response = await POST(request);

    const streamResponses = await parseStreamingResponse(response);

    expect(streamResponses).toEqual([
      { type: 'error', error: 'API rate limit exceeded' },
    ]);

    // Verify error was saved to database
    expect(mockSaveMessage).toHaveBeenCalledWith(
      threadId,
      'assistant',
      'API rate limit exceeded',
      'error'
    );
  });

  it('should handle non-Error exceptions in streamOpenAITokens', async () => {
    const userId = createUniqueUserId();
    const _threadId = '550e8400-e29b-41d4-a716-446655440001';

    mockGetUserIdFromHeader.mockResolvedValue(userId);

    // Mock streamOpenAITokens to throw a non-Error value
    mockStreamOpenAITokens.mockImplementation(async function* () {
      throw 'String error';
    });

    const request = createRequest();
    const response = await POST(request);

    const streamResponses = await parseStreamingResponse(response);

    expect(streamResponses).toEqual([
      { type: 'error', error: 'Generation failed: String error' },
    ]);
  });

  it('should handle empty history array', async () => {
    const userId = createUniqueUserId();

    mockGetUserIdFromHeader.mockResolvedValue(userId);

    const request = createRequest(
      'Hello',
      '550e8400-e29b-41d4-a716-446655440001',
      []
    );
    await POST(request);

    expect(mockStreamOpenAITokens).toHaveBeenCalledWith(
      expect.any(Object),
      [],
      'Hello'
    );
  });
});
