import React from 'react';

import { redirect } from 'next/navigation';

import 'server-only';

import { getSession } from '@/lib/server/supabase';

import Content from '../Content';
import SignUpCard from './SignUpCard';

export default async function AuthPage() {
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  return (
    <div className="flex h-auto flex-col justify-between pt-4 md:h-[calc(100vh-44px)]">
      <div className="flex h-full flex-col-reverse justify-center gap-6 p-1 md:h-[calc(100vh-44px)] md:flex-row">
        <Content />
        <SignUpCard />
      </div>
    </div>
  );
}
