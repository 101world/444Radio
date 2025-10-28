# Multi-Track Studio Implementation Plan
## From AudioMass Single-Track → 444Radio Multi-Track with Glassmorphism

---

## Overview

This document outlines the step-by-step implementation plan to build a multi-track audio studio for 444Radio, based on AudioMass architecture but enhanced with:

- ✨ **Multi-track capability** (unlimited tracks)
- 🎨 **Glassmorphism UI** (purple/pink gradients, backdrop blur)
- 🤖 **AI Generation sidebar** (MiniMax + ACE-Step)
- 📚 **Library integration** (drag-and-drop from Supabase)
- 🎛️ **All AudioMass effects** (Gain, Fade, EQ, Reverb, Delay, etc.)
- 💾 **Project persistence** (save/load multi-track sessions)

---

## Phase 1: Foundation - Core Audio Utilities

### 1.1 Create `lib/audio-utils.ts` - Buffer Manipulation

Port AudioMass buffer functions to TypeScript:

```typescript
// lib/audio-utils.ts
/**
 * Audio buffer manipulation utilities
 * Ported from AudioMass actions.js
 */

export interface AudioBufferSegment {
  buffer: AudioBuffer;
  offset: number;
  duration: number;
}

/**
 * Copy a segment of an AudioBuffer
 * @param buffer - Source AudioBuffer
 * @param offset - Start time in seconds
 * @param duration - Length in seconds
 * @returns New AudioBuffer with copied segment
 */
export function copyBufferSegment(
  buffer: AudioBuffer,
  offset: number,
  duration: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(offset * sampleRate);
  const durationSamples = Math.floor(duration * sampleRate);
  const endSample = Math.min(startSample + durationSamples, buffer.length);
  const length = endSample - startSample;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    length,
    sampleRate
  );

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);
    newChannelData.set(channelData.slice(startSample, endSample));
  }

  return newBuffer;
}

/**
 * Trim buffer to specific range
 * @param buffer - Source AudioBuffer
 * @param offset - Start time in seconds
 * @param duration - Length in seconds
 * @param activeChannels - Which channels to process
 * @returns New AudioBuffer with trimmed content
 */
export function trimBuffer(
  buffer: AudioBuffer,
  offset: number,
  duration: number,
  activeChannels?: boolean[]
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(offset * sampleRate);
  const durationSamples = Math.floor(duration * sampleRate);
  const newLength = buffer.length - durationSamples;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    newLength,
    sampleRate
  );

  const channels = activeChannels || Array(buffer.numberOfChannels).fill(true);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    if (!channels[i]) continue;

    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);

    // Copy before trim
    newChannelData.set(channelData.slice(0, startSample), 0);
    
    // Copy after trim
    if (startSample + durationSamples < buffer.length) {
      newChannelData.set(
        channelData.slice(startSample + durationSamples),
        startSample
      );
    }
  }

  return newBuffer;
}

/**
 * Insert audio segment at position
 * @param targetBuffer - Buffer to insert into
 * @param insertBuffer - Buffer to insert
 * @param offset - Position in seconds
 * @returns New AudioBuffer with inserted content
 */
export function insertSegmentToBuffer(
  targetBuffer: AudioBuffer,
  insertBuffer: AudioBuffer,
  offset: number
): AudioBuffer {
  const sampleRate = targetBuffer.sampleRate;
  const offsetSamples = Math.floor(offset * sampleRate);
  const newLength = targetBuffer.length + insertBuffer.length;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const newBuffer = audioContext.createBuffer(
    targetBuffer.numberOfChannels,
    newLength,
    sampleRate
  );

  for (let i = 0; i < targetBuffer.numberOfChannels; i++) {
    const targetData = targetBuffer.getChannelData(i);
    const insertData = insertBuffer.numberOfChannels > 1 
      ? insertBuffer.getChannelData(i) 
      : insertBuffer.getChannelData(0);
    const newData = newBuffer.getChannelData(i);

    // Before insertion point
    newData.set(targetData.slice(0, offsetSamples), 0);

    // Inserted segment
    newData.set(insertData, offsetSamples);

    // After insertion point
    if (offsetSamples < targetBuffer.length) {
      newData.set(
        targetData.slice(offsetSamples),
        offsetSamples + insertBuffer.length
      );
    }
  }

  return newBuffer;
}

/**
 * Create silent AudioBuffer
 * @param duration - Length in seconds
 * @param sampleRate - Sample rate (default 44100)
 * @param channels - Number of channels (default 2)
 * @returns Silent AudioBuffer
 */
export function makeSilenceBuffer(
  duration: number,
  sampleRate = 44100,
  channels = 2
): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioContext.createBuffer(channels, length, sampleRate);
}

/**
 * Overwrite entire buffer with new buffer
 * @param targetBuffer - Buffer to overwrite
 * @param newBuffer - New buffer content
 * @returns The new buffer
 */
export function overwriteBuffer(
  targetBuffer: AudioBuffer,
  newBuffer: AudioBuffer
): AudioBuffer {
  return newBuffer;
}

/**
 * Convert Float32Array audio data to Int16Array for export
 * @param float32Array - Audio data in float format (-1.0 to 1.0)
 * @returns Audio data in int16 format
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    const value = float32Array[i];
    const scaled = value < 0 ? value * 32768 : value * 32767;
    int16Array[i] = Math.max(-32768, Math.min(32767, scaled));
  }
  
  return int16Array;
}

/**
 * Get shared AudioContext instance
 */
let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
}

/**
 * Create OfflineAudioContext for non-realtime processing
 */
export function getOfflineAudioContext(
  channels: number,
  sampleRate: number,
  duration: number
): OfflineAudioContext {
  return new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    channels,
    duration,
    sampleRate
  );
}
```

