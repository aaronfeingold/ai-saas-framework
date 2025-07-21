'use client';

import { memo } from 'react';

import Image from 'next/image';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Artifact } from '@/hooks/use-artifact';

interface ArtifactProps {
  artifact: Artifact | null;
  className?: string;
}

function PureArtifact({ artifact, className }: ArtifactProps) {
  if (!artifact) {
    return (
      <div
        className={`text-muted-foreground flex h-48 items-center justify-center ${className}`}
      >
        No artifact selected
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-medium">{artifact.title}</CardTitle>
        <div className="text-muted-foreground text-sm">
          Type: {artifact.type}
          {artifact.language && ` • Language: ${artifact.language}`}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {artifact.type === 'code' ? (
            <pre className="bg-muted overflow-x-auto rounded-md p-4">
              <code className={`language-${artifact.language || 'text'}`}>
                {artifact.content}
              </code>
            </pre>
          ) : artifact.type === 'image' ? (
            <Image
              src={artifact.content}
              alt={artifact.title}
              width={800}
              height={600}
              className="h-auto max-w-full rounded-md"
            />
          ) : (
            <div className="prose max-w-none">{artifact.content}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const Artifact = memo(PureArtifact);
