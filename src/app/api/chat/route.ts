import { NextRequest, NextResponse } from 'next/server';

import { streamOpenAITokens } from '@/app/api/chat/stream-openai-tokens';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { ChatMessage } from '@/lib/chat/types';
import { StreamingResponse } from '@/lib/chat/types/streaming';
import { saveMessage } from '@/lib/db/messages';
import { verifyThreadOwnership } from '@/lib/db/threads';
import { fireAndForget } from '@/lib/internal/fire-and-forget';
import { openaiClient } from '@/lib/openai/client';

// Allow up to 2 minutes for AI generation
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
    // Expected format: { message: string, threadId: string, history?: ChatMessage[] }
    const {
      message: newMessage,
      threadId,
      history,
    }: {
      message: string;
      threadId: string;
      history: ChatMessage[];
    } = await request.json();

    // Perform comprehensive validation including security checks
    // This ensures data integrity and prevents unauthorized thread access
    await validateChatRequest(newMessage, threadId, userId);

    // Save the user's message to the database immediately
    await saveMessage(threadId, 'user', newMessage, 'text');

    // Fire-and-forget call to auto-name the thread if this is the first message
    if (history.length === 0) {
      fireAndForget(userId, '/api/threads/auto-name', {
        method: 'POST',
        body: JSON.stringify({ threadId }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set up JSON streaming response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Generate streaming response using OpenAI Responses API
          for await (const chunk of streamOpenAITokens(
            openaiClient,
            history,
            newMessage
          )) {
            fullResponse += chunk;

            // Send chunk as JSON
            const chunkResponse: StreamingResponse = {
              type: 'chunk',
              content: chunk,
            };
            const jsonData = JSON.stringify(chunkResponse) + '\n';
            controller.enqueue(encoder.encode(jsonData));
          }

          // Send completion event
          const completionResponse: StreamingResponse = { type: 'complete' };
          const completionData = JSON.stringify(completionResponse) + '\n';
          controller.enqueue(encoder.encode(completionData));

          // Save the complete assistant response to database
          // TODO: save the message with a timestamp of when it starts streaming.
          await saveMessage(threadId, 'assistant', fullResponse, 'text');

          controller.close();
        } catch (error) {
          // Send error event
          const errorResponse: StreamingResponse = {
            type: 'error',
            error:
              error instanceof Error
                ? error.message
                : `Generation failed: ${String(error)}`,
          };
          const errorData = JSON.stringify(errorResponse) + '\n';
          controller.enqueue(encoder.encode(errorData));

          // Save error message to database for debugging
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

    // Return streaming JSON response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
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
