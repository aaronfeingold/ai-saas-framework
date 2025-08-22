'use client';

import { Suspense } from 'react';

import { ErrorBoundary } from 'react-error-boundary';

import { ChatHistorySidebar } from '@/components/chat/chat-history-sidebar';
import { Skeleton } from '@/components/ui/skeleton';

function ChatLayoutFallback() {
  return (
    <div className="flex h-screen">
      <div className="bg-muted/20 w-80 space-y-4 border-r p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}

function ChatErrorFallback({
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold text-red-600">Chat Error</h2>
        <p className="text-muted-foreground">
          Something went wrong loading the chat interface.
        </p>
        <button
          onClick={resetErrorBoundary}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      FallbackComponent={ChatErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className="bg-background flex h-screen">
        <Suspense
          fallback={
            <div className="bg-muted/20 w-80 space-y-4 border-r p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          }
        >
          <ChatHistorySidebar />
        </Suspense>

        <main className="flex-1 overflow-hidden">
          <Suspense fallback={<ChatLayoutFallback />}>{children}</Suspense>
        </main>
      </div>
    </ErrorBoundary>
  );
}
