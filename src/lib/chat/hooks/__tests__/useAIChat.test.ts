/**
 * @jest-environment jsdom
 */

// Mock Web APIs needed by AI SDK before any imports
global.TransformStream = class TransformStream {
  readable = {} as ReadableStream;
  writable = {} as WritableStream;
};

if (!global.ReadableStream) {
  // @ts-expect-error - Minimal mock for test environment
  global.ReadableStream = class ReadableStream {};
}

if (!global.WritableStream) {
  // @ts-expect-error - Minimal mock for test environment
  global.WritableStream = class WritableStream {};
}

import { useChat } from '@ai-sdk/react';
import { renderHook } from '@testing-library/react';

import { useSetMessages } from '@/lib/store/thread-store';

import { useAIChat } from '../useAIChat';

// Mock the AI SDK
jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn(),
}));

// Mock the thread store
jest.mock('@/lib/store/thread-store', () => ({
  useSetMessages: jest.fn(),
}));

const mockUseChat = useChat as jest.MockedFunction<typeof useChat>;
const mockUseSetMessages = useSetMessages as jest.MockedFunction<
  typeof useSetMessages
>;

// Mock AI SDK message data that simulates the structure returned by useChat
// These follow the AI SDK's parts-based message format with text content
const mockAIMessage = {
  id: 'ai-msg-1',
  role: 'user' as const,
  parts: [
    {
      type: 'text' as const,
      text: 'Hello AI',
    },
  ],
};

const mockAIMessage2 = {
  id: 'ai-msg-2',
  role: 'assistant' as const,
  parts: [
    {
      type: 'text' as const,
      text: 'Hello human!',
    },
  ],
};

describe('useAIChat', () => {
  const mockSendMessage = jest.fn();
  const mockSetMessages = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseChat.mockReturnValue({
      messages: [],
      status: 'ready',
      sendMessage: mockSendMessage,
    } as unknown as ReturnType<typeof useChat>);

    mockUseSetMessages.mockReturnValue(mockSetMessages);
  });

  describe('initialization', () => {
    it('should initialize AI chat with correct transport config', () => {
      const threadId = 'thread-123';

      renderHook(() => useAIChat(threadId));

      expect(mockUseChat).toHaveBeenCalledWith({
        transport: expect.objectContaining({
          // We can't easily test the DefaultChatTransport internals,
          // but we can verify useChat was called
        }),
      });
    });

    it('should return status and sendMessage from AI SDK', () => {
      const { result } = renderHook(() => useAIChat('thread-123'));

      expect(result.current.status).toBe('ready');
      expect(result.current.sendMessage).toBe(mockSendMessage);
    });
  });

  describe('message syncing', () => {
    it('should sync AI messages to store with timestamps', () => {
      // Configure AI SDK mock to return a message
      mockUseChat.mockReturnValue({
        messages: [mockAIMessage],
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      // Initialize the hook, which should trigger message conversion and store sync
      renderHook(() => useAIChat('thread-123'));

      // Verify that the AI SDK message was converted to application format
      // and passed to the store's setMessages function (wholesale replacement)
      expect(mockSetMessages).toHaveBeenCalledWith([
        {
          id: 'ai-msg-1',
          role: 'user',
          content: 'Hello AI', // Text extracted from parts array
          createdAt: expect.any(String), // Timestamp handling (currently empty)
        },
      ]);
    });

    it('should wholesale replace messages on each useChat update', () => {
      // Start with empty messages
      mockUseChat.mockReturnValue({
        messages: [],
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      const { rerender } = renderHook(() => useAIChat('thread-123'));

      // First call with empty messages
      expect(mockSetMessages).toHaveBeenNthCalledWith(1, []);

      // Update to have one message
      mockUseChat.mockReturnValue({
        messages: [mockAIMessage],
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      rerender();

      // Second call replaces with new message set
      expect(mockSetMessages).toHaveBeenNthCalledWith(2, [
        {
          id: 'ai-msg-1',
          role: 'user',
          content: 'Hello AI',
          createdAt: expect.any(String),
        },
      ]);

      // Update to have different set of messages (simulating backend sync)
      mockUseChat.mockReturnValue({
        messages: [mockAIMessage2], // Different message entirely
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      rerender();

      // Third call wholesale replaces again - old messages are blown away
      expect(mockSetMessages).toHaveBeenNthCalledWith(3, [
        {
          id: 'ai-msg-2',
          role: 'assistant',
          content: 'Hello human!',
          createdAt: expect.any(String),
        },
      ]);

      // Verify setMessages was called 3 times total
      expect(mockSetMessages).toHaveBeenCalledTimes(3);
    });

    it('should handle complete message replacement scenario', () => {
      // This test demonstrates the wholesale replacement behavior
      // that happens when useChat returns a completely different set

      const initialMessages = [mockAIMessage];
      const newMessages = [mockAIMessage2, mockAIMessage]; // Different order/content

      // Start with initial messages
      mockUseChat.mockReturnValue({
        messages: initialMessages,
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      const { rerender } = renderHook(() => useAIChat('thread-123'));

      expect(mockSetMessages).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: 'ai-msg-1' }),
      ]);

      // Backend returns completely new message set
      mockUseChat.mockReturnValue({
        messages: newMessages,
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      rerender();

      // Store is completely replaced, not merged
      expect(mockSetMessages).toHaveBeenLastCalledWith([
        expect.objectContaining({ id: 'ai-msg-2' }),
        expect.objectContaining({ id: 'ai-msg-1' }),
      ]);
    });

    it('should sync multiple messages in correct order', () => {
      mockUseChat.mockReturnValue({
        messages: [mockAIMessage, mockAIMessage2],
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      renderHook(() => useAIChat('thread-123'));

      expect(mockSetMessages).toHaveBeenCalledWith([
        {
          id: 'ai-msg-1',
          role: 'user',
          content: 'Hello AI',
          createdAt: expect.any(String),
        },
        {
          id: 'ai-msg-2',
          role: 'assistant',
          content: 'Hello human!',
          createdAt: expect.any(String),
        },
      ]);
    });

    it('should handle complex message parts', () => {
      const complexMessage = {
        id: 'complex-msg',
        role: 'assistant' as const,
        parts: [
          { type: 'text' as const, text: 'Part 1 ' },
          { type: 'text' as const, text: 'Part 2' },
          { type: 'unknown' as 'text', data: 'ignored' }, // Should be ignored
        ],
      };

      mockUseChat.mockReturnValue({
        messages: [complexMessage],
        status: 'ready',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      renderHook(() => useAIChat('thread-123'));

      expect(mockSetMessages).toHaveBeenCalledWith([
        {
          id: 'complex-msg',
          role: 'assistant',
          content: 'Part 1 Part 2', // Combined text parts, unknown part ignored
          createdAt: expect.any(String),
        },
      ]);
    });
  });

  describe('status handling', () => {
    it('should return streaming status', () => {
      mockUseChat.mockReturnValue({
        messages: [],
        status: 'streaming',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      const { result } = renderHook(() => useAIChat('thread-123'));

      expect(result.current.status).toBe('streaming');
    });

    it('should return submitted status', () => {
      mockUseChat.mockReturnValue({
        messages: [],
        status: 'submitted',
        sendMessage: mockSendMessage,
      } as unknown as ReturnType<typeof useChat>);

      const { result } = renderHook(() => useAIChat('thread-123'));

      expect(result.current.status).toBe('submitted');
    });
  });
});
