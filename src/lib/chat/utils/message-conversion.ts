import { useChat } from '@ai-sdk/react';

import { ChatMessage } from '@/lib/chat/types';

/**
 * Convert AI SDK message to application ChatMessage format.
 *
 * Extracts text content from AI SDK's parts-based message structure
 * and maps roles to our simplified role system.
 *
 * @param msg - AI SDK message with parts array
 * @returns ChatMessage compatible with our UI components
 *
 * @example
 * ```tsx
 * const converted = convertAIMessageToChatMessage(aiMessage);
 * ```
 */
export function convertAIMessageToChatMessage(
  msg: ReturnType<typeof useChat>['messages'][0]
): ChatMessage {
  // Extract text content from parts array
  const content = msg.parts
    .map((part) => {
      switch (part.type) {
        case 'text':
          return part.text || '';

        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('');

  // Map AI SDK roles to our role system
  let mappedRole: 'user' | 'assistant' | 'developer';
  switch (msg.role) {
    case 'user':
      mappedRole = 'user';
      break;
    case 'assistant':
      mappedRole = 'assistant';
      break;
    case 'system':
    default:
      mappedRole = 'developer';
      break;
  }

  return {
    id: msg.id,
    role: mappedRole,
    content,

    // TODO: Extract actual message timestamp from AI SDK response metadata
    // The AI SDK may provide timestamps in the future, either:
    // - msg.createdAt (if added to message structure)
    // - msg.metadata?.timestamp (if provided in metadata)
    // - Response headers (if available through transport layer)
    //
    // Current limitation: We use empty string, but this means:
    // - UI components can't display accurate message times
    // - Message ordering relies on array order rather than timestamps
    // - Chat history doesn't show when messages were actually sent
    //
    // Potential solutions:
    // 1. Generate client-side timestamp: new Date().toISOString()
    // 2. Extract from AI SDK metadata when available
    // 3. Enhance API response to include server timestamps
    createdAt: '',
  };
}
