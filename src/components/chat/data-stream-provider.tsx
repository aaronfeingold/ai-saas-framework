'use client';

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

interface DataStreamContextType {
  isStreaming: boolean;
  currentStream: string | null;
  setStreaming: (isStreaming: boolean) => void;
  setCurrentStream: (stream: string | null) => void;
}

const DataStreamContext = createContext<DataStreamContextType | undefined>(
  undefined
);

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error('useDataStream must be used within a DataStreamProvider');
  }
  return context;
}

interface DataStreamProviderProps {
  children: ReactNode;
}

export function DataStreamProvider({ children }: DataStreamProviderProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState<string | null>(null);

  const setStreaming = (streaming: boolean) => {
    setIsStreaming(streaming);
    if (!streaming) {
      setCurrentStream(null);
    }
  };

  const setCurrentStreamWrapper = (stream: string | null) => {
    setCurrentStream(stream);
    setIsStreaming(!!stream);
  };

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      setIsStreaming(false);
      setCurrentStream(null);
    };
  }, []);

  return (
    <DataStreamContext.Provider
      value={{
        isStreaming,
        currentStream,
        setStreaming,
        setCurrentStream: setCurrentStreamWrapper,
      }}
    >
      {children}
    </DataStreamContext.Provider>
  );
}
