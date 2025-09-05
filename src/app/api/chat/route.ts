import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/require-auth';
import { saveMessage, getThreadWithMessages } from '@/lib/chat/service';

// Allow up to 30s for generation (tweak as needed)
export const maxDuration = 120;

/**
 * Converts message content to string format for storage
 */
function normalizeMessageContent(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/**
 * Validates the incoming request data and thread ownership
 */
async function validateChatRequest(
  messages: UIMessage[],
  threadId: string,
  userId: string
): Promise<void> {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  if (messages.length === 0) {
    throw new Error('Cannot start a conversation without messages');
  }

  if (threadId === undefined || threadId === null) {
    throw new Error('Thread ID is required');
  }

  // Verify thread ownership - user can only write to their own threads
  const thread = await getThreadWithMessages(threadId);
  if (!thread || thread.userId !== userId) {
    throw new Error('Thread not found or access denied');
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
  threadId: string,
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
 * Creates a callback to save the AI's response after streaming completes
 */
function createSaveAssistantResponseCallback(threadId: string) {
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
    const { messages, threadId }: { messages: UIMessage[]; threadId: string } =
      await request.json();

    // Validate the request early (includes thread ownership check)
    await validateChatRequest(messages, threadId, userId);

    // Save the user's message to the existing thread
    const userMessage = getLastUserMessage(messages);
    if (userMessage) {
      await saveUserMessageToThread(threadId, userMessage);
    }

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
      onFinish: createSaveAssistantResponseCallback(threadId),
    });

    // Return the streaming response
    return result.toUIMessageStreamResponse();
  } catch (error) {
    // Return proper error response for validation failures
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
});