**Files to create:**
- ✅ `lib/audio-utils.ts`

**Tasks:**
- [ ] Create the file with all utility functions
- [ ] Add unit tests (optional but recommended)
- [ ] Test buffer operations with sample audio

---

## Phase 2: WaveSurfer React Integration

### 2.1 Create `hooks/useWaveSurfer.ts`

React hook for managing WaveSurfer instances:

```typescript
// hooks/useWaveSurfer.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

export interface UseWaveSurferOptions {
  container: string;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  splitChannels?: boolean;
  autoCenter?: boolean;
}

export interface UseWaveSurferReturn {
  wavesurfer: WaveSurfer | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadAudio: (url: string | AudioBuffer) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  destroy: () => void;
}

export function useWaveSurfer(
  options: UseWaveSurferOptions
): UseWaveSurferReturn {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize WaveSurfer
  useEffect(() => {
    const ws = WaveSurfer.create({
      container: options.container,
      height: options.height || 128,
      waveColor: options.waveColor || '#8b5cf6',
      progressColor: options.progressColor || '#ec4899',
      cursorColor: options.cursorColor || '#22d3ee',
      splitChannels: options.splitChannels ?? true,
      autoCenter: options.autoCenter ?? true,
      hideScrollbar: true,
      plugins: [RegionsPlugin.create()],
    });

    // Event listeners
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('timeupdate', (time) => setCurrentTime(time));
    ws.on('ready', () => setDuration(ws.getDuration()));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [options.container, options.height]);

  const loadAudio = useCallback(async (source: string | AudioBuffer) => {
    if (!wavesurferRef.current) return;

    if (typeof source === 'string') {
      await wavesurferRef.current.load(source);
    } else {
      wavesurferRef.current.loadBlob(new Blob([source]));
    }
  }, []);

  const play = useCallback(() => {
    wavesurferRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    wavesurferRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    wavesurferRef.current?.stop();
    setIsPlaying(false);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!wavesurferRef.current) return;
    const duration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(time / duration);
  }, []);

  const setVolume = useCallback((volume: number) => {
    wavesurferRef.current?.setVolume(volume);
  }, []);

  const destroy = useCallback(() => {
    wavesurferRef.current?.destroy();
    wavesurferRef.current = null;
  }, []);

  return {
    wavesurfer: wavesurferRef.current,
    isPlaying,
    currentTime,
    duration,
    loadAudio,
    play,
    pause,
    stop,
    seekTo,
    setVolume,
    destroy,
  };
}
```

**Files to create:**
- ✅ `hooks/useWaveSurfer.ts`

---

## Phase 3: Multi-Track Engine

### 3.1 Create `hooks/useMultiTrack.ts`

Multi-track state management:

