import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/require-auth';
import { saveMessage, getThreadWithMessages } from '@/lib/chat/service';

/**
 * AI SDK Message Format Requirements
 *
 * This endpoint handles UI messages in the AI SDK format, which uses different
 * structures for different message roles:
 *
 * USER MESSAGES (multi-modal support):
 * {
 *   id: string,
 *   role: 'user',
 *   parts: [{ type: 'text', text: string }]  // Array to support images/attachments
 * }
 *
 * ASSISTANT MESSAGES (generated responses):
 * {
 *   id: string,
 *   role: 'assistant',
 *   content: string  // Simple content property
 * }
 *
 * SYSTEM MESSAGES (configuration):
 * {
 *   id: string,
 *   role: 'system',
 *   content: string  // Simple content property
 * }
 *
 * The different formats are required by the AI SDK's convertToModelMessages()
 * function and enable multi-modal user input while maintaining backward
 * compatibility for assistant responses.
 */

// Allow up to 2 minutes for AI generation
export const maxDuration = 120;

/**
 * Validates the incoming request data and thread ownership.
 *
 * This function performs essential security and data integrity checks:
 * - Ensures messages array exists and is valid
 * - Prevents empty conversations from being started
 * - Verifies thread ID is provided
 * - Enforces thread ownership (users can only access their own threads)
 *
 * @param {UIMessage[]} messages - Array of UI messages from the AI SDK
 * @param {string} threadId - The thread identifier to validate
 * @param {string} userId - The authenticated user's ID
 * @throws {Error} When messages are invalid or user lacks thread access
 * @returns {Promise<void>} Resolves if validation passes, throws otherwise
 */
async function validateChatRequest(
  messages: UIMessage[],
  threadId: string,
  userId: string
): Promise<void> {
  // Validate messages array structure - AI SDK requires array format
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array');
  }

  // Prevent empty conversations from being processed
  if (messages.length === 0) {
    throw new Error('Cannot start a conversation without messages');
  }

  // Thread ID is required for persistence and ownership validation
  if (threadId === undefined || threadId === null) {
    throw new Error('Thread ID is required');
  }

  // Critical security check: verify thread ownership to prevent unauthorized access
  // Users can only write to their own threads to maintain data isolation
  const thread = await getThreadWithMessages(threadId);
  if (!thread || thread.userId !== userId) {
    throw new Error('Thread not found or access denied');
  }
}

/**
 * Scans backwards through the message array to find the most recent user message.
 *
 * This function implements reverse iteration because:
 * - User messages are what we need to persist to the database
 * - In a conversation flow, we only need the latest user input
 * - Assistant messages are generated and saved separately via onFinish callback
 * - System messages don't need persistence as they're configuration
 *
 * @param {UIMessage[]} messages - Array of UI messages from the conversation
 * @returns {UIMessage | null} The last user message found, or null if none exists
 * @example
 * const messages = [
 *   { role: 'system', content: 'You are helpful' },
 *   { role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
 *   { role: 'assistant', content: 'Hi there!' },
 *   { role: 'user', parts: [{ type: 'text', text: 'How are you?' }] }
 * ];
 * const lastUser = getLastUserMessage(messages);
 * // Returns the 'How are you?' message
 */
function getLastUserMessage(messages: UIMessage[]): UIMessage | null {
  // Iterate backwards through messages to find the most recent user message
  // This is more efficient than forward iteration + filtering for this use case
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  // No user message found in the conversation
  return null;
}

/**
 * Saves a user message to an existing thread with strict format validation.
 *
 * This function enforces the AI SDK's user message structure requirements:
 * - User messages must have a 'parts' array (not 'content' property)
 * - Parts array must contain exactly one element
 * - The part must be of type 'text' with string content
 *
 * This validation is critical because:
 * - The AI SDK uses different message formats for different roles
 * - User messages use parts[] for multi-modal support (text, images, etc.)
 * - Assistant messages use content property for backward compatibility
 * - Incorrect format causes AI SDK conversion failures
 *
 * @param {string} threadId - The thread to save the message to
 * @param {UIMessage} userMessage - User message with parts array format
 * @throws {Error} When message structure doesn't match AI SDK requirements
 * @returns {Promise<void>} Resolves when message is successfully saved
 * @example
 * const validUserMessage = {
 *   id: 'msg_123',
 *   role: 'user',
 *   parts: [{ type: 'text', text: 'Hello world' }]
 * };
 * await saveUserMessageToThread('thread_456', validUserMessage);
 */
