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
}

const TRACK_COLORS = [
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#22d3ee', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#a78bfa', // light purple
  '#fb7185', // light pink
  '#06b6d4', // light cyan
  '#fbbf24', // light amber
];

export function useMultiTrack(): UseMultiTrackReturn {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [masterVolumeState, setMasterVolumeState] = useState(0.8);
  const [zoom, setZoom] = useState(1.0);
  const [duration, setDuration] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);

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

      console.log('✅ Multi-track audio context initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
    }

    return () => {
      // Cleanup audio nodes
      if (masterGainNodeRef.current) {
        masterGainNodeRef.current.disconnect();
      }
    };
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
      volume: 0.8,
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
        gainNode.gain.value = newTrack.volume;

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
    setCurrentTimeState(time);
  }, []);

  // Set playing state (called from Timeline)
  const setPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Set selected track
  const setSelectedTrack = useCallback((id: string | null) => {
    setSelectedTrackId(id);
  }, []);

  // Set selected clip
  const setSelectedClip = useCallback((id: string | null) => {
    setSelectedClipId(id);
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
  };
}