```typescript
// hooks/useMultiTrack.ts
import { useState, useCallback, useRef } from 'react';
import { getAudioContext } from '@/lib/audio-utils';
import type WaveSurfer from 'wavesurfer.js';

export interface Track {
  id: string;
  name: string;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  wavesurfer: WaveSurfer | null;
  buffer: AudioBuffer | null;
  gainNode: GainNode | null;
  panNode: StereoPannerNode | null;
}

export interface UseMultiTrackReturn {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  addTrack: (name: string, audioUrl: string) => Promise<void>;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  playAll: () => void;
  pauseAll: () => void;
  stopAll: () => void;
  seekAll: (time: number) => void;
  setTrackVolume: (id: string, volume: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
}

const TRACK_COLORS = [
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#22d3ee', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
];

export function useMultiTrack(): UseMultiTrackReturn {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const addTrack = useCallback(async (name: string, audioUrl: string) => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name,
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      wavesurfer: null,
      buffer: null,
      gainNode: null,
      panNode: null,
    };

    setTracks((prev) => [...prev, newTrack]);
  }, [tracks.length]);

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (track) {
        track.wavesurfer?.destroy();
        track.gainNode?.disconnect();
        track.panNode?.disconnect();
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const playAll = useCallback(() => {
    tracks.forEach((track) => {
      if (!track.mute && track.wavesurfer) {
        track.wavesurfer.play();
      }
    });
    setIsPlaying(true);
  }, [tracks]);

  const pauseAll = useCallback(() => {
    tracks.forEach((track) => {
      track.wavesurfer?.pause();
    });
    setIsPlaying(false);
  }, [tracks]);

  const stopAll = useCallback(() => {
    tracks.forEach((track) => {
      track.wavesurfer?.stop();
    });
    setIsPlaying(false);
    setCurrentTime(0);
  }, [tracks]);

  const seekAll = useCallback((time: number) => {
    tracks.forEach((track) => {
      if (track.wavesurfer) {
        const duration = track.wavesurfer.getDuration();
        track.wavesurfer.seekTo(time / duration);
      }
    });
    setCurrentTime(time);
  }, [tracks]);

  const setTrackVolume = useCallback((id: string, volume: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          t.gainNode?.gain.setValueAtTime(volume, audioContextRef.current?.currentTime || 0);
          return { ...t, volume };
        }
        return t;
      })
    );
  }, []);

  const setTrackPan = useCallback((id: string, pan: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id && t.panNode) {
          t.panNode.pan.setValueAtTime(pan, audioContextRef.current?.currentTime || 0);
          return { ...t, pan };
        }
        return t;
      })
    );
  }, []);

  const toggleMute = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newMute = !t.mute;
          t.gainNode?.gain.setValueAtTime(
            newMute ? 0 : t.volume,
            audioContextRef.current?.currentTime || 0
          );
          return { ...t, mute: newMute };
        }
        return t;
      })
    );
  }, []);

  const toggleSolo = useCallback((id: string) => {
    setTracks((prev) => {
      const hasSolo = prev.some((t) => t.solo && t.id !== id);
      
      return prev.map((t) => {
        if (t.id === id) {
          const newSolo = !t.solo;
          return { ...t, solo: newSolo };
        } else if (hasSolo) {
          // Un-solo all others
          return { ...t, solo: false };
        }
        return t;
      });
    });
  }, []);

  return {
    tracks,
    isPlaying,
    currentTime,
    addTrack,
    removeTrack,
    updateTrack,
    playAll,
    pauseAll,
    stopAll,
    seekAll,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
  };
}
```

**Files to create:**
- ✅ `hooks/useMultiTrack.ts`

---

## Phase 4: UI Components (Glassmorphism)

### 4.1 Timeline Component

```typescript
// app/components/studio/Timeline.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useMultiTrack } from '@/hooks/useMultiTrack';

export default function Timeline() {
  const { tracks } = useMultiTrack();

  return (
    <div className="flex-1 overflow-auto bg-black/20 backdrop-blur-xl">
      <div className="min-h-full p-4 space-y-2">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className="relative bg-gray-900/50 backdrop-blur-sm rounded-lg border border-purple-500/20 p-3"
          >
            {/* Track header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: track.color }}
              />
              <span className="text-white font-medium">{track.name}</span>
            </div>
            
            {/* WaveSurfer container */}
            <div
              id={`waveform-${track.id}`}
              className="w-full"
            />
          </div>
        ))}
        
        {tracks.length === 0 && (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>No tracks yet. Add a track to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4.2 Track Controls Component

```typescript
// app/components/studio/TrackControls.tsx
'use client';

import { Volume2, Trash2 } from 'lucide-react';
import { useMultiTrack } from '@/hooks/useMultiTrack';

