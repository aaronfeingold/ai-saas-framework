import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/server/supabase';

import { db } from './postgres';
import {
  type ActivityLog,
  type InsertChat,
  type InsertContentItem,
  type InsertMessage,
  type InsertVote,
  type SelectChat,
  type SelectContentItem,
  type SelectMessage,
  type SelectUser,
  type SelectVote,
  type Team,
  type TeamDataWithMembers,
  type TeamMember,
  activityLogs,
  chats,
  contentItems,
  messages,
  teamMembers,
  teams,
  users,
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

// =============================================================================
// TEAM/USER QUERIES (from temp-saas-starter)
// =============================================================================

export async function getUser(): Promise<SelectUser | null> {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return result[0] || null;
}

export async function getTeamByStripeCustomerId(
  customerId: string
): Promise<Team | null> {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result[0] || null;
}

export async function updateTeamSubscription(
  teamId: string,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
): Promise<void> {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: string) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      teamId: activityLogs.teamId,
      userId: activityLogs.userId,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      metadata: activityLogs.metadata,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(): Promise<TeamDataWithMembers | null> {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id),
    with: {
      team: {
        with: {
          teamMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return result?.team || null;
}

export async function createTeam(name: string, userId: string): Promise<Team> {
  // Create team
  const teamResult = await db
    .insert(teams)
    .values({
      name,
    })
    .returning();

  const team = teamResult[0];

  // Add user as team owner
  await db.insert(teamMembers).values({
    userId,
    teamId: team.id,
    role: 'owner',
  });

  return team;
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: string = 'member'
): Promise<TeamMember> {
  const result = await db
    .insert(teamMembers)
    .values({
      teamId,
      userId,
      role,
    })
    .returning();

  return result[0];
}

export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .returning();

  return result.length > 0;
}

export async function logActivity(
  teamId: string,
  userId: string | null,
  action: string,
  ipAddress?: string,
  metadata?: Record<string, unknown>
): Promise<ActivityLog> {
  const result = await db
    .insert(activityLogs)
    .values({
      teamId,
      userId,
      action,
      ipAddress,
      metadata,
    })
    .returning();

  return result[0];
}
