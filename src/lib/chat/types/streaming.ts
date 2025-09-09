/**
 * Shared types for chat streaming API responses
 * Used by both frontend and backend for type safety
 */

/**
 * Streaming chunk containing partial AI response content
 */
export interface StreamChunk {
  type: 'chunk';
  content: string;
}

/**
 * Stream completion event indicating successful end of generation
 */
export interface StreamComplete {
  type: 'complete';
}

/**
 * Stream error event with error details
 */
export interface StreamError {
  type: 'error';
  error: string;
}

/**
 * Union type for all possible streaming response events
 */
export type StreamingResponse = StreamChunk | StreamComplete | StreamError;
