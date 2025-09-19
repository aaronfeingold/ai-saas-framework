'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { gt } from 'drizzle-orm';

import { db } from '@/lib/db/postgres';
import {
  createChat as createChatQuery,
  deleteChat as deleteChatQuery,
  getChatById,
  getMessageById,
  updateChatTitle as updateChatTitleQuery,
} from '@/lib/db/queries';
import { messages } from '@/lib/db/schema';
import { getSession } from '@/lib/server/supabase';

export async function deleteTrailingMessages(
  chatId: string,
  messageId: string
) {
  const user = await getSession();

  if (!user) {
    throw new Error('Unauthorized');
  }

  try {
    // Verify chat ownership
    const chat = await getChatById(chatId, user.id);

    if (!chat) {
      throw new Error('Chat not found or unauthorized');
    }

    // Get the message to keep
    const messageToKeep = await getMessageById(messageId, user.id);

    if (!messageToKeep) {
      throw new Error('Message not found');
    }

    // Delete messages created after the specified message
    await db
      .delete(messages)
      .where(gt(messages.createdAt, messageToKeep.createdAt));

    revalidatePath(`/chat/${chatId}`);
  } catch (error) {
    console.error('Error deleting trailing messages:', error);
    throw new Error('Failed to delete messages');
  }
}

export async function deleteChat(chatId: string) {
  const user = await getSession();

  if (!user) {
    throw new Error('Unauthorized');
  }

  try {
    // Delete chat (messages will be deleted via cascade)
    const deleted = await deleteChatQuery(chatId, user.id);

    if (!deleted) {
      throw new Error('Chat not found or unauthorized');
    }

    revalidatePath('/');
    redirect('/');
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw new Error('Failed to delete chat');
  }
}

export async function updateChatTitle(chatId: string, title: string) {
  const user = await getSession();

  if (!user) {
    throw new Error('Unauthorized');
  }

  try {
    const updatedChat = await updateChatTitleQuery(chatId, user.id, title);

    if (!updatedChat) {
      throw new Error('Chat not found or unauthorized');
    }

    revalidatePath(`/chat/${chatId}`);
  } catch (error) {
    console.error('Error updating chat title:', error);
    throw new Error('Failed to update chat title');
  }
}

export async function createChat(): Promise<string> {
  const user = await getSession();

  if (!user) {
    throw new Error('Unauthorized');
  }

  try {
    const newChat = await createChatQuery({
      userId: user.id,
      title: 'New Chat',
      visibility: 'private',
      modelId: 'claude-3-5-sonnet-20241022',
    });

    revalidatePath('/');
    return newChat.id;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw new Error('Failed to create chat');
  }
}
