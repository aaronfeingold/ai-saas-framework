'use client';

import { memo } from 'react';

import { DownloadIcon, FileTextIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DocumentToolCallProps {
  documentId: string;
  fileName?: string;
  className?: string;
}

interface DocumentToolResultProps {
  documentId: string;
  fileName?: string;
  content?: string;
  className?: string;
}

function PureDocumentToolCall({
  documentId,
  fileName,
  className,
}: DocumentToolCallProps) {
  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="flex items-center gap-3 p-4">
        <FileTextIcon size={20} />
        <div className="flex-1">
          <div className="font-medium">Processing document...</div>
          <div className="text-muted-foreground text-sm">
            {fileName || `Document ${documentId.slice(0, 8)}...`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PureDocumentToolResult({
  documentId,
  fileName,
  content,
  className,
}: DocumentToolResultProps) {
  const handleDownload = () => {
    // TODO: Implement document download logic
    console.log('Download document:', documentId);
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          {fileName || `Document ${documentId.slice(0, 8)}...`}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <DownloadIcon size={16} />
        </Button>
      </CardHeader>
      {content && (
        <CardContent>
          <div className="text-muted-foreground max-h-32 overflow-y-auto text-sm">
            {content.length > 200 ? `${content.slice(0, 200)}...` : content}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall);
export const DocumentToolResult = memo(PureDocumentToolResult);
