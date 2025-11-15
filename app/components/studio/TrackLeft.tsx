/**
 * TrackLeft - Left fixed controls column for track
 */
 'use client'

import { MouseEvent, useState, useRef, useEffect } from 'react';
import { Volume2, GripVertical } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TrackLeft({ trackId }: { trackId: string }) {
  const { tracks, setTrackVolume, setTrackPan, toggleMute, toggleSolo, removeTrack, setSelectedTrack, selectedTrackId, trackHeight, setTrackHeight } = useStudio();
  const track = tracks.find(t => t.id === trackId);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  if (!track) return null;

  const isSelected = selectedTrackId === trackId;
  const index = tracks.findIndex(t => t?.id === trackId);
  const number = index === -1 ? '-' : index + 1;

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = trackHeight || 144;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      const newHeight = Math.max(80, Math.min(400, startHeightRef.current + delta));
      setTrackHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setTrackHeight]);

  return (
    <div
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      className={`w-56 shrink-0 bg-gradient-to-b from-gray-950 to-black border-r border-teal-900/30 backdrop-blur-md p-4 flex flex-col gap-3 justify-center transition-all relative ${isSelected ? 'border-teal-500 ring-1 ring-teal-500/50 shadow-lg shadow-cyan-900/20' : 'hover:brightness-110'}`}
      style={{ height: `${trackHeight}px` }}
      onClick={() => setSelectedTrack(trackId)}
      onKeyDown={(e) => { if (e.key === 'Enter') setSelectedTrack(trackId); }}
    >
      {/* Name */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-teal-700/20 flex items-center justify-center text-[11px] text-teal-300 font-semibold">{number}</div>
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />
        <span className="text-white font-semibold text-sm truncate" title={track.name}>{track.name}</span>
      </div>
      {/* Controls row */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggleMute(trackId); }}
          className={`px-2 py-1 rounded text-xs font-semibold ${track.mute ? 'bg-red-600/30 text-red-300' : 'bg-gray-900/70 text-gray-300 hover:text-white border border-teal-900/40'}`}
          title="Mute (M)"
          aria-label={`Mute ${track.name}`}
        >
          <Volume2 className="w-4 h-4 text-gray-200" />
        </button>
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggleSolo(trackId); }}
          className={`px-2 py-1 rounded text-xs font-semibold ${track.solo ? 'bg-cyan-600/30 text-cyan-200' : 'bg-gray-900/70 text-gray-300 hover:text-white border border-teal-900/40'}`}
          title="Solo (S)"
          aria-label={`Solo ${track.name}`}
        >S</button>
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); removeTrack(trackId); }}
          className="px-2 py-1 rounded text-xs font-semibold bg-gray-900/70 text-red-300 hover:bg-red-600/20 border border-teal-900/40"
          title="Delete"
          aria-label={`Delete ${track.name}`}
        >
          ✕
        </button>
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

      {/* Resize handle */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-teal-500/50 transition-colors group ${isResizing ? 'bg-teal-500' : 'bg-transparent'}`}
        onMouseDown={handleResizeStart}
        title="Drag to resize track height"
      >
        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-teal-400" />
        </div>
      </div>
    </div>
  )
}
