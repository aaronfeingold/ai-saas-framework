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
// TEAM & SUBSCRIPTION MANAGEMENT (from temp-saas-starter)
// =============================================================================

// Teams table for multi-tenant SaaS with Stripe integration
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripeProductId: text('stripe_product_id'),
    planName: text('plan_name'),
    subscriptionStatus: text('subscription_status'),
  },
  (table) => ({
    stripeCustomerIdx: uniqueIndex('idx_teams_stripe_customer').on(
      table.stripeCustomerId
    ),
    stripeSubscriptionIdx: uniqueIndex('idx_teams_stripe_subscription').on(
      table.stripeSubscriptionId
    ),
  })
);

// Team members for role-based access control
export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner', 'admin', 'member'
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userTeamIdx: uniqueIndex('idx_team_members_user_team').on(
      table.userId,
      table.teamId
    ),
    teamIdx: index('idx_team_members_team').on(table.teamId),
    userIdx: index('idx_team_members_user').on(table.userId),
  })
);

// Activity logs for audit trails
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    teamIdx: index('idx_activity_logs_team').on(table.teamId),
    timestampIdx: index('idx_activity_logs_timestamp').on(table.timestamp),
    actionIdx: index('idx_activity_logs_action').on(table.action),
  })
);

// Team invitations
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedAt: timestamp('invited_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'declined'
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: index('idx_invitations_email').on(table.email),
    teamIdx: index('idx_invitations_team').on(table.teamId),
    tokenIdx: uniqueIndex('idx_invitations_token').on(table.token),
    statusIdx: index('idx_invitations_status').on(table.status),
  })
);

// =============================================================================
// EMAIL SYSTEM TABLES
// =============================================================================

// Email templates for dynamic template management
export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // template identifier (e.g., 'welcome', 'payment-confirmation')
    displayName: text('display_name').notNull(), // human-readable name
    description: text('description'),
    category: text('category').notNull().default('transactional'), // 'transactional', 'marketing', 'system'
    subject: text('subject').notNull(),
    htmlContent: text('html_content').notNull(),
    textContent: text('text_content'),
    variables: jsonb('variables').default('[]'), // array of variable definitions
    isActive: boolean('is_active').default(true),
    isSystem: boolean('is_system').default(false), // cannot be deleted
    version: integer('version').default(1),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex('idx_email_templates_name').on(table.name),
    categoryIdx: index('idx_email_templates_category').on(table.category),
    activeIdx: index('idx_email_templates_active').on(table.isActive),
    createdByIdx: index('idx_email_templates_created_by').on(table.createdBy),
  })
);

// Email logs for tracking sent emails
export const emailLogs = pgTable(
  'email_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    template: text('template').notNull(), // template name
    variables: jsonb('variables'),
    status: text('status').notNull().default('pending'), // 'pending', 'sent', 'delivered', 'bounced', 'failed'
    resendId: text('resend_id'), // Resend message ID
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    bouncedAt: timestamp('bounced_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    toIdx: index('idx_email_logs_to').on(table.to),
    templateIdx: index('idx_email_logs_template').on(table.template),
    statusIdx: index('idx_email_logs_status').on(table.status),
    resendIdIdx: index('idx_email_logs_resend_id').on(table.resendId),
    createdAtIdx: index('idx_email_logs_created_at').on(table.createdAt.desc()),
    sentAtIdx: index('idx_email_logs_sent_at').on(table.sentAt),
  })
);

// Email template versions for version control
export const emailTemplateVersions = pgTable(
  'email_template_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => emailTemplates.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    subject: text('subject').notNull(),
    htmlContent: text('html_content').notNull(),
    textContent: text('text_content'),
    variables: jsonb('variables').default('[]'),
    changeNote: text('change_note'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    templateVersionIdx: uniqueIndex('idx_template_versions_template_version').on(
      table.templateId,
      table.version
    ),
    templateIdx: index('idx_template_versions_template').on(table.templateId),
    createdByIdx: index('idx_template_versions_created_by').on(table.createdBy),
    createdAtIdx: index('idx_template_versions_created_at').on(table.createdAt.desc()),
  })
);

