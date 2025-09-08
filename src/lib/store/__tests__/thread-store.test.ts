/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { ChatMessage } from '@/lib/chat/types';

import {
  useSetMessages,
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
      const setMessages = renderHook(() => useSetMessages()).result.current;

      // Initialize thread with one message to establish baseline
      act(() => {
        storeResult.current.initializeThread('thread-123', 'Test Thread', [
          mockMessage1,
        ]);
      });

      expect(storeResult.current.messages).toEqual([mockMessage1]);

      // Test wholesale replacement behavior - this is the key architectural decision
      // Instead of adding/updating individual messages, we replace the entire array
      // This simulates how useAIChat syncs complete message state from AI SDK
      act(() => {
        setMessages([mockMessage2]); // Complete replacement, not merge
      });

      // Verify old message is gone and new message is present
      // This demonstrates the "source of truth" pattern where external systems
      // (like AI SDK) provide complete state that replaces our local state
      expect(storeResult.current.messages).toEqual([mockMessage2]);
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