export default function TrackControls({ trackId }: { trackId: string }) {
  const { tracks, setTrackVolume, setTrackPan, toggleMute, toggleSolo, removeTrack } = useMultiTrack();
  const track = tracks.find((t) => t.id === trackId);

  if (!track) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-900/50 backdrop-blur-sm rounded-lg border border-purple-500/20">
      {/* Volume */}
      <div className="flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-purple-400" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
          className="w-20"
        />
      </div>

      {/* Pan */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Pan</span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={track.pan}
          onChange={(e) => setTrackPan(trackId, parseFloat(e.target.value))}
          className="w-20"
        />
      </div>

      {/* Mute */}
      <button
        onClick={() => toggleMute(trackId)}
        className={`px-3 py-1 rounded text-xs font-medium ${
          track.mute
            ? 'bg-red-500/20 text-red-400 border border-red-500/50'
            : 'bg-gray-800 text-gray-400 border border-gray-700'
        }`}
      >
        M
      </button>

      {/* Solo */}
      <button
        onClick={() => toggleSolo(trackId)}
        className={`px-3 py-1 rounded text-xs font-medium ${
          track.solo
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
            : 'bg-gray-800 text-gray-400 border border-gray-700'
        }`}
      >
        S
      </button>

      {/* Delete */}
      <button
        onClick={() => removeTrack(trackId)}
        className="ml-auto p-2 rounded hover:bg-red-500/20 text-red-400"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
```

### 4.3 Transport Bar Component

```typescript
// app/components/studio/TransportBar.tsx
'use client';

import { Play, Pause, Square, SkipBack } from 'lucide-react';
import { useMultiTrack } from '@/hooks/useMultiTrack';

export default function TransportBar() {
  const { isPlaying, currentTime, playAll, pauseAll, stopAll, seekAll } = useMultiTrack();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-20 bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-xl border-t border-purple-500/30">
      <div className="h-full flex items-center justify-between px-6">
        {/* Transport controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => seekAll(0)}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          {!isPlaying ? (
            <button
              onClick={playAll}
              className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-lg"
            >
              <Play className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={pauseAll}
              className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-lg"
            >
              <Pause className="w-6 h-6" />
            </button>
          )}
          
          <button
            onClick={stopAll}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>

        {/* Time display */}
        <div className="text-white font-mono text-lg">
          {formatTime(currentTime)}
        </div>
      </div>
    </div>
  );
}
```

**Files to create:**
- ✅ `app/components/studio/Timeline.tsx`
- ✅ `app/components/studio/TrackControls.tsx`
- ✅ `app/components/studio/TransportBar.tsx`

---

## Phase 5: Effects Implementation

### 5.1 Create `lib/audio-effects.ts`

Port AudioMass effects to TypeScript:

```typescript
// lib/audio-effects.ts
export interface EffectFilterChain {
  filter: (
    audioCtx: AudioContext | OfflineAudioContext,
    destination: AudioNode,
    source: AudioBufferSourceNode,
    duration: number
  ) => AudioNode | AudioNode[];
  preview?: (enabled: boolean, source: AudioBufferSourceNode) => void;
  update?: (filterChain: AudioNode | AudioNode[], audioCtx: AudioContext, value: any, source?: AudioBufferSourceNode) => void;
  destroy?: () => void;
}

/**
 * Gain effect (volume adjustment)
 */
export function createGainEffect(gainValue: number): EffectFilterChain {
  return {
    filter: (audioCtx, destination, source) => {
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = gainValue;
      
      source.connect(gainNode);
      gainNode.connect(destination);
      
      return gainNode;
    },
    update: (filterChain, audioCtx, value) => {
      if (filterChain instanceof GainNode) {
        filterChain.gain.setValueAtTime(value, audioCtx.currentTime);
      }
    },
  };
}

/**
 * Delay effect
 */
export interface DelayParams {
  delay: { val: number } | Array<{ val: number; time: number }>;
  feedback: { val: number } | Array<{ val: number; time: number }>;
  mix: { val: number } | Array<{ val: number; time: number }>;
}

export function createDelayEffect(params: DelayParams): EffectFilterChain {
  return {
    filter: (audioCtx, destination, source) => {
      const inputNode = audioCtx.createGain();
      const outputNode = audioCtx.createGain();
      const dryGainNode = audioCtx.createGain();
      const wetGainNode = audioCtx.createGain();
      const feedbackGainNode = audioCtx.createGain();
      const delayNode = audioCtx.createDelay();

      source.connect(inputNode);
      inputNode.connect(dryGainNode);
      dryGainNode.connect(outputNode);

      // Feedback loop
      delayNode.connect(feedbackGainNode);
      feedbackGainNode.connect(delayNode);

      inputNode.connect(delayNode);
      delayNode.connect(wetGainNode);
      wetGainNode.connect(outputNode);
      outputNode.connect(destination);

      // Set values
      if (!Array.isArray(params.delay)) {
        delayNode.delayTime.value = params.delay.val;
      }
      if (!Array.isArray(params.feedback)) {
        feedbackGainNode.gain.value = params.feedback.val;
      }
      if (!Array.isArray(params.mix)) {
        dryGainNode.gain.value = 1 - ((params.mix.val - 0.5) * 2);
        wetGainNode.gain.value = 1 - ((0.5 - params.mix.val) * 2);
      }

      return [inputNode, outputNode, dryGainNode, wetGainNode, feedbackGainNode, delayNode];
    },
  };
}

/**
 * Reverb effect
 */
export interface ReverbParams {
  time: number;  // Duration in seconds
  decay: number; // Decay factor (0-1)
  mix: number;   // Wet/dry mix (0-1)
  reverse: boolean;
}

export function createReverbEffect(params: ReverbParams): EffectFilterChain {
  return {
    filter: (audioCtx, destination, source) => {
      const inputNode = audioCtx.createGain();
      const reverbNode = audioCtx.createConvolver();
      const outputNode = audioCtx.createGain();
      const wetGainNode = audioCtx.createGain();
      const dryGainNode = audioCtx.createGain();

      source.connect(inputNode);
      inputNode.connect(reverbNode);
      reverbNode.connect(wetGainNode);
      inputNode.connect(dryGainNode);
      dryGainNode.connect(outputNode);
      wetGainNode.connect(outputNode);
      outputNode.connect(destination);

      // Set mix
      dryGainNode.gain.value = 1 - ((params.mix - 0.5) * 2);
      wetGainNode.gain.value = 1 - ((0.5 - params.mix) * 2);

      // Create impulse response
      const length = audioCtx.sampleRate * params.time;
      const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
      const impulseL = impulse.getChannelData(0);
      const impulseR = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const n = params.reverse ? length - i : i;
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, params.decay);
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, params.decay);
      }
      reverbNode.buffer = impulse;

      return [inputNode, outputNode, reverbNode, dryGainNode, wetGainNode];
    },
  };
}

