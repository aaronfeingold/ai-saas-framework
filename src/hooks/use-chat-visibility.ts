'use client';

import { useCallback, useState } from 'react';

import type { VisibilityType } from '@/components/chat/visibility-selector';

export function useChatVisibility(
  initialVisibility: VisibilityType = 'private'
) {
  const [visibility, setVisibility] =
    useState<VisibilityType>(initialVisibility);
  const [isUpdating, setIsUpdating] = useState(false);

  const updateVisibility = useCallback(
    async (chatId: string, newVisibility: VisibilityType) => {
      if (isUpdating || visibility === newVisibility) return;

      setIsUpdating(true);

      try {
        const response = await fetch(`/api/chat/${chatId}/visibility`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ visibility: newVisibility }),
        });

        if (!response.ok) {
          throw new Error('Failed to update visibility');
        }

        setVisibility(newVisibility);
        return true;
      } catch (error) {
        console.error('Error updating chat visibility:', error);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [visibility, isUpdating]
  );

  return {
    visibility,
    isUpdating,
    updateVisibility,
    setVisibility,
  };
}
