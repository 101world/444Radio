/**
 * useMultiTrack - Multi-track audio engine management
 * 
 * Manages multiple WaveSurfer instances for multi-track audio editing.
 * Handles synchronized playback, per-track controls, and mixing.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAudioContext } from '@/lib/audio-utils';
import { PrecisionAudioScheduler, ScheduledClip, TrackState } from '@/lib/audio-scheduler';

export interface AudioClip {
  id: string;
  trackId: string; // Which track this clip belongs to
  audioUrl: string;
  name: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Clip duration in seconds
  offset: number; // Start offset within the audio file
  color: string;
  // Optional in-memory blob reference for file uploads (prevents relying on object URLs alone)
  audioBlob?: Blob | null;
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
  addTrack: (name: string, audioUrl?: string, color?: string, initialClipDuration?: number, audioBlob?: Blob | null) => string;
  addEmptyTrack: () => string;
  addClipToTrack: (trackId: string, audioUrl: string, name: string, startTime?: number, durationOverride?: number, audioBlob?: Blob | null) => void;
  moveClip: (clipId: string, newStartTime: number) => void;
  moveClipToTrack: (clipId: string, targetTrackId: string, newStartTime?: number) => void;
  resizeClip: (clipId: string, newDuration: number, newOffset: number, newStartTime?: number) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  removeClip: (clipId: string) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  renameTrack: (id: string, name: string) => void;
  setTrackVolume: (id: string, volume: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  setMasterVolume: (volume: number) => void;
  setZoom: (zoom: number) => void;
  setSelectedTrack: (id: string | null) => void;
  setSelectedClip: (id: string | null) => void;
  ensureBuffer: (url: string) => Promise<AudioBuffer>;
  getPeaksForUrl: (url: string, sampleCount?: number) => Promise<Float32Array>;
  trackHeight: number;
  setTrackHeight: (h: number) => void;
  leftGutterWidth: number;
  setLeftGutterWidth: (w: number) => void;
  // Playback controls (will be called from Timeline component)
  setPlaying: (playing: boolean) => void;
  togglePlayback: () => void;
  setCurrentTime: (time: number) => void;
  // Transport helpers
  skipBackward: (seconds?: number) => void;
  skipForward: (seconds?: number) => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  toggleTrackLoop: (trackId: string) => void;
  isTrackLooping: (trackId: string) => boolean;
  reorderTrack: (trackId: string, newIndex: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
  const [history, setHistory] = useState<Track[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [masterVolumeState, setMasterVolumeState] = useState(0.8); // 80% default, per requirement
  const [zoom, setZoom] = useState(1.0);
  const [duration, setDuration] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [leftGutterWidth, setLeftGutterWidth] = useState<number>(224);
  const [trackHeight, setTrackHeight] = useState<number>(144);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const peaksCacheRef = useRef<Map<string, Float32Array>>(new Map());
  const activeSourcesRef = useRef<Map<string, { source: AudioBufferSourceNode; clipId: string }>>(new Map());
  const blobCacheRef = useRef<Map<string, Blob>>(new Map()); // Cache blobs by URL for instant lookup
  const loopTracksStateRef = useRef<Set<string>>(new Set());
  const [loopedTracksState, setLoopedTracksState] = useState<Set<string>>(new Set());
  const isPlayingRef = useRef<boolean>(false); // Track isPlaying state for closures
  const playStartProjectTimeRef = useRef<number>(0);
  const playStartContextTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const schedulerRef = useRef<PrecisionAudioScheduler | null>(null);

  // Helper: create audio nodes for a track (if missing) and connect them
  const createAudioNodesForTrack = useCallback((track: Track) => {
    if (!audioContextRef.current || !masterGainNodeRef.current) return track;
    if (track.gainNode && track.panNode) return track;
    try {
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = track.volume;
      const panNode = audioContextRef.current.createStereoPanner();
      panNode.pan.value = track.pan;
      gainNode.connect(panNode);
      panNode.connect(masterGainNodeRef.current);
      return { ...track, gainNode, panNode };
    } catch (err) {
      console.warn('Failed to create audio nodes for track:', track.name, err);
      return track;
    }
  }, [audioContextRef, masterGainNodeRef]);

  // Save state to history for undo/redo
  const saveHistory = useCallback((newTracks: Track[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newTracks)));
      // Limit history to 50 states
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

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
      
      // On init, ensure all tracks get nodes if audio context is ready
      setTracks(prev => prev.map(t => createAudioNodesForTrack(t)));

      // Initialize scheduler
      const trackStates = new Map<string, TrackState>();
      tracks.forEach(track => {
        if (track.gainNode && track.panNode) {
          trackStates.set(track.id, {
            id: track.id,
            gainNode: track.gainNode,
            panNode: track.panNode,
            volume: track.volume,
            pan: track.pan,
            mute: track.mute,
            solo: track.solo,
          });
        }
      });
      schedulerRef.current = new PrecisionAudioScheduler(ctx, trackStates);

      return () => {
        // Cleanup audio nodes
        if (masterGainNodeRef.current) {
          masterGainNodeRef.current.disconnect();
        }
        // Cleanup scheduler
        if (schedulerRef.current) {
          schedulerRef.current.destroy();
        }
      };
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
    }
  }, [isPlaying]);

  // Update scheduler when tracks change
  useEffect(() => {
    if (!schedulerRef.current || !audioContextRef.current) return;

    const trackStates = new Map<string, TrackState>();
    tracks.forEach(track => {
      if (track.gainNode && track.panNode) {
        trackStates.set(track.id, {
          id: track.id,
          gainNode: track.gainNode,
          panNode: track.panNode,
          volume: track.volume,
          pan: track.pan,
          mute: track.mute,
          solo: track.solo,
        });
      }
    });

    // Update scheduler's track map
    schedulerRef.current = new PrecisionAudioScheduler(audioContextRef.current, trackStates);
  }, [tracks]);

  // Add a new track (legacy - with audio URL)
  const addTrack = useCallback((name: string, audioUrl?: string, color?: string, initialClipDuration?: number, audioBlob: Blob | null = null): string => {
    const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Cache blob immediately if provided
    if (audioUrl && audioBlob) {
      blobCacheRef.current.set(audioUrl, audioBlob);
      console.log('✅ Blob cached for URL:', audioUrl);
    }
    
    const clip = audioUrl ? {
      id: `clip-${Date.now()}`,
      trackId, // Add trackId
      audioUrl,
      name,
      startTime: 0,
      duration: typeof initialClipDuration === 'number' ? initialClipDuration : 60, // Will be updated when audio loads
      offset: 0,
      color: color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      audioBlob: audioBlob || null,
    } : null;
    
    console.log('🎵 addTrack called:', { name, audioUrl: !!audioUrl, duration: initialClipDuration, hasClip: !!clip });
    
    const newTrack: Track = {
      id: trackId,
      name,
      audioUrl: audioUrl || null,
      clips: clip ? [clip] : [],
      color: color || TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      volume: 1.0,
      pan: 0,
      mute: false,
      solo: false,
      effects: [],
      gainNode: null,
      panNode: null,
    };

    // Create audio nodes for this track if AudioContext ready
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

    setTracks((prev) => {
      const newTracks = [...prev, newTrack];
      saveHistory(newTracks);
      return newTracks;
    });
    console.log('✅ Track added:', newTrack.id, newTrack.name, 'Clips:', newTrack.clips.length, newTrack.clips);
    
    // If we received an audioUrl, attempt to probe its duration asynchronously
    if (audioUrl) {
      (async () => {
        try {
          const buf = await loadBuffer(audioUrl);
          // Update the clip duration if present
          setTracks((prev) => prev.map(t => {
            if (t.id !== newTrack.id) return t;
            const newClips = t.clips.map(c => {
              if (c.trackId === newTrack.id && c.audioUrl === audioUrl) {
                return { ...c, duration: buf.duration };
              }
              return c;
            });
            return { ...t, clips: newClips };
          }));
        } catch (e) {
          // ignore; leave duration as-is
        }
      })();
    }

    return newTrack.id;
  }, [tracks.length, saveHistory]);

  // Add empty track (AudioMass style)
  const addEmptyTrack = useCallback((): string => {
    return addTrack(`Track ${tracks.length + 1}`);
  }, [addTrack, tracks.length]);

  // Add clip to existing track
  const addClipToTrack = useCallback((trackId: string, audioUrl: string, name: string, startTime: number = 0, durationOverride?: number, audioBlob: Blob | null = null) => {
    // Cache blob immediately if provided
    if (audioBlob) {
      blobCacheRef.current.set(audioUrl, audioBlob);
      console.log('✅ Blob cached for URL:', audioUrl);
    }
    
    setTracks((prev) => {
      const newTracks = prev.map((t) => {
        if (t.id === trackId) {
          const newClip: AudioClip = {
            id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            trackId, // Add trackId
            audioUrl,
            name,
            startTime,
            duration: typeof durationOverride === 'number' ? durationOverride : 60, // Will be updated when audio loads
            offset: 0,
            color: t.color,
            audioBlob: audioBlob || null,
          };
          return { ...t, clips: [...t.clips, newClip] };
        }
        return t;
      });
      saveHistory(newTracks);
      return newTracks;
    });
    console.log(`✅ Clip added to track ${trackId}`);

    // Probe audio duration for better UI positioning/looping (skip if durationOverride provided)
    if (typeof durationOverride === 'undefined') {
      (async () => {
      try {
        const buf = await loadBuffer(audioUrl);
        setTracks((prev) => prev.map((t) => {
          if (t.id !== trackId) return t;
          const updated = t.clips.map(c => c.audioUrl === audioUrl && Math.abs(c.startTime - startTime) < 0.001 && c.name === name
            ? { ...c, duration: buf.duration }
            : c
          );
          return { ...t, clips: updated };
        }));
      } catch (e) {
        // ignore errors
      }
      })();
    }
    // If playing, we need to re-schedule playback so new clip is included correctly
    if (isPlaying) {
      try {
        // Request a pause via events (reschedule effect will restart)
        try { window.dispatchEvent(new CustomEvent('studio:pause-request')); } catch(e) {}
        try { window.dispatchEvent(new CustomEvent('studio:reschedule-playback')); } catch(e) {}
      } catch (e) {
        console.error('Failed to request reschedule after adding clip:', e);
      }
    }
  }, [saveHistory, isPlaying]);

  // Move clip on timeline
  const moveClip = useCallback((clipId: string, newStartTime: number) => {
    setTracks((prev) => {
      const newTracks = prev.map((t) => ({
        ...t,
        clips: t.clips.map((c) =>
          c.id === clipId ? { ...c, startTime: newStartTime } : c
        ),
      }));
      saveHistory(newTracks);
      return newTracks;
    });
    // If playing, ask to pause and reschedule after change
    if (isPlaying) {
      try { window.dispatchEvent(new CustomEvent('studio:pause-request')); } catch {}
      try { window.dispatchEvent(new CustomEvent('studio:reschedule-playback')); } catch {}
    }
  }, [saveHistory, isPlaying]);

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
      const newArr = prev.map((t) => {
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
      return newArr;
    });
    console.log(`🔄 Clip moved to different track: ${clipId} → ${targetTrackId}`);
    if (isPlaying) { try { window.dispatchEvent(new CustomEvent('studio:pause-request')); } catch {} try { window.dispatchEvent(new CustomEvent('studio:reschedule-playback')); } catch {} }
  }, []);

  // Remove clip from track
  const removeClip = useCallback((clipId: string) => {
    // Find clip and clean up blob cache before removing
    for (const t of tracks) {
      const c = t.clips.find(cc => cc.id === clipId);
      if (c && typeof c.audioUrl === 'string' && c.audioUrl.startsWith('blob:')) {
        blobCacheRef.current.delete(c.audioUrl);
        try { URL.revokeObjectURL(c.audioUrl); } catch {}
        console.log('🗑️ Blob cache cleaned for:', c.audioUrl);
      }
    }
    
    setTracks((prev) => {
      const newTracks = prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }));
      saveHistory(newTracks);
      return newTracks;
    });
    console.log(`🗑️ Clip removed: ${clipId}`);
  }, [saveHistory, tracks]);

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
    // Find track before removing so we can clean up any blob URLs
    const toRemove = tracks.find(t => t.id === id);
    
    // Clean up blob cache for all clips in this track
    if (toRemove && Array.isArray(toRemove.clips)) {
      for (const c of toRemove.clips) {
        if (c.audioUrl && c.audioUrl.startsWith('blob:')) {
          blobCacheRef.current.delete(c.audioUrl);
          try { URL.revokeObjectURL(c.audioUrl); } catch {}
          console.log('🗑️ Blob cache cleaned for:', c.audioUrl);
        }
      }
    }

    setTracks((prev) => {
      const track = prev.find((t) => t.id === id);
      if (track) {
        // Disconnect audio nodes
        if (track.gainNode) track.gainNode.disconnect();
        if (track.panNode) track.panNode.disconnect();
        console.log('🗑️ Track removed:', id);
      }
      const newTracks = prev.filter((t) => t.id !== id);
      saveHistory(newTracks);
      return newTracks;
    });
  }, [saveHistory, tracks]);

  // Update track properties
  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Rename track
  const renameTrack = useCallback((id: string, name: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
  }, []);

  // Set track volume
  const setTrackVolume = useCallback((id: string, volume: number) => {
    // Hot-swap via scheduler (smooth ramp)
    if (schedulerRef.current) {
      schedulerRef.current.setTrackVolume(id, volume, false);
    }

    // Update React state
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, volume } : t
      )
    );
  }, []);

  // Set track pan
  const setTrackPan = useCallback((id: string, pan: number) => {
    // Hot-swap via scheduler (smooth ramp)
    if (schedulerRef.current) {
      schedulerRef.current.setTrackPan(id, pan);
    }

    // Update React state
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, pan } : t
      )
    );
  }, []);

  // Toggle mute
  const toggleMute = useCallback((id: string) => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;

    const newMute = !track.mute;

    // Hot-swap via scheduler (no playback restart)
    if (schedulerRef.current) {
      schedulerRef.current.setTrackMute(id, newMute);
    }

    // Update React state
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, mute: newMute } : t
      )
    );
    console.log(`🔇 Track ${id} mute:`, newMute);
  }, [tracks]);

  // Toggle solo
  const toggleSolo = useCallback((id: string) => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;

    const newSolo = !track.solo;

    // Hot-swap via scheduler
    if (schedulerRef.current) {
      schedulerRef.current.setTrackSolo(
        id,
        newSolo,
        tracks.map(t => t.id)
      );
    }

    // Update React state
    setTracks((prev) => {
      const anySolo = newSolo || prev.some((t) => t.id !== id && t.solo);

      return prev.map((t) => {
        if (t.id === id) {
          console.log(`🎧 Track ${id} solo:`, newSolo);
          return { ...t, solo: newSolo };
        } else if (anySolo) {
          // Mute other non-solo tracks when any track is soloed
          return t;
        } else {
          // Un-mute all tracks when no track is soloed
          return t;
        }
      });
    });
  }, [tracks]);

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
    if (!audioContextRef.current) {
      console.error('❌ AudioContext not available for buffer loading');
      throw new Error('AudioContext not initialized');
    }
    
    // For blob URLs, try to decode from cached blob FIRST (synchronous ref lookup)
    if (url.startsWith('blob:')) {
      const cachedBlob = blobCacheRef.current.get(url);
      if (cachedBlob) {
        try {
          console.log('🔄 Decoding from blob cache ref for:', url);
          const arr = await cachedBlob.arrayBuffer();
          const buf = await audioContextRef.current!.decodeAudioData(arr);
          cache.set(url, buf);
          // Update any clips that reference this url with accurate duration
          setTracks(prev => prev.map(tr => ({
            ...tr,
            clips: tr.clips.map(c => c.audioUrl === url && c.duration !== buf.duration ? { ...c, duration: buf.duration } : c)
          })));
          return buf;
        } catch (errDecode) {
          console.error('Failed to decode from blob cache:', errDecode);
          // Fall through to try fetch as backup
        }
      } else {
        // Fallback: search tracks state for stored blob
        for (const t of tracks) {
          const clip = t.clips.find(c => c.audioUrl === url && c.audioBlob);
          if (clip && clip.audioBlob) {
            try {
              console.log('🔄 Decoding from tracks state blob for:', url);
              const arr = await clip.audioBlob.arrayBuffer();
              const buf = await audioContextRef.current!.decodeAudioData(arr);
              cache.set(url, buf);
              setTracks(prev => prev.map(tr => ({
                ...tr,
                clips: tr.clips.map(c => c.audioUrl === url && c.duration !== buf.duration ? { ...c, duration: buf.duration } : c)
              })));
              return buf;
            } catch (errDecode) {
              console.error('Failed to decode from tracks state blob:', errDecode);
            }
          }
        }
      }
    }
    
    try {
      // Route R2 URLs through server proxy to avoid CORS issues
      const maybeProxy = (u: string) => {
        // Don't proxy blob URLs (from local file uploads)
        if (u.startsWith('blob:')) return u;
        
        try {
          const target = new URL(u);
          const r2Hosts: string[] = [];
          if (process.env.NEXT_PUBLIC_R2_AUDIO_URL) r2Hosts.push(new URL(process.env.NEXT_PUBLIC_R2_AUDIO_URL).hostname);
          if (process.env.NEXT_PUBLIC_R2_IMAGES_URL) r2Hosts.push(new URL(process.env.NEXT_PUBLIC_R2_IMAGES_URL).hostname);
          if (process.env.NEXT_PUBLIC_R2_VIDEOS_URL) r2Hosts.push(new URL(process.env.NEXT_PUBLIC_R2_VIDEOS_URL).hostname);
          const isR2 = target.hostname.endsWith('.r2.dev') || target.hostname.endsWith('.r2.cloudflarestorage.com') || r2Hosts.includes(target.hostname);
          const isReplicate = target.hostname.includes('replicate.delivery') || target.hostname.includes('replicate.com');
          const needsProxy = isR2 || isReplicate;
          return needsProxy ? `/api/r2/proxy?url=${encodeURIComponent(u)}` : u;
        } catch {
          return u;
        }
      };
      const fetchUrl = maybeProxy(url);

      const res = await fetch(fetchUrl, { mode: 'cors' as RequestMode });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      const arr = await res.arrayBuffer();
      const buf = await audioContextRef.current.decodeAudioData(arr);
      cache.set(url, buf);
      // Update any clips that reference this url with accurate duration
      setTracks(prev => prev.map(t => ({
        ...t,
        clips: t.clips.map(c => c.audioUrl === url && c.duration !== buf.duration
          ? { ...c, duration: buf.duration }
          : c
        )
      })));
      return buf;
    } catch (e) {
      const error = e as Error;
      console.error('Failed to load audio buffer:', url, e);
      
      // Check if it's a 404 (expired Replicate URL)
      if (error.message?.includes('404')) {
        console.warn('⚠️ URL expired (404):', url);
        try { 
          window.dispatchEvent(new CustomEvent('studio:notify', { 
            detail: { 
              message: 'Audio file expired - please re-generate or use a different track', 
              type: 'warning' 
            } 
          })); 
        } catch {}
      } else {
        // Notify UI if available
        try { 
          window.dispatchEvent(new CustomEvent('studio:notify', { 
            detail: { 
              message: 'Failed to load audio (CORS or network)', 
              type: 'error' 
            } 
          })); 
        } catch {}
      }
      throw e;
    }
  }, [tracks]);

  const ensureBuffer = useCallback(async (url: string): Promise<AudioBuffer> => {
    return await loadBuffer(url);
  }, [loadBuffer]);

  // Compute or return cached peaks for a given url and required sample count
  const getPeaksForUrl = useCallback(async (url: string, sampleCount: number = 300): Promise<Float32Array> => {
    const cacheKey = `${url}::${sampleCount}`;
    const cache = peaksCacheRef.current;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

    const buf = await ensureBuffer(url);
    const channelData = buf.getChannelData(0);
    const samples = channelData.length;
    const block = Math.max(1, Math.floor(samples / sampleCount));
    const peaks = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      const start = i * block;
      const end = Math.min(samples - 1, (i + 1) * block - 1);
      let max = 0;
      for (let j = start; j <= end; j++) {
        const v = Math.abs(channelData[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    cache.set(cacheKey, peaks);
    return peaks;
  }, [ensureBuffer]);

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
    // If no clip at current time, try first clip if time is before it (fallback for time 0)
    if (t === 0 && track.clips.length > 0) {
      const first = track.clips.sort((a, b) => a.startTime - b.startTime)[0];
      if (first.startTime === 0) {
        return { clip: first, offset: first.offset };
      }
    }
    return null;
  };

  const startTrackAtTime = useCallback(async (track: Track, projectTime: number) => {
    if (!audioContextRef.current) return;
    // Ensure audio nodes exist for this track (create lazily if needed)
    if (!track.gainNode || !track.panNode) {
      const newTrack = createAudioNodesForTrack(track);
      setTracks(prev => prev.map(t => t.id === track.id ? newTrack : t));
      if (!newTrack.gainNode || !newTrack.panNode) {
        // If nodes couldn't be created, bail silently
        return;
      }
      // use the updated track
      track = newTrack as Track;
    }
    const active = findActiveClip(track, projectTime);
    if (!active) {
      console.log(`⏭️ Track "${track.name}" has no clip at time ${projectTime.toFixed(2)}s`);
      return; // nothing to play at this time on this track
    }
    const { clip, offset } = active;
    console.log(`🎬 Starting clip "${clip.name}" on track "${track.name}" at offset ${offset.toFixed(2)}s`);
    const buffer = await loadBuffer(clip.audioUrl);
    const src = audioContextRef.current.createBufferSource();
    src.buffer = buffer;
    const isLoop = loopTracksStateRef.current.has(track.id);
    if (isLoop) {
      src.loop = true;
      src.loopStart = clip.offset;
      src.loopEnd = clip.offset + clip.duration;
    }
    
    // Apply current mute/solo state to gain before connecting
    const anySolo = tracks.some(t => t.solo);
    const shouldMute = track.mute || (anySolo && !track.solo);
    if (track.gainNode && audioContextRef.current) {
      track.gainNode.gain.setValueAtTime(
        shouldMute ? 0 : track.volume,
        audioContextRef.current.currentTime
      );
    }
    
    src.connect(track.gainNode!);
    try {
      src.start(0, Math.max(0, offset));
      console.log(`✅ Playback started for "${clip.name}"`);
    } catch (e) {
      console.error('❌ Source start error:', e);
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
      if (!rafRef.current) return; // Check if ticker was cleared

      // Only update currentTime if still playing
      if (isPlaying) {
        const ctx = audioContextRef.current!;
        const t = playStartProjectTimeRef.current + (ctx.currentTime - playStartContextTimeRef.current);
        setCurrentTimeState(t);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [currentTime, isPlaying]); // Add isPlaying back to dependencies

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
    if (!schedulerRef.current) {
      console.error('❌ Scheduler not initialized');
      try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Audio scheduler not ready', type: 'error' } })); } catch {}
      return;
    }

    // Prevent double-triggering - check using ref to get current value
    const currentIsPlaying = isPlayingRef.current;
    if (playing === currentIsPlaying) {
      console.log(`⚠️ Already ${playing ? 'playing' : 'paused'}, ignoring`);
      return;
    }

    if (playing) {
      // Ask global audio player to pause
      try { window.dispatchEvent(new CustomEvent('studio:pause-global-audio')); } catch {}
      try {
        // Resume AudioContext if suspended
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
        console.log('📋 Tracks:', tracksWithClips.map(t => `${t.name} (${t.clips.length} clips)`).join(', '));

        // Build ScheduledClip array from all tracks
        const scheduledClips: ScheduledClip[] = [];

        for (const track of tracksWithClips) {
          for (const clip of track.clips) {
            // Load buffer if not cached
            let buffer = bufferCacheRef.current.get(clip.audioUrl);
            if (!buffer) {
              try {
                buffer = await loadBuffer(clip.audioUrl);
                if (buffer) {
                  bufferCacheRef.current.set(clip.audioUrl, buffer);
                } else {
                  console.warn(`⚠️ Buffer is null for ${clip.audioUrl}, skipping`);
                  continue;
                }
              } catch (error) {
                console.error(`❌ Failed to load ${clip.audioUrl}:`, error);
                // Continue playing other clips even if one fails
                continue;
              }
            }

            scheduledClips.push({
              trackId: track.id,
              clipId: clip.id,
              buffer,
              startTime: clip.startTime,
              duration: clip.duration,
              offset: clip.offset,
              loop: loopTracksStateRef.current.has(track.id),
            });
          }
        }

        // Start precision scheduler
        schedulerRef.current.start(
          scheduledClips,
          currentTime,
          () => {
            console.log('All clips scheduled');
          }
        );

        // Start RAF ticker for UI updates
        startTicker();
        setIsPlaying(true);
        isPlayingRef.current = true;
        console.log('▶️ Playback started at', currentTime);
      } catch (e) {
        console.error('❌ Playback start failed:', e);
        try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Playback failed: ' + (e instanceof Error ? e.message : 'Unknown error'), type: 'error' } })); } catch {}
        clearTicker();
        schedulerRef.current?.stop();
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    } else {
      // Stop scheduler
      console.log('⏸️ Stopping playback at', currentTime);
      schedulerRef.current.stop();
      // Also stop any individual sources to prevent overlapping audio
      stopAllSources();
      clearTicker();
      setIsPlaying(false);
      isPlayingRef.current = false;
      console.log('✅ Playback fully stopped');
    }
  }, [tracks, currentTime, startTicker, clearTicker, isPlaying, loadBuffer]);

  // Listen for reschedule-playback event (triggered after operations like addClip while playing)
  useEffect(() => {
    const onReschedule = () => {
      // Small timeout to allow UI and tracks state to update
      setTimeout(() => {
        if (!isPlaying) {
          setPlaying(true);
        }
      }, 50);
    };
    window.addEventListener('studio:reschedule-playback', onReschedule as EventListener);
    return () => window.removeEventListener('studio:reschedule-playback', onReschedule as EventListener);
  }, [isPlaying, setPlaying]);

  // Listen for global audio play pause event (pause studio when global player starts)
  useEffect(() => {
    const onGlobalPause = () => {
      if (isPlaying) {
        // Stop scheduler and clear tick
        schedulerRef.current?.stop();
        clearTicker();
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    }
    window.addEventListener('audio:pause-studio', onGlobalPause as EventListener);
    return () => window.removeEventListener('audio:pause-studio', onGlobalPause as EventListener);
  }, [isPlaying, clearTicker]);

  // Listen for explicit pause requests to safely stop playback (internal use)
  useEffect(() => {
    const onPauseRequest = () => {
      if (!isPlaying) return;
      // Stop scheduler and clear all sources
      schedulerRef.current?.stop();
      stopAllSources();
      clearTicker();
      setIsPlaying(false);
      isPlayingRef.current = false;
      console.log('⏸️ Playback paused via studio:pause-request');
    }
    window.addEventListener('studio:pause-request', onPauseRequest as EventListener);
    return () => window.removeEventListener('studio:pause-request', onPauseRequest as EventListener);
  }, [isPlaying, clearTicker]);

  // Toggle playback (safer for UI buttons)
  const togglePlayback = useCallback(() => {
    const willPlay = !isPlaying;
    setPlaying(willPlay);
    
    // Notify global audio player to pause when studio starts playing
    if (willPlay) {
      try {
        window.dispatchEvent(new CustomEvent('audio:pause-global'));
        console.log('🎛️ Studio playback started, notified global player');
      } catch (e) {
        console.error('Failed to notify global player:', e);
      }
    }
  }, [isPlaying, setPlaying]);

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
    // Don't restart playback, just update position
    if (isPlaying) {
      // Stop current playback
      schedulerRef.current?.stop();
      clearTicker();
      stopAllSources();
      setIsPlaying(false);
    }
  }, [currentTime, isPlaying, clearTicker]);

  const skipForward = useCallback((seconds: number = 10) => {
    const newTime = currentTime + seconds;
    setCurrentTimeState(newTime);
    // Don't restart playback, just update position
    if (isPlaying) {
      // Stop current playback
      schedulerRef.current?.stop();
      clearTicker();
      stopAllSources();
      setIsPlaying(false);
    }
  }, [currentTime, isPlaying, clearTicker]);

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

  // Undo/Redo implementation
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setTracks(JSON.parse(JSON.stringify(history[prevIndex])));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setTracks(JSON.parse(JSON.stringify(history[nextIndex])));
    }
  }, [history, historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

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
    renameTrack,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
    setMasterVolume,
    setZoom,
    setSelectedTrack,
    setSelectedClip,
    ensureBuffer,
    getPeaksForUrl,
    trackHeight,
    setTrackHeight,
    leftGutterWidth,
    setLeftGutterWidth,
    setPlaying,
    togglePlayback,
    setCurrentTime,
    skipBackward,
    skipForward,
    playNextTrack,
    playPreviousTrack,
    toggleTrackLoop,
    isTrackLooping,
    reorderTrack,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
