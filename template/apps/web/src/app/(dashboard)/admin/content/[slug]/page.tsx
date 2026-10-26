import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';

import { DynamicContentTable } from '../components/dynamic-content-table';

interface ContentTypePageProps {
  params: {
    slug: string;
  };
}

async function getContentType(slug: string) {
  try {
    // In a real app, you'd fetch this from your API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/content/types`
    );
    if (!response.ok) return null;

    const contentTypes = await response.json();
    return contentTypes.find((ct: { slug: string }) => ct.slug === slug);
  } catch {
    return null;
  }
}

export default async function ContentTypePage({
  params,
}: ContentTypePageProps) {
  const contentType = await getContentType(params.slug);

  if (!contentType) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <Suspense fallback={<ContentTableSkeleton />}>
        <DynamicContentTable contentType={contentType} />
      </Suspense>
    </div>
  );
}

function ContentTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="flex gap-4">
        <Skeleton className="h-10 max-w-sm flex-1" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="rounded-lg border">
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
