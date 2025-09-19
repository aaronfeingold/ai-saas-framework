'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  AlertCircleIcon,
  CheckIcon,
  FileIcon,
  LoaderIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  url?: string;
  error?: string;
  documentId?: string;
}

interface DocumentUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
  className?: string;
}

export function DocumentUpload({
  onFilesUploaded,
  maxFiles = 5,
  maxSize = 10,
  acceptedTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'],
  className,
}: DocumentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const updateFileStatus = (
    id: string,
    status: UploadedFile['status'],
    progress: number,
    url?: string,
    error?: string,
    documentId?: string
  ) => {
    setUploadedFiles((prev) =>
      prev.map((file) =>
        file.id === id
          ? { ...file, status, progress, url, error, documentId }
          : file
      )
    );
  };

  const processFile = useCallback(async (uploadFile: UploadedFile) => {
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        updateFileStatus(
          uploadFile.id,
          'uploading',
          Math.min(uploadFile.progress + 10, 90)
        );
      }, 200);

      // Upload to Supabase Storage
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('fileName', uploadFile.name);

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadResult = await uploadResponse.json();

      updateFileStatus(
        uploadFile.id,
        'processing',
        95,
        uploadResult.url,
        undefined,
        uploadResult.documentId
      );

      // Process with LlamaIndex (if configured)
      const processResponse = await fetch('/api/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: uploadResult.documentId,
          fileName: uploadFile.name,
          url: uploadResult.url,
        }),
      });

      if (!processResponse.ok) {
        throw new Error('Processing failed');
      }

      await processResponse.json();

      updateFileStatus(
        uploadFile.id,
        'completed',
        100,
        uploadResult.url,
        undefined,
        uploadResult.documentId
      );
    } catch (error) {
      updateFileStatus(
        uploadFile.id,
        'error',
        100,
        undefined,
        error instanceof Error ? error.message : 'Processing failed'
      );
    }
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
        id: uuidv4(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading' as const,
        progress: 0,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Process each file
      for (const uploadFile of newFiles) {
        try {
          await processFile(uploadFile);
        } catch (error) {
          updateFileStatus(
            uploadFile.id,
            'error',
            100,
            undefined,
            error instanceof Error ? error.message : 'Upload failed'
          );
        }
      }
    },
    [processFile]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive: dropzoneActive,
  } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce(
      (acc, type) => {
        acc[type] = [];
        return acc;
      },
      {} as Record<string, string[]>
    ),
    maxFiles: maxFiles - uploadedFiles.length,
    maxSize: maxSize * 1024 * 1024,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  });

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <LoaderIcon className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckIcon className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <FileIcon className="h-4 w-4" />;
    }
  };

  // Notify parent component when files are completed
  useEffect(() => {
    const completedFiles = uploadedFiles.filter(
      (file) => file.status === 'completed'
    );
    if (completedFiles.length > 0) {
      onFilesUploaded(completedFiles);
    }
  }, [uploadedFiles, onFilesUploaded]);

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragActive || dropzoneActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        )}
      >
        <input {...getInputProps()} />
        <UploadIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h3 className="mb-2 text-lg font-medium">Upload Documents</h3>
        <p className="text-muted-foreground mb-4">
          Drag and drop files here, or click to browse
        </p>
        <div className="text-muted-foreground space-y-1 text-xs">
          <p>Supported formats: {acceptedTypes.join(', ')}</p>
          <p>
            Max file size: {maxSize}MB | Max files: {maxFiles}
          </p>
        </div>
      </div>

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Uploaded Files</h4>
          {uploadedFiles.map((file) => (
            <Card key={file.id} className="p-4">
              <CardContent className="p-0">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {getStatusIcon(file.status)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {file.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="h-8 w-8 p-0"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>

                {(file.status === 'uploading' ||
                  file.status === 'processing') && (
                  <div className="space-y-1">
                    <Progress value={file.progress} className="h-2" />
                    <p className="text-muted-foreground text-xs">
                      {file.status === 'uploading'
                        ? 'Uploading...'
                        : 'Processing...'}
                    </p>
                  </div>
                )}

                {file.status === 'error' && file.error && (
                  <p className="text-sm text-red-500">{file.error}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
