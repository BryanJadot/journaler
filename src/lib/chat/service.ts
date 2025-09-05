import { eq, desc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { threads, messages, roleEnum, outputTypeEnum } from '@/lib/db/schema';

// Extract enum types from the schema
export type Role = (typeof roleEnum.enumValues)[number];
export type OutputType = (typeof outputTypeEnum.enumValues)[number];

export async function createThread(userId: string, name: string) {
  const [thread] = await db
    .insert(threads)
    .values({
      userId,
      name,
      updatedAt: new Date(),
    })
    .returning();

  return thread;
}

export async function getThreadsByUser(userId: string) {
  return db.query.threads.findMany({
    where: eq(threads.userId, userId),
    orderBy: [desc(threads.updatedAt)],
    with: {
      messages: {
        orderBy: [desc(messages.createdAt)],
        limit: 1,
      },
    },
  });
}

export async function getMostRecentThread(userId: string) {
  return db.query.threads.findFirst({
    where: eq(threads.userId, userId),
    orderBy: [desc(threads.updatedAt)],
    with: {
      messages: {
        orderBy: [messages.createdAt],
      },
    },
  });
}

export async function getThreadWithMessages(threadId: number) {
  return db.query.threads.findFirst({
    where: eq(threads.id, threadId),
    with: {
      messages: {
        orderBy: [messages.createdAt],
      },
    },
  });
}

export async function saveMessage(
  threadId: number,
  role: Role,
  content: string,
  outputType: OutputType = 'text'
) {
  // Use transaction to ensure consistency between message creation and thread update
  return await db.transaction(async (tx) => {
    // Save the message
    const [message] = await tx
      .insert(messages)
      .values({
        threadId,
        role,
        content,
        outputType,
        createdAt: new Date(),
      })
      .returning();

    // Update thread's updatedAt timestamp
    await tx
      .update(threads)
      .set({ updatedAt: new Date() })
      .where(eq(threads.id, threadId));

    return message;
  });
}

export async function createThreadWithFirstMessage(
  userId: string,
  firstMessage: {
    role: Role;
    content: string;
    outputType: OutputType;
  }
) {
  // Transaction to create thread and first message atomically
  return await db.transaction(async (tx) => {
    // Create thread with a default name (can be updated based on first message)
    const [thread] = await tx
      .insert(threads)
      .values({
        userId,
        name: 'New Chat', // We can update this later based on the conversation
        updatedAt: new Date(),
      })
      .returning();

    // Create the first message
    const [message] = await tx
      .insert(messages)
      .values({
        threadId: thread.id,
        role: firstMessage.role,
        content: firstMessage.content,
        outputType: firstMessage.outputType,
        createdAt: new Date(),
      })
      .returning();

    return { thread, message };
  });
}
