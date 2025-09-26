import { NextRequest, NextResponse } from 'next/server';

import { streamOpenAITokens } from '@/app/api/chat/stream-openai-tokens';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { convertDatabaseMessagesToChatMessages } from '@/lib/chat/message-helpers';
import { StreamingResponse } from '@/lib/chat/types/streaming';
import { saveMessage } from '@/lib/db/messages';
import { verifyThreadOwnership, getThreadWithMessages } from '@/lib/db/threads';
import { fireAndForget } from '@/lib/internal/fire-and-forget';
import { openaiClient } from '@/lib/openai/client';

// Allow up to 2 minutes for AI generation
// This accounts for complex conversations and potential API latency
export const maxDuration = 120;

/**
 * Validates the incoming request data and thread ownership.
 *
 * This function performs essential security and data integrity checks:
 * - Validates the new message content
 * - Verifies thread ID is provided
 * - Enforces thread ownership (users can only access their own threads)
 *
 * @param newMessage - The new user message content
 * @param threadId - The thread identifier to validate
 * @param userId - The authenticated user's ID
 * @throws When request is invalid or user lacks thread access
 * @returns Resolves if validation passes, throws otherwise
 */
async function validateChatRequest(
  newMessage: string,
  threadId: string,
  userId: string
): Promise<void> {
  // Validate message content
  if (!newMessage || typeof newMessage !== 'string') {
    throw new Error('Message content is required');
  }

  // Thread ID is required for persistence and ownership validation
  if (!threadId) {
    throw new Error('Thread ID is required');
  }

  // Critical security check: verify thread ownership to prevent unauthorized access
  // Uses optimized function that only checks ownership without loading all messages
  const hasAccess = await verifyThreadOwnership(threadId, userId);
  if (!hasAccess) {
    throw new Error('Thread not found or access denied');
  }
}

/**
 * Main chat endpoint that handles AI conversations with direct OpenAI streaming.
 *
 * This endpoint orchestrates the complete chat flow:
 * 1. Authentication via middleware layer
 * 2. Request validation and thread ownership verification
 * 3. User message persistence to database
 * 4. AI response generation via direct OpenAI streaming
 * 5. Assistant response persistence after streaming completes
 *
 * The endpoint uses OpenAI's Responses API for streaming:
 * - Direct integration with OpenAI without AI SDK overhead
 * - Server-sent events for real-time streaming
 * - Proper error handling with structured responses
 *
 * @param request - The incoming HTTP request
 * @returns Streaming AI response or error response
 */
export async function POST(request: NextRequest) {
  try {
    // Get user ID from headers set by middleware
    const userId = await getUserIdFromHeader();

    // Parse the incoming JSON request body
    // Expected format: { message: string, threadId: string }
    const {
      message: newMessage,
      threadId,
    }: {
      message: string;
      threadId: string;
    } = await request.json();

    // Perform comprehensive validation including security checks
    // This ensures data integrity and prevents unauthorized thread access
    await validateChatRequest(newMessage, threadId, userId);

    // Load thread with all existing messages from database
    // Note: verifyThreadOwnership already confirmed existence, but we need full data
    const thread = await getThreadWithMessages(threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }

    // Convert database messages to ChatMessage format for OpenAI
    // This ensures proper type compatibility and serialization
    const history = convertDatabaseMessagesToChatMessages(thread.messages);

    // Save the user's message to the database immediately
    await saveMessage(threadId, 'user', newMessage, 'text');

    // Fire-and-forget call to auto-name the thread if this is the first message
    // This happens asynchronously to avoid blocking the chat response
    if (history.length === 0) {
      fireAndForget(userId, '/api/threads/auto-name', {
        method: 'POST',
        body: JSON.stringify({ threadId }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set up JSON streaming response infrastructure
    const encoder = new TextEncoder();
    let fullResponse = ''; // Accumulates complete response for database storage

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate streaming response using OpenAI Responses API
          // This yields individual tokens as they arrive from OpenAI
          for await (const chunk of streamOpenAITokens(
            openaiClient,
            history,
            newMessage
          )) {
            fullResponse += chunk; // Build complete response for persistence

            // Send chunk as JSON-delimited streaming event
            const chunkResponse: StreamingResponse = {
              type: 'chunk',
              content: chunk,
            };
            const jsonData = JSON.stringify(chunkResponse) + '\n';
            controller.enqueue(encoder.encode(jsonData));
          }

          // Send completion event to signal end of streaming
          const completionResponse: StreamingResponse = { type: 'complete' };
          const completionData = JSON.stringify(completionResponse) + '\n';
          controller.enqueue(encoder.encode(completionData));

          // Save the complete assistant response to database
          // TODO: save the message with a timestamp of when it starts streaming.
          // Currently uses completion timestamp, but start timestamp would be more accurate
          await saveMessage(threadId, 'assistant', fullResponse, 'text');

          controller.close();
        } catch (error) {
          // Send error event to client for user feedback
          const errorResponse: StreamingResponse = {
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : `Generation failed: ${String(error)}`,
          };
          const errorData = JSON.stringify(errorResponse) + '\n';
          controller.enqueue(encoder.encode(errorData));

          // Save error message to database for debugging and conversation continuity
          // This allows users to see what went wrong and retry if needed
          await saveMessage(
            threadId,
            'assistant',
            error instanceof Error ? error.message : 'Generation failed',
            'error'
          );

          controller.close();
        }
      },
    });

    // Return streaming JSON response with proper headers for real-time communication
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json', // JSON streaming format
        'Cache-Control': 'no-cache', // Prevent caching of streaming responses
        Connection: 'keep-alive', // Maintain connection during streaming
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests if needed
        'Access-Control-Allow-Headers': 'Content-Type', // Required headers for CORS
      },
    });
  } catch (error) {
    // Handle all errors with structured JSON responses
    // This includes validation errors, database errors, and generation failures
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
}
