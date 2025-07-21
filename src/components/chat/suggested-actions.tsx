'use client';

import { memo } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SuggestedAction {
  title: string;
  action: string;
  icon?: React.ReactNode;
}

interface SuggestedActionsProps {
  onActionClick: (action: string) => void;
  className?: string;
}

const defaultSuggestions: SuggestedAction[] = [
  {
    title: 'Explain a concept',
    action: 'Can you explain how machine learning works?',
  },
  {
    title: 'Write code',
    action: 'Write a React component for a todo list',
  },
  {
    title: 'Analyze data',
    action: 'How can I analyze customer feedback data?',
  },
  {
    title: 'Creative writing',
    action: 'Write a short story about artificial intelligence',
  },
];

function PureSuggestedActions({
  onActionClick,
  className,
}: SuggestedActionsProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-muted-foreground text-sm font-medium">
        Suggested actions:
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {defaultSuggestions.map((suggestion, index) => (
          <Card key={index} className="p-0">
            <Button
              variant="ghost"
              className="h-auto w-full flex-col items-start justify-start p-3 text-left"
              onClick={() => onActionClick(suggestion.action)}
            >
              <div className="text-sm font-medium">{suggestion.title}</div>
              <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {suggestion.action}
              </div>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions);