// User notification preferences
export const userNotificationPreferences = pgTable(
  'user_notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emailEnabled: boolean('email_enabled').default(true),
    marketingEmails: boolean('marketing_emails').default(false),
    productUpdates: boolean('product_updates').default(true),
    securityAlerts: boolean('security_alerts').default(true),
    billingNotifications: boolean('billing_notifications').default(true),
    unsubscribedFromAll: boolean('unsubscribed_from_all').default(false),
    unsubscribeToken: text('unsubscribe_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex('idx_user_notification_preferences_user').on(table.userId),
    tokenIdx: uniqueIndex('idx_user_notification_preferences_token').on(table.unsubscribeToken),
  })
);

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
    displayName: text('display_name'), // Public display name
    bio: text('bio'), // User bio/description
    avatarUrl: text('avatar_url'), // Profile picture URL
    timezone: text('timezone').default('UTC'), // User timezone
    preferences: jsonb('preferences').default('{}'), // User preferences (theme, notifications, etc.)
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }), // Last activity timestamp
    emailVerified: boolean('email_verified').default(false), // Email verification status
    twoFactorEnabled: boolean('two_factor_enabled').default(false), // 2FA status
    profileCompletedAt: timestamp('profile_completed_at', {
      withTimezone: true,
    }), // Profile completion timestamp
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    displayNameIdx: index('idx_users_display_name').on(table.displayName),
    lastSeenIdx: index('idx_users_last_seen').on(table.lastSeenAt),
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

// Document storage and management (enhanced for universal file support)
export const userDocuments = pgTable(
  'user_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),

    // File type classification
    fileType: text('file_type').notNull().default('document'), // 'document', 'image', 'video', 'audio'
    contentType: text('content_type'), // MIME type
    fileSize: integer('file_size'), // File size in bytes
    fileUrl: text('file_url'), // Public URL to the file

    // Processing metadata
    processingStatus: text('processing_status').default('pending'), // 'pending', 'processing', 'completed', 'failed'
    processedAt: timestamp('processed_at', { withTimezone: true }),

    // Content analysis
    extractedText: text('extracted_text'), // OCR text from images or extracted text from PDFs

    // Existing fields (from temp-supabase-auth compatibility)
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
    fileTypeIdx: index('idx_user_documents_file_type').on(table.fileType),
    processingStatusIdx: index('idx_user_documents_processing_status').on(
      table.processingStatus
    ),
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

// Email System Relations
export const emailTemplatesRelations = relations(emailTemplates, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
  versions: many(emailTemplateVersions),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailLogs.template],
    references: [emailTemplates.name],
  }),
}));

export const emailTemplateVersionsRelations = relations(emailTemplateVersions, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailTemplateVersions.templateId],
    references: [emailTemplates.id],
  }),
  createdBy: one(users, {
    fields: [emailTemplateVersions.createdBy],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));

// Team System Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

// Enhanced Chat System Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
  userDocuments: many(userDocuments),
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitationsSent: many(invitations),
  userSessions: many(userSessions),
  securityEvents: many(securityEvents),
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

// User Sessions Relations
export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// Security Events Relations
export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  user: one(users, {
    fields: [securityEvents.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// EMAIL SYSTEM TABLES
// =============================================================================

// Email logs for tracking sent emails
export const emailLogs = pgTable(
  'email_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    to: text('to').notNull(), // Recipient email address
    subject: text('subject').notNull(), // Email subject
    template: text('template').notNull(), // Template used (welcome, password-reset, etc.)
    status: text('status').notNull().default('pending'), // pending, sent, delivered, bounced, failed
    resendId: text('resend_id'), // Resend message ID
    variables: jsonb('variables'), // Template variables used
    error: text('error'), // Error message if failed
    sentAt: timestamp('sent_at', { withTimezone: true }), // When email was sent
    deliveredAt: timestamp('delivered_at', { withTimezone: true }), // When email was delivered
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    toIdx: index('idx_email_logs_to').on(table.to),
    statusIdx: index('idx_email_logs_status').on(table.status),
    templateIdx: index('idx_email_logs_template').on(table.template),
    createdAtIdx: index('idx_email_logs_created_at').on(table.createdAt.desc()),
    resendIdIdx: index('idx_email_logs_resend_id').on(table.resendId),
  })
);

// Email templates for storing reusable templates (Phase 2)
export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(), // Template identifier
    displayName: text('display_name').notNull(), // Human-readable name
    description: text('description'), // Template description
    subject: text('subject').notNull(), // Default subject line
    category: text('category').notNull().default('transactional'), // transactional, marketing, system
    isActive: boolean('is_active').notNull().default(true), // Whether template is active
    variables: jsonb('variables').default('{}'), // Required variables schema
    createdBy: uuid('created_by').notNull(), // User who created the template
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex('idx_email_templates_name').on(table.name),
    categoryIdx: index('idx_email_templates_category').on(table.category),
    activeIdx: index('idx_email_templates_active').on(table.isActive),
    createdByIdx: index('idx_email_templates_created_by').on(table.createdBy),
  })
);

