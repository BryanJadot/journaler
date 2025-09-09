/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { ChatMessage } from '@/lib/chat/types';

import {
  useNewMessages,
  useThread,
  useThreadId,
  useThreadMessages,
  useThreadName,
} from '../thread-store';

// Mock message data for testing store operations
// These represent typical user and assistant messages
const mockMessage1: ChatMessage = {
  id: '1',
  role: 'user',
  content: 'Hello',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockMessage2: ChatMessage = {
  id: '2',
  role: 'assistant',
  content: 'Hi there!',
  createdAt: '2024-01-01T00:01:00Z',
};

describe('thread-store', () => {
  beforeEach(() => {
    // Reset store state before each test to ensure test isolation
    // This prevents test interdependencies and ensures consistent starting state
    const { result } = renderHook(() => useThread());
    act(() => {
      result.current.initializeThread('', '', []);
    });
  });

  describe('useThread', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useThread());

      expect(result.current.threadId).toBe('');
      expect(result.current.threadName).toBe('');
      expect(result.current.messages).toEqual([]);
    });

    it('should initialize thread with provided data', () => {
      const { result } = renderHook(() => useThread());

      act(() => {
        result.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
          mockMessage2,
        ]);
      });

      expect(result.current.threadId).toBe('thread-123');
      expect(result.current.threadName).toBe('Test Thread');
      expect(result.current.messages).toEqual([mockMessage1, mockMessage2]);
    });
  });

  describe('message actions', () => {
    it('should set messages wholesale', () => {
      const { result: storeResult } = renderHook(() => useThread());

      // Initialize thread with one message to establish baseline
      act(() => {
        storeResult.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
        ]);
      });

      expect(storeResult.current.messages).toEqual([mockMessage1]);

      // Test wholesale replacement behavior - this is the key architectural decision
      // Instead of adding/updating individual messages, we replace the entire array
      // This simulates how initialization syncs complete message state from server
      act(() => {
        storeResult.current.setMessages([mockMessage2]); // Complete replacement, not merge
      });

      // Verify old message is gone and new message is present
      // This demonstrates the "source of truth" pattern where external systems
      // (like server initialization) provide complete state that replaces our local state
      expect(storeResult.current.messages).toEqual([mockMessage2]);
    });

    it('should add user message with timestamp', () => {
      const { result } = renderHook(() => useThread());

      act(() => {
        result.current.initializeThread('thread-123', 'Test Thread', []);
      });

      let userMessage: ChatMessage;
      act(() => {
        userMessage = result.current.addUserMessage('Hello, world!');
      });

      // Verify message was added to store
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(userMessage!);

      // Verify message has correct properties
      expect(userMessage!.role).toBe('user');
      expect(userMessage!.content).toBe('Hello, world!');
      expect(userMessage!.id).toMatch(/^user-\d+-[a-z0-9]+$/);
      expect(userMessage!.createdAt).toBeDefined();
      expect(new Date(userMessage!.createdAt)).toBeInstanceOf(Date);
    });

    it('should start assistant message with timestamp', () => {
      const { result } = renderHook(() => useThread());

      act(() => {
        result.current.initializeThread('thread-123', 'Test Thread', []);
      });

      let assistantMessage: ChatMessage;
      act(() => {
        assistantMessage = result.current.startAssistantMessage();
      });

      // Verify message was added to store
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(assistantMessage!);

      // Verify message has correct properties
      expect(assistantMessage!.role).toBe('assistant');
      expect(assistantMessage!.content).toBe(''); // Empty initially for streaming
      expect(assistantMessage!.id).toMatch(/^assistant-\d+-[a-z0-9]+$/);
      expect(assistantMessage!.createdAt).toBeDefined();
      expect(new Date(assistantMessage!.createdAt)).toBeInstanceOf(Date);
    });

    it('should update assistant message content', () => {
      const { result } = renderHook(() => useThread());

      act(() => {
        result.current.initializeThread('thread-123', 'Test Thread', []);
      });

      let assistantMessage: ChatMessage;
      act(() => {
        assistantMessage = result.current.startAssistantMessage();
      });

      // Update the assistant message content
      act(() => {
        result.current.updateAssistantMessage(
          assistantMessage!.id,
          'Hello back!'
        );
      });

      // Verify message content was updated
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello back!');
      expect(result.current.messages[0].id).toBe(assistantMessage!.id);
      expect(result.current.messages[0].createdAt).toBe(
        assistantMessage!.createdAt
      );
    });

    it('should handle streaming conversation flow', () => {
      const { result } = renderHook(() => useThread());

      act(() => {
        result.current.initializeThread('thread-123', 'Test Thread', []);
      });

      // User sends message
      let userMessage: ChatMessage;
      act(() => {
        userMessage = result.current.addUserMessage('What is 2+2?');
      });

      // Assistant message starts streaming
      let assistantMessage: ChatMessage;
      act(() => {
        assistantMessage = result.current.startAssistantMessage();
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toEqual(userMessage!);
      expect(result.current.messages[1]).toEqual(assistantMessage!);

      // Streaming content updates
      act(() => {
        result.current.updateAssistantMessage(assistantMessage!.id, '2');
      });

      act(() => {
        result.current.updateAssistantMessage(assistantMessage!.id, '2+2');
      });

      act(() => {
        result.current.updateAssistantMessage(
          assistantMessage!.id,
          '2+2 equals 4'
        );
      });

      // Verify final state
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe('2+2 equals 4');
      expect(result.current.messages[1].id).toBe(assistantMessage!.id);
      expect(result.current.messages[1].createdAt).toBe(
        assistantMessage!.createdAt
      );
    });

    it('should not update non-existent message', () => {
      const { result } = renderHook(() => useThread());

      act(() => {
        result.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
        ]);
      });

      // Try to update a message that doesn't exist
      act(() => {
        result.current.updateAssistantMessage('non-existent-id', 'New content');
      });

      // Original message should be unchanged
      expect(result.current.messages).toEqual([mockMessage1]);
    });

    it('should track new messages separately from initial messages', () => {
      const { result: threadResult } = renderHook(() => useThread());
      const { result: newMessagesResult } = renderHook(() => useNewMessages());

      // Initialize with existing messages (should not be tracked as new)
      act(() => {
        threadResult.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
        ]);
      });

      expect(threadResult.current.messages).toEqual([mockMessage1]);
      expect(newMessagesResult.current).toEqual([]); // Initial messages are not "new"

      // Add a user message (should be tracked as new)
      let userMessage: ChatMessage;
      act(() => {
        userMessage = threadResult.current.addUserMessage('New user message');
      });

      // Add an assistant message (should be tracked as new)
      let assistantMessage: ChatMessage;
      act(() => {
        assistantMessage = threadResult.current.startAssistantMessage();
      });

      // All messages should be in the main array
      expect(threadResult.current.messages).toHaveLength(3);
      expect(threadResult.current.messages).toEqual([
        mockMessage1,
        userMessage!,
        assistantMessage!,
      ]);

      // Only the new messages should be in newMessages
      expect(newMessagesResult.current).toHaveLength(2);
      expect(newMessagesResult.current).toEqual([
        userMessage!,
        assistantMessage!,
      ]);
    });

    it('should reset new message tracking when thread is reinitialized', () => {
      const { result: threadResult } = renderHook(() => useThread());
      const { result: newMessagesResult } = renderHook(() => useNewMessages());

      // Add some new messages first
      act(() => {
        threadResult.current.initializeThread('thread-123', 'Test Thread', []);
        threadResult.current.addUserMessage('Message 1');
        threadResult.current.addUserMessage('Message 2');
      });

      expect(newMessagesResult.current).toHaveLength(2);

      // Reinitialize thread with new data
      act(() => {
        threadResult.current.initializeThread('thread-456', 'New Thread', [
          mockMessage1,
        ]);
      });

      // New messages should be reset
      expect(threadResult.current.messages).toEqual([mockMessage1]);
      expect(newMessagesResult.current).toEqual([]); // Should be empty after reinitialize
    });
  });

  describe('selector hooks', () => {
    it('should return thread ID', () => {
      const { result: storeResult } = renderHook(() => useThread());
      const { result: idResult } = renderHook(() => useThreadId());

      act(() => {
        storeResult.current.initializeThread('thread-123', 'Test Thread', []);
      });

      expect(idResult.current).toBe('thread-123');
    });

    it('should return thread name', () => {
      const { result: storeResult } = renderHook(() => useThread());
      const { result: nameResult } = renderHook(() => useThreadName());

      act(() => {
        storeResult.current.initializeThread('thread-123', 'Test Thread', []);
      });

      expect(nameResult.current).toBe('Test Thread');
    });

    it('should return messages', () => {
      const { result: storeResult } = renderHook(() => useThread());
      const { result: messagesResult } = renderHook(() => useThreadMessages());

      act(() => {
        storeResult.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
        ]);
      });

      expect(messagesResult.current).toEqual([mockMessage1]);
    });
  });

  describe('store persistence', () => {
    it('should maintain state across different hook calls', () => {
      // Test that Zustand store maintains global state correctly
      // This verifies the singleton store pattern works as expected

      // Initialize state in one component/hook
      const { result: initResult } = renderHook(() => useThread());
      act(() => {
        initResult.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
        ]);
      });

      // Read state from different components/hooks using selectors
      // This simulates how different UI components access the same store
      const { result: readResult } = renderHook(() => ({
        id: useThreadId(),
        name: useThreadName(),
        messages: useThreadMessages(),
      }));

      // All components should see the same shared state
      expect(readResult.current.id).toBe('thread-123');
      expect(readResult.current.name).toBe('Test Thread');
      expect(readResult.current.messages).toEqual([mockMessage1]);
    });

    it('should update all selectors when state changes', () => {
      // Test that selector hooks properly subscribe to state changes
      // This verifies the reactivity of our granular selector pattern

      const { result: storeResult } = renderHook(() => useThread());
      const { result: selectorsResult } = renderHook(() => ({
        id: useThreadId(),
        name: useThreadName(),
        messages: useThreadMessages(),
      }));

      // Verify initial empty state
      expect(selectorsResult.current.id).toBe('');
      expect(selectorsResult.current.name).toBe('');
      expect(selectorsResult.current.messages).toEqual([]);

      // Update state atomically using initializeThread
      act(() => {
        storeResult.current.initializeThread('new-thread', 'New Thread', [
          mockMessage1,
        ]);
      });

      // All selectors should immediately reflect the new state
      // This demonstrates that our selector hooks properly subscribe to changes
      // and that state updates are atomic (all or nothing)
      expect(selectorsResult.current.id).toBe('new-thread');
      expect(selectorsResult.current.name).toBe('New Thread');
      expect(selectorsResult.current.messages).toEqual([mockMessage1]);
    });
  });
});
