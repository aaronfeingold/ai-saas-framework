'use client';

import React, { useCallback, useState } from 'react';

import {
  X as CloseIcon,
  Upload as CloudUploadIcon,
  FileText as DocumentIcon,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import type { FileRejection, FileWithPath } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const SUPPORTED_FILE_TYPES: Record<string, string[]> = {
  // Documents
  'application/pdf': ['.pdf', '.PDF'],
  'application/msword': ['.doc', '.DOC'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
    '.DOCX',
  ],
  'text/plain': ['.txt', '.TXT'],
  'text/markdown': ['.md', '.MD'],
  // Images
  'image/jpeg': ['.jpg', '.jpeg', '.JPG', '.JPEG'],
  'image/png': ['.png', '.PNG'],
  'image/webp': ['.webp', '.WEBP'],
  'image/gif': ['.gif', '.GIF'],
  'image/bmp': ['.bmp', '.BMP'],
  'image/tiff': ['.tiff', '.tif', '.TIFF', '.TIF'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB in bytes

export interface UploadResult {
  success: boolean;
  documentId?: string;
  url?: string;
  fileName?: string;
  fileType?: 'document' | 'image';
  error?: string;
}

interface FileUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
  onUploadProgress?: (progress: number) => void;
  onUploadStart?: () => void;
  onError?: (error: string) => void;
  className?: string;
  maxFileSize?: number;
  supportedTypes?: Record<string, string[]>;
  multiple?: boolean;
}

function ProgressIndicator({
  value,
  status,
  severity = 'info',
}: {
  value: number;
  status: string;
  severity?: 'info' | 'error' | 'success';
}) {
  const statusesWithSpinner = [
    'Uploading file...',
    'Processing document...',
    'Analyzing content...',
    'Generating embeddings...',
    'Finalizing...',
  ];

  const shouldShowSpinner = statusesWithSpinner.includes(status);

  return (
    <div className="space-y-2">
      <div className="flex w-full items-center">
        <div className="mr-2 w-full">
          <Progress
            value={value}
            className="bg-muted [&>div]:bg-primary h-2 rounded-md [&>div]:transition-transform [&>div]:duration-300 [&>div]:ease-linear"
          />
        </div>
        <div className="min-w-[35px]">
          <p className="text-muted-foreground text-sm">{Math.round(value)}%</p>
        </div>
      </div>
      <div className="ml-1 flex min-h-[20px] items-center gap-1">
        <p
          className={cn(
            'flex items-center gap-1 text-sm font-medium transition-opacity duration-300',
            severity === 'error' ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {status}
          {shouldShowSpinner && (
            <Loader2 className="text-primary h-4 w-4 animate-spin" />
          )}
        </p>
      </div>
    </div>
  );
}

function FilePreview({
  file,
  onRemove,
  isUploading = false,
}: {
  file: FileWithPath;
  onRemove: () => void;
  isUploading?: boolean;
}) {
  const isImage = file.type.startsWith('image/');
  const Icon = isImage ? ImageIcon : DocumentIcon;

  return (
    <Card className="bg-card/50 rounded-lg p-4 shadow-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'text-primary-foreground flex h-10 w-10 items-center justify-center rounded-lg',
              isImage ? 'bg-blue-500' : 'bg-primary'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="max-w-[80%] min-w-0">
            <p className="text-foreground mb-0.5 line-clamp-2 overflow-hidden leading-tight font-medium break-words">
              {file.name}
            </p>
            <p className="text-muted-foreground text-sm">
              {(file.size / (1024 * 1024)).toFixed(2)} MB •{' '}
              {isImage ? 'Image' : 'Document'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={isUploading}
          className="text-foreground hover:text-destructive"
        >
          <CloseIcon className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export default function FileUpload({
  onUploadComplete,
  onUploadProgress,
  onUploadStart,
  onError,
  className,
  maxFileSize = MAX_FILE_SIZE,
  supportedTypes = SUPPORTED_FILE_TYPES,
  multiple = false,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPath[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [statusSeverity, setStatusSeverity] = useState<
    'info' | 'error' | 'success'
  >('info');

  const validateFile = useCallback(
    (files: FileWithPath[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          onError?.(
            `File too large. Maximum size: ${Math.round(maxFileSize / (1024 * 1024))}MB`
          );
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          onError?.('File type not supported');
        } else {
          onError?.('File validation failed');
        }
        return false;
      }
      return true;
    },
    [maxFileSize, onError]
  );

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[], fileRejections: FileRejection[]) => {
      if (validateFile(acceptedFiles, fileRejections)) {
        if (multiple) {
          setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
        } else {
          setSelectedFiles(acceptedFiles.slice(0, 1));
        }
      }
    },
    [multiple, validateFile]
  );

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: FileWithPath): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);

    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }

      const result = await response.json();
      return {
        success: true,
        documentId: result.documentId,
        url: result.url,
        fileName: result.fileName,
        fileType: result.fileType,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  };

  const processFile = async (
    documentId: string,
    fileName: string,
    url: string
  ) => {
    try {
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          fileName,
          url,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Processing failed');
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Processing failed'
      );
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setStatusSeverity('info');
    onUploadStart?.();

    try {
      const totalFiles = selectedFiles.length;
      let completedFiles = 0;

      for (const file of selectedFiles) {
        // Upload phase
        setUploadStatus('Uploading file...');
        setUploadProgress(Math.round((completedFiles / totalFiles) * 40));
        onUploadProgress?.(Math.round((completedFiles / totalFiles) * 40));

        const uploadResult = await uploadFile(file);

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload failed');
        }

        // Processing phase
        setUploadStatus('Processing document...');
        setUploadProgress(Math.round((completedFiles / totalFiles) * 70));
        onUploadProgress?.(Math.round((completedFiles / totalFiles) * 70));

        await processFile(
          uploadResult.documentId!,
          uploadResult.fileName!,
          uploadResult.url!
        );

        completedFiles++;
        setUploadProgress(Math.round((completedFiles / totalFiles) * 100));
        onUploadProgress?.(Math.round((completedFiles / totalFiles) * 100));

        onUploadComplete?.(uploadResult);
      }

      setUploadStatus('Upload completed successfully!');
      setStatusSeverity('success');
      setSelectedFiles([]);

      // Reset after 3 seconds
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus('');
      }, 3000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      setUploadStatus(errorMessage);
      setStatusSeverity('error');
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: supportedTypes,
    maxSize: maxFileSize,
    multiple,
  });

  return (
    <div className={cn('bg-background mx-auto max-w-[550px]', className)}>
      {selectedFiles.length === 0 ? (
        <div
          {...getRootProps()}
          className={cn(
            'flex min-h-[120px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary hover:bg-primary/5'
          )}
        >
          <input {...getInputProps()} />
          <div className="space-y-3">
            <div className="flex justify-center">
              <CloudUploadIcon
                className={cn(
                  'h-12 w-12 transition-colors duration-200',
                  isDragActive ? 'text-primary' : 'text-foreground'
                )}
              />
            </div>
            <div className="space-y-2">
              <h6
                className={cn(
                  'text-lg font-semibold transition-colors duration-200',
                  isDragActive ? 'text-primary' : 'text-foreground'
                )}
              >
                {isDragActive ? 'Drop files here...' : 'Drag files here'}
              </h6>
              <p className="text-muted-foreground">Or</p>
              <Button
                variant="outline"
                className="text-foreground border-border hover:border-primary hover:bg-transparent"
                type="button"
              >
                Browse Files
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                Supported: PDF, DOCX, TXT, MD, JPG, PNG, WEBP
              </p>
              <p className="text-muted-foreground/70 text-xs italic">
                Maximum file size: {Math.round(maxFileSize / (1024 * 1024))}MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedFiles.map((file, index) => (
            <FilePreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => handleRemoveFile(index)}
              isUploading={isUploading}
            />
          ))}

          {(isUploading || uploadProgress > 0) && (
            <div className="mt-4">
              <ProgressIndicator
                value={uploadProgress}
                status={uploadStatus}
                severity={statusSeverity}
              />
              {uploadStatus && statusSeverity === 'error' && (
                <Alert variant="destructive" className="mt-2 rounded-lg">
                  <AlertDescription>{uploadStatus}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1 rounded-lg py-2 font-semibold disabled:opacity-50"
            >
              <CloudUploadIcon className="mr-2 h-5 w-5" />
              {isUploading
                ? 'Processing...'
                : `Upload ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`}
            </Button>

            {!isUploading && (
              <Button
                variant="outline"
                onClick={() => setSelectedFiles([])}
                className="px-4"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
