'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { format } from 'date-fns';
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  Filter,
  Search,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Content, ContentType } from '@/lib/content/types';

interface ContentWithType extends Content {
  content_type: ContentType;
}

export function ContentModerationQueue() {
  const [content, setContent] = useState<ContentWithType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);

  const loadContentTypes = useCallback(async () => {
    try {
      const response = await fetch('/api/content/types');
      if (response.ok) {
        const data = await response.json();
        setContentTypes(data);
      }
    } catch (error) {
      console.error('Error loading content types:', error);
    }
  }, []);

  const loadPendingContent = useCallback(async () => {
    try {
      // Load content with pending_review status across all content types
      const params = new URLSearchParams({
        status: 'pending_review',
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter !== 'all' && { content_type_id: typeFilter }),
      });

      const response = await fetch(`/api/content/moderation?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContent(data);
      } else {
        toast.error('Failed to load pending content');
      }
    } catch (error) {
      console.error('Error loading pending content:', error);
      toast.error('Failed to load pending content');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, typeFilter]);

  useEffect(() => {
    loadContentTypes();
    loadPendingContent();
  }, [loadContentTypes, loadPendingContent]);

  async function moderateContent(
    id: string,
    action: 'approve' | 'reject',
    reason?: string
  ) {
    try {
      const response = await fetch(`/api/content/moderation/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });

      if (response.ok) {
        toast.success(`Content ${action}d successfully`);
        loadPendingContent();
      } else {
        toast.error(`Failed to ${action} content`);
      }
    } catch (error) {
      console.error(`Error ${action}ing content:`, error);
      toast.error(`Failed to ${action} content`);
    }
  }

  const pendingCount = content.length;
  const urgentCount = content.filter(
    (item) =>
      new Date().getTime() - new Date(item.created_at).getTime() >
      24 * 60 * 60 * 1000
  ).length;

  if (loading) {
    return <div className="py-8 text-center">Loading moderation queue...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-muted-foreground text-xs">
              Items awaiting moderation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {urgentCount}
            </div>
            <p className="text-muted-foreground text-xs">Older than 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content Types</CardTitle>
            <User className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentTypes.length}</div>
            <p className="text-muted-foreground text-xs">
              Active content types
            </p>
          </CardContent>
        </Card>
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

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {contentTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.icon} {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content Queue */}
      {content.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mb-4 text-4xl">🎉</div>
            <h3 className="mb-2 text-lg font-medium">All caught up!</h3>
            <p className="text-muted-foreground">
              No content pending review at the moment
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {content.map((item) => (
            <ModerationCard
              key={item.id}
              content={item}
              onModerate={moderateContent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ModerationCardProps {
  content: ContentWithType;
  onModerate: (
    id: string,
    action: 'approve' | 'reject',
    reason?: string
  ) => void;
}

function ModerationCard({ content, onModerate }: ModerationCardProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const isUrgent =
    new Date().getTime() - new Date(content.created_at).getTime() >
    24 * 60 * 60 * 1000;

  // Get the title field value for display
  const titleField = content.content_type.fields.find(
    (f) => f.id === 'title' || f.id === 'name' || f.type === 'text'
  );
  const title = titleField
    ? content.data[titleField.id]
    : `${content.content_type.name} #${content.id.slice(0, 8)}`;

  return (
    <Card className={isUrgent ? 'border-orange-200' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              {content.content_type.icon} {title}
              {isUrgent && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Urgent
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {content.content_type.name} • Created{' '}
              {format(new Date(content.created_at), 'MMM d, yyyy HH:mm')}
            </CardDescription>
          </div>
          <Badge variant="secondary">Pending Review</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Content preview */}
        <div className="bg-muted/50 space-y-2 rounded-lg p-4">
          {content.content_type.fields.slice(0, 3).map((field) => {
            const value = content.data[field.id];
            if (!value) return null;

            return (
              <div key={field.id} className="text-sm">
                <span className="text-muted-foreground font-medium">
                  {field.label}:{' '}
                </span>
                <span className="truncate">
                  {typeof value === 'string' && value.length > 100
                    ? `${value.substring(0, 100)}...`
                    : String(value)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onModerate(content.id, 'approve')}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive">
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Content</DialogTitle>
                <DialogDescription>
                  Please provide a reason for rejecting this content. This will
                  be sent to the creator.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Explain why this content is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRejectionReason('')}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onModerate(content.id, 'reject', rejectionReason);
                    setRejectionReason('');
                  }}
                  disabled={!rejectionReason.trim()}
                >
                  Reject Content
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Link
            href={`/admin/content/${content.content_type.slug}/${content.id}`}
          >
            <Button size="sm" variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              View Full
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
