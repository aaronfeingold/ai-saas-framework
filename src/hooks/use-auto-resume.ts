'use client';

import { useCallback, useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

export function useAutoResume() {
  const [isResuming, setIsResuming] = useState(false);
  const router = useRouter();

  const resumeLastChat = useCallback(async () => {
    setIsResuming(true);

    try {
      // Check localStorage for last chat ID
      const lastChatId = localStorage.getItem('lastChatId');

      if (lastChatId) {
        // Verify the chat still exists
        const response = await fetch(`/api/chat/${lastChatId}`);

        if (response.ok) {
          router.push(`/chat/${lastChatId}`);
          return true;
        } else {
          // Remove invalid chat ID from localStorage
          localStorage.removeItem('lastChatId');
        }
      }

      return false;
    } catch (error) {
      console.error('Error resuming chat:', error);
      return false;
    } finally {
      setIsResuming(false);
    }
  }, [router]);

  const saveCurrentChat = (chatId: string) => {
    localStorage.setItem('lastChatId', chatId);
  };

  const clearLastChat = () => {
    localStorage.removeItem('lastChatId');
  };

  // Auto-resume on mount if enabled
  useEffect(() => {
    const autoResumeEnabled = localStorage.getItem('autoResume') === 'true';

    if (autoResumeEnabled) {
      resumeLastChat();
    }
  }, [resumeLastChat]);

  return {
    isResuming,
    resumeLastChat,
    saveCurrentChat,
    clearLastChat,
  };
}
