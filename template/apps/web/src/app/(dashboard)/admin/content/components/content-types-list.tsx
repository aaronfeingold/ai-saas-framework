'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { Edit, ExternalLink, Eye, Settings, Trash } from 'lucide-react';
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
import type { ContentType } from '@/lib/content/types';

export function ContentTypesList() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContentTypes();
  }, []);

  async function loadContentTypes() {
    try {
      const response = await fetch('/api/content/types');
      if (response.ok) {
        const data = await response.json();
        setContentTypes(data);
      } else {
        toast.error('Failed to load content types');
      }
    } catch (error) {
      console.error('Error loading content types:', error);
      toast.error('Failed to load content types');
    } finally {
      setLoading(false);
    }
  }

  async function deleteContentType(id: string) {
    if (!confirm('Are you sure you want to delete this content type?')) return;

    try {
      const response = await fetch(`/api/content/types/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Content type deleted');
        loadContentTypes();
      } else {
        toast.error('Failed to delete content type');
      }
    } catch (error) {
      console.error('Error deleting content type:', error);
      toast.error('Failed to delete content type');
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  if (contentTypes.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-muted-foreground mb-4 text-sm">
          No content types configured yet
        </p>
        <Link href="/admin/content/types/new">
          <Button size="sm">Create your first content type</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contentTypes.map((contentType) => (
        <ContentTypeCard
          key={contentType.id}
          contentType={contentType}
          onDelete={() => deleteContentType(contentType.id)}
        />
      ))}
    </div>
  );
}

interface ContentTypeCardProps {
  contentType: ContentType;
  onDelete: () => void;
}

function ContentTypeCard({ contentType, onDelete }: ContentTypeCardProps) {
  return (
    <div className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center space-x-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded text-lg">
          {contentType.icon || '📄'}
        </div>
        <div>
          <div className="flex items-center gap-2 font-medium">
            {contentType.name}
            {contentType.is_system && (
              <Badge variant="secondary" className="text-xs">
                System
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground text-sm">
            {contentType.fields.length} fields • {contentType.slug}
          </div>
          {contentType.description && (
            <div className="text-muted-foreground mt-1 text-xs">
              {contentType.description}
            </div>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/content/${contentType.slug}`}>
              <Eye className="mr-2 h-4 w-4" />
              View Content
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/content/${contentType.slug}/new`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Create New
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/admin/content/types/${contentType.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Type
            </Link>
          </DropdownMenuItem>
          {!contentType.is_system && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
