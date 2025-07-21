'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDatabase } from '@/lib/db/mongodb';
import type { Chat } from '@/lib/db/schema';
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
    const db = await getDatabase();
    const chats = db.collection('chats');
    const messages = db.collection('messages');

    // Verify chat ownership
    const chat = await chats.findOne({
      id: chatId,
      user_id: user.id,
    });

    if (!chat) {
      throw new Error('Chat not found or unauthorized');
    }

    // Delete messages after the specified message ID
    const messageToKeep = await messages.findOne({ id: messageId });

    if (!messageToKeep) {
      throw new Error('Message not found');
    }

    await messages.deleteMany({
      chat_id: chatId,
      created_at: { $gt: messageToKeep.created_at },
    });

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
    const db = await getDatabase();
    const chats = db.collection('chats');
    const messages = db.collection('messages');

    // Verify chat ownership and delete
    const result = await chats.deleteOne({
      id: chatId,
      user_id: user.id,
    });

    if (result.deletedCount === 0) {
      throw new Error('Chat not found or unauthorized');
    }

    // Delete all messages for this chat
    await messages.deleteMany({ chat_id: chatId });

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
    const db = await getDatabase();
    const chats = db.collection('chats');

    const result = await chats.updateOne(
      { id: chatId, user_id: user.id },
      {
        $set: {
          title,
          updated_at: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
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
    const db = await getDatabase();
    const chats = db.collection('chats');

    const chatId = crypto.randomUUID();
    const now = new Date();

    const newChat: Omit<Chat, 'id'> & { id: string } = {
      id: chatId,
      user_id: user.id,
      title: 'New Chat',
      visibility: 'private',
      model_id: 'claude-3-5-sonnet-20241022',
      created_at: now,
      updated_at: now,
    };

    await chats.insertOne(newChat);

    revalidatePath('/');
    return chatId;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw new Error('Failed to create chat');
  }
}
