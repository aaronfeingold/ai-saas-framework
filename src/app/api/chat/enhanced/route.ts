import { type NextRequest, NextResponse } from 'next/server';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Attachment, Message } from 'ai';
import { convertToCoreMessages, streamText } from 'ai';
import { nanoid } from 'nanoid';

import {
  type ModelId,
  getAnthropicConfig,
  getGoogleConfig,
  getModel,
  getModelConfig,
  getOpenAIConfig,
  isModelSupported,
} from '@/lib/ai/providers';
import { searchUserDocument } from '@/lib/ai/tools/document-search';
import { websiteSearchTool } from '@/lib/ai/tools/website-search';
import { ensureUserExists } from '@/lib/auth/server/supabase';
import { createServerSupabaseClient } from '@/lib/server/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Initialize Redis for rate limiting
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const getSystemPrompt = (selectedFiles: string[] = []) => {
  const basePrompt = `You are a helpful AI assistant. Answer all questions to the best of your ability. Use tools when necessary. Strive to only use a tool one time per question.

FORMATTING: Your responses are rendered using react-markdown with the following capabilities:
- GitHub Flavored Markdown (GFM) support through remarkGfm plugin
- Syntax highlighting for code blocks through rehypeHighlight plugin
- All standard markdown formatting`;

  if (selectedFiles.length > 0) {
    return `${basePrompt}

IMPORTANT: The user has uploaded ${selectedFiles.length} document(s): ${selectedFiles.join(', ')}.

When answering questions that might be addressed in these documents:
1. ALWAYS use the searchUserDocument tool to retrieve relevant information from the uploaded documents
2. Reference the documents properly in your response with the exact format: [Document title, p.X](<?pdf=Document_title&p=X>)
3. Include direct quotes from the documents when appropriate
4. When information from the documents contradicts your general knowledge, prioritize the document content

For questions not related to the uploaded documents, you can respond based on your general knowledge.`;
  }

  return basePrompt;
};

// Save chat session to database
async function saveChatToDatabase(
  chatSessionId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  fileAttachments: Attachment[] = [],
  reasoningText?: string,
  sources?: unknown,
  toolInvocations?: unknown[]
) {
  const supabase = await createServerSupabaseClient();

  try {
    // Save user message
    await supabase.from('chat_messages').insert({
      id: nanoid(),
      chat_session_id: chatSessionId,
      content: userMessage,
      is_user_message: true,
      attachments: fileAttachments.length > 0 ? fileAttachments : null,
    });

    // Save assistant message
    await supabase.from('chat_messages').insert({
      id: nanoid(),
      chat_session_id: chatSessionId,
      content: assistantMessage,
      is_user_message: false,
      reasoning: reasoningText || null,
      sources: sources || null,
      tool_invocations: toolInvocations?.length ? toolInvocations : null,
    });
  } catch (error) {
    console.error('Error saving chat to database:', error);
  }
}

// Create or get chat session
async function getOrCreateChatSession(
  chatId: string,
  userId: string,
  title?: string
) {
  const supabase = await createServerSupabaseClient();

  // Check if session exists
  const { data: existingSession } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingSession) {
    return existingSession;
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from('chat_sessions')
    .insert({
      id: chatId,
      user_id: userId,
      chat_title: title || 'New Chat',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create chat session: ${error.message}`);
  }

  return newSession;
}

function errorHandler(error: unknown) {
  if (error == null) {
    return 'unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return JSON.stringify(error);
}

export async function POST(req: NextRequest) {
  // Ensure user is authenticated
  const user = await ensureUserExists();
  if (!user) {
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting (if Redis is configured)
  if (redis) {
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '24h'), // 30 messages per 24 hours
    });

    const { success, limit, reset, remaining } = await ratelimit.limit(
      `ratelimit_${user.id}`
    );

    if (!success) {
      return new NextResponse('Rate limit exceeded. Please try again later.', {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset * 1000).toISOString(),
        },
      });
    }
  }

  const body = await req.json();
  const messages: Message[] = body.messages ?? [];
  const chatSessionId = body.chatId;
  const selectedModel = body.selectedModel || 'gpt-4o-mini';
  const selectedFiles: string[] = body.selectedFiles ?? [];

  if (!chatSessionId) {
    return new NextResponse('Chat session ID is required.', {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate model
  if (!isModelSupported(selectedModel)) {
    return new NextResponse(`Model ${selectedModel} is not supported`, {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let fileAttachments: Attachment[] = [];

  // Extract attachments from the last message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === 'user' && lastMessage?.experimental_attachments) {
    fileAttachments = lastMessage.experimental_attachments;
  }

  const userId = user.id;

  // Ensure chat session exists
  await getOrCreateChatSession(chatSessionId, userId);

  // Get model configuration
  const modelConfig = getModelConfig(selectedModel as ModelId);
  const model = getModel(selectedModel as ModelId);

  // Configure provider-specific options
  const providerOptions: Record<string, unknown> = {};

  if (modelConfig.provider === 'anthropic') {
    const anthropicConfig = getAnthropicConfig(selectedModel as ModelId);
    if (anthropicConfig) {
      providerOptions.anthropic = anthropicConfig;
    }
  }

  if (modelConfig.provider === 'google') {
    const googleConfig = getGoogleConfig(selectedModel as ModelId);
    if (googleConfig) {
      providerOptions.google = googleConfig;
    }
  }

  if (modelConfig.provider === 'openai') {
    const openaiConfig = getOpenAIConfig(selectedModel as ModelId);
    if (openaiConfig) {
      providerOptions.openai = openaiConfig;
    }
  }

  try {
    const result = streamText({
      model,
      system: getSystemPrompt(selectedFiles),
      messages: convertToCoreMessages(messages),
      providerOptions,
      tools: {
        searchUserDocument: searchUserDocument({
          userId,
          selectedFiles,
        }),
        websiteSearchTool: websiteSearchTool,
      },
      experimental_activeTools:
        selectedFiles.length > 0
          ? ['searchUserDocument', 'websiteSearchTool']
          : ['websiteSearchTool'],
      maxSteps: 3,
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'enhanced_chat_api',
        metadata: {
          userId: user.id,
          chatId: chatSessionId,
          model: selectedModel,
        },
        recordInputs: true,
        recordOutputs: true,
      },
      onFinish: async (event) => {
        const { text, reasoning, steps, sources } = event;
        const lastMessage = messages[messages.length - 1];
        const lastMessageContent =
          typeof lastMessage.content === 'string' ? lastMessage.content : '';

        const foundReasoningStep = event.steps.find((step) => step.reasoning);
        const reasoningText =
          reasoning ||
          (foundReasoningStep?.reasoning
            ? foundReasoningStep.reasoning
            : undefined);

        await saveChatToDatabase(
          chatSessionId,
          user.id,
          lastMessageContent,
          text,
          fileAttachments,
          reasoningText,
          sources,
          steps.map((step) => step.toolResults).flat()
        );

        console.log('Chat saved to database:', chatSessionId);
      },
      onError: async (error) => {
        console.error('Error processing chat:', error);
      },
    });

    // Consume the stream to ensure onFinish callback is called
    result.consumeStream();

    return result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
      getErrorMessage: errorHandler,
    });
  } catch (error) {
    console.error('Error in enhanced chat API:', error);
    return new NextResponse('Internal server error', {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
