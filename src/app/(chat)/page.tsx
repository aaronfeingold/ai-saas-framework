import { redirect } from 'next/navigation';

import { nanoid } from 'nanoid';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

export default async function ChatPage() {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  // Generate a new chat ID for new conversations
  const chatId = nanoid();

  return (
    <>
      <Chat
        id={chatId}
        initialMessages={[]}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
