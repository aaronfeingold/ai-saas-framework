'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { format } from 'date-fns';
import {
  ArrowUpDown,
  Edit,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Trash,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

interface DynamicContentTableProps {
  contentType: ContentType;
}

export function DynamicContentTable({ contentType }: DynamicContentTableProps) {
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>(
    'all'
  );
  const [sortField, setSortField] = useState(
    contentType.ui_config.sort_field || 'created_at'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    contentType.ui_config.sort_direction || 'desc'
  );

  const loadContent = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        content_type_id: contentType.id,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        sort_by: sortField,
        sort_direction: sortDirection,
      });

      const response = await fetch(
        `/api/content/${contentType.slug}?${params}`
      );
      if (response.ok) {
        const data = await response.json();
        setContent(data);
      } else {
        toast.error('Failed to load content');
      }
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [
    contentType.id,
    contentType.slug,
    searchTerm,
    statusFilter,
    sortField,
    sortDirection,
  ]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  async function deleteContent(id: string) {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const response = await fetch(`/api/content/${contentType.slug}/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Content deleted');
        loadContent();
      } else {
        toast.error('Failed to delete content');
      }
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  }

  async function publishContent(id: string) {
    try {
      const response = await fetch(
        `/api/content/${contentType.slug}/${id}/publish`,
        {
          method: 'POST',
        }
      );

      if (response.ok) {
        toast.success('Content published');
        loadContent();
      } else {
        toast.error('Failed to publish content');
      }
    } catch (error) {
      console.error('Error publishing content:', error);
      toast.error('Failed to publish content');
    }
  }

  const displayFields =
    contentType.ui_config.list_display ||
    contentType.fields.slice(0, 3).map((f) => f.id);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  if (loading) {
    return <div className="py-8 text-center">Loading content...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{contentType.name} Content</h2>
        <Link href={`/admin/content/${contentType.slug}/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add {contentType.name}
          </Button>
        </Link>
      </div>

      {/* Filters */}
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

      {/* Table */}
      {content.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-4 text-4xl">{contentType.icon || '📄'}</div>
          <h3 className="mb-2 text-lg font-medium">
            No {contentType.name.toLowerCase()} content yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Create your first {contentType.name.toLowerCase()} to get started
          </p>
          <Link href={`/admin/content/${contentType.slug}/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create {contentType.name}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {displayFields.map((fieldId) => {
                  const field = contentType.fields.find(
                    (f) => f.id === fieldId
                  );
                  return (
                    <TableHead
                      key={fieldId}
                      className="cursor-pointer"
                      onClick={() => handleSort(fieldId)}
                    >
                      <div className="flex items-center gap-2">
                        {field?.label || fieldId}
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                  );
                })}
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {content.map((item) => (
                <TableRow key={item.id}>
                  {displayFields.map((fieldId) => (
                    <TableCell key={fieldId}>
                      <ContentFieldDisplay
                        value={item.data[fieldId]}
                        field={contentType.fields.find((f) => f.id === fieldId)}
                      />
                    </TableCell>
                  ))}
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
                            href={`/admin/content/${contentType.slug}/${item.id}`}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/admin/content/${contentType.slug}/${item.id}/edit`}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {item.status === 'draft' && (
                          <DropdownMenuItem
                            onClick={() => publishContent(item.id)}
                          >
                            Publish
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteContent(item.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

interface ContentFieldDisplayProps {
  value: unknown;
  field?: { type: string; label: string };
}

function ContentFieldDisplay({ value, field }: ContentFieldDisplayProps) {
  if (value == null) return <span className="text-muted-foreground">—</span>;

  switch (field?.type) {
    case 'boolean':
      return value ? '✓' : '✗';

    case 'date':
      return format(new Date(value), 'MMM d, yyyy');

    case 'datetime':
      return format(new Date(value), 'MMM d, yyyy HH:mm');

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;

    case 'multi_select':
    case 'tags':
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 3).map((item, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {item}
              </Badge>
            ))}
            {value.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{value.length - 3}
              </Badge>
            )}
          </div>
        );
      }
      return String(value);

    case 'rich_text':
    case 'textarea':
      const text = String(value);
      return (
        <div className="max-w-xs truncate" title={text}>
          {text}
        </div>
      );

    case 'url':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {new URL(value).hostname}
        </a>
      );

    case 'email':
      return (
        <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
          {value}
        </a>
      );

    case 'image':
    case 'file':
      return (
        <span className="cursor-pointer text-blue-600 hover:underline">
          📎 {String(value).split('/').pop()}
        </span>
      );

    default:
      return (
        <div className="max-w-xs truncate" title={String(value)}>
          {String(value)}
        </div>
      );
  }
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
