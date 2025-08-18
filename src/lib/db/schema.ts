import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
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

// =============================================================================
// ENHANCED CHAT SYSTEM (from temp-supabase-auth)
// =============================================================================

// User profiles table (stored in PostgreSQL, references Supabase auth.users)
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // This matches Supabase auth.users.id
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  })
);

// Chat sessions table
export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatTitle: text('chat_title'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_chat_sessions_user_id').on(table.userId),
    createdAtIdx: index('idx_chat_sessions_created_at').on(
      table.createdAt.desc()
    ),
  })
);

// Chat messages table with rich content support
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatSessionId: uuid('chat_session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    content: text('content'),
    isUserMessage: boolean('is_user_message').notNull(),
    reasoning: text('reasoning'), // For AI reasoning/thinking process
    sources: jsonb('sources'), // Source citations and references
    toolInvocations: jsonb('tool_invocations'), // Tool calls and results
    attachments: jsonb('attachments'), // File attachments
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    chatSessionIdIdx: index('idx_chat_messages_session_id').on(
      table.chatSessionId
    ),
    createdAtIdx: index('idx_chat_messages_created_at').on(
      table.createdAt.desc()
    ),
    isUserMessageIdx: index('idx_chat_messages_is_user').on(
      table.isUserMessage
    ),
  })
);

// Document storage and management
export const userDocuments = pgTable(
  'user_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    filterTags: text('filter_tags').notNull(),
    totalPages: integer('total_pages').notNull(),
    aiTitle: text('ai_title'),
    aiDescription: text('ai_description'),
    aiMainTopics: text('ai_maintopics').array(),
    aiKeyEntities: text('ai_keyentities').array(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_user_documents_user_id').on(table.userId),
    titleIdx: index('idx_user_documents_title').on(table.title),
    createdAtIdx: index('idx_user_documents_created_at').on(
      table.createdAt.desc()
    ),
  })
);

// Vector embeddings for documents (optimized for similarity search)
export const userDocumentsVec = pgTable(
  'user_documents_vec',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => userDocuments.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    textContent: text('text_content').notNull(),
    embedding: vector('embedding', { dimensions: 1024 }), // Voyage AI embeddings
  },
  (table) => ({
    documentIdIdx: index('idx_user_documents_vec_doc_id').on(table.documentId),
    pageNumberIdx: index('idx_user_documents_vec_page').on(table.pageNumber),
    embeddingIdx: index('idx_user_documents_vec_embedding').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
  })
);

// Error feedback and monitoring
export const errorFeedback = pgTable(
  'error_feedback',
  {
    id: serial('id').primaryKey(),
    feedback: text('feedback').notNull(),
    category: text('category'),
    errorMessage: text('errormessage'),
    errorStack: text('errorstack'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    categoryIdx: index('idx_error_feedback_category').on(table.category),
    createdAtIdx: index('idx_error_feedback_created_at').on(
      table.createdAt?.desc()
    ),
  })
);

// Legacy Chat Tables (keeping for backward compatibility)
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

// Legacy Content Tables (keeping for backward compatibility)
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

// =============================================================================
// ABSTRACT CONTENT MANAGEMENT SYSTEM
// =============================================================================

// Content Types Registry
export const contentTypes = pgTable(
  'content_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    icon: text('icon'),
    fields: jsonb('fields').notNull(), // Array of field definitions
    uiConfig: jsonb('ui_config').notNull().default('{}'),
    isSystem: text('is_system').default('false').$type<'true' | 'false'>(),
    createdBy: uuid('created_by').notNull(), // References Supabase auth.users
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    slugIdx: index('idx_content_types_slug').on(table.slug),
    createdByIdx: index('idx_content_types_created_by').on(table.createdBy),
    isSystemIdx: index('idx_content_types_is_system').on(table.isSystem),
  })
);

// Abstract Content Storage
export const contents = pgTable(
  'contents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentTypeId: uuid('content_type_id')
      .notNull()
      .references(() => contentTypes.id, { onDelete: 'cascade' }),
    slug: text('slug'),
    data: jsonb('data').notNull().default('{}'), // Dynamic field data
    metadata: jsonb('metadata').notNull().default('{}'), // SEO, tags, etc.
    status: text('status')
      .notNull()
      .default('draft')
      .$type<'draft' | 'published' | 'archived' | 'pending_review'>(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(), // References Supabase auth.users
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    contentTypeIdIdx: index('idx_contents_content_type_id').on(
      table.contentTypeId
    ),
    slugIdx: index('idx_contents_slug').on(table.slug),
    statusIdx: index('idx_contents_status').on(table.status),
    publishedAtIdx: index('idx_contents_published_at').on(
      table.publishedAt?.desc()
    ),
    createdByIdx: index('idx_contents_created_by').on(table.createdBy),
    createdAtIdx: index('idx_contents_created_at').on(table.createdAt.desc()),
    uniqueSlugPerType: uniqueIndex('unique_slug_per_content_type').on(
      table.contentTypeId,
      table.slug
    ),
  })
);

