'use client';

import { useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GlobeIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Source {
  id: string;
  type: 'document' | 'website' | 'tool';
  title: string;
  url?: string;
  description?: string;
  excerpt?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

interface MessageSourcesProps {
  sources: Source[];
  className?: string;
}

export function MessageSources({ sources, className }: MessageSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  const getSourceIcon = (type: Source['type']) => {
    switch (type) {
      case 'document':
        return <FileTextIcon className="h-4 w-4" />;
      case 'website':
        return <GlobeIcon className="h-4 w-4" />;
      case 'tool':
        return <ExternalLinkIcon className="h-4 w-4" />;
      default:
        return <FileTextIcon className="h-4 w-4" />;
    }
  };

  const getSourceTypeLabel = (type: Source['type']) => {
    switch (type) {
      case 'document':
        return 'Document';
      case 'website':
        return 'Website';
      case 'tool':
        return 'Tool';
      default:
        return 'Source';
    }
  };

  const formatConfidence = (confidence?: number) => {
    if (!confidence) return null;
    const percentage = Math.round(confidence * 100);
    return (
      <Badge
        variant={
          percentage > 80
            ? 'default'
            : percentage > 60
              ? 'secondary'
              : 'outline'
        }
        className="text-xs"
      >
        {percentage}% match
      </Badge>
    );
  };

  return (
    <div className={cn('w-full', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground flex h-auto w-full items-center justify-between p-2"
          >
            <div className="flex items-center gap-2">
              <ExternalLinkIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {sources.length} source{sources.length !== 1 ? 's' : ''}
              </span>
            </div>
            {isOpen ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 pt-2"
            >
              {sources.map((source, index) => (
                <Card key={source.id || index} className="text-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(source.type)}
                        <span className="truncate text-sm font-medium">
                          {source.title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getSourceTypeLabel(source.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        {formatConfidence(source.confidence)}
                        {source.url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            asChild
                          >
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center"
                            >
                              <ExternalLinkIcon className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>

                  {(source.description || source.excerpt) && (
                    <CardContent className="pt-0">
                      {source.description && (
                        <p className="text-muted-foreground mb-2">
                          {source.description}
                        </p>
                      )}
                      {source.excerpt && (
                        <blockquote className="border-muted text-muted-foreground border-l-2 pl-3 italic">
                          &ldquo;{source.excerpt}&rdquo;
                        </blockquote>
                      )}
                      {source.metadata &&
                        Object.keys(source.metadata).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(source.metadata).map(
                              ([key, value]) => (
                                <Badge
                                  key={key}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {key}: {String(value)}
                                </Badge>
                              )
                            )}
                          </div>
                        )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </motion.div>
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
