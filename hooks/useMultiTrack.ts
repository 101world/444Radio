/**
 * useMultiTrack - Multi-track audio engine management
 * 
 * Manages multiple WaveSurfer instances for multi-track audio editing.
 * Handles synchronized playback, per-track controls, and mixing.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAudioContext } from '@/lib/audio-utils';

export interface AudioClip {
  id: string;
  trackId: string; // Which track this clip belongs to
  audioUrl: string;
  name: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Clip duration in seconds
  offset: number; // Start offset within the audio file
  color: string;
}

export interface Track {
  id: string;
  name: string;
  color: string;
  audioUrl: string | null; // Legacy, kept for backward compat
  clips: AudioClip[]; // NEW: clips on this track
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects?: Array<{
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    parameters: Record<string, number>;
  }>;
  // WaveSurfer instance will be managed by Timeline component
  // Audio nodes for mixing
  gainNode: GainNode | null;
  panNode: StereoPannerNode | null;
}

export interface UseMultiTrackReturn {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  masterVolume: number;
  zoom: number;
  duration: number;
  selectedTrackId: string | null;
  selectedClipId: string | null;
  addTrack: (name: string, audioUrl?: string, color?: string) => string;
  addEmptyTrack: () => string;
  addClipToTrack: (trackId: string, audioUrl: string, name: string, startTime?: number) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  moveClipToTrack: (clipId: string, targetTrackId: string, newStartTime?: number) => void;
  resizeClip: (clipId: string, newDuration: number, newOffset: number, newStartTime?: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  removeClip: (clipId: string) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  setTrackVolume: (id: string, volume: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  setMasterVolume: (volume: number) => void;
  setZoom: (zoom: number) => void;
  setSelectedTrack: (id: string | null) => void;
  setSelectedClip: (id: string | null) => void;
  // Playback controls (will be called from Timeline component)
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  // Transport helpers
  skipBackward: (seconds?: number) => void;
  skipForward: (seconds?: number) => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  toggleTrackLoop: (trackId: string) => void;
  isTrackLooping: (trackId: string) => boolean;
  reorderTrack: (trackId: string, newIndex: number) => void;
}

const TRACK_COLORS = [
  '#22d3ee', // cyan
  '#ec4899', // pink
  '#67e8f9', // light cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#06b6d4', // teal
  '#fb7185', // light pink
  '#0ea5e9', // blue
  '#fbbf24', // light amber
];

export function useMultiTrack(): UseMultiTrackReturn {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [masterVolumeState, setMasterVolumeState] = useState(0.8); // 80% default, per requirement
  const [zoom, setZoom] = useState(1.0);
  const [duration, setDuration] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<Map<string, { source: AudioBufferSourceNode; clipId: string }>>(new Map());
  const loopTracksStateRef = useRef<Set<string>>(new Set());
  const [loopedTracksState, setLoopedTracksState] = useState<Set<string>>(new Set());
  const playStartProjectTimeRef = useRef<number>(0);
  const playStartContextTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  // Initialize audio context and master gain
  useEffect(() => {
    try {
      const ctx = getAudioContext();
      audioContextRef.current = ctx;

      // Create master gain node
      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolumeState;
      masterGain.connect(ctx.destination);
      masterGainNodeRef.current = masterGain;

      console.log('✅ Multi-track audio context initialized, state:', ctx.state);
      
      // Auto-resume on first user interaction (handles browser autoplay policy)
      const resumeAudio = async () => {
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
            console.log('🔓 AudioContext auto-resumed on user interaction');
          } catch (e) {
            console.warn('Auto-resume failed:', e);
          }
        }
      };
      
      // Listen for any user interaction
      document.addEventListener('click', resumeAudio, { once: true });
      document.addEventListener('keydown', resumeAudio, { once: true });
      
      return () => {
        // Cleanup audio nodes
        if (masterGainNodeRef.current) {
          masterGainNodeRef.current.disconnect();
        }
      };
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
    }
  }, []);

  // Add a new track (legacy - with audio URL)
  const addTrack = useCallback((name: string, audioUrl?: string, color?: string): string => {
    const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTrack: Track = {
      id: trackId,
      name,
      audioUrl: audioUrl || null,
      clips: audioUrl ? [{
        id: `clip-${Date.now()}`,
        trackId, // Add trackId
        audioUrl,
        name,
        startTime: 0,
        duration: 60, // Will be updated when audio loads
        offset: 0,
        color: color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      }] : [],
      color: color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      effects: [],
      gainNode: null,
      panNode: null,
    };

    // Create audio nodes for this track
    if (audioContextRef.current && masterGainNodeRef.current) {
      try {
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = newTrack.volume; // 1.0 (100%) by default

        const panNode = audioContextRef.current.createStereoPanner();
        panNode.pan.value = newTrack.pan;

        // Connect: track gain -> pan -> master gain -> destination
        gainNode.connect(panNode);
        panNode.connect(masterGainNodeRef.current);

        newTrack.gainNode = gainNode;
        newTrack.panNode = panNode;

        console.log('✅ Audio nodes created for track:', newTrack.id);
      } catch (error) {
        console.error('❌ Failed to create audio nodes:', error);
      }
    }

    setTracks((prev) => [...prev, newTrack]);
    console.log('✅ Track added:', newTrack.id, newTrack.name);
    
    return newTrack.id;
  }, [tracks.length]);

  // Add empty track (AudioMass style)
  const addEmptyTrack = useCallback((): string => {
    return addTrack(`Track ${tracks.length + 1}`);
  }, [addTrack, tracks.length]);

  // Add clip to existing track
  const addClipToTrack = useCallback((trackId: string, audioUrl: string, name: string, startTime: number = 0) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const newClip: AudioClip = {
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            trackId, // Add trackId
            audioUrl,
            name,
            startTime,
            duration: 60, // Will be updated when audio loads
            offset: 0,
            color: t.color,
          };
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      })
    );
    console.log(`✅ Clip added to track ${trackId}`);
  }, []);

  // Move clip on timeline
  const moveClip = useCallback((clipId: string, newStartTime: number) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, startTime: newStartTime } : c
        ),
      }))
    );
  }, []);

  // Move clip to different track
  const moveClipToTrack = useCallback((clipId: string, targetTrackId: string, newStartTime?: number) => {
    setTracks((prev) => {
      // Find the clip
      let clipToMove: AudioClip | null = null;
      let sourceTrackId: string | null = null;

      for (const track of prev) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip) {
          clipToMove = clip;
          sourceTrackId = track.id;
          break;
        }
      }

      if (!clipToMove || !sourceTrackId || sourceTrackId === targetTrackId) {
        return prev; // No change if clip not found or same track
      }

      // Remove from source track and add to target track
      return prev.map((t) => {
        if (t.id === sourceTrackId) {
          // Remove clip from source
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
        } else if (t.id === targetTrackId) {
          // Add clip to target with new trackId
          const movedClip = {
            ...clipToMove,
            trackId: targetTrackId,
            startTime: newStartTime !== undefined ? newStartTime : clipToMove.startTime,
          };
          return { ...t, clips: [...t.clips, movedClip] };
        }
        return t;
      });
    });
    console.log(`🔄 Clip moved to different track: ${clipId} → ${targetTrackId}`);
  }, []);

  // Remove clip from track
  const removeClip = useCallback((clipId: string) => {
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))
    );
    console.log(`🗑️ Clip removed: ${clipId}`);
  }, []);

  // Resize clip (adjust duration/offset and optionally startTime)
  const resizeClip = useCallback((clipId: string, newDuration: number, newOffset: number, newStartTime?: number) => {
    setTracks((prev) => prev.map((t) => ({
      ...t,
      clips: t.clips.map((c) => {
        if (c.id !== clipId) return c;
        const dur = Math.max(0.05, newDuration); // minimum duration 50ms
        const off = Math.max(0, newOffset);
        const start = newStartTime !== undefined ? Math.max(0, newStartTime) : c.startTime;
        return { ...c, duration: dur, offset: off, startTime: start };
      }),
    })));
    console.log(`✂️ Clip resized: ${clipId}`);
  }, []);

  // Split clip at absolute project time
  const splitClip = useCallback((clipId: string, splitTime: number) => {
    setTracks((prev) => prev.map((t) => {
      const idx = t.clips.findIndex(c => c.id === clipId);
      if (idx === -1) return t;
      const clip = t.clips[idx];
      if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) return t; // outside
      const leftDuration = splitTime - clip.startTime;
      const rightDuration = clip.duration - leftDuration;
      const rightOffset = clip.offset + leftDuration;
      const leftClip: AudioClip = { ...clip, duration: leftDuration };
      const rightClip: AudioClip = {
        ...clip,
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startTime: splitTime,
        duration: rightDuration,
        offset: rightOffset,
        name: `${clip.name} (part 2)`,
      };
      const newClips = [...t.clips];
      newClips.splice(idx, 1, leftClip, rightClip);
      return { ...t, clips: newClips };
    }))
  }, []);

  // Remove track
  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (track) {
        // Disconnect audio nodes
        if (track.gainNode) track.gainNode.disconnect();
        if (track.panNode) track.panNode.disconnect();
        console.log('🗑️ Track removed:', id);
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  // Update track properties
  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Set track volume
  const setTrackVolume = useCallback((id: string, volume: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          // Update audio node
          if (t.gainNode && audioContextRef.current) {
            t.gainNode.gain.setValueAtTime(
              t.mute ? 0 : volume,
              audioContextRef.current.currentTime
            );
          }
          return { ...t, volume };
        }
        return t;
      })
    );
  }, []);

  // Set track pan
  const setTrackPan = useCallback((id: string, pan: number) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          // Update audio node
          if (t.panNode && audioContextRef.current) {
            t.panNode.pan.setValueAtTime(pan, audioContextRef.current.currentTime);
          }
          return { ...t, pan };
        }
        return t;
      })
    );
  }, []);

  // Toggle mute
  const toggleMute = useCallback((id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const newMute = !t.mute;
          // Update audio node
          if (t.gainNode && audioContextRef.current) {
            t.gainNode.gain.setValueAtTime(
              newMute ? 0 : t.volume,
              audioContextRef.current.currentTime
            );
          }
          console.log(`🔇 Track ${id} mute:`, newMute);
          return { ...t, mute: newMute };
        }
        return t;
      })
    );
  }, []);

  // Toggle solo
  const toggleSolo = useCallback((id: string) => {
    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (!track) return prev;

      const newSolo = !track.solo;
      const anySolo = newSolo || prev.some((t) => t.id !== id && t.solo);

      return prev.map((t) => {
        if (t.id === id) {
          // Toggle this track's solo
          console.log(`🎧 Track ${id} solo:`, newSolo);
          return { ...t, solo: newSolo };
        } else if (anySolo) {
          // Mute other tracks when any track is soloed
          if (t.gainNode && audioContextRef.current) {
            const shouldMute = !t.solo;
            t.gainNode.gain.setValueAtTime(
              shouldMute ? 0 : t.volume,
              audioContextRef.current.currentTime
            );
          }
          return t;
        } else {
          // Un-mute all tracks when no track is soloed
          if (t.gainNode && audioContextRef.current) {
            t.gainNode.gain.setValueAtTime(
              t.mute ? 0 : t.volume,
              audioContextRef.current.currentTime
            );
          }
          return t;
        }
      });
    });
  }, []);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    setMasterVolumeState(volume);
    if (masterGainNodeRef.current && audioContextRef.current) {
      masterGainNodeRef.current.gain.setValueAtTime(
        volume,
        audioContextRef.current.currentTime
      );
      console.log('🔊 Master volume:', volume);
    }
  }, []);

  // Set current time (called from Timeline or TransportBar)
  const setCurrentTime = useCallback((time: number) => {
    setCurrentTimeState(Math.max(0, time));
  }, []);

  // Set playing state (called from Timeline)
  const loadBuffer = useCallback(async (url: string): Promise<AudioBuffer> => {
    const cache = bufferCacheRef.current;
    if (cache.has(url)) return cache.get(url)!;
    if (!audioContextRef.current) throw new Error('AudioContext not initialized');
    try {
      const res = await fetch(url, { mode: 'cors' as RequestMode });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const arr = await res.arrayBuffer();
      const buf = await audioContextRef.current.decodeAudioData(arr);
      cache.set(url, buf);
      return buf;
    } catch (e) {
      console.error('Failed to load audio buffer:', url, e);
      // Notify UI if available
      try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Failed to load audio (CORS or network)', type: 'error' } })); } catch {}
      throw e;
    }
  }, []);

  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach(({ source }) => {
      try { source.stop(0); } catch {}
    });
    activeSourcesRef.current.clear();
  }, []);

  const findActiveClip = (track: Track, t: number): { clip: AudioClip; offset: number } | null => {
    for (const clip of track.clips) {
      const start = clip.startTime;
      const end = clip.startTime + clip.duration;
      if (t >= start && t < end) {
        const offset = clip.offset + (t - start);
        return { clip, offset };
      }
    }
    return null;
  };

  const startTrackAtTime = useCallback(async (track: Track, projectTime: number) => {
    if (!audioContextRef.current) return;
    if (!track.gainNode) return;
    const active = findActiveClip(track, projectTime);
    if (!active) return; // nothing to play at this time on this track
    const { clip, offset } = active;
    const buffer = await loadBuffer(clip.audioUrl);
    const src = audioContextRef.current.createBufferSource();
    src.buffer = buffer;
    const isLoop = loopTracksStateRef.current.has(track.id);
    if (isLoop) {
      src.loop = true;
      src.loopStart = clip.offset;
      src.loopEnd = clip.offset + clip.duration;
    }
    src.connect(track.gainNode);
    try {
      src.start(0, Math.max(0, offset));
    } catch (e) {
      console.warn('Source start error:', e);
    }
    src.onended = () => {
      // If looping, onended will not fire until stop; if not looping, try advance to next clip
      if (!isLoop && isPlaying) {
        const nowProject = playStartProjectTimeRef.current + ((audioContextRef.current!.currentTime - playStartContextTimeRef.current));
        const next = track.clips
          .filter(c => c.startTime >= (clip.startTime + clip.duration))
          .sort((a, b) => a.startTime - b.startTime)[0];
        if (next) {
          // If we are past next.startTime, compute offset; else start when reached (simplify: start immediately with computed offset if any)
          const nextOffset = Math.max(0, (nowProject - next.startTime) + next.offset);
          const advance = audioContextRef.current!;
          const src2 = advance.createBufferSource();
          src2.buffer = bufferCacheRef.current.get(next.audioUrl) || null;
          const proceed = async () => {
            if (!src2.buffer) src2.buffer = await loadBuffer(next.audioUrl);
            src2.connect(track.gainNode!);
            try { src2.start(0, nextOffset); } catch {}
            activeSourcesRef.current.set(track.id, { source: src2, clipId: next.id });
          };
          proceed();
        } else {
          // No next clip; do nothing
        }
      }
    };
    activeSourcesRef.current.set(track.id, { source: src, clipId: clip.id });
  }, [loadBuffer, isPlaying]);

  const startTicker = useCallback(() => {
    if (!audioContextRef.current) return;
    playStartContextTimeRef.current = audioContextRef.current.currentTime;
    playStartProjectTimeRef.current = currentTime;
    const tick = () => {
      const ctx = audioContextRef.current!;
      const t = playStartProjectTimeRef.current + (ctx.currentTime - playStartContextTimeRef.current);
      setCurrentTimeState(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [currentTime]);

  const clearTicker = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const setPlaying = useCallback(async (playing: boolean) => {
    if (!audioContextRef.current) {
      console.error('❌ AudioContext not initialized');
      try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Audio engine not ready', type: 'error' } })); } catch {}
      return;
    }
    
    if (playing) {
      try {
        // Resume AudioContext (required by browser autoplay policy)
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('🔁 AudioContext resumed from suspended state');
        }
        
        // Verify we have tracks with clips
        const tracksWithClips = tracks.filter(t => t.clips.length > 0);
        if (tracksWithClips.length === 0) {
          console.warn('⚠️ No clips to play');
          try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'No audio clips on timeline', type: 'info' } })); } catch {}
          return;
        }
        
        console.log(`🎵 Starting playback with ${tracksWithClips.length} tracks at time ${currentTime.toFixed(2)}s`);
        
        // Always stop sources before starting
        stopAllSources();
        clearTicker();
        setIsPlaying(false);
        
        // Small delay to ensure clean state
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Start each track at currentTime
        const startPromises = tracksWithClips.map(async (t) => {
          try {
            await startTrackAtTime(t, currentTime);
          } catch (err) {
            console.error(`Failed to start track ${t.name}:`, err);
          }
        });
        await Promise.all(startPromises);
        
        startTicker();
        setIsPlaying(true);
        console.log('▶️ Playback started at', currentTime);
      } catch (e) {
        console.error('❌ Playback start failed:', e);
        try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Playback failed: ' + (e instanceof Error ? e.message : 'Unknown error'), type: 'error' } })); } catch {}
        clearTicker();
        stopAllSources();
        setIsPlaying(false);
      }
    } else {
      clearTicker();
      stopAllSources();
      setIsPlaying(false);
      console.log('⏸️ Playback stopped at', currentTime);
    }
  }, [tracks, currentTime, startTrackAtTime, startTicker, clearTicker, stopAllSources]);

  // Set selected track
  const setSelectedTrack = useCallback((id: string | null) => {
    setSelectedTrackId(id);
  }, []);

  // Set selected clip
  const setSelectedClip = useCallback((id: string | null) => {
    setSelectedClipId(id);
  }, []);

  const skipBackward = useCallback((seconds: number = 10) => {
    const newTime = Math.max(0, currentTime - seconds);
    setCurrentTimeState(newTime);
    if (isPlaying) {
      // Restart playback at new position
      setPlaying(true);
    }
  }, [currentTime, isPlaying, setPlaying]);

  const skipForward = useCallback((seconds: number = 10) => {
    const newTime = currentTime + seconds;
    setCurrentTimeState(newTime);
    if (isPlaying) {
      setPlaying(true);
    }
  }, [currentTime, isPlaying, setPlaying]);

  const playNextTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = selectedTrackId ? tracks.findIndex(t => t.id === selectedTrackId) : -1;
    const nextIdx = (idx + 1) % tracks.length;
    setSelectedTrackId(tracks[nextIdx].id);
  }, [tracks, selectedTrackId]);

  const playPreviousTrack = useCallback(() => {
    if (tracks.length === 0) return;
    const idx = selectedTrackId ? tracks.findIndex(t => t.id === selectedTrackId) : 0;
    const prevIdx = (idx - 1 + tracks.length) % tracks.length;
    setSelectedTrackId(tracks[prevIdx].id);
  }, [tracks, selectedTrackId]);

  const toggleTrackLoop = useCallback((trackId: string) => {
    const setRef = loopTracksStateRef.current;
    const next = new Set(loopedTracksState);
    if (setRef.has(trackId)) {
      setRef.delete(trackId);
      next.delete(trackId);
    } else {
      setRef.add(trackId);
      next.add(trackId);
    }
    setLoopedTracksState(next);
    // If currently playing and this track has a source, update loop flag if looping current clip
    const entry = activeSourcesRef.current.get(trackId);
    if (entry) {
      entry.source.loop = setRef.has(trackId);
    }
  }, [loopedTracksState]);

  const isTrackLooping = useCallback((trackId: string) => loopedTracksState.has(trackId), [loopedTracksState]);

  const reorderTrack = useCallback((trackId: string, newIndex: number) => {
    setTracks((prev) => {
      const idx = prev.findIndex(t => t.id === trackId);
      if (idx === -1) return prev;
      const clampedIndex = Math.max(0, Math.min(newIndex, prev.length - 1));
      if (idx === clampedIndex) return prev;
      const newArr = [...prev];
      const [moved] = newArr.splice(idx, 1);
      newArr.splice(clampedIndex, 0, moved);
      return newArr;
    });
  }, []);

  return {
    tracks,
    isPlaying,
    currentTime,
    masterVolume: masterVolumeState,
    zoom,
    duration,
    selectedTrackId,
    selectedClipId,
    addTrack,
    addEmptyTrack,
    addClipToTrack,
    moveClip,
    moveClipToTrack,
    resizeClip,
    splitClip,
    removeClip,
    removeTrack,
    updateTrack,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
    setMasterVolume,
    setZoom,
    setSelectedTrack,
    setSelectedClip,
    setPlaying,
    setCurrentTime,
    skipBackward,
    skipForward,
    playNextTrack,
    playPreviousTrack,
    toggleTrackLoop,
    isTrackLooping,
    reorderTrack,
  };
}