// Content Relationships (for relational fields)
export const contentRelationships = pgTable(
  'content_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromContentId: uuid('from_content_id')
      .notNull()
      .references(() => contents.id, { onDelete: 'cascade' }),
    toContentId: uuid('to_content_id')
      .notNull()
      .references(() => contents.id, { onDelete: 'cascade' }),
    relationshipType: text('relationship_type').notNull(), // belongs_to, has_many, etc.
    fieldName: text('field_name').notNull(), // The field that defines this relationship
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    fromContentIdIdx: index('idx_content_relationships_from').on(
      table.fromContentId
    ),
    toContentIdIdx: index('idx_content_relationships_to').on(table.toContentId),
    fieldNameIdx: index('idx_content_relationships_field_name').on(
      table.fieldName
    ),
    relationshipTypeIdx: index('idx_content_relationships_type').on(
      table.relationshipType
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

// Enhanced Chat System Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
  userDocuments: many(userDocuments),
}));

export const chatSessionsRelations = relations(
  chatSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [chatSessions.userId],
      references: [users.id],
    }),
    messages: many(chatMessages),
  })
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chatSession: one(chatSessions, {
    fields: [chatMessages.chatSessionId],
    references: [chatSessions.id],
  }),
}));

export const userDocumentsRelations = relations(
  userDocuments,
  ({ one, many }) => ({
    user: one(users, {
      fields: [userDocuments.userId],
      references: [users.id],
    }),
    vectorEmbeddings: many(userDocumentsVec),
  })
);

export const userDocumentsVecRelations = relations(
  userDocumentsVec,
  ({ one }) => ({
    document: one(userDocuments, {
      fields: [userDocumentsVec.documentId],
      references: [userDocuments.id],
    }),
  })
);

// Legacy Chat Relations (keeping for backward compatibility)
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

// Abstract Content Management Relations
export const contentTypesRelations = relations(contentTypes, ({ many }) => ({
  contents: many(contents),
}));

export const contentsRelations = relations(contents, ({ one, many }) => ({
  contentType: one(contentTypes, {
    fields: [contents.contentTypeId],
    references: [contentTypes.id],
  }),
  fromRelationships: many(contentRelationships, {
    relationName: 'fromContent',
  }),
  toRelationships: many(contentRelationships, {
    relationName: 'toContent',
  }),
}));

export const contentRelationshipsRelations = relations(
  contentRelationships,
  ({ one }) => ({
    fromContent: one(contents, {
      fields: [contentRelationships.fromContentId],
      references: [contents.id],
      relationName: 'fromContent',
    }),
    toContent: one(contents, {
      fields: [contentRelationships.toContentId],
      references: [contents.id],
      relationName: 'toContent',
    }),
  })
);

// =============================================================================
// ZOD SCHEMAS (Generated from Drizzle tables)
// =============================================================================

// Enhanced Chat System schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

export const insertChatSessionSchema = createInsertSchema(chatSessions);
export const selectChatSessionSchema = createSelectSchema(chatSessions);
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type SelectChatSession = z.infer<typeof selectChatSessionSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessages);
export const selectChatMessageSchema = createSelectSchema(chatMessages);
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type SelectChatMessage = z.infer<typeof selectChatMessageSchema>;

export const insertUserDocumentSchema = createInsertSchema(userDocuments);
export const selectUserDocumentSchema = createSelectSchema(userDocuments);
export type InsertUserDocument = z.infer<typeof insertUserDocumentSchema>;
export type SelectUserDocument = z.infer<typeof selectUserDocumentSchema>;

export const insertUserDocumentVecSchema = createInsertSchema(userDocumentsVec);
export const selectUserDocumentVecSchema = createSelectSchema(userDocumentsVec);
export type InsertUserDocumentVec = z.infer<typeof insertUserDocumentVecSchema>;
export type SelectUserDocumentVec = z.infer<typeof selectUserDocumentVecSchema>;

export const insertErrorFeedbackSchema = createInsertSchema(errorFeedback);
export const selectErrorFeedbackSchema = createSelectSchema(errorFeedback);
export type InsertErrorFeedback = z.infer<typeof insertErrorFeedbackSchema>;
export type SelectErrorFeedback = z.infer<typeof selectErrorFeedbackSchema>;

// Legacy Chat schemas (keeping for backward compatibility)
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

// Abstract Content Management Schemas
export const insertContentTypeSchema = createInsertSchema(contentTypes);
export const selectContentTypeSchema = createSelectSchema(contentTypes);
export type InsertContentType = z.infer<typeof insertContentTypeSchema>;
export type SelectContentType = z.infer<typeof selectContentTypeSchema>;

export const insertContentSchema = createInsertSchema(contents);
export const selectContentSchema = createSelectSchema(contents);
export type InsertContent = z.infer<typeof insertContentSchema>;
export type SelectContent = z.infer<typeof selectContentSchema>;

export const insertContentRelationshipSchema =
  createInsertSchema(contentRelationships);
export const selectContentRelationshipSchema =
  createSelectSchema(contentRelationships);
export type InsertContentRelationship = z.infer<
  typeof insertContentRelationshipSchema
>;
export type SelectContentRelationship = z.infer<
  typeof selectContentRelationshipSchema
>;

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

// Enhanced Chat System exports
export type UserProfile = SelectUser;
export type ChatSession = SelectChatSession;
export type ChatMessage = SelectChatMessage;
export type UserDocument = SelectUserDocument;
export type UserDocumentVec = SelectUserDocumentVec;
export type ErrorFeedback = SelectErrorFeedback;

// Legacy compatibility exports
export type Chat = SelectChat;
export type Message = SelectMessage;
export type Vote = SelectVote;
export type ContentItem = SelectContentItem;
export type Embedding = SelectEmbedding;

// Abstract Content Management exports
export type ContentType = SelectContentType;
export type Content = SelectContent;
export type ContentRelationship = SelectContentRelationship;

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
