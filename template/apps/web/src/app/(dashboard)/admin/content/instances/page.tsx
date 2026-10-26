'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { format } from 'date-fns';
import { Eye, Filter, MoreHorizontal, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Content, ContentStatus, ContentType } from '@/lib/content/types';

export default function AllContentInstancesPage() {
  const [content, setContent] = useState<
    (Content & { contentType: ContentType })[]
  >([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>(
    'all'
  );
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const loadAllContent = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch content from all content types
      const allContent = [];

      for (const contentType of contentTypes) {
        const params = new URLSearchParams({
          content_type_id: contentType.id,
          ...(searchTerm && { search: searchTerm }),
          ...(statusFilter !== 'all' && { status: statusFilter }),
        });

        const response = await fetch(
          `/api/content/${contentType.slug}?${params}`
        );
        if (response.ok) {
          const data = await response.json();
          const contentWithType = (data.data || data).map((item: Content) => ({
            ...item,
            contentType,
          }));
          allContent.push(...contentWithType);
        }
      }

      // Sort by creation date
      allContent.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setContent(allContent);
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  }, [contentTypes, searchTerm, statusFilter]);

  async function loadContentTypes() {
    try {
      const response = await fetch('/api/content/types');
      if (response.ok) {
        const data = await response.json();
        setContentTypes(data.data || data);
      }
    } catch (error) {
      console.error('Error loading content types:', error);
    }
  }

  useEffect(() => {
    loadAllContent();
    loadContentTypes();
  }, [loadAllContent]);

  // Filter content based on search and filters
  const filteredContent = content.filter((item) => {
    const matchesSearch =
      searchTerm === '' ||
      Object.values(item.data).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesStatus =
      statusFilter === 'all' || item.status === statusFilter;
    const matchesType =
      typeFilter === 'all' || item.contentType.slug === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return <div className="py-8 text-center">Loading all content...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          All Content Instances
        </h1>
        <p className="text-muted-foreground">
          Browse and manage all content across all content types
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{content.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {content.filter((c) => c.status === 'published').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {content.filter((c) => c.status === 'draft').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentTypes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Content</CardTitle>
          <CardDescription>
            Search and filter across all content types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="max-w-sm flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {contentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.slug}>
                    {type.icon} {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ContentStatus | 'all')
              }
            >
              <SelectTrigger className="w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Table */}
      <Card>
        <CardHeader>
          <CardTitle>Content Instances</CardTitle>
          <CardDescription>
            {filteredContent.length} of {content.length} items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredContent.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mb-4 text-4xl">📄</div>
              <h3 className="mb-2 text-lg font-medium">No content found</h3>
              <p className="text-muted-foreground">
                {content.length === 0
                  ? 'Create some content to get started'
                  : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Content</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContent.map((item) => (
                  <TableRow key={`${item.contentType.slug}-${item.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {getContentTitle(item)}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {item.id}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {item.contentType.icon || '📄'}
                        </span>
                        <span>{item.contentType.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/admin/content/${item.contentType.slug}/${item.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/admin/content/${item.contentType.slug}`}
                            >
                              View Type
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getContentTitle(item: Content & { contentType: ContentType }): string {
  // Try common title fields
  const titleFields = ['title', 'name', 'subject', 'heading'];

  for (const field of titleFields) {
    if (item.data[field]) {
      return String(item.data[field]);
    }
  }

  // Fallback to first text field
  const firstTextField = item.contentType.fields.find(
    (f) => f.type === 'text' || f.type === 'textarea'
  );

  if (firstTextField && item.data[firstTextField.id]) {
    return String(item.data[firstTextField.id]).substring(0, 50) + '...';
  }

  return 'Untitled';
}

function StatusBadge({ status }: { status: ContentStatus }) {
  const variants = {
    draft: 'secondary',
    published: 'default',
    archived: 'outline',
    pending_review: 'destructive',
  } as const;

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}
