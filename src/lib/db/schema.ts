import { z } from 'zod';

// User and Profile Types
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

// Chat and Message Types
export const messageSchema = z.object({
  id: z.string().uuid(),
  chat_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  created_at: z.date(),
});

export type Message = z.infer<typeof messageSchema>;

export const chatSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  visibility: z.enum(['private', 'public', 'organization']).default('private'),
  model_id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type Chat = z.infer<typeof chatSchema>;

// Vote Types
export const voteSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.enum(['up', 'down']),
  created_at: z.date(),
});

export type Vote = z.infer<typeof voteSchema>;

// Subscription Types
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

// Content Types (MongoDB)
export const contentItemSchema = z.object({
  _id: z.string(),
  user_id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  content_type: z.enum(['document', 'image', 'video', 'audio', 'other']),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ContentItem = z.infer<typeof contentItemSchema>;

// Vector Types (PostgreSQL + pgvector)
export const embeddingSchema = z.object({
  id: z.number(),
  content: z.string(),
  embedding: z.array(z.number()),
  metadata: z.record(z.any()).optional(),
  user_id: z.string().uuid().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type Embedding = z.infer<typeof embeddingSchema>;

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
