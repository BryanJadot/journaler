import { NextRequest } from 'next/server';

import { silenceConsoleErrors } from '@/__tests__/helpers/console-helpers';
import { POST } from '@/app/api/threads/auto-name/route';
import * as getUserFromHeaderModule from '@/lib/auth/get-user-from-header';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';

// Mock dependencies
jest.mock('@/lib/auth/get-user-from-header');
jest.mock('@/lib/db/threads', () => ({
  getThreadWithFirstMessage: jest.fn(),
  updateThreadName: jest.fn(),
}));
jest.mock('@/lib/chat/auto-naming', () => ({
  validateThreadForAutoNaming: jest.fn(),
  generateThreadName: jest.fn(),
}));

const mockGetUserIdFromHeader =
  getUserFromHeaderModule.getUserIdFromHeader as jest.MockedFunction<
    typeof getUserFromHeaderModule.getUserIdFromHeader
  >;

const threadsService = jest.requireMock('@/lib/db/threads');
const mockGetThreadWithFirstMessage = threadsService.getThreadWithFirstMessage;
const mockUpdateThreadName = threadsService.updateThreadName;

const autoNamingService = jest.requireMock('@/lib/chat/auto-naming');
const mockValidateThreadForAutoNaming =
  autoNamingService.validateThreadForAutoNaming;
const mockGenerateThreadName = autoNamingService.generateThreadName;

