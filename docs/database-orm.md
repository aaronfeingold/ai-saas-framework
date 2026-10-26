# Database ORM Documentation

## Overview

This project uses **Drizzle ORM** as the primary database ORM (Object-Relational Mapping) layer for PostgreSQL. Drizzle ORM is a modern, type-safe ORM that provides excellent TypeScript support and performance.

## Key Features

- **Type Safety**: Full TypeScript support with type inference
- **SQL-like API**: Familiar SQL syntax for developers
- **Zero Runtime Dependencies**: Lightweight and performant
- **Schema Introspection**: Automatic type generation from database schema
- **Migration Support**: Built-in migration system via `drizzle-kit`

## Dependencies

```json
{
  "drizzle-orm": "^0.44.3",
  "drizzle-kit": "^0.31.4"
}
```

## Database Configuration

The database connection is configured in `src/lib/db/postgres.ts` and exports:

- `db` - Main database instance
- `postgresPool` - Connection pool
- `withTransaction` - Transaction helper
- `batchOperations` - Batch operation helper

## User Management Architecture

The project uses a **hybrid user management approach** combining Supabase Auth with PostgreSQL:

### Authentication Layer (Supabase)

- **Primary Authentication**: Supabase handles user authentication, session management, and security
- **Auth User ID**: Supabase `auth.users.id` serves as the primary user identifier
- **Session Management**: Handled via `src/lib/server/supabase.ts` and `src/lib/server/server.ts`

### User Profile Layer (PostgreSQL + Drizzle)

- **Extended User Data**: PostgreSQL `users` table stores additional profile information
- **Data Synchronization**: User records are created in PostgreSQL when users first authenticate
- **Rich Profiles**: Supports extended fields like `displayName`, `bio`, `avatarUrl`, `timezone`, etc.

### Hybrid Queries

```typescript
// Get Supabase auth user
const authUser = await getSession(); // From Supabase auth

// Get extended profile from PostgreSQL
const userProfile = await db
  .select()
  .from(users)
  .where(eq(users.id, authUser.id)); // Links via same ID

// Auto-sync user on first access
const user = await ensureUserExists(); // Creates PG record if missing
```

## Schema Definition

Database schema is defined in `src/lib/db/schema.ts` using Drizzle's table definitions:

```typescript
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// User profiles table (extends Supabase auth.users)
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // Matches Supabase auth.users.id
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  displayName: text('display_name'), // Public display name
  bio: text('bio'), // User bio/description
  avatarUrl: text('avatar_url'), // Profile picture URL
  timezone: text('timezone').default('UTC'), // User timezone
  preferences: jsonb('preferences').default('{}'), // User preferences
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  emailVerified: boolean('email_verified').default(false),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

## Query Examples

### Authentication Queries

```typescript
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/postgres';
import { users } from '@/lib/db/schema';
import { ensureUserExists, getSession } from '@/lib/server/supabase';

// Get authenticated user from Supabase
const authUser = await getSession();

// Ensure user exists in PostgreSQL (auto-creates if missing)
const user = await ensureUserExists();

// Get user profile from PostgreSQL
const userProfile = await db
  .select()
  .from(users)
  .where(eq(users.id, authUser.id))
  .limit(1);

// Update user profile
const updatedUser = await db
  .update(users)
  .set({
    displayName: 'New Display Name',
    bio: 'Updated bio',
    lastSeenAt: new Date(),
  })
  .where(eq(users.id, authUser.id))
  .returning();
```

### Complex Queries with Relations

```typescript
// Query with joins
const chatsWithMessages = await db
  .select()
  .from(chats)
  .leftJoin(messages, eq(messages.chatId, chats.id))
  .where(eq(chats.userId, userId));
```

### Transactions

```typescript
import { withTransaction } from '@/lib/db/postgres';

const result = await withTransaction(async (tx) => {
  const user = await tx.insert(users).values(userData).returning();
  const profile = await tx
    .insert(profiles)
    .values({
      userId: user[0].id,
      ...profileData,
    })
    .returning();
  return { user: user[0], profile: profile[0] };
});
```

## Vector Support

The project includes PostgreSQL vector support using the `pgvector` extension:

```typescript
import { vector } from 'drizzle-orm/pg-core';

export const embeddings = pgTable('embeddings', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
});
```

## Type Generation

Drizzle automatically generates TypeScript types from the schema:

```typescript
import { type InsertUser, type SelectUser } from '@/lib/db/schema';

// SelectUser - for reading from database
// InsertUser - for inserting into database
```

## Migration System

Database migrations are managed through `drizzle-kit`. Run migrations with:

```bash
npm run db:migrate
```

## Query Organization

Database queries are organized in `src/lib/db/queries.ts` with functions like:

- `getUserChats(userId)` - Get user's chat sessions
- `getChatById(chatId, userId)` - Get specific chat
- `createChat(data)` - Create new chat
- `updateChatTitle(chatId, userId, title)` - Update chat title

## Best Practices

1. **Use Transactions**: For operations that modify multiple tables
2. **Type Safety**: Leverage Drizzle's TypeScript integration
3. **Query Organization**: Keep related queries in dedicated files
4. **Indexes**: Define appropriate indexes in schema for performance
5. **Relations**: Use Drizzle's relation system for complex queries

## Related Files

### Database Layer

- `src/lib/db/schema.ts` - Database schema definitions
- `src/lib/db/postgres.ts` - Database connection and utilities
- `src/lib/db/queries.ts` - Query functions
- `src/lib/db/vector.ts` - Vector database operations

### Authentication Layer

- `src/lib/server/supabase.ts` - Supabase auth integration
- `src/lib/server/server.ts` - Server-side Supabase client
- `src/lib/auth/server/supabase.ts` - User synchronization utilities
- `src/types/database.ts` - TypeScript database types

### Configuration

- `package.json` - Dependencies and scripts
- Environment variables for Supabase configuration
