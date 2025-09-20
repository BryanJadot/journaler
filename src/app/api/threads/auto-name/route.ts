import { NextRequest, NextResponse } from 'next/server';

import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import {
  validateThreadForAutoNaming,
  generateThreadName,
} from '@/lib/chat/auto-naming';
import { getThreadWithFirstMessage, updateThreadName } from '@/lib/db/threads';

/**
 * Auto-generate thread names based on the first message in a conversation.
 *
 * This API endpoint analyzes the first user message in a thread and uses OpenAI
 * to generate a concise, descriptive name for the conversation. It only operates
 * on threads that still have the default name ('New Chat') to avoid overwriting
 * user-customized names.
 *
 * The endpoint is designed to be called in a fire-and-forget manner after the
 * first message is sent, providing seamless auto-naming without blocking the
 * user experience.
 *
 * Security:
 * - Requires authenticated requests via HMAC-signed internal headers
 * - Only processes threads owned by the authenticated user
 * - Validates thread exists and has default name before processing
 *
 * @param request - POST request with threadId in body
 * @returns 200 with updated thread name or appropriate error response
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request using HMAC-signed headers
    const userId = await getUserIdFromHeader();

    // Parse request body
    const body = await request.json();
    const { threadId } = body;

    if (!threadId) {
      return NextResponse.json(
        { error: 'threadId is required' },
        { status: 400 }
      );
    }

    // Get thread with first message
    const threadData = await getThreadWithFirstMessage(threadId);

    if (!threadData) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Validate thread is eligible for auto-naming
    const validation = validateThreadForAutoNaming(threadData, userId);
    if (!validation.eligible) {
      return NextResponse.json(
        { error: validation.reason },
        { status: validation.statusCode }
      );
    }

    // Generate name using OpenAI
    const generatedName = await generateThreadName(
      threadData.firstMessage!.content
    );

    // Update thread name in database (cache invalidation handled in service)
    await updateThreadName(threadId, generatedName, userId);

    return NextResponse.json({
      success: true,
      threadId,
      newName: generatedName,
    });
  } catch (error) {
    console.error('Error auto-naming thread:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