// ... More effects (EQ, Compression, etc.) following same pattern
```

### 5.2 Effect Modals (Example: Gain)

```typescript
// app/components/studio/effects/GainModal.tsx
'use client';

import { useState } from 'react';
import GlassModal from '../GlassModal';
import EffectModal from '../EffectModal';

interface GainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (params: { gain: number }) => void;
}

export default function GainModal({ isOpen, onClose, onApply }: GainModalProps) {
  const [gain, setGain] = useState(1.0);
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = () => {
    setPreviewing(!previewing);
    // TODO: Connect to audio preview system
  };

  const handleApply = () => {
    onApply({ gain });
    onClose();
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Gain" maxWidth="lg">
      <EffectModal
        parameters={[
          {
            type: 'slider',
            label: 'Gain',
            value: gain,
            onChange: setGain,
            min: 0,
            max: 2,
            step: 0.01,
            displayValue: `${(gain * 100).toFixed(0)}%`,
          },
        ]}
        isPreviewActive={previewing}
        onPreview={handlePreview}
        onApply={handleApply}
      />
    </GlassModal>
  );
}
```

**Files to create:**
- ✅ `lib/audio-effects.ts`
- ✅ `app/components/studio/effects/GainModal.tsx`
- ✅ `app/components/studio/effects/DelayModal.tsx`
- ✅ `app/components/studio/effects/ReverbModal.tsx`
- ✅ `app/components/studio/effects/EQModal.tsx`
- ✅ `app/components/studio/effects/FadeModal.tsx`
- ✅ `app/components/studio/effects/NormalizeModal.tsx`

---

## Phase 6: Main Studio Page

### 6.1 Create `app/studio/multi-track/page.tsx`

```typescript
// app/studio/multi-track/page.tsx
'use client';

import { useState } from 'react';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import AISidebar from '@/app/components/studio/AISidebar';
import LibraryPanel from '@/app/components/studio/LibraryPanel';
import EffectsRack from '@/app/components/studio/EffectsRack';
import { useMultiTrack } from '@/hooks/useMultiTrack';

