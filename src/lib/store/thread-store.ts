import { useMemo } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Thread store state interface
 *
 * Manages the current chat thread's state including messages and new message tracking.
 * The newMessageIds Set is crucial for preventing double rendering in hybrid SSR/client scenarios.
 */
interface ThreadState {
  /** Unique identifier for the current thread */
  threadId: string;
  /** Human-readable name/title for the thread */
  threadName: string;
  /** Complete array of all messages in chronological order */
  messages: ChatMessage[];
  /**
   * Set of message IDs that were added during the current client session.
   * This enables hybrid rendering where server renders initial messages
   * and client only renders newly added messages to prevent duplication.
   */
  newMessageIds: Set<string>;
  /** Current value of the chat input field */
  inputValue: string;
  /** Currently selected text from assistant messages */
  selectedText: string | null;
  /** Position for the selection tooltip relative to viewport */
  tooltipPosition: { top: number; left: number } | null;
}

/**
 * Thread store actions interface
 *
 * Defines all operations for managing thread state, designed to support
 * streaming chat with proper message lifecycle management. Actions are organized
 * around the chat message lifecycle: adding user messages, creating assistant
 * message placeholders, updating streaming content, and managing text selection
 * for quoting functionality.
 */
interface ThreadActions {
  /**
   * Wholesale replacement of messages array (used for server initialization).
   * Does not add to newMessageIds since these are existing server messages.
   * @param messages - Complete array of messages to set
   */
  setMessages: (messages: ChatMessage[]) => void;

  /**
   * Adds a user message with timestamp and tracks as "new" for hybrid rendering.
   * Automatically generates unique ID and current timestamp.
   * @param content - The user's message content
   * @returns The created ChatMessage with generated ID
   */
  addUserMessage: (content: string) => ChatMessage;

  /**
   * Creates an empty assistant message placeholder for streaming responses.
   * Marks as "new" and returns message for streaming updates.
   * @returns The created assistant ChatMessage with empty content
   */
  startAssistantMessage: () => ChatMessage;

  /**
   * Updates an existing assistant message's content during streaming.
   * Used to append tokens as they arrive from the AI API.
   * @param messageId - ID of the message to update
   * @param content - New complete content (not incremental)
   */
  updateAssistantMessage: (messageId: string, content: string) => void;

  /**
   * Initializes thread with server data, clearing newMessageIds.
   * Used when loading a thread from the database on page load.
   * @param threadId - Unique thread identifier
   * @param threadName - Display name for the thread
   * @param messages - Initial messages from server (not marked as "new")
   */
  initializeThread: (
    threadId: string,
    threadName: string,
    messages: ChatMessage[]
  ) => void;

  /**
   * Updates the chat input field value.
   * @param value - The new input value
   */
  setInputValue: (value: string) => void;

  /**
   * Sets the selected text and tooltip position for quoting.
   * @param text - The selected text from an assistant message
   * @param position - The viewport position for the tooltip
   */
  setSelectionAndTooltipPosition: (
    text: string,
    position: { top: number; left: number }
  ) => void;

  /**
   * Clears the current selection and hides the tooltip.
   */
  clearSelection: () => void;

  /**
   * Quotes the selected text into the chat input with markdown formatting.
   * Formats multi-line selections with > prefix on each line.
   */
  quoteSelection: () => void;
}

/**
 * Combined store interface
 */
type ThreadStore = ThreadState & ThreadActions;

/**
 * Zustand store for managing current thread data with hybrid SSR support.
 *
 * This store implements a sophisticated message tracking system using newMessageIds
 * to distinguish between server-rendered messages and client-added messages.
 * This prevents double rendering in hybrid applications where:
 * - Server renders initial messages on page load
 * - Client adds new messages during the session
 * - Components can selectively render only new messages
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { threadId, messages, initializeThread } = useThread();
 *
 * // Hybrid rendering pattern
 * const allMessages = useThreadMessages(); // Server + client messages
 * const newMessages = useNewMessages(); // Only client-added messages
 * ```
 */