async function saveUserMessageToThread(
  threadId: string,
  userMessage: UIMessage
): Promise<void> {
  // Validate AI SDK user message structure: must have parts array
  // User messages use parts[] format to support multi-modal content (text, images, etc.)
  if (!('parts' in userMessage) || !Array.isArray(userMessage.parts)) {
    throw new Error('User message must have parts array');
  }

  // Currently only support single-part messages for simplicity
  // Multi-part messages would require more complex content handling
  if (userMessage.parts.length !== 1) {
    throw new Error('User message must have exactly one part');
  }

  // Validate the message part structure and content type
  const part = userMessage.parts[0];
  if (part.type !== 'text' || typeof part.text !== 'string') {
    throw new Error('User message part must be text type with string content');
  }

  // Save the validated text content to the database
  await saveMessage(threadId, 'user', part.text, 'text');
}

/**
 * Creates a callback function to save the AI's response after streaming completes.
 *
 * This callback is used with the AI SDK's onFinish hook to persist assistant responses.
 * It handles both successful completions and error cases:
 * - Success: saves the generated text with 'text' type
 * - Error: saves the error message with 'error' type for debugging
 *
 * @param {string} threadId - The thread to save the assistant response to
 * @returns {Function} Callback function that handles the completion event
 * @example
 * const callback = createSaveAssistantResponseCallback('thread_123');
 * streamText({
 *   model: 'gpt-4',
 *   messages,
 *   onFinish: callback // Will save response when streaming completes
 * });
 */
function createSaveAssistantResponseCallback(threadId: string) {
  return async ({ text, error }: { text: string; error?: Error }) => {
    // Save the AI response or error message to the database
    // This preserves both successful generations and failure cases for debugging
    await saveMessage(
      threadId,
      'assistant',
      error ? error.message : text,
      error ? 'error' : 'text'
    );
  };
}

/**
 * Main chat endpoint that handles AI conversations with persistence.
 *
 * This endpoint orchestrates the complete chat flow:
 * 1. Authentication via requireAuth wrapper
 * 2. Request validation and thread ownership verification
 * 3. User message persistence to database
 * 4. AI response generation via streaming
 * 5. Assistant response persistence via onFinish callback
 *
 * The endpoint uses the AI SDK's streaming approach for better UX:
 * - Immediate response streaming to the client
 * - Background persistence of both user and assistant messages
 * - Proper error handling with structured responses
 *
 * @param {object} params - Parameters from requireAuth wrapper
 * @param {NextRequest} params.request - The incoming HTTP request
 * @param {string} params.userId - The authenticated user's ID
 * @returns {Response} Streaming AI response or error response
 */
export const POST = requireAuth(async ({ request, userId }) => {
  try {
    // Parse the incoming JSON request body
    // Expected format: { messages: UIMessage[], threadId: string }
    const { messages, threadId }: { messages: UIMessage[]; threadId: string } =
      await request.json();

    // Perform comprehensive validation including security checks
    // This ensures data integrity and prevents unauthorized thread access
    await validateChatRequest(messages, threadId, userId);

    // Extract and persist the user's message to the database
    // Only user messages need immediate persistence; assistant messages are saved via onFinish
    const userMessage = getLastUserMessage(messages);
    if (userMessage) {
      await saveUserMessageToThread(threadId, userMessage);
    }

    // Generate streaming AI response using the AI SDK
    // convertToModelMessages transforms UI messages to the model's expected format
    const result = streamText({
      model: 'openai/gpt-5', // Using GPT-5 model for high-quality responses
      messages: convertToModelMessages(messages), // Convert UI format to model format
      temperature: 0.1, // Low temperature for more focused, consistent responses
      system:
        'Format your responses using markdown. Use **bold**, \
        *italic*, `code`, ```code blocks```, lists, and other markdown elements to \
        make your responses clear and well-formatted. \
        Unless it does not make sense at all, your responses need to be structured \
        with good headers and subheaders.',
      // Callback to save assistant response after streaming completes
      // This ensures we persist the full response even during streaming
      onFinish: createSaveAssistantResponseCallback(threadId),
    });

    // Convert the streaming result to a UI-compatible response format
    // This handles the streaming protocol and proper headers for the client
    return result.toUIMessageStreamResponse();
  } catch (error) {
    // Handle all errors with structured JSON responses
    // This includes validation errors, database errors, and AI generation failures
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
});
