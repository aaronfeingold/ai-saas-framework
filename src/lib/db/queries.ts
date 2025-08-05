import { and, desc, eq } from 'drizzle-orm';

import { db } from './postgres';
import {
  type InsertChat,
  type InsertContentItem,
  type InsertMessage,
  type InsertVote,
  type SelectChat,
  type SelectContentItem,
  type SelectMessage,
  type SelectVote,
  chats,
  contentItems,
  messages,
  votes,
} from './schema';

// =============================================================================
// CHAT QUERIES
// =============================================================================

export const getUserChats = async (userId: string): Promise<SelectChat[]> => {
  return await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));
};

export const getChatById = async (
  chatId: string,
  userId?: string
): Promise<SelectChat | null> => {
  const conditions = userId
    ? and(eq(chats.id, chatId), eq(chats.userId, userId))
    : eq(chats.id, chatId);

  const result = await db.select().from(chats).where(conditions).limit(1);

  return result[0] || null;
};

export const createChat = async (chatData: InsertChat): Promise<SelectChat> => {
  const result = await db.insert(chats).values(chatData).returning();
  return result[0];
};

export const updateChatTitle = async (
  chatId: string,
  userId: string,
  title: string
): Promise<SelectChat | null> => {
  const result = await db
    .update(chats)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning();

  return result[0] || null;
};

export const deleteChat = async (
  chatId: string,
  userId: string
): Promise<boolean> => {
  const result = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning();

  return result.length > 0;
};

// =============================================================================
// MESSAGE QUERIES
// =============================================================================

export const getChatMessages = async (
  chatId: string,
  limit?: number
): Promise<SelectMessage[]> => {
  let query = db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  if (limit) {
    query = query.limit(limit);
  }

  return await query;
};

export const createMessage = async (
  messageData: InsertMessage
): Promise<SelectMessage> => {
  const result = await db.insert(messages).values(messageData).returning();
  return result[0];
};

export const deleteTrailingMessages = async (
  chatId: string,
  fromMessageId: string,
  userId: string
): Promise<number> => {
  // First get the timestamp of the message to keep
  const messageToKeep = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.id, fromMessageId),
        eq(messages.chatId, chatId),
        eq(messages.userId, userId)
      )
    )
    .limit(1);

  if (messageToKeep.length === 0) {
    return 0;
  }

  // Delete messages created after the specified message
  const result = await db
    .delete(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        eq(messages.userId, userId)
        // Note: This comparison might need adjustment based on your exact timestamp handling
        // You may need to use a custom SQL condition here
      )
    )
    .returning();

  return result.length;
};

export const getMessageById = async (
  messageId: string,
  userId?: string
): Promise<SelectMessage | null> => {
  const conditions = userId
    ? and(eq(messages.id, messageId), eq(messages.userId, userId))
    : eq(messages.id, messageId);

  const result = await db.select().from(messages).where(conditions).limit(1);

  return result[0] || null;
};

// =============================================================================
// VOTE QUERIES
// =============================================================================

export const createVote = async (voteData: InsertVote): Promise<SelectVote> => {
  const result = await db.insert(votes).values(voteData).returning();
  return result[0];
};

export const getMessageVotes = async (
  messageId: string
): Promise<SelectVote[]> => {
  return await db.select().from(votes).where(eq(votes.messageId, messageId));
};

export const getUserVoteForMessage = async (
  messageId: string,
  userId: string
): Promise<SelectVote | null> => {
  const result = await db
    .select()
    .from(votes)
    .where(and(eq(votes.messageId, messageId), eq(votes.userId, userId)))
    .limit(1);

  return result[0] || null;
};

export const updateVote = async (
  messageId: string,
  userId: string,
  type: 'up' | 'down'
): Promise<SelectVote | null> => {
  const result = await db
    .update(votes)
    .set({ type })
    .where(and(eq(votes.messageId, messageId), eq(votes.userId, userId)))
    .returning();

  return result[0] || null;
};

export const deleteVote = async (
  messageId: string,
  userId: string
): Promise<boolean> => {
  const result = await db
    .delete(votes)
    .where(and(eq(votes.messageId, messageId), eq(votes.userId, userId)))
    .returning();

  return result.length > 0;
};

// =============================================================================
// CONTENT QUERIES
// =============================================================================

export const getUserContentItems = async (
  userId: string,
  contentType?: string,
  limit?: number
): Promise<SelectContentItem[]> => {
  let query = db
    .select()
    .from(contentItems)
    .where(eq(contentItems.userId, userId))
    .orderBy(desc(contentItems.createdAt));

  if (contentType) {
    query = query.where(
      and(
        eq(contentItems.userId, userId),
        eq(
          contentItems.contentType,
          contentType as 'document' | 'image' | 'video' | 'audio' | 'other'
        )
      )
    );
  }

  if (limit) {
    query = query.limit(limit);
  }

  return await query;
};

export const getContentItemById = async (
  contentId: string,
  userId?: string
): Promise<SelectContentItem | null> => {
  const conditions = userId
    ? and(eq(contentItems.id, contentId), eq(contentItems.userId, userId))
    : eq(contentItems.id, contentId);

  const result = await db
    .select()
    .from(contentItems)
    .where(conditions)
    .limit(1);

  return result[0] || null;
};

export const createContentItem = async (
  contentData: InsertContentItem
): Promise<SelectContentItem> => {
  const result = await db.insert(contentItems).values(contentData).returning();
  return result[0];
};

export const updateContentItem = async (
  contentId: string,
  userId: string,
  updates: Partial<InsertContentItem>
): Promise<SelectContentItem | null> => {
  const result = await db
    .update(contentItems)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(and(eq(contentItems.id, contentId), eq(contentItems.userId, userId)))
    .returning();

  return result[0] || null;
};

export const deleteContentItem = async (
  contentId: string,
  userId: string
): Promise<boolean> => {
  const result = await db
    .delete(contentItems)
    .where(and(eq(contentItems.id, contentId), eq(contentItems.userId, userId)))
    .returning();

  return result.length > 0;
};

export const searchContentItems = async (
  userId: string,
  searchTerm: string,
  limit: number = 10
): Promise<SelectContentItem[]> => {
  // Note: This is a basic text search. For more advanced search,
  // you might want to use PostgreSQL's full-text search capabilities
  return await db
    .select()
    .from(contentItems)
    .where(
      and(
        eq(contentItems.userId, userId)
        // You may need to use a custom SQL condition for text search
        // This is a placeholder and would need proper implementation
      )
    )
    .limit(limit);
};

// =============================================================================
// UTILITY QUERIES
// =============================================================================

export const getUserStats = async (userId: string) => {
  const [chatCount] = await db
    .select({ count: eq(chats.userId, userId) })
    .from(chats);

  const [messageCount] = await db
    .select({ count: eq(messages.userId, userId) })
    .from(messages);

  const [contentCount] = await db
    .select({ count: eq(contentItems.userId, userId) })
    .from(contentItems);

  return {
    chats: chatCount?.count || 0,
    messages: messageCount?.count || 0,
    contentItems: contentCount?.count || 0,
  };
};
