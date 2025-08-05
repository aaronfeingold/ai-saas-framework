import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// =============================================================================
// POSTGRESQL TABLES (Business Data + Vectors)
// =============================================================================

// Chat Tables
export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References Supabase auth.users
    title: text('title').notNull(),
    visibility: text('visibility')
      .notNull()
      .default('private')
      .$type<'private' | 'public' | 'organization'>(),
    modelId: text('model_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_chats_user_id').on(table.userId),
    createdAtIdx: index('idx_chats_created_at').on(table.createdAt.desc()),
  })
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(), // References Supabase auth.users
    role: text('role').notNull().$type<'user' | 'assistant' | 'system'>(),
    content: text('content').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    chatIdIdx: index('idx_messages_chat_id').on(table.chatId),
    userIdIdx: index('idx_messages_user_id').on(table.userId),
    createdAtIdx: index('idx_messages_created_at').on(table.createdAt.desc()),
  })
);

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(), // References Supabase auth.users
    type: text('type').notNull().$type<'up' | 'down'>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    messageIdIdx: index('idx_votes_message_id').on(table.messageId),
    userIdIdx: index('idx_votes_user_id').on(table.userId),
    uniqueVote: uniqueIndex('unique_vote_per_user').on(
      table.messageId,
      table.userId
    ),
  })
);

// Content Tables
export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // References Supabase auth.users
    title: text('title').notNull(),
    content: text('content').notNull(),
    contentType: text('content_type')
      .notNull()
      .$type<'document' | 'image' | 'video' | 'audio' | 'other'>(),
    metadata: jsonb('metadata'),
    tags: text('tags').array(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_content_items_user_id').on(table.userId),
    contentTypeIdx: index('idx_content_items_content_type').on(
      table.contentType
    ),
    createdAtIdx: index('idx_content_items_created_at').on(
      table.createdAt.desc()
    ),
  })
);

// Vector Tables (Enhanced from existing)
export const embeddings = pgTable(
  'embeddings',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata'),
    userId: uuid('user_id'), // References Supabase auth.users, nullable for public content
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_embeddings_user_id').on(table.userId),
    embeddingIdx: index('idx_embeddings_embedding').using(
      'ivfflat',
      table.embedding.op('vector_cosine_ops')
    ),
  })
);

// =============================================================================
// RELATIONS
// =============================================================================

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  message: one(messages, {
    fields: [votes.messageId],
    references: [messages.id],
  }),
}));

// =============================================================================
// ZOD SCHEMAS (Generated from Drizzle tables)
// =============================================================================

// Chat schemas
export const insertChatSchema = createInsertSchema(chats);
export const selectChatSchema = createSelectSchema(chats);
export type InsertChat = z.infer<typeof insertChatSchema>;
export type SelectChat = z.infer<typeof selectChatSchema>;

// Message schemas
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SelectMessage = z.infer<typeof selectMessageSchema>;

// Vote schemas
export const insertVoteSchema = createInsertSchema(votes);
export const selectVoteSchema = createSelectSchema(votes);
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type SelectVote = z.infer<typeof selectVoteSchema>;

// Content schemas
export const insertContentItemSchema = createInsertSchema(contentItems);
export const selectContentItemSchema = createSelectSchema(contentItems);
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type SelectContentItem = z.infer<typeof selectContentItemSchema>;

// Embedding schemas
export const insertEmbeddingSchema = createInsertSchema(embeddings);
export const selectEmbeddingSchema = createSelectSchema(embeddings);
export type InsertEmbedding = z.infer<typeof insertEmbeddingSchema>;
export type SelectEmbedding = z.infer<typeof selectEmbeddingSchema>;

// =============================================================================
// LEGACY COMPATIBILITY TYPES (for existing code)
// =============================================================================

// User and Profile Types (these still come from Supabase)
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  subscription_tier: z.enum(['free', 'pro', 'enterprise']).default('free'),
  created_at: z.date(),
  updated_at: z.date(),
});

export type User = z.infer<typeof userSchema>;

// Subscription Types (these still come from Supabase)
export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  stripe_customer_id: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  stripe_price_id: z.string().nullable(),
  subscription_status: z
    .enum([
      'active',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'past_due',
      'trialing',
      'unpaid',
    ])
    .nullable(),
  current_period_start: z.date().nullable(),
  current_period_end: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

// Legacy compatibility exports
export type Chat = SelectChat;
export type Message = SelectMessage;
export type Vote = SelectVote;
export type ContentItem = SelectContentItem;
export type Embedding = SelectEmbedding;

// API Request/Response Types
export const chatRequestSchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    content: z.string(),
  }),
  selectedModelId: z.string(),
  selectedVisibilityType: z.enum(['private', 'public', 'organization']),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const ragRequestSchema = z.object({
  query: z.string().min(1),
  limit: z.number().min(1).max(50).default(10),
  user_id: z.string().uuid().optional(),
});

export type RagRequest = z.infer<typeof ragRequestSchema>;