export default function MultiTrackStudioPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const multiTrack = useMultiTrack();

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="h-16 bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-xl border-b border-purple-500/30 flex items-center justify-between px-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          444Radio Studio
        </h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 transition-colors"
          >
            AI Generate
          </button>
          
          <button
            onClick={() => setLibraryOpen(!libraryOpen)}
            className="px-4 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/50 transition-colors"
          >
            Library
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* AI Sidebar */}
        {sidebarOpen && (
          <AISidebar
            onClose={() => setSidebarOpen(false)}
            onGenerate={async (url) => {
              await multiTrack.addTrack('Generated Track', url);
            }}
          />
        )}

        {/* Timeline */}
        <div className="flex-1 flex flex-col">
          {/* Effects bar */}
          <EffectsRack />
          
          {/* Timeline */}
          <Timeline />
          
          {/* Library panel */}
          {libraryOpen && (
            <LibraryPanel
              onTrackSelect={(url) => multiTrack.addTrack('Library Track', url)}
            />
          )}
        </div>
      </div>

      {/* Transport bar */}
      <TransportBar />
    </div>
  );
}
```

**Files to create:**
- ✅ `app/studio/multi-track/page.tsx`

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Day 1-2: Create `lib/audio-utils.ts` with all buffer functions
- [ ] Day 3-4: Create `hooks/useWaveSurfer.ts` and test with single track
- [ ] Day 5-7: Create `hooks/useMultiTrack.ts` and test with 2-3 tracks

### Week 2: UI Components
- [ ] Day 1-2: Build Timeline component
- [ ] Day 3-4: Build TrackControls component
- [ ] Day 5-6: Build TransportBar component
- [ ] Day 7: Integration testing

### Week 3: Effects
- [ ] Day 1-2: Create `lib/audio-effects.ts` with Gain, Delay, Reverb
- [ ] Day 3-4: Build effect modals (Gain, Delay, Reverb)
- [ ] Day 5-6: Add EQ, Fade, Normalize
- [ ] Day 7: Effects testing

### Week 4: Integration & Polish
- [ ] Day 1-2: Build AISidebar with generation flow
- [ ] Day 3-4: Build LibraryPanel with drag-and-drop
- [ ] Day 5-6: Export system (mix to master → download)
- [ ] Day 7: Final testing and polish

---

## Testing Strategy

### Unit Tests
- Buffer manipulation functions (trim, copy, insert)
- Effect parameter calculations
- Time synchronization logic

### Integration Tests
- Multi-track playback sync
- Volume/pan controls
- Mute/solo behavior
- Effect preview/apply

### Manual Tests
- Load 5+ tracks simultaneously
- Apply multiple effects to same track
- Drag-and-drop from library
- Generate AI music → add to timeline
- Export final mix

---

## Success Criteria

✅ **Multi-Track Capability**
- Load unlimited tracks
- Synchronized playback
- Per-track volume/pan/mute/solo
- No audio glitches or dropouts

✅ **Effects System**
- All AudioMass effects working (Gain, EQ, Reverb, Delay, Fade, Normalize)
- Real-time preview with toggle
- Offline rendering for quality
- Visual feedback during processing

✅ **Glassmorphism UI**
- Purple/pink gradient accents
- Backdrop blur effects
- Smooth animations
- Responsive layout
- Touch-friendly controls (mobile/tablet)

✅ **AI Integration**
- Collapsible sidebar
- MiniMax + ACE-Step generation
- Language-specific lyrics
- Generated tracks auto-add to timeline

✅ **Library Integration**
- Drag-and-drop from Supabase
- Visual waveform preview
- Filter by genre/artist
- Quick add to timeline

✅ **Export System**
- Mix all tracks to master
- MP3/WAV/FLAC formats
- Selection export support
- Progress indication

✅ **Performance**
- < 100ms latency for playback
- Smooth 60fps UI animations
- Efficient memory usage (< 500MB for 10 tracks)
- Works on modern browsers (Chrome, Firefox, Safari, Edge)

---

## Next Steps

**Start here:**
1. Create `lib/audio-utils.ts` ✅
2. Create `hooks/useWaveSurfer.ts` ✅
3. Build simple test page with 2 tracks
4. Verify synchronized playback
5. Continue with Phase 2...

**Questions to answer:**
- Export format priority? (MP3 first, then WAV/FLAC?)
- Mobile support priority? (Desktop-first recommended)
- Max tracks limit? (Suggest 20-30 for performance)
- Automation envelopes? (Volume/pan changes over time - Phase 2 feature?)

Ready to start building? 🎵🚀