// Email campaigns for bulk/marketing emails (Phase 4)
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // Campaign name
    subject: text('subject').notNull(), // Email subject
    templateId: uuid('template_id').references(() => emailTemplates.id),
    status: text('status').notNull().default('draft'), // draft, scheduled, sending, sent, failed
    recipientCount: integer('recipient_count').default(0), // Total recipients
    sentCount: integer('sent_count').default(0), // Successfully sent
    failedCount: integer('failed_count').default(0), // Failed sends
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }), // When to send
    startedAt: timestamp('started_at', { withTimezone: true }), // When sending started
    completedAt: timestamp('completed_at', { withTimezone: true }), // When sending completed
    createdBy: uuid('created_by').notNull(), // User who created the campaign
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index('idx_email_campaigns_status').on(table.status),
    scheduledAtIdx: index('idx_email_campaigns_scheduled').on(table.scheduledAt),
    createdByIdx: index('idx_email_campaigns_created_by').on(table.createdBy),
    templateIdx: index('idx_email_campaigns_template').on(table.templateId),
  })
);

// Email campaign recipients for tracking individual sends (Phase 4)
export const emailCampaignRecipients = pgTable(
  'email_campaign_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    email: text('email').notNull(), // Recipient email
    status: text('status').notNull().default('pending'), // pending, sent, delivered, bounced, failed
    resendId: text('resend_id'), // Resend message ID
    error: text('error'), // Error message if failed
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    campaignIdx: index('idx_email_campaign_recipients_campaign').on(table.campaignId),
    emailIdx: index('idx_email_campaign_recipients_email').on(table.email),
    statusIdx: index('idx_email_campaign_recipients_status').on(table.status),
    campaignEmailIdx: uniqueIndex('idx_campaign_recipients_campaign_email').on(
      table.campaignId,
      table.email
    ),
  })
);

// Email Relations
export const emailLogsRelations = relations(emailLogs, ({ one }) => ({}));

export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  campaigns: many(emailCampaigns),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({ one, many }) => ({
  template: one(emailTemplates, {
    fields: [emailCampaigns.templateId],
    references: [emailTemplates.id],
  }),
  recipients: many(emailCampaignRecipients),
}));

