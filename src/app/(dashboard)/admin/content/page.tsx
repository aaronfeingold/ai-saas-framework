import { Suspense } from 'react';

import Link from 'next/link';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { ContentTypesList } from './components/content-types-list';

export default function ContentManagementPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Content Management
          </h1>
          <p className="text-muted-foreground">
            Manage your dynamic content types and content instances
          </p>
        </div>
        <Link href="/admin/content/types/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Content Type
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Content Types</CardTitle>
            <CardDescription>
              Configure your dynamic content schemas and field definitions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ContentTypesListSkeleton />}>
              <ContentTypesList />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common content management tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/admin/content/types/new">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Create New Content Type
              </Button>
            </Link>
            <Link href="/admin/content/instances">
              <Button variant="outline" className="w-full justify-start">
                Browse All Content
              </Button>
            </Link>
            <Link href="/admin/content/moderation">
              <Button variant="outline" className="w-full justify-start">
                Content Moderation Queue
              </Button>
            </Link>
            <Link href="/admin/content/festival/setup">
              <Button variant="outline" className="w-full justify-start">
                🎪 Setup Festival Demo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContentTypesListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
