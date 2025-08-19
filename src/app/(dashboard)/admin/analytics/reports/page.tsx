import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { AutomatedReports } from './components/automated-reports';
import { CustomReportBuilder } from './components/custom-report-builder';

export default function ReportsPage() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Automated Reporting
        </h1>
        <p className="text-muted-foreground">
          Generate, schedule, and manage automated reports across all platform
          metrics
        </p>
      </div>

      {/* Automated Reports */}
      <Suspense fallback={<ReportsSkeleton />}>
        <AutomatedReports />
      </Suspense>

      {/* Custom Report Builder */}
      <Suspense fallback={<ReportBuilderSkeleton />}>
        <CustomReportBuilder />
      </Suspense>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportBuilderSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border p-6">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
