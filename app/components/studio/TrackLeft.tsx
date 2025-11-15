/**
 * TrackLeft - Left fixed controls column for track
 */
 'use client'

import { MouseEvent } from 'react';
import { Volume2 } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TrackLeft({ trackId }: { trackId: string }) {
  const { tracks, setTrackVolume, setTrackPan, toggleMute, toggleSolo, removeTrack, setSelectedTrack, selectedTrackId } = useStudio();
  const track = tracks.find(t => t.id === trackId);
  if (!track) return null;

  const isSelected = selectedTrackId === trackId;

  return (
    <div
      className={`w-56 shrink-0 bg-white/5 border-r border-teal-900/30 backdrop-blur-md rounded-l p-3 flex flex-col gap-3 h-24 justify-center ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/50' : ''}`}
      onClick={() => setSelectedTrack(trackId)}
    >
      {/* Name */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />
        <span className="text-white font-semibold text-sm truncate" title={track.name}>{track.name}</span>
      </div>
      {/* Controls row */}
      <div className="flex items-center gap-1">
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggleMute(trackId); }}
          className={`px-2 py-1 rounded text-xs font-semibold ${track.mute ? 'bg-red-600/30 text-red-300' : 'bg-gray-900/70 text-gray-300 hover:text-white border border-teal-900/40'}`}
          title="Mute (M)"
        >M</button>
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggleSolo(trackId); }}
          className={`px-2 py-1 rounded text-xs font-semibold ${track.solo ? 'bg-cyan-600/30 text-cyan-200' : 'bg-gray-900/70 text-gray-300 hover:text-white border border-teal-900/40'}`}
          title="Solo (S)"
        >S</button>
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); removeTrack(trackId); }}
          className="px-2 py-1 rounded text-xs font-semibold bg-gray-900/70 text-red-300 hover:bg-red-600/20 border border-teal-900/40"
          title="Delete"
        >✕</button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
          className="w-full h-1 accent-cyan-500"
        />
        <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(track.volume * 100)}%</span>
      </div>
    </div>
  )
}
