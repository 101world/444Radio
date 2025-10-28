/**
 * StudioContext - Global state for multi-track studio
 * Provides access to multi-track engine throughout the studio interface
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useMultiTrack, UseMultiTrackReturn } from '@/hooks/useMultiTrack';

const StudioContext = createContext<UseMultiTrackReturn | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const multiTrack = useMultiTrack();

  return (
    <StudioContext.Provider value={multiTrack}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio(): UseMultiTrackReturn {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within StudioProvider');
  }
  return context;
}
