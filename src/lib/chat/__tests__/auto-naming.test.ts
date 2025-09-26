import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import {
  validateThreadForAutoNaming,
  generateThreadName,
} from '@/lib/chat/auto-naming';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import type { ThreadWithFirstMessage } from '@/lib/db/threads';

// Mock the openaiClient
jest.mock('@/lib/openai/client', () => ({
  openaiClient: {
    responses: {
      create: jest.fn(),
    },
  },
}));

describe('Auto-naming Service', () => {
  describe('validateThreadForAutoNaming', () => {
    const mockUserId = 'user-123';
    const baseThreadData: ThreadWithFirstMessage = {
      thread: {
        id: 'thread-456',
        name: DEFAULT_THREAD_NAME,
        userId: mockUserId,
        updatedAt: new Date(),
      },
      firstMessage: {
        content: 'Hello, how can you help me?',
        role: 'user',
      },
    };

    it('should return eligible for valid thread data', () => {
      const result = validateThreadForAutoNaming(baseThreadData, mockUserId);

      expect(result).toEqual({ eligible: true });
    });

    it('should reject thread that belongs to different user', () => {
      const threadData = {
        ...baseThreadData,
        thread: { ...baseThreadData.thread, userId: 'different-user' },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'Thread not found',
        statusCode: 404,
      });
    });

    it('should reject thread that already has custom name', () => {
      const threadData = {
        ...baseThreadData,
        thread: { ...baseThreadData.thread, name: 'Custom Thread Name' },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'Thread already has a custom name',
        statusCode: 409,
      });
    });

    it('should reject thread with no first message', () => {
      const threadData = {
        ...baseThreadData,
        firstMessage: null,
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'No user message found to base name on',
        statusCode: 422,
      });
    });

    it('should reject thread where first message is not from user', () => {
      const threadData = {
        ...baseThreadData,
        firstMessage: {
          content: 'Hello from assistant',
          role: 'assistant',
        },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'No user message found to base name on',
        statusCode: 422,
      });
    });

    it('should reject thread where first message is from developer', () => {
      const threadData = {
        ...baseThreadData,
        firstMessage: {
          content: 'Debug message',
          role: 'developer',
        },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'No user message found to base name on',
        statusCode: 422,
      });
    });

    it('should handle empty user ID', () => {
      const result = validateThreadForAutoNaming(baseThreadData, '');

      expect(result).toEqual({
        eligible: false,
        reason: 'Thread not found',
        statusCode: 404,
      });
    });

    it('should handle thread with empty name (should still be default)', () => {
      const threadData = {
        ...baseThreadData,
        thread: { ...baseThreadData.thread, name: '' },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'Thread already has a custom name',
        statusCode: 409,
      });
    });

    it('should handle whitespace-only names as custom names', () => {
      const threadData = {
        ...baseThreadData,
        thread: { ...baseThreadData.thread, name: '   ' },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({
        eligible: false,
        reason: 'Thread already has a custom name',
        statusCode: 409,
      });
    });

    it('should handle very long user message content', () => {
      const threadData = {
        ...baseThreadData,
        firstMessage: {
          content: 'x'.repeat(10000),
          role: 'user',
        },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({ eligible: true });
    });

    it('should handle empty user message content', () => {
      const threadData = {
        ...baseThreadData,
        firstMessage: {
          content: '',
          role: 'user',
        },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({ eligible: true });
    });

    it('should handle special characters in message content', () => {
      const threadData = {
        ...baseThreadData,
        firstMessage: {
          content: 'Hello! How are you? 🚀 Let\'s chat about "AI" & <coding>',
          role: 'user',
        },
      };

      const result = validateThreadForAutoNaming(threadData, mockUserId);

      expect(result).toEqual({ eligible: true });
    });
  });

  describe('generateThreadName', () => {
    // Get the mocked create function
    const mockOpenaiClient = jest.requireMock('@/lib/openai/client') as {
      openaiClient: {
        responses: {
          create: jest.MockedFunction<
            (
              input: unknown
            ) => Promise<{ output_text?: string | null | undefined }>
          >;
        };
      };
    };
    const mockCreate = mockOpenaiClient.openaiClient.responses.create;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate a thread name successfully', async () => {
      const mockResponse = {
        output_text: 'Help with JavaScript',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName(
        'Can you help me with JavaScript?'
      );

      expect(result).toBe('Help with JavaScript');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'user',
            content: 'Can you help me with JavaScript?',
          },
        ],
        instructions:
          'Generate a concise, descriptive title for a conversation that starts with this user message. The title should capture the main topic or intent. Maximum 50 characters. Return only the title, no quotes or extra formatting.',
        reasoning: {
          effort: 'low',
        },
        text: {
          verbosity: 'low',
        },
      });
    });

    it('should handle empty message content', async () => {
      const mockResponse = {
        output_text: 'New Conversation',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName('');

      expect(result).toBe('New Conversation');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: '' }],
        })
      );
    });

    it('should handle very long message content', async () => {
      const longMessage = 'x'.repeat(5000);
      const mockResponse = {
        output_text: 'Long Message Discussion',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName(longMessage);

      expect(result).toBe('Long Message Discussion');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: longMessage }],
        })
      );
    });

    it('should trim whitespace from generated name', async () => {
      const mockResponse = {
        output_text: '  JavaScript Help  ',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName('JavaScript question');

      expect(result).toBe('JavaScript Help');
    });

    it('should throw error when OpenAI returns empty response', async () => {
      const mockResponse = {
        output_text: '',
      };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'OpenAI returned empty response'
      );
    });

    it('should throw error when OpenAI returns null content', async () => {
      const mockResponse = {
        output_text: null,
      };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'OpenAI returned empty response'
      );
    });

    it('should throw error when OpenAI returns undefined content', async () => {
      const mockResponse = {
        output_text: undefined,
      };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'OpenAI returned empty response'
      );
    });

    it('should throw error when generated name exceeds 100 characters', async () => {
      const longName = 'x'.repeat(101);
      const mockResponse = {
        output_text: longName,
      };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateThreadName('Test message')).rejects.toThrow(
        `Generated name exceeds 100 characters: "${longName}"`
      );
    });

    it('should accept generated name exactly at 100 characters', async () => {
      const exactlyHundredChars = 'x'.repeat(100);
      const mockResponse = {
        output_text: exactlyHundredChars,
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName('Test message');

      expect(result).toBe(exactlyHundredChars);
      expect(result.length).toBe(100);
    });

    it('should handle OpenAI API errors', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API Error'));

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'OpenAI API Error'
      );
    });

    it('should handle network errors', async () => {
      mockCreate.mockRejectedValue(new Error('Network Error'));

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'Network Error'
      );
    });

    it('should handle rate limiting errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should handle special characters in message content', async () => {
      const specialMessage =
        'How to handle "quotes" & <tags> in JavaScript? 🚀';
      const mockResponse = {
        output_text: 'JavaScript Special Characters',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName(specialMessage);

      expect(result).toBe('JavaScript Special Characters');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: [{ role: 'user', content: specialMessage }],
        })
      );
    });

    it('should handle unicode characters in message content', async () => {
      const unicodeMessage = '你好，AI能帮我学习编程吗？🤖';
      const mockResponse = {
        output_text: 'Programming Learning Help',
      };
      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateThreadName(unicodeMessage);

      expect(result).toBe('Programming Learning Help');
    });

    it('should handle malformed OpenAI response structure', async () => {
      const mockResponse = {};
      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'OpenAI returned empty response'
      );
    });

    it('should handle missing output_text in OpenAI response', async () => {
      const mockResponse = { output_text: undefined };
      mockCreate.mockResolvedValue(mockResponse);

      await expect(generateThreadName('Test message')).rejects.toThrow(
        'OpenAI returned empty response'
      );
    });
  });
});
