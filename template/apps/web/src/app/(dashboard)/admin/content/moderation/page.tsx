import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { ContentModerationQueue } from './components/moderation-queue';

export default function ContentModerationPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Content Moderation
        </h1>
        <p className="text-muted-foreground">
          Review and moderate content submissions across all content types
        </p>
      </div>

      <Suspense fallback={<ModerationSkeleton />}>
        <ContentModerationQueue />
      </Suspense>
    </div>
  );
}

function ModerationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 max-w-sm flex-1" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="mb-3 flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="mb-4 h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
