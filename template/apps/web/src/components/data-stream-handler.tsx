'use client';

import { useEffect } from 'react';

import { useDataStream } from '@/components/chat/data-stream-provider';

interface DataStreamHandlerProps {
  streamUrl?: string;
  onStreamData?: (data: unknown) => void;
  onStreamComplete?: () => void;
  onStreamError?: (error: Error) => void;
}

export function DataStreamHandler({
  streamUrl,
  onStreamData,
  onStreamComplete,
  onStreamError,
}: DataStreamHandlerProps) {
  const { setStreaming, setCurrentStream } = useDataStream();

  useEffect(() => {
    if (!streamUrl) return;

    const controller = new AbortController();

    const handleStream = async () => {
      try {
        setStreaming(true);
        setCurrentStream(streamUrl);

        const response = await fetch(streamUrl, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No readable stream available');
        }

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onStreamData?.(data);
              } catch (parseError) {
                console.warn('Failed to parse stream data:', parseError);
              }
            }
          }
        }

        onStreamComplete?.();
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Stream error:', error);
          onStreamError?.(error);
        }
      } finally {
        setStreaming(false);
        setCurrentStream(null);
      }
    };

    handleStream();

    return () => {
      controller.abort();
    };
  }, [
    streamUrl,
    onStreamData,
    onStreamComplete,
    onStreamError,
    setStreaming,
    setCurrentStream,
  ]);

  return null; // This component doesn't render anything
}