export const emailCampaignRecipientsRelations = relations(
  emailCampaignRecipients,
  ({ one }) => ({
    campaign: one(emailCampaigns, {
      fields: [emailCampaignRecipients.campaignId],
      references: [emailCampaigns.id],
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

// Team System schemas
export const insertTeamSchema = createInsertSchema(teams);
export const selectTeamSchema = createSelectSchema(teams);
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type SelectTeam = z.infer<typeof selectTeamSchema>;

export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export const selectTeamMemberSchema = createSelectSchema(teamMembers);
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type SelectTeamMember = z.infer<typeof selectTeamMemberSchema>;

export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const selectActivityLogSchema = createSelectSchema(activityLogs);
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type SelectActivityLog = z.infer<typeof selectActivityLogSchema>;

export const insertInvitationSchema = createInsertSchema(invitations);
export const selectInvitationSchema = createSelectSchema(invitations);
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type SelectInvitation = z.infer<typeof selectInvitationSchema>;

// Email System schemas
export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates);
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type SelectEmailTemplate = z.infer<typeof selectEmailTemplateSchema>;

export const insertEmailLogSchema = createInsertSchema(emailLogs);
export const selectEmailLogSchema = createSelectSchema(emailLogs);
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type SelectEmailLog = z.infer<typeof selectEmailLogSchema>;

export const insertEmailTemplateVersionSchema = createInsertSchema(emailTemplateVersions);
export const selectEmailTemplateVersionSchema = createSelectSchema(emailTemplateVersions);
export type InsertEmailTemplateVersion = z.infer<typeof insertEmailTemplateVersionSchema>;
export type SelectEmailTemplateVersion = z.infer<typeof selectEmailTemplateVersionSchema>;

export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences);
export const selectUserNotificationPreferencesSchema = createSelectSchema(userNotificationPreferences);
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type SelectUserNotificationPreferences = z.infer<typeof selectUserNotificationPreferencesSchema>;

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

// User Sessions schemas
export const insertUserSessionSchema = createInsertSchema(userSessions);
export const selectUserSessionSchema = createSelectSchema(userSessions);
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type SelectUserSession = z.infer<typeof selectUserSessionSchema>;

// Security Events schemas
export const insertSecurityEventSchema = createInsertSchema(securityEvents);
export const selectSecurityEventSchema = createSelectSchema(securityEvents);
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SelectSecurityEvent = z.infer<typeof selectSecurityEventSchema>;

// Email System schemas
export const insertEmailLogSchema = createInsertSchema(emailLogs);
export const selectEmailLogSchema = createSelectSchema(emailLogs);
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type SelectEmailLog = z.infer<typeof selectEmailLogSchema>;

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates);
export const selectEmailTemplateSchema = createSelectSchema(emailTemplates);
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type SelectEmailTemplate = z.infer<typeof selectEmailTemplateSchema>;

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns);
export const selectEmailCampaignSchema = createSelectSchema(emailCampaigns);
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type SelectEmailCampaign = z.infer<typeof selectEmailCampaignSchema>;

export const insertEmailCampaignRecipientSchema = createInsertSchema(emailCampaignRecipients);
export const selectEmailCampaignRecipientSchema = createSelectSchema(emailCampaignRecipients);
export type InsertEmailCampaignRecipient = z.infer<typeof insertEmailCampaignRecipientSchema>;
export type SelectEmailCampaignRecipient = z.infer<typeof selectEmailCampaignRecipientSchema>;

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

// Team System exports
export type Team = SelectTeam;
export type TeamMember = SelectTeamMember;
export type ActivityLog = SelectActivityLog;
export type Invitation = SelectInvitation;

// Team types with relations (matching temp-saas-starter)
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<SelectUser, 'id' | 'email' | 'fullName'>;
  })[];
};

// Activity type enum (matching temp-saas-starter)
export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

// =============================================================================
// USER SESSIONS & SECURITY
// =============================================================================

// User sessions for tracking active sessions and security events
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull().unique(),
    deviceInfo: text('device_info'), // User agent, device type
    ipAddress: text('ip_address'),
    location: text('location'), // City, country from IP
    isActive: boolean('is_active').default(true),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index('idx_user_sessions_user').on(table.userId),
    sessionTokenIdx: uniqueIndex('idx_user_sessions_token').on(
      table.sessionToken
    ),
    activeIdx: index('idx_user_sessions_active').on(table.isActive),
    expiresIdx: index('idx_user_sessions_expires').on(table.expiresAt),
  })
);

// Security events log
export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type').notNull(), // 'login', 'logout', 'password_change', 'email_change', etc.
    eventData: jsonb('event_data').default('{}'), // Additional event details
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    success: boolean('success').default(true),
    riskScore: integer('risk_score').default(0), // 0-100 risk assessment
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdx: index('idx_security_events_user').on(table.userId),
    eventTypeIdx: index('idx_security_events_type').on(table.eventType),
    createdAtIdx: index('idx_security_events_created').on(table.createdAt),
    riskScoreIdx: index('idx_security_events_risk').on(table.riskScore),
  })
);

// Enhanced Chat System exports
export type UserProfile = SelectUser;
export type ChatSession = SelectChatSession;
export type ChatMessage = SelectChatMessage;
export type UserDocument = SelectUserDocument;
export type UserDocumentVec = SelectUserDocumentVec;
export type ErrorFeedback = SelectErrorFeedback;
export type UserSession = SelectUserSession;
export type SecurityEvent = SelectSecurityEvent;

// Email System exports
export type EmailLog = SelectEmailLog;
export type EmailTemplate = SelectEmailTemplate;
export type EmailCampaign = SelectEmailCampaign;
export type EmailCampaignRecipient = SelectEmailCampaignRecipient;

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
