'use client';

import { useCallback, useState } from 'react';

export interface Artifact {
  id: string;
  type: 'code' | 'text' | 'image' | 'chart';
  title: string;
  content: string;
  language?: string;
  created_at: Date;
}

export function useArtifactSelector() {
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null
  );
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const selectArtifact = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact);
  }, []);

  const addArtifact = useCallback((artifact: Artifact) => {
    setArtifacts((prev) => [...prev, artifact]);
    setSelectedArtifact(artifact);
  }, []);

  const updateArtifact = useCallback(
    (id: string, updates: Partial<Artifact>) => {
      setArtifacts((prev) =>
        prev.map((artifact) =>
          artifact.id === id ? { ...artifact, ...updates } : artifact
        )
      );

      if (selectedArtifact?.id === id) {
        setSelectedArtifact((prev) => (prev ? { ...prev, ...updates } : null));
      }
    },
    [selectedArtifact]
  );

  const removeArtifact = useCallback(
    (id: string) => {
      setArtifacts((prev) => prev.filter((artifact) => artifact.id !== id));

      if (selectedArtifact?.id === id) {
        setSelectedArtifact(null);
      }
    },
    [selectedArtifact]
  );

  return {
    selectedArtifact,
    artifacts,
    selectArtifact,
    addArtifact,
    updateArtifact,
    removeArtifact,
  };
}
