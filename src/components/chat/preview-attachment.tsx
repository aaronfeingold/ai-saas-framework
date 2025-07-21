'use client';

import { memo } from 'react';

import Image from 'next/image';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PreviewAttachmentProps {
  file: {
    name: string;
    type: string;
    url: string;
    size?: number;
  };
  onRemove?: () => void;
  className?: string;
}

function PurePreviewAttachment({
  file,
  onRemove,
  className,
}: PreviewAttachmentProps) {
  const isImage = file.type.startsWith('image/');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={`relative ${className}`}>
      {onRemove && (
        <Button
          variant="ghost"
          size="sm"
          className="bg-background absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full border shadow-sm"
          onClick={onRemove}
        >
          <X size={12} />
        </Button>
      )}
      <CardContent className="p-3">
        {isImage ? (
          <div className="space-y-2">
            <Image
              src={file.url}
              alt={file.name}
              width={200}
              height={128}
              className="h-auto max-h-32 max-w-full rounded object-cover"
            />
            <div className="text-muted-foreground truncate text-xs">
              {file.name}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded">
              <span className="text-xs font-medium">
                {file.type.split('/')[1]?.substring(0, 2).toUpperCase() || 'F'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{file.name}</div>
              {file.size && (
                <div className="text-muted-foreground text-xs">
                  {formatFileSize(file.size)}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const PreviewAttachment = memo(PurePreviewAttachment);
