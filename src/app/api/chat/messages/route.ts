import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/server/supabase';
import { createServerSupabaseClient } from '@/lib/server/server';

export const dynamic = 'force-dynamic';

// GET /api/chat/messages?chatId=xxx - Get messages for a chat session
export async function GET(req: NextRequest) {
  const user = await getSession();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!chatId) {
    return new NextResponse('Chat ID is required', { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  try {
    // First, verify the chat session belongs to the user
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError || !session) {
      return new NextResponse('Chat not found', { status: 404 });
    }

    // Get messages for the chat session
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(
        `
        id,
        content,
        is_user_message,
        reasoning,
        sources,
        tool_invocations,
        attachments,
        created_at
      `
      )
      .eq('chat_session_id', chatId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new NextResponse('Failed to fetch messages', { status: 500 });
    }

    // Transform messages to the expected format
    const transformedMessages =
      messages?.map((msg) => {
        const parts = [];

        // Add text content
        if (msg.content) {
          parts.push({
            type: 'text',
            text: msg.content,
          });
        }

        // Add reasoning if present
        if (msg.reasoning) {
          parts.push({
            type: 'reasoning',
            text: msg.reasoning,
          });
        }

        // Add tool invocations if present
        if (msg.tool_invocations && Array.isArray(msg.tool_invocations)) {
          msg.tool_invocations.forEach((tool, index) => {
            parts.push({
              type: `tool-${tool.type || 'unknown'}`,
              toolCallId: `${msg.id}-tool-${index}`,
              state: 'output-available',
              output: tool.result || tool.output,
            });
          });
        }

        return {
          id: msg.id,
          role: msg.is_user_message ? 'user' : 'assistant',
          parts,
          createdAt: msg.created_at,
          experimental_attachments: msg.attachments || undefined,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      data: transformedMessages,
      pagination: {
        limit,
        offset,
        has_more: transformedMessages.length === limit,
      },
    });
  } catch (error) {
    console.error('Error in messages API:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
