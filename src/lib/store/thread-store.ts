import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Thread store state interface
 */
interface ThreadState {
  threadId: string;
  threadName: string;
  messages: ChatMessage[];
}

/**
 * Thread store actions interface
 */
interface ThreadActions {
  setMessages: (messages: ChatMessage[]) => void;

  initializeThread: (
    threadId: string,
    threadName: string,
    messages: ChatMessage[]
  ) => void;
}

/**
 * Combined store interface
 */
type ThreadStore = ThreadState & ThreadActions;

/**
 * Zustand store for managing current thread data.
 *
 * @example
 * ```tsx
 * const { threadId, messages, initializeThread } = useThread();
 * ```
 */
export const useThread = create<ThreadStore>()(
  devtools(
    (set) => ({
      // Initial state
      threadId: '',
      threadName: '',
      messages: [],

      setMessages: (messages) => set({ messages }, false, 'setMessages'),

      initializeThread: (threadId, threadName, messages) =>
        set({ threadId, threadName, messages }, false, 'initializeThread'),
    }),
    {
      name: 'thread-store',
    }
  )
);

/**
 * Selector hooks for specific state parts
 */

/**
 * Hook to get thread ID
 */
export const useThreadId = () => useThread((state) => state.threadId);

/**
 * Hook to get thread name
 */
export const useThreadName = () => useThread((state) => state.threadName);

/**
 * Hook to get messages array
 */
export const useThreadMessages = () => useThread((state) => state.messages);

/**
 * Hook to get setMessages action
 */
export const useSetMessages = () => useThread((state) => state.setMessages);
