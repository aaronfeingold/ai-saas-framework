import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/server/supabase';
import { createServerSupabaseClient } from '@/lib/server/server';

export const dynamic = 'force-dynamic';

// GET /api/chat/history - Get chat history for the user
export async function GET(req: NextRequest) {
  const user = await getSession();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search');

  const supabase = await createServerSupabaseClient();

  try {
    let query = supabase
      .from('chat_sessions')
      .select(
        `
        id,
        chat_title,
        created_at,
        updated_at,
        chat_messages!inner(
          id,
          content,
          is_user_message,
          created_at
        )
      `
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    // Add search filter if provided
    if (search) {
      query = query.ilike('chat_title', `%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching chat history:', error);
      return new NextResponse('Internal server error', { status: 500 });
    }

    // Transform the data to include message preview
    const chatHistory =
      sessions?.map((session) => {
        const messages = session.chat_messages || [];
        const lastMessage = messages.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        return {
          id: session.id,
          title: session.chat_title,
          created_at: session.created_at,
          updated_at: session.updated_at,
          message_count: messages.length,
          last_message: lastMessage
            ? {
                content: lastMessage.content?.substring(0, 100) || '',
                is_user_message: lastMessage.is_user_message,
                created_at: lastMessage.created_at,
              }
            : null,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      data: chatHistory,
      pagination: {
        limit,
        offset,
        has_more: chatHistory.length === limit,
      },
    });
  } catch (error) {
    console.error('Error in chat history API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// DELETE /api/chat/history?id=chat_id - Delete a chat session
export async function DELETE(req: NextRequest) {
  const user = await getSession();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('id');

  if (!chatId) {
    return new NextResponse('Chat ID is required', { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  try {
    // Delete the chat session (messages will be deleted via CASCADE)
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting chat session:', error);
      return new NextResponse('Failed to delete chat', { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete chat API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