describe('/api/threads/auto-name', () => {
  silenceConsoleErrors();

  const mockUserId = 'user-123';
  const mockThreadId = 'thread-456';
  const mockGeneratedName = 'Generated Thread Name';

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserIdFromHeader.mockResolvedValue(mockUserId);
  });

  const createRequest = (body: unknown) => {
    return new NextRequest('http://localhost/api/threads/auto-name', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  describe('Success Cases', () => {
    beforeEach(() => {
      const mockThreadData = {
        thread: {
          id: mockThreadId,
          name: DEFAULT_THREAD_NAME,
          userId: mockUserId,
          updatedAt: new Date(),
        },
        firstMessage: {
          content: 'Hello, how can you help me?',
          role: 'user',
        },
      };

      mockGetThreadWithFirstMessage.mockResolvedValue(mockThreadData);
      mockValidateThreadForAutoNaming.mockReturnValue({ eligible: true });
      mockGenerateThreadName.mockResolvedValue(mockGeneratedName);
      mockUpdateThreadName.mockResolvedValue(true);
    });

    it('should successfully auto-name a thread', async () => {
      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        threadId: mockThreadId,
        newName: mockGeneratedName,
      });

      expect(mockGetUserIdFromHeader).toHaveBeenCalledTimes(1);
      expect(mockGetThreadWithFirstMessage).toHaveBeenCalledWith(mockThreadId);
      expect(mockValidateThreadForAutoNaming).toHaveBeenCalledWith(
        expect.objectContaining({
          thread: expect.objectContaining({ id: mockThreadId }),
          firstMessage: expect.objectContaining({ role: 'user' }),
        }),
        mockUserId
      );
      expect(mockGenerateThreadName).toHaveBeenCalledWith(
        'Hello, how can you help me?'
      );
      expect(mockUpdateThreadName).toHaveBeenCalledWith(
        mockThreadId,
        mockGeneratedName,
        mockUserId,
        DEFAULT_THREAD_NAME
      );
    });

    it('should handle empty thread name generation', async () => {
      mockGenerateThreadName.mockResolvedValue('');

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newName).toBe('');
      expect(mockUpdateThreadName).toHaveBeenCalledWith(
        mockThreadId,
        '',
        mockUserId,
        DEFAULT_THREAD_NAME
      );
    });

    it('should handle special characters in generated name', async () => {
      const specialName = 'Thread with "quotes" & symbols!';
      mockGenerateThreadName.mockResolvedValue(specialName);

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newName).toBe(specialName);
    });

    it('should handle race condition when thread is renamed during generation', async () => {
      // Simulate thread being renamed by user during OpenAI generation
      mockUpdateThreadName.mockResolvedValue(false);

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: false,
        reason: 'Thread was already renamed',
        threadId: mockThreadId,
      });

      // Verify that we still tried to update with the conditional check
      expect(mockUpdateThreadName).toHaveBeenCalledWith(
        mockThreadId,
        mockGeneratedName,
        mockUserId,
        DEFAULT_THREAD_NAME
      );
    });
  });

  describe('Validation Errors', () => {
    it('should return 400 when threadId is missing', async () => {
      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('threadId is required');
      expect(mockGetThreadWithFirstMessage).not.toHaveBeenCalled();
    });

    it('should return 400 when threadId is null', async () => {
      const request = createRequest({ threadId: null });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('threadId is required');
    });

    it('should return 400 when threadId is empty string', async () => {
      const request = createRequest({ threadId: '' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('threadId is required');
    });

    it('should return 404 when thread is not found', async () => {
      mockGetThreadWithFirstMessage.mockResolvedValue(null);

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Thread not found');
      expect(mockValidateThreadForAutoNaming).not.toHaveBeenCalled();
    });
  });

  describe('Thread Validation Errors', () => {
    beforeEach(() => {
      const mockThreadData = {
        thread: {
          id: mockThreadId,
          name: 'Custom Thread Name',
          userId: mockUserId,
          updatedAt: new Date(),
        },
        firstMessage: {
          content: 'Hello world',
          role: 'user',
        },
      };
      mockGetThreadWithFirstMessage.mockResolvedValue(mockThreadData);
    });

    it('should return 404 when thread belongs to different user', async () => {
      mockValidateThreadForAutoNaming.mockReturnValue({
        eligible: false,
        reason: 'Thread not found',
        statusCode: 404,
      });

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Thread not found');
      expect(mockGenerateThreadName).not.toHaveBeenCalled();
    });

    it('should return 409 when thread already has custom name', async () => {
      mockValidateThreadForAutoNaming.mockReturnValue({
        eligible: false,
        reason: 'Thread already has a custom name',
        statusCode: 409,
      });

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Thread already has a custom name');
      expect(mockGenerateThreadName).not.toHaveBeenCalled();
    });

    it('should return 422 when no user message found', async () => {
      mockValidateThreadForAutoNaming.mockReturnValue({
        eligible: false,
        reason: 'No user message found to base name on',
        statusCode: 422,
      });

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(422);
      expect(data.error).toBe('No user message found to base name on');
      expect(mockGenerateThreadName).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Errors', () => {
    it('should handle authentication failure', async () => {
      mockGetUserIdFromHeader.mockRejectedValue(
        new Error('Authentication failed')
      );

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockGetThreadWithFirstMessage).not.toHaveBeenCalled();
    });
  });

  describe('OpenAI Errors', () => {
    beforeEach(() => {
      const mockThreadData = {
        thread: {
          id: mockThreadId,
          name: DEFAULT_THREAD_NAME,
          userId: mockUserId,
          updatedAt: new Date(),
        },
        firstMessage: {
          content: 'Hello world',
          role: 'user',
        },
      };
      mockGetThreadWithFirstMessage.mockResolvedValue(mockThreadData);
      mockValidateThreadForAutoNaming.mockReturnValue({ eligible: true });
    });

    it('should handle OpenAI API failure', async () => {
      mockGenerateThreadName.mockRejectedValue(new Error('OpenAI API error'));

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
      expect(mockUpdateThreadName).not.toHaveBeenCalled();
    });

    it('should handle OpenAI empty response', async () => {
      mockGenerateThreadName.mockRejectedValue(
        new Error('OpenAI returned empty response')
      );

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle OpenAI rate limiting', async () => {
      mockGenerateThreadName.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Database Errors', () => {
    beforeEach(() => {
      const mockThreadData = {
        thread: {
          id: mockThreadId,
          name: DEFAULT_THREAD_NAME,
          userId: mockUserId,
          updatedAt: new Date(),
        },
        firstMessage: {
          content: 'Hello world',
          role: 'user',
        },
      };
      mockGetThreadWithFirstMessage.mockResolvedValue(mockThreadData);
      mockValidateThreadForAutoNaming.mockReturnValue({ eligible: true });
      mockGenerateThreadName.mockResolvedValue(mockGeneratedName);
    });

    it('should handle database query failure', async () => {
      mockGetThreadWithFirstMessage.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle database update failure', async () => {
      mockUpdateThreadName.mockRejectedValue(
        new Error('Database update failed')
      );

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle transaction rollback', async () => {
      mockUpdateThreadName.mockRejectedValue(new Error('Transaction failed'));

      const request = createRequest({ threadId: mockThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('Malformed Request Handling', () => {
    it('should handle invalid JSON', async () => {
      const request = new NextRequest(
        'http://localhost/api/threads/auto-name',
        {
          method: 'POST',
          body: 'invalid json',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest(
        'http://localhost/api/threads/auto-name',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle extra fields in request body', async () => {
      const mockThreadData = {
        thread: {
          id: mockThreadId,
          name: DEFAULT_THREAD_NAME,
          userId: mockUserId,
          updatedAt: new Date(),
        },
        firstMessage: {
          content: 'Hello world',
          role: 'user',
        },
      };
      mockGetThreadWithFirstMessage.mockResolvedValue(mockThreadData);
      mockValidateThreadForAutoNaming.mockReturnValue({ eligible: true });
      mockGenerateThreadName.mockResolvedValue(mockGeneratedName);
      mockUpdateThreadName.mockResolvedValue(true);

      const request = createRequest({
        threadId: mockThreadId,
        extraField: 'should be ignored',
        anotherField: 123,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long thread IDs', async () => {
      const longThreadId = 'a'.repeat(1000);
      mockGetThreadWithFirstMessage.mockResolvedValue(null);

      const request = createRequest({ threadId: longThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Thread not found');
      expect(mockGetThreadWithFirstMessage).toHaveBeenCalledWith(longThreadId);
    });

    it('should handle unicode thread IDs', async () => {
      const unicodeThreadId = '🚀-thread-id-🎉';
      mockGetThreadWithFirstMessage.mockResolvedValue(null);

      const request = createRequest({ threadId: unicodeThreadId });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Thread not found');
    });
  });
});
