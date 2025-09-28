import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import OpenAI from 'openai';

import {
  streamOpenAITokens,
  THERAPY_ASSISTANT_PROMPT_ID,
} from '@/app/api/chat/stream-openai-tokens';
import { ChatMessage } from '@/lib/chat/types';

describe('streamOpenAITokens', () => {
  let mockClient: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should convert chat messages to OpenAI format correctly', async () => {
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

    const newMessage = 'How are you?';

    // Create mock stream that returns an async iterable
    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        // Empty stream for this test
      },
    };

    // Create mock client with responses.stream method
    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);

    // Consume the generator to trigger the API call
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(mockClient.responses.stream).toHaveBeenCalledWith({
      prompt: {
        id: THERAPY_ASSISTANT_PROMPT_ID,
      },
      model: 'gpt-5-mini',
      reasoning: { effort: 'low' },
      text: { verbosity: 'medium' },
      input: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ],
    });
  });

  it('should yield text deltas from stream', async () => {
    const history: ChatMessage[] = [];
    const newMessage = 'Test message';

    // Create mock stream that yields text deltas
    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'response.output_text.delta', delta: 'Hello' };
        yield { type: 'response.output_text.delta', delta: ' world' };
        yield { type: 'response.output_text.delta', delta: '!' };
        yield { type: 'response.completed' };
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);
    const results = [];

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(['Hello', ' world', '!']);
  });

  it('should handle empty history', async () => {
    const history: ChatMessage[] = [];
    const newMessage = 'First message';

    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'response.output_text.delta', delta: 'Response' };
        yield { type: 'response.completed' };
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);

    // Consume generator
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(mockClient.responses.stream).toHaveBeenCalledWith({
      prompt: {
        id: THERAPY_ASSISTANT_PROMPT_ID,
      },
      model: 'gpt-5-mini',
      reasoning: { effort: 'low' },
      text: { verbosity: 'medium' },
      input: [{ role: 'user', content: 'First message' }],
    });
  });

  it('should throw error when stream returns error event', async () => {
    const history: ChatMessage[] = [];
    const newMessage = 'Test message';

    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: 'response.failed',
          response: { error: { message: 'API rate limit exceeded' } },
        };
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);

    await expect(async () => {
      for await (const _chunk of generator) {
        // Should throw before yielding anything
      }
    }).rejects.toThrow('OpenAI response failed: API rate limit exceeded');
  });

  it('should stop generating when response.completed is received', async () => {
    const history: ChatMessage[] = [];
    const newMessage = 'Test message';

    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'response.output_text.delta', delta: 'First' };
        yield { type: 'response.completed' };
        yield {
          type: 'response.output_text.delta',
          delta: 'Should not appear',
        };
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);
    const results = [];

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(['First']);
  });

  it('should ignore non-delta events', async () => {
    const history: ChatMessage[] = [];
    const newMessage = 'Test message';

    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'response.start' };
        yield { type: 'response.output_text.delta', delta: 'Hello' };
        yield { type: 'response.some_other_event', data: 'ignored' };
        yield { type: 'response.output_text.delta', delta: ' world' };
        yield { type: 'response.completed' };
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);
    const results = [];

    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(['Hello', ' world']);
  });

  it('should handle mixed role conversation', async () => {
    const history: ChatMessage[] = [
      {
        id: '1',
        role: 'system',
        content: 'You are helpful',
        createdAt: '2023-01-01T00:00:00Z',
      },
      {
        id: '2',
        role: 'user',
        content: 'Hi',
        createdAt: '2023-01-01T00:01:00Z',
      },
      {
        id: '3',
        role: 'assistant',
        content: 'Hello!',
        createdAt: '2023-01-01T00:02:00Z',
      },
    ];

    const newMessage = 'How can you help?';

    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        // Empty stream
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, history, newMessage);

    // Consume to trigger API call
    for await (const _chunk of generator) {
      // Empty
    }

    expect(mockClient.responses.stream).toHaveBeenCalledWith({
      prompt: {
        id: THERAPY_ASSISTANT_PROMPT_ID,
      },
      model: 'gpt-5-mini',
      reasoning: { effort: 'low' },
      text: { verbosity: 'medium' },
      input: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'How can you help?' },
      ],
    });
  });

  it('should use the provided client', async () => {
    const mockStreamIterable = {
      [Symbol.asyncIterator]: async function* () {
        yield { type: 'response.output_text.delta', delta: 'Test' };
        yield { type: 'response.completed' };
      },
    };

    mockClient = {
      responses: {
        stream: jest.fn().mockReturnValue(mockStreamIterable),
      },
    } as unknown as jest.Mocked<OpenAI>;

    const generator = streamOpenAITokens(mockClient, [], 'Test message');

    // Consume generator to trigger client usage
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(mockClient.responses.stream).toHaveBeenCalledWith({
      prompt: {
        id: THERAPY_ASSISTANT_PROMPT_ID,
      },
      model: 'gpt-5-mini',
      reasoning: { effort: 'low' },
      text: { verbosity: 'medium' },
      input: [{ role: 'user', content: 'Test message' }],
    });
    expect(results).toEqual(['Test']);
  });
});
