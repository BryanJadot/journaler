import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/require-auth';
import {
  saveMessage,
  createThreadWithFirstMessage,
  createThread,
  getMostRecentThread,
  type Role,
  type OutputType,
} from '@/lib/chat/service';

// (Optional) prefer Edge for low-latency streaming
export const runtime = 'edge';
// Allow up to 30s for generation (tweak as needed)
export const maxDuration = 120;

/**
 * Converts message content to string format for storage
 */
function normalizeMessageContent(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Validates the incoming request data
 */
function validateChatRequest(messages: UIMessage[]): void {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  if (messages.length === 0) {
    throw new Error('Cannot start a conversation without messages');
  }
}

/**
 * Extracts the last message from the array if it's from a user
 */
function getLastUserMessage(messages: UIMessage[]): UIMessage | null {
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.role === 'user' ? lastMessage : null;
}

/**
 * Saves a user message to an existing thread
 */
async function saveUserMessageToThread(
  threadId: number,
  userMessage: UIMessage
): Promise<void> {
  await saveMessage(
    threadId,
    'user',
    normalizeMessageContent(
      'content' in userMessage ? userMessage.content : ''
    ),
    'text'
  );
}

/**
 * Handles the case where a thread ID is already provided
 */
async function handleExistingThread(
  threadId: number,
  messages: UIMessage[]
): Promise<{ threadId: number; messageSaved: boolean }> {
  const userMessage = getLastUserMessage(messages);

  if (userMessage) {
    await saveUserMessageToThread(threadId, userMessage);
    return { threadId, messageSaved: true };
  }

  return { threadId, messageSaved: false };
}

/**
 * Creates a new thread for a user's first conversation
 */
async function createNewThreadWithMessage(
  userId: string,
  userMessage: UIMessage | null
): Promise<{ threadId: number; messageSaved: boolean }> {
  if (userMessage) {
    // Create thread WITH the first message in a single transaction
    const { thread } = await createThreadWithFirstMessage(userId, {
      role: 'user' as Role,
      content: normalizeMessageContent(
        'content' in userMessage ? userMessage.content : ''
      ),
      outputType: 'text' as OutputType,
    });
    return { threadId: thread.id, messageSaved: true };
  }

  // Non-user message as first message - just create empty thread
  const thread = await createThread(userId, 'New Chat');
  return { threadId: thread.id, messageSaved: false };
}

/**
 * Handles the case where no thread ID is provided (but we know messages exist)
 */
async function handleNoThread(
  userId: string,
  messages: UIMessage[]
): Promise<{ threadId: number; messageSaved: boolean }> {
  const userMessage = getLastUserMessage(messages);

  // Check for existing threads first
  const recentThread = await getMostRecentThread(userId);

  if (recentThread) {
    // Reuse existing thread
    if (userMessage) {
      await saveUserMessageToThread(recentThread.id, userMessage);
      return { threadId: recentThread.id, messageSaved: true };
    }
    return { threadId: recentThread.id, messageSaved: false };
  }

  // No existing threads - create new one
  return createNewThreadWithMessage(userId, userMessage);
}

/**
 * Main orchestrator: Gets or creates a thread and saves the user's message
 */
async function getOrCreateThreadAndSaveMessage(
  userId: string,
  threadId: number | undefined,
  messages: UIMessage[]
): Promise<{ threadId: number; messageSaved: boolean }> {
  // Check for explicit threadId (including zero, which is valid)
  if (threadId !== undefined && threadId !== null) {
    return handleExistingThread(threadId, messages);
  }

  return handleNoThread(userId, messages);
}

/**
 * Creates a callback to save the AI's response after streaming completes
 */
function createSaveAssistantResponseCallback(threadId: number) {
  return async ({ text, error }: { text: string; error?: Error }) => {
    await saveMessage(
      threadId,
      'assistant',
      error ? error.message : text,
      error ? 'error' : 'text'
    );
  };
}

/**
 * Main chat endpoint that handles AI conversations with persistence
 */
export const POST = requireAuth(async ({ request, userId }) => {
  try {
    // Parse the incoming request
    const { messages, threadId }: { messages: UIMessage[]; threadId?: number } =
      await request.json();

    // Validate the request early
    validateChatRequest(messages);

    // Get/create thread and save the user's message
    const { threadId: currentThreadId } = await getOrCreateThreadAndSaveMessage(
      userId,
      threadId,
      messages
    );

    // Stream the AI response
    const result = streamText({
      model: 'openai/gpt-5',
      messages: convertToModelMessages(messages),
      temperature: 0.1,
      system:
        'Format your responses using markdown. Use **bold**, \
        *italic*, `code`, ```code blocks```, lists, and other markdown elements to \
        make your responses clear and well-formatted. \
        Unless it does not make sense at all, your responses need to be structured \
        with good headers and subheaders.',
      // Save the AI's response after streaming completes
      onFinish: createSaveAssistantResponseCallback(currentThreadId),
    });

    // Return the streaming response with thread ID in headers
    const response = result.toUIMessageStreamResponse();
    response.headers.set('X-Thread-Id', currentThreadId.toString());

    return response;
  } catch (error) {
    // Return proper error response for validation failures
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
});
