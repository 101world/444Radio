'use client';

import React, { createContext, useRef, useState, useEffect, useContext } from 'react';

interface PlayerState {
  src: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}

interface PlayerActions {
  play: (src: string, options?: { startAt?: number }) => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
}

interface UniversalPlayerContextValue {
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  player: PlayerState;
  actions: PlayerActions;
}

const UniversalPlayerContext = createContext<UniversalPlayerContextValue | null>(null);

export function UniversalPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    src: null,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.volume = state.volume;

      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setState(s => ({ ...s, currentTime: audioRef.current!.currentTime }));
        }
      });

      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setState(s => ({ ...s, duration: audioRef.current!.duration }));
        }
      });

      audioRef.current.addEventListener('ended', () => {
        setState(s => ({ ...s, playing: false }));
      });
    }
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  const play = (src: string, { startAt = 0 }: { startAt?: number } = {}) => {
    if (!audioRef.current) return;

    if (src && src !== state.src) {
      audioRef.current.src = src;
      audioRef.current.currentTime = startAt;
      audioRef.current.play().catch(() => {});
      setState(s => ({ ...s, src, playing: true, currentTime: startAt }));
      return;
    }

    audioRef.current.currentTime = startAt;
    audioRef.current.play().then(() => {
      setState(s => ({ ...s, playing: true }));
    }).catch(() => {});
  };

  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setState(s => ({ ...s, playing: false }));
  };

  const seek = (t: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = t;
    setState(s => ({ ...s, currentTime: t }));
  };

  const setVolume = (v: number) => {
    setState(s => ({ ...s, volume: Math.max(0, Math.min(1, v)) }));
  };

  return (
    <UniversalPlayerContext.Provider value={{
      audioRef,
      player: state,
      actions: { play, pause, seek, setVolume }
    }}>
      {children}
    </UniversalPlayerContext.Provider>
  );
}

export function useUniversalPlayer(): UniversalPlayerContextValue {
  const context = useContext(UniversalPlayerContext);
  if (!context) {
    throw new Error('useUniversalPlayer must be used within UniversalPlayerProvider');
  }
  return context;
}
