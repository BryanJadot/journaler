'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

import { getThreadNameAction } from '@/app/journal/chat/actions';
import { DEFAULT_THREAD_NAME } from '@/lib/chat/constants';
import {
  useThreadId,
  useThreadMessages,
  useThreadName,
} from '@/lib/store/thread-store';

/**
 * Custom hook that intelligently polls for thread name updates after the first message is sent.
 *
 * This hook implements a sophisticated polling mechanism to detect when the background
 * AI auto-naming process has completed and automatically refreshes the UI to reflect
 * the new thread name. It's designed to be efficient and avoid unnecessary API calls
 * by only polling when conditions indicate a first message scenario.
 *
 * Key features:
 * - Automatically detects first messages vs. subsequent messages
 * - Polls every 2 seconds with a 30-second timeout
 * - Waits for streaming to be idle before triggering UI refresh
 * - Stops polling when name change is detected and applied
 * - Handles errors gracefully and prevents memory leaks
 * - Only triggers for threads with default names
 *
 * Integration points:
 * - Uses thread store for current state (ID, name, messages)
 * - Calls getThreadNameAction for server state
 * - Monitors streaming status to prevent race conditions
 * - Triggers router.refresh() for UI updates only when streaming is idle
 *
 * @param streamingStatus - Current streaming chat status ('idle' | 'loading' | 'error')
 * @returns Object containing handleFirstMessage function for triggering polling
 *
 * @example
 * ```tsx
 * const { handleFirstMessage } = useThreadNamePolling(chatStatus);
 *
 * // Call when sending a message
 * const sendMessage = () => {
 *   handleFirstMessage(); // Starts polling if it's the first message
 *   // ... send message logic
 * };
 * ```
 */
export function useThreadNamePolling(streamingStatus: string) {
  const router = useRouter();
  const threadId = useThreadId();
  const currentThreadName = useThreadName();
  const messages = useThreadMessages();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to avoid stale closures in polling callback
  // This ensures the polling function always sees current values, not values from when callback was created
  const streamingStatusRef = useRef(streamingStatus);
  const currentThreadNameRef = useRef(currentThreadName);
  const threadIdRef = useRef(threadId);

  useEffect(() => {
    streamingStatusRef.current = streamingStatus;
  }, [streamingStatus]);
  useEffect(() => {
    currentThreadNameRef.current = currentThreadName;
  }, [currentThreadName]);
  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  /**
   * Safely stops the polling interval and cleans up references.
   *
   * This helper ensures proper cleanup of the polling mechanism to prevent
   * memory leaks and unnecessary API calls. It's used both for successful
   * completion and error scenarios.
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Polls the server for thread name updates and handles UI refresh.
   *
   * This function implements the core polling logic with multiple conditions
   * to ensure we only refresh when appropriate:
   * 1. Server call succeeds
   * 2. New name is not the default placeholder
   * 3. New name differs from current local state
   * 4. Streaming has completed (prevents race conditions)
   *
   * When all conditions are met, it triggers a router refresh to update
   * the UI and stops polling to conserve resources.
   *
   * Error handling: Logs errors and stops polling to prevent infinite
   * failed requests.
   */
  const pollThreadName = useCallback(async () => {
    if (!threadIdRef.current) return;

    try {
      const result = await getThreadNameAction(threadIdRef.current);

      // Check all conditions for a successful name update
      if (
        result.success &&
        result.name !== DEFAULT_THREAD_NAME && // Not still the default
        result.name !== currentThreadNameRef.current && // Actually changed
        streamingStatusRef.current === 'idle' // Streaming complete
      ) {
        // Thread has been auto-named successfully, refresh the UI
        router.refresh();

        // Stop polling since we found the updated name
        stopPolling();
      }
    } catch (error) {
      console.error('Error polling thread name:', error);
      // Stop polling on error to prevent continuous failed requests
      stopPolling();
    }
  }, [router, stopPolling]);

  // Cleanup effect: ensures polling stops when component unmounts
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  /**
   * Conditionally starts polling for thread name updates when a first message is sent.
   *
   * This function implements intelligent detection of "first message" scenarios
   * by checking multiple conditions to avoid unnecessary polling:
   *
   * Conditions for starting polling:
   * 1. Thread was empty before this message (messages.length === 0)
   * 2. Thread still has the default placeholder name
   * 3. Polling hasn't already been started for this session
   *
   * Polling configuration:
   * - Interval: 2 seconds between checks
   * - Timeout: 30 seconds maximum duration
   * - Immediate check: Runs once immediately when started
   *
   * This approach ensures we only poll when there's a reasonable expectation
   * that the AI naming process is running in the background.
   *
   * @returns Optional cleanup function for the timeout (not the interval)
   */
  const handleFirstMessage = useCallback(() => {
    // Guard conditions: only start polling for genuine first messages
    if (
      messages.length === 0 && // Thread was empty before sending
      currentThreadName === DEFAULT_THREAD_NAME && // Still has placeholder name
      !pollingIntervalRef.current // Not already polling
    ) {
      // Start periodic polling every 2 seconds
      pollingIntervalRef.current = setInterval(pollThreadName, 2000);

      // Perform an immediate check to catch fast responses
      pollThreadName();

      // Set a safety timeout to prevent infinite polling
      const timeoutId = setTimeout(stopPolling, 30000);

      // Return cleanup function for the timeout (interval is cleaned up by stopPolling)
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, currentThreadName, pollThreadName, stopPolling]);

  return {
    handleFirstMessage,
  };
}
