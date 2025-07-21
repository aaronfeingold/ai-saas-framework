'use client';

import { useCallback, useEffect, useRef } from 'react';

export function useScrollToBottom<T extends HTMLElement = HTMLDivElement>() {
  const elementRef = useRef<T>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (elementRef.current) {
      elementRef.current.scrollTo({
        top: elementRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    scrollToBottom('instant');
  }, [scrollToBottom]);

  // Auto-scroll when content changes
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new MutationObserver(() => {
      // Check if user is near bottom before auto-scrolling
      const { scrollTop, scrollHeight, clientHeight } = element;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      if (isNearBottom) {
        scrollToBottom('smooth');
      }
    });

    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [scrollToBottom]);

  return {
    elementRef,
    scrollToBottom,
    scrollToBottomInstant,
  };
}
