/**
 * Chat-related constants used throughout the application.
 *
 * This module centralizes all chat-related constants to ensure consistency
 * across components, services, and tests. By maintaining these values in a
 * single location, we can easily update behavior application-wide.
 */

/**
 * Default name assigned to newly created chat threads.
 *
 * This name appears in the UI when users create a new conversation
 * and serves as the initial title until they choose to rename it.
 * The name is kept generic to work across different languages and contexts.
 *
 * @constant {string}
 * @default 'New Chat'
 */
export const DEFAULT_THREAD_NAME = 'New Chat';
