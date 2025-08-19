import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { AIUsageAnalytics } from './components/ai-usage-analytics';
import { ContentAnalytics } from './components/content-analytics';
import { SystemMetricsDashboard } from './components/system-metrics-dashboard';
import { UserActivityMonitor } from './components/user-activity-monitor';

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">
          Monitor system performance, AI usage, content engagement, and user
          activity
        </p>
      </div>

      {/* System Metrics */}
      <Suspense fallback={<MetricsSkeleton title="System Metrics" />}>
        <SystemMetricsDashboard />
      </Suspense>

      {/* AI Usage Analytics */}
      <Suspense fallback={<MetricsSkeleton title="AI Usage Analytics" />}>
        <AIUsageAnalytics />
      </Suspense>

      {/* Content Analytics */}
      <Suspense fallback={<MetricsSkeleton title="Content Analytics" />}>
        <ContentAnalytics />
      </Suspense>

      {/* User Activity */}
      <Suspense fallback={<MetricsSkeleton title="User Activity" />}>
        <UserActivityMonitor />
      </Suspense>
    </div>
  );
}

function MetricsSkeleton({ title: _title }: { title: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="rounded-lg border p-6">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
