import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';

import { DynamicContentForm } from '../../components/dynamic-content-form';

interface NewContentPageProps {
  params: {
    slug: string;
  };
}

async function getContentType(slug: string) {
  try {
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

export default async function NewContentPage({ params }: NewContentPageProps) {
  const contentType = await getContentType(params.slug);

  if (!contentType) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Create New {contentType.name}
        </h1>
        <p className="text-muted-foreground">
          Fill out the form below to create a new{' '}
          {contentType.name.toLowerCase()}
        </p>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <Suspense fallback={<FormSkeleton />}>
          <DynamicContentForm contentType={contentType} mode="create" />
        </Suspense>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}
