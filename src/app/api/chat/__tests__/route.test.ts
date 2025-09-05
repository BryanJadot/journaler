import { NextRequest } from 'next/server';

import {
  createUniqueUserId,
  createApiMessage,
} from '@/__tests__/helpers/test-helpers';
import * as cookiesModule from '@/lib/auth/cookies';
import * as jwtModule from '@/lib/auth/jwt';

import { POST } from '../route';

jest.mock('@/lib/auth/cookies');
jest.mock('@/lib/auth/jwt');

// Mock the chat service functions
jest.mock('@/lib/chat/service', () => ({
  saveMessage: jest.fn(),
  getThreadWithMessages: jest.fn(),
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
const _mockSaveMessage = chatService.saveMessage as jest.MockedFunction<
  () => Promise<unknown>
>;
const mockGetThreadWithMessages =
  chatService.getThreadWithMessages as jest.MockedFunction<
    () => Promise<unknown>
  >;

/**
 * Test suite for the chat API endpoint.
 *
 * This suite covers the complete chat functionality including:
 * - Authentication and authorization
 * - Message structure validation (AI SDK format compliance)
 * - Thread ownership verification
 * - AI response generation and persistence
 *
 * The tests focus heavily on message format validation because incorrect
 * message structure is a common source of AI SDK integration issues.
 */
describe('/api/chat POST', () => {
  /**
   * Helper function to create test requests with default valid structure.
   * Note: Default messages use old format for backward compatibility with auth tests.
   * Validation tests override with proper AI SDK format using createApiMessage.
   */
  const createRequest = (
    messages: unknown[] = [{ role: 'user', content: 'Hello' }], // Mixed formats for testing
    threadId = '550e8400-e29b-41d4-a716-446655440001'
  ) => {
    return new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, threadId }),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock thread ownership validation - return a valid thread for the test user
    mockGetThreadWithMessages.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: 'test-user-id',
      name: 'Test Thread',
      messages: [],
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

    // Mock thread ownership for this specific user
    mockGetThreadWithMessages.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: userId, // Use the same userId as the authenticated user
      name: 'Test Thread',
      messages: [],
    });

    // Create properly formatted user message using test helper
    // This demonstrates the correct AI SDK format with parts array
    const messages = [createApiMessage('user', 'Hello, AI!')];
    const request = createRequest(messages);

    const response = await POST(request);

    const { streamText, convertToModelMessages } = jest.requireMock('ai');
    // Verify AI SDK functions called with correct parameters
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-5', // Using GPT-5 for high-quality responses
        temperature: 0.1, // Low temperature for consistent responses
      })
    );
    // Verify message format conversion was attempted
    expect(convertToModelMessages).toHaveBeenCalledWith(messages);
    expect(response).toBeInstanceOf(Response);
  });

  /**
   * Tests validation of AI SDK user message structure.
   *
   * This test verifies that the API correctly rejects user messages that don't
   * conform to the AI SDK's required format. User messages MUST have a 'parts'
   * array instead of a 'content' property to support multi-modal content.
   *
   * The validation is critical because:
   * - Incorrect format causes AI SDK convertToModelMessages() to fail
   * - User messages have different structure than assistant messages
   * - Frontend must send messages in the correct format
   */
  it('should validate user message structure and reject invalid parts', async () => {
    const userId = createUniqueUserId();
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    // Mock thread ownership for this specific user
    mockGetThreadWithMessages.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: userId,
      name: 'Test Thread',
      messages: [],
    });

    // Create message with invalid structure - using old 'content' format
    // This simulates what happens when frontend sends messages in wrong format
    const invalidMessage = {
      id: 'test-id',
      role: 'user',
      content: 'This should fail', // Invalid: user messages need 'parts' array
    };

    const request = createRequest([invalidMessage]);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('User message must have parts array');
  });

  /**
   * Tests validation of user message parts array structure.
   *
   * This test ensures the API enforces the single-part limitation for user messages.
   * Currently, the system only supports messages with exactly one text part for
   * simplicity, though the AI SDK format allows multiple parts for multi-modal content.
   *
   * This validation prevents:
   * - Complex multi-part messages that aren't properly handled
   * - Empty parts arrays that would cause processing errors
   * - Malformed message structures from reaching the AI model
   */
  it('should validate user message parts array structure', async () => {
    const userId = createUniqueUserId();
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    // Mock thread ownership for this specific user
    mockGetThreadWithMessages.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: userId,
      name: 'Test Thread',
      messages: [],
    });

    // Create message with multiple parts - currently not supported
    // This simulates a multi-modal message that exceeds current system capabilities
    const invalidMessage = {
      id: 'test-id',
      role: 'user',
      parts: [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'Second part' }, // Invalid: system expects exactly one part
      ],
    };

    const request = createRequest([invalidMessage]);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('User message must have exactly one part');
  });

  /**
   * Tests validation of message part type and content structure.
   *
   * This test verifies that the API correctly validates the internal structure
   * of message parts. Each part must:
   * - Have type 'text' (other types like 'image' not currently supported)
   * - Contain a 'text' property with string content
   *
   * This validation ensures:
   * - Only supported content types are processed
   * - Text content is properly typed for database storage
   * - Future multi-modal support has proper type checking foundation
   */
  it('should validate text part type and content', async () => {
    const userId = createUniqueUserId();
    mockGetAuthToken.mockResolvedValue('valid-token');
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      payload: { userId, username: 'testuser' },
    });

    // Mock thread ownership for this specific user
    mockGetThreadWithMessages.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      userId: userId,
      name: 'Test Thread',
      messages: [],
    });

    // Create message with unsupported part type
    // This simulates an attempt to send image content (not yet supported)
    const invalidMessage = {
      id: 'test-id',
      role: 'user',
      parts: [{ type: 'image', text: 'Should fail' }], // Invalid: only 'text' type supported
    };

    const request = createRequest([invalidMessage]);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain(
      'User message part must be text type with string content'
    );
  });
});