export const useThread = create<ThreadStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      threadId: '',
      threadName: '',
      messages: [],
      newMessageIds: new Set(),
      inputValue: '',
      selectedText: null,
      tooltipPosition: null,

      setMessages: (messages) => set({ messages }, false, 'setMessages'),

      addUserMessage: (content) => {
        // Generate unique ID using timestamp + random string for collision resistance
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
        };

        set(
          (state) => ({
            messages: [...state.messages, userMessage],
            // Add to newMessageIds Set to track this as a client-added message
            // This enables hybrid rendering where client components can show only new messages
            newMessageIds: new Set([...state.newMessageIds, userMessage.id]),
          }),
          false,
          'addUserMessage'
        );

        return userMessage;
      },

      startAssistantMessage: () => {
        // Create placeholder message for streaming AI response
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: '', // Empty content will be populated via streaming
          createdAt: new Date().toISOString(),
        };

        set(
          (state) => ({
            messages: [...state.messages, assistantMessage],
            // Mark as new message so client components can render it immediately
            // even while content is still streaming in
            newMessageIds: new Set([
              ...state.newMessageIds,
              assistantMessage.id,
            ]),
          }),
          false,
          'startAssistantMessage'
        );

        return assistantMessage;
      },

      updateAssistantMessage: (messageId, content) => {
        set(
          (state) => ({
            // Update message content while preserving all other properties
            // This is called repeatedly during streaming to append new tokens
            messages: state.messages.map((msg) =>
              msg.id === messageId ? { ...msg, content } : msg
            ),
            // Note: We don't modify newMessageIds here since the message
            // was already added to the set in startAssistantMessage
          }),
          false,
          'updateAssistantMessage'
        );
      },

      initializeThread: (threadId, threadName, messages) =>
        // Initialize with server data and reset all state
        // This ensures a clean slate when loading a thread
        set(
          {
            threadId,
            threadName,
            messages,
            newMessageIds: new Set(),
            inputValue: '',
            selectedText: null,
            tooltipPosition: null,
          },
          false,
          'initializeThread'
        ),

      setInputValue: (value) =>
        set({ inputValue: value }, false, 'setInputValue'),

      setSelectionAndTooltipPosition: (text, position) =>
        set(
          { selectedText: text, tooltipPosition: position },
          false,
          'setSelectionAndTooltipPosition'
        ),

      clearSelection: () =>
        set(
          { selectedText: null, tooltipPosition: null },
          false,
          'clearSelection'
        ),

      quoteSelection: () => {
        const state = get();
        if (!state.selectedText) return;

        // Format the selected text as a markdown quote
        const lines = state.selectedText.split('\n');
        const quoted = lines.map((line) => `> ${line}`).join('\n');

        // Smart formatting: no preceding newline if input is empty
        const newInput = state.inputValue
          ? state.inputValue + '\n' + quoted + '\n\n'
          : quoted + '\n\n';

        set(
          {
            inputValue: newInput,
            selectedText: null,
            tooltipPosition: null,
          },
          false,
          'quoteSelection'
        );
      },
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
 * Hook to get only new messages (added during current client session).
 *
 * This is the key to hybrid SSR/client rendering - it returns only messages
 * that were added after the initial server render. This prevents double
 * rendering where server renders initial messages and client tries to
 * render them again.
 *
 * Use this hook in client components that should only show newly added
 * messages, while server components render the initial message history.
 *
 * @returns Array of ChatMessage objects that were added during this session
 *
 * @example
 * ```tsx
 * // In a client component - only render new messages
 * const newMessages = useNewMessages();
 *
 * // vs useThreadMessages() which returns ALL messages including server ones
 * const allMessages = useThreadMessages();
 * ```
 */
export const useNewMessages = () => {
  const messages = useThread((state) => state.messages);
  const newMessageIds = useThread((state) => state.newMessageIds);

  // Memoize the filtered array to prevent infinite re-renders
  // Only recalculate when messages or newMessageIds change
  return useMemo(
    () => messages.filter((msg) => newMessageIds.has(msg.id)),
    [messages, newMessageIds]
  );
};

/**
 * Hook to get the chat input value
 */
export const useInputValue = () => useThread((state) => state.inputValue);

/**
 * Hook to set the chat input value
 */
export const useSetInputValue = () => useThread((state) => state.setInputValue);

/**
 * Hook to get the selected text
 */
export const useSelectedText = () => useThread((state) => state.selectedText);

/**
 * Hook to get the tooltip position
 */
export const useTooltipPosition = () =>
  useThread((state) => state.tooltipPosition);

/**
 * Hook to set selection and tooltip position
 */
export const useSetSelectionAndTooltipPosition = () =>
  useThread((state) => state.setSelectionAndTooltipPosition);

/**
 * Hook to clear selection
 */
export const useClearSelection = () =>
  useThread((state) => state.clearSelection);

/**
 * Hook to quote the current selection
 */
export const useQuoteSelection = () =>
  useThread((state) => state.quoteSelection);
