'use client';

import React from 'react';

import Image from 'next/image';

import {
  Brain,
  Calendar,
  Clock,
  FileText as DocumentIcon,
  Download,
  ExternalLink,
  FileType,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Tag,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface DocumentMetadata {
  id: string;
  title: string;
  file_type: 'document' | 'image';
  content_type: string;
  file_size: number;
  file_url: string;
  total_pages: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  processed_at?: string;
  extracted_text?: string;
  ai_title?: string;
  ai_description?: string;
  ai_maintopics?: string[];
  ai_keyentities?: string[];
}

interface DocumentViewerProps {
  document: DocumentMetadata;
  className?: string;
  showMetadata?: boolean;
  showAIAnalysis?: boolean;
  showExtractedText?: boolean;
}

function ProcessingStatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'Pending',
    },
    processing: {
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Processing',
    },
    completed: {
      color: 'bg-green-100 text-green-800 border-green-200',
      label: 'Completed',
    },
    failed: {
      color: 'bg-red-100 text-red-800 border-red-200',
      label: 'Failed',
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <Badge variant="outline" className={cn('font-medium', config.color)}>
      {config.label}
    </Badge>
  );
}

function MetadataSection({ document }: { document: DocumentMetadata }) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileType className="h-5 w-5" />
          Document Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">
                {formatDate(document.created_at)}
              </span>
            </div>

            {document.processed_at && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">Processed:</span>
                <span className="font-medium">
                  {formatDate(document.processed_at)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <HardDrive className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">Size:</span>
              <span className="font-medium">
                {formatFileSize(document.file_size)}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Layers className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">Pages:</span>
              <span className="font-medium">{document.total_pages}</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="text-muted-foreground h-4 w-4" />
            <span className="text-muted-foreground text-sm">Type:</span>
            <Badge variant="secondary" className="text-xs">
              {document.content_type}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground ml-6 text-sm">Status:</span>
            <ProcessingStatusBadge status={document.processing_status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AIAnalysisSection({ document }: { document: DocumentMetadata }) {
  if (
    !document.ai_title &&
    !document.ai_description &&
    !document.ai_maintopics &&
    !document.ai_keyentities
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5" />
          AI Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {document.ai_title && (
          <div>
            <h4 className="text-muted-foreground mb-1 text-sm font-medium">
              Generated Title
            </h4>
            <p className="text-sm">{document.ai_title}</p>
          </div>
        )}

        {document.ai_description && (
          <div>
            <h4 className="text-muted-foreground mb-1 text-sm font-medium">
              Description
            </h4>
            <p className="text-muted-foreground text-sm">
              {document.ai_description}
            </p>
          </div>
        )}

        {document.ai_maintopics && document.ai_maintopics.length > 0 && (
          <div>
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">
              Main Topics
            </h4>
            <div className="flex flex-wrap gap-1">
              {document.ai_maintopics.map((topic, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {document.ai_keyentities && document.ai_keyentities.length > 0 && (
          <div>
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">
              Key Entities
            </h4>
            <div className="flex flex-wrap gap-1">
              {document.ai_keyentities.map((entity, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  <Users className="mr-1 h-3 w-3" />
                  {entity}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExtractedTextSection({ document }: { document: DocumentMetadata }) {
  if (!document.extracted_text) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DocumentIcon className="h-5 w-5" />
          Extracted Content
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          <pre className="text-muted-foreground text-sm whitespace-pre-wrap">
            {document.extracted_text}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function DocumentViewer({
  document,
  className,
  showMetadata = true,
  showAIAnalysis = true,
  showExtractedText = true,
}: DocumentViewerProps) {
  const isImage = document.file_type === 'image';
  const Icon = isImage ? ImageIcon : DocumentIcon;

  const handleDownload = () => {
    window.open(document.file_url, '_blank');
  };

  const handleOpenExternal = () => {
    window.open(document.file_url, '_blank');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'text-primary-foreground flex h-12 w-12 items-center justify-center rounded-lg',
                  isImage ? 'bg-blue-500' : 'bg-primary'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg leading-tight font-semibold">
                  {document.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {isImage ? 'Image' : 'Document'} • {document.total_pages} page
                  {document.total_pages !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="text-xs"
              >
                <Download className="mr-1 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="text-xs"
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                Open
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Preview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {isImage ? (
            <div className="max-h-[400px] max-w-full overflow-hidden rounded-lg border">
              <Image
                src={document.file_url}
                alt={document.title}
                width={800}
                height={400}
                className="h-auto w-full object-contain"
                style={{ maxHeight: '400px' }}
              />
            </div>
          ) : (
            <div className="bg-muted/50 flex min-h-[200px] items-center justify-center rounded-lg border p-4">
              <div className="text-muted-foreground text-center">
                <DocumentIcon className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <p className="text-sm">Document preview not available</p>
                <p className="mt-1 text-xs">
                  Click &quot;Open&quot; to view the full document
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Section */}
      {showMetadata && <MetadataSection document={document} />}

      {/* AI Analysis Section */}
      {showAIAnalysis && <AIAnalysisSection document={document} />}

      {/* Extracted Text Section */}
      {showExtractedText && <ExtractedTextSection document={document} />}
    </div>
  );
}
