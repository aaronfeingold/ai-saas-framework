import React from 'react';

import { getSession } from '@/lib/server/supabase';

import Content from '../../(auth)/Content';
import SignInCard from '../../(auth)/login/SignInCard';
import ModalWrapper from '../ModalWrapper';

export const dynamic = 'force-dynamic';

export default async function SignInModal() {
  const session = await getSession();

  if (session) {
    return null;
  }

  return (
    <ModalWrapper title="Sign in">
      <div className="flex flex-wrap items-center justify-center gap-4 overflow-x-hidden">
        <div className="order-2 flex w-full items-center justify-center rounded-md pb-4 sm:pb-2 md:order-1 md:w-5/12 md:pb-0">
          <Content />
        </div>
        <div className="order-1 w-full pt-4 pb-0 sm:pt-2 sm:pb-0 md:order-2 md:w-6/12 md:pt-1 md:pb-1">
          <SignInCard />
        </div>
      </div>
    </ModalWrapper>
  );
}
