import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { PluginManager } from './components/plugin-manager';

export default function PluginsPage() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Plugin Management</h1>
        <p className="text-muted-foreground">
          Manage domain configurations and plugin settings for your SaaS
          platform
        </p>
      </div>

      <Suspense fallback={<PluginsSkeleton />}>
        <PluginManager />
      </Suspense>
    </div>
  );
}

function PluginsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
