import { relations } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
  serial,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['user', 'assistant', 'developer']);
export const outputTypeEnum = pgEnum('output_type', ['text', 'error']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Starred flag for thread prioritization - starred threads appear at top of thread list
  starred: boolean('starred').notNull().default(false),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => threads.id),
  role: roleEnum('role').notNull(),
  content: text('content').notNull(), // JSON or text content
  outputType: outputTypeEnum('output_type').notNull().default('text'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
}));
