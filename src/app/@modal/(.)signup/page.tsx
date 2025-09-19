import React from 'react';

import { getSession } from '@/lib/server/supabase';

import Content from '../../(auth)/Content';
import SignUpCard from '../../(auth)/signup/SignUpCard';
import ModalWrapper from '../ModalWrapper';

export const dynamic = 'force-dynamic';

export default async function SignUpModal() {
  const session = await getSession();

  if (session) {
    return null;
  }

  return (
    <ModalWrapper title="Sign up">
      <div className="flex w-full flex-col items-center justify-center gap-2 md:flex-row">
        {/* Left side (Content) - Order changes on mobile */}
        <div className="order-2 flex w-full items-center justify-center rounded-md pb-8 sm:pb-4 md:order-1 md:w-[45.8%] md:pb-0">
          <Content />
        </div>

        {/* Right side (SignUpCard) - Order changes on mobile */}
        <div className="order-1 w-full pt-8 sm:pt-4 md:order-2 md:w-1/2 md:pt-0">
          <SignUpCard />
        </div>
      </div>
    </ModalWrapper>
  );
}
