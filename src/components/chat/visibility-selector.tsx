'use client';

import { useState } from 'react';

import { Globe, Lock, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type VisibilityType = 'private' | 'public' | 'organization';

interface VisibilitySelectorProps {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  className?: string;
}

const visibilityOptions = [
  {
    value: 'private' as VisibilityType,
    label: 'Private',
    icon: Lock,
    description: 'Only you can access this chat',
  },
  {
    value: 'organization' as VisibilityType,
    label: 'Organization',
    icon: Users,
    description: 'Members of your organization can access',
  },
  {
    value: 'public' as VisibilityType,
    label: 'Public',
    icon: Globe,
    description: 'Anyone with the link can access',
  },
];

export function VisibilitySelector({
  chatId,
  selectedVisibilityType,
  className,
}: VisibilitySelectorProps) {
  const [isLoading, setIsLoading] = useState(false);

  const selectedOption = visibilityOptions.find(
    (option) => option.value === selectedVisibilityType
  );

  const handleVisibilityChange = async (newVisibility: VisibilityType) => {
    if (newVisibility === selectedVisibilityType || isLoading) return;

    setIsLoading(true);

    try {
      // TODO: Implement API call to update chat visibility
      console.log(`Updating chat ${chatId} visibility to ${newVisibility}`);

      // Simulated API call
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to update visibility:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={isLoading}
        >
          {selectedOption && (
            <>
              <selectedOption.icon className="mr-2 h-4 w-4" />
              {selectedOption.label}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {visibilityOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleVisibilityChange(option.value)}
            className="flex flex-col items-start gap-1 p-3"
          >
            <div className="flex items-center gap-2">
              <option.icon className="h-4 w-4" />
              <span className="font-medium">{option.label}</span>
              {option.value === selectedVisibilityType && (
                <div className="ml-auto h-2 w-2 rounded-full bg-blue-500" />
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {option.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
