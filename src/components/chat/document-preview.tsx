'use client';

import { memo } from 'react';

import { FileTextIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DocumentPreviewProps {
  document: {
    id: string;
    title: string;
    content?: string;
    type?: string;
    url?: string;
    createdAt?: Date;
  };
  className?: string;
}

function PureDocumentPreview({ document, className }: DocumentPreviewProps) {
  return (
    <Card className={`max-w-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileTextIcon size={20} />
            <CardTitle className="truncate text-sm font-medium">
              {document.title}
            </CardTitle>
          </div>
          {document.type && (
            <Badge variant="secondary" className="text-xs">
              {document.type}
            </Badge>
          )}
        </div>
      </CardHeader>

      {document.content && (
        <CardContent className="pt-0">
          <div className="text-muted-foreground line-clamp-3 text-xs">
            {document.content.length > 150
              ? `${document.content.slice(0, 150)}...`
              : document.content}
          </div>

          {document.createdAt && (
            <div className="text-muted-foreground mt-2 text-xs">
              {document.createdAt.toLocaleDateString()}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export const DocumentPreview = memo(PureDocumentPreview);
