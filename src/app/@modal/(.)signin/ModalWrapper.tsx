// ModalWrapper.tsx
'use client';

import React from 'react';

import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// ModalWrapper.tsx

interface ModalWrapperProps {
  children: React.ReactNode;
}

export default function ModalWrapper({ children }: ModalWrapperProps) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={() => router.back()}>
      <DialogTitle className="bg-background text-white">Sign in</DialogTitle>
      <DialogContent className="bg-background my-2 max-h-[90vh] w-[95%] overflow-x-hidden overflow-y-auto rounded-lg p-4 shadow-lg sm:max-w-[90%] sm:p-6 md:max-w-[90%] md:p-6 lg:max-w-[1200px]">
        {children}
      </DialogContent>
    </Dialog>
  );
}
