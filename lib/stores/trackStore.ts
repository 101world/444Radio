/**
 * Zustand store for DAW track state.
 *
 * Replaces React's useState<Track[]> for timeline data.
 * Benefits:
 *  - Clip-level subscriptions (only re-render what changed)
 *  - No full component re-render on track/clip updates
 *  - Cleaner undo/redo path later
 *  - Imperative getState() for non-React code (TimelineRenderer, engine callbacks)
 */

import { create } from 'zustand'
import type { Track, TrackClip } from '@/lib/audio/TrackManager'

interface TrackStoreState {
  tracks: Track[]
  selectedTrackId: string | null
  selectedClipId: string | null

  // Bulk operations
  setTracks: (tracks: Track[]) => void
  
  // Track operations
  setSelectedTrackId: (id: string | null) => void
  setSelectedClipId: (id: string | null) => void
  
  // Granular update — only re-renders subscribers of that track
  updateTrackById: (trackId: string, updates: Partial<Track>) => void
  
  // Clip-level update — surgical, no full re-render
  updateClip: (trackId: string, clipId: string, updates: Partial<TrackClip>) => void
  
  // Add/remove
  addTrack: (track: Track) => void
  removeTrack: (trackId: string) => void
  
  // Reset
  reset: () => void
}

export const useTrackStore = create<TrackStoreState>((set) => ({
  tracks: [],
  selectedTrackId: null,
  selectedClipId: null,

  setTracks: (tracks) => set({ tracks }),
  
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  
  updateTrackById: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    })),
  
  updateClip: (trackId, clipId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId ? { ...c, ...updates } : c
              ),
            }
          : t
      ),
    })),
  
  addTrack: (track) =>
    set((state) => ({ tracks: [...state.tracks, track] })),
  
  removeTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
      selectedTrackId:
        state.selectedTrackId === trackId ? null : state.selectedTrackId,
    })),
  
  reset: () => set({ tracks: [], selectedTrackId: null, selectedClipId: null }),
}))

// Selectors for granular subscriptions
export const selectTracks = (state: TrackStoreState) => state.tracks
export const selectTrackById = (trackId: string) => (state: TrackStoreState) =>
  state.tracks.find((t) => t.id === trackId)
export const selectSelectedTrackId = (state: TrackStoreState) => state.selectedTrackId
export const selectSelectedClipId = (state: TrackStoreState) => state.selectedClipId
