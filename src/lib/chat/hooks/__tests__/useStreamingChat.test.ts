/**
 * @jest-environment jsdom
 */
import { TextDecoder, TextEncoder } from 'util';

import { act, renderHook } from '@testing-library/react';

import { useStreamingChat } from '@/lib/chat/hooks/useStreamingChat';
import { ChatMessage } from '@/lib/chat/types';

// Mock the thread store
const mockAddUserMessage = jest.fn();
const mockStartAssistantMessage = jest.fn();
const mockUpdateAssistantMessage = jest.fn();
const mockUseThread = jest.fn();
const mockUseThreadId = jest.fn();

jest.mock('@/lib/store/thread-store', () => ({
  useThread: () => mockUseThread(),
  useThreadId: () => mockUseThreadId(),
}));

// Create local mock functions
const mockFetch = jest.fn();

// Helper to create mock stream data
function createMockStreamData(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('useStreamingChat', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      role: 'user',
      content: 'Hello',
      createdAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockAssistantMessage: ChatMessage = {
    id: 'assistant-123',
    role: 'assistant',
    content: '',
    createdAt: '2024-01-01T00:01:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch and TextDecoder locally
    global.fetch = jest.fn();
    global.TextDecoder = jest.fn().mockImplementation(() => ({
      decode: jest.fn((value: Uint8Array) => new TextDecoder().decode(value)),
    }));
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

    mockUseThreadId.mockReturnValue('thread-123');
    mockUseThread.mockReturnValue({
      messages: mockMessages,
      addUserMessage: mockAddUserMessage,
      startAssistantMessage: mockStartAssistantMessage,
      updateAssistantMessage: mockUpdateAssistantMessage,
    });

    mockAddUserMessage.mockReturnValue({
      id: 'user-456',
      role: 'user',
      content: 'Test message',
      createdAt: '2024-01-01T00:02:00Z',
    });

    mockStartAssistantMessage.mockReturnValue(mockAssistantMessage);
  });

  afterEach(() => {
    // Restore all mocks after each test
    jest.restoreAllMocks();
  });

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useStreamingChat());

    expect(result.current.status).toBe('idle');
    expect(typeof result.current.sendMessage).toBe('function');
  });

  it('should not send empty messages', async () => {
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Cannot send empty message');
    expect(mockAddUserMessage).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');

    consoleSpy.mockRestore();
  });

  it('should not send message without thread ID', async () => {
    mockUseThreadId.mockReturnValue('');
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Cannot send message: no thread ID available'
    );
    expect(mockAddUserMessage).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');

    consoleSpy.mockRestore();
  });

  it('should handle successful streaming', async () => {
    const { result } = renderHook(() => useStreamingChat());

    // Mock successful fetch response with streaming body
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('{"type":"chunk","content":"Hello"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('{"type":"chunk","content":" world"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('{"type":"complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Verify user message was added
    expect(mockAddUserMessage).toHaveBeenCalledWith('Test message');

    // Verify assistant message was started
    expect(mockStartAssistantMessage).toHaveBeenCalled();

    // Verify API call was made
    expect(mockFetch).toHaveBeenCalledWith('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Test message',
        threadId: 'thread-123',
      }),
    });

    // Verify assistant message was updated with accumulated content
    expect(mockUpdateAssistantMessage).toHaveBeenCalledWith(
      'assistant-123',
      'Hello'
    );
    expect(mockUpdateAssistantMessage).toHaveBeenCalledWith(
      'assistant-123',
      'Hello world'
    );

    // Verify final status is idle
    expect(result.current.status).toBe('idle');
  });

  it('should handle API errors', async () => {
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockResponse = {
      ok: false,
      json: async () => ({ error: 'API rate limit exceeded' }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Chat streaming error:',
      expect.any(Error)
    );
    expect(mockUpdateAssistantMessage).toHaveBeenCalledWith(
      'assistant-123',
      'API rate limit exceeded'
    );
    expect(result.current.status).toBe('error');

    consoleSpy.mockRestore();
  });

  it('should handle streaming errors', async () => {
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData(
            '{"type":"error","error":"Stream failed"}\n'
          ),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Chat streaming error:',
      expect.any(Error)
    );
    expect(mockUpdateAssistantMessage).toHaveBeenCalledWith(
      'assistant-123',
      'Stream failed'
    );
    expect(result.current.status).toBe('error');

    consoleSpy.mockRestore();
  });

  it('should handle malformed JSON gracefully', async () => {
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('invalid json\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('{"type":"chunk","content":"Hello"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('{"type":"complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Should warn about malformed JSON but continue processing
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse JSON line:',
      'invalid json',
      expect.any(Error)
    );

    // Should still process valid JSON
    expect(mockUpdateAssistantMessage).toHaveBeenCalledWith(
      'assistant-123',
      'Hello'
    );
    expect(result.current.status).toBe('idle');

    consoleSpy.mockRestore();
  });

  it('should handle incomplete JSON lines in buffer', async () => {
    const { result } = renderHook(() => useStreamingChat());

    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('{"type":"chunk","con'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: createMockStreamData('tent":"Hello"}\n{"type":"complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    // Should handle partial JSON correctly
    expect(mockUpdateAssistantMessage).toHaveBeenCalledWith(
      'assistant-123',
      'Hello'
    );
    expect(result.current.status).toBe('idle');
  });

  it('should reset error status after delay', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockResponse = {
      ok: false,
      json: async () => ({ error: 'Test error' }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(result.current.status).toBe('error');

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.status).toBe('idle');

    consoleSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should trim message content', async () => {
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockResponse = {
      ok: false,
      json: async () => ({ error: 'Test error' }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('  Test message  ');
    });

    expect(mockAddUserMessage).toHaveBeenCalledWith('Test message');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        body: JSON.stringify({
          message: 'Test message',
          threadId: 'thread-123',
        }),
      })
    );

    consoleSpy.mockRestore();
  });

  it('should handle no response body', async () => {
    const { result } = renderHook(() => useStreamingChat());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const mockResponse = {
      ok: true,
      body: null,
    };

    mockFetch.mockResolvedValue(mockResponse);

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Chat streaming error:',
      expect.any(Error)
    );
    expect(result.current.status).toBe('error');

    consoleSpy.mockRestore();
  });
});
