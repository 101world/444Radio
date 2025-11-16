/**
 * TrackLeft - Left fixed controls column for track
 */
 'use client'

import { MouseEvent, useState, useRef, useEffect, memo } from 'react';
import { Volume2, GripVertical, Edit2, Check, X, Download } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';

function TrackLeft({ trackId }: { trackId: string }) {
  const { tracks, setTrackVolume, setTrackPan, toggleMute, toggleSolo, removeTrack, setSelectedTrack, selectedTrackId, trackHeight, setTrackHeight, renameTrack, reorderTrack, addTrack } = useStudio();
  const track = tracks.find(t => t.id === trackId);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // Start editing track name
  const handleStartEditName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(track.name);
    setTimeout(() => nameInputRef.current?.select(), 0);
  };

  // Save edited name
  const handleSaveName = () => {
    if (editedName.trim()) {
      renameTrack(trackId, editedName.trim());
    }
    setIsEditingName(false);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  // Handle keyboard shortcuts for editing
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Download all clips from this track
  const handleDownloadTrack = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!track.clips || track.clips.length === 0) {
      alert('No audio clips in this track to download');
      return;
    }

    // Download each clip
    for (const clip of track.clips) {
      try {
        const a = document.createElement('a');
        a.href = clip.audioUrl;
        a.download = `${track.name}_${clip.name}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Download failed for', clip.name, error);
      }
    }
  };

  // Track drag-and-drop reordering
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', trackId);
    // Friendly drag image to avoid default ghost image causing flicker
    try {
      const img = new Image();
      img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
      e.dataTransfer.setDragImage(img, 0, 0);
    } catch {}
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedTrackId = e.dataTransfer.getData('text/plain');
    // Try to parse JSON for library track votes
    const jsonData = e.dataTransfer.getData('application/json');
    if (draggedTrackId && draggedTrackId !== trackId) {
      const draggedIndex = tracks.findIndex(t => t.id === draggedTrackId);
      const targetIndex = tracks.findIndex(t => t.id === trackId);
      if (draggedIndex !== -1 && targetIndex !== -1) {
        reorderTrack(draggedTrackId, targetIndex);
      }
    }
    // If a library track was dropped, create a new track at this location
    if (!draggedTrackId && jsonData) {
      try {
        const parsed = JSON.parse(jsonData);
        if (parsed?.type === 'library-track' && parsed?.trackData) {
          const lib = parsed.trackData;
          const newTrackId = addTrack(lib.title || 'Library Track', lib.audio_url || lib.audioUrl);
          const targetIndex = tracks.findIndex(t => t.id === trackId);
          if (newTrackId && targetIndex !== -1) {
            // Place new track in the desired position
            reorderTrack(newTrackId, targetIndex);
          }
        }
      } catch (err) {
        console.warn('Failed to parse library-drop JSON', err);
      }
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      className={`w-56 shrink-0 bg-gradient-to-br from-gray-950 via-black to-gray-900 border-r backdrop-blur-md p-4 flex flex-col gap-3 justify-center transition-all duration-200 relative group cursor-move ${
        isSelected 
          ? 'border-teal-400/60 ring-2 ring-teal-500/40 shadow-2xl shadow-teal-500/20' 
          : 'border-teal-900/20 hover:border-teal-700/40 hover:brightness-110 hover:shadow-lg hover:shadow-black/30'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{ height: `${trackHeight}px` }}
      onClick={() => setSelectedTrack(trackId)}
      onKeyDown={(e) => { if (e.key === 'Enter') setSelectedTrack(trackId); }}
    >
      {/* Name - Enhanced with Editing */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600/30 to-cyan-600/30 border border-teal-500/30 flex items-center justify-center text-xs text-teal-300 font-bold shadow-inner">
          {number}
        </div>
        <div 
          className="w-3 h-3 rounded-full shadow-lg ring-1 ring-white/20" 
          style={{ 
            backgroundColor: track.color,
            boxShadow: `0 0 8px ${track.color}80`
          }} 
        />
        {isEditingName ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              ref={nameInputRef}
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-2 py-1 text-xs bg-gray-900/80 border border-teal-500/50 rounded text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50"
              maxLength={30}
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleSaveName(); }}
              className="p-1 rounded bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 transition-colors"
              title="Save"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
              className="p-1 rounded bg-gray-700/30 hover:bg-gray-700/50 text-gray-300 transition-colors"
              title="Cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <span className="text-white font-bold text-sm truncate flex-1 drop-shadow-lg" title={track.name}>
              {track.name}
            </span>
            <button
              onClick={handleStartEditName}
              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-teal-600/20 text-teal-400 transition-all"
              title="Rename track"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
      
      {/* Controls row - Enhanced */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggleMute(trackId); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            track.mute 
              ? 'bg-gradient-to-br from-red-600/40 to-pink-600/40 text-red-200 border border-red-400/40 shadow-lg shadow-red-500/30' 
              : 'bg-gray-900/80 text-gray-300 hover:text-white border border-teal-900/30 hover:border-teal-700/50 hover:bg-gray-800/80'
          }`}
          title="Mute (M)"
          aria-label={`Mute ${track.name}`}
        >
          <Volume2 className="w-4 h-4" />
        </button>
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); toggleSolo(trackId); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            track.solo 
              ? 'bg-gradient-to-br from-cyan-600/40 to-blue-600/40 text-cyan-200 border border-cyan-400/40 shadow-lg shadow-cyan-500/30' 
              : 'bg-gray-900/80 text-gray-300 hover:text-white border border-teal-900/30 hover:border-teal-700/50 hover:bg-gray-800/80'
          }`}
          title="Solo (S)"
          aria-label={`Solo ${track.name}`}
        >
          S
        </button>
        <button
          onClick={handleDownloadTrack}
          className="px-2 py-1.5 rounded-lg text-xs font-bold bg-gray-900/80 text-teal-400 hover:bg-gradient-to-br hover:from-teal-600/30 hover:to-cyan-600/30 border border-teal-900/30 hover:border-teal-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/20"
          title="Download all clips"
          aria-label={`Download ${track.name}`}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e: MouseEvent) => { e.stopPropagation(); removeTrack(trackId); }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-900/80 text-red-300 hover:bg-gradient-to-br hover:from-red-600/30 hover:to-pink-600/30 border border-teal-900/30 hover:border-red-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20"
          title="Delete"
          aria-label={`Delete ${track.name}`}
        >
          ✕
        </button>
      </div>

      {/* Volume - Enhanced */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-900/80 rounded-full appearance-none cursor-pointer accent-teal-500 border border-teal-900/30 hover:border-teal-700/50 transition-all [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-teal-400 [&::-webkit-slider-thumb]:to-cyan-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-teal-500/40"
        />
        <span className="text-[10px] text-gray-400 w-10 text-right font-mono font-semibold">{Math.round(track.volume * 100)}%</span>
      </div>

      {/* Resize handle - Enhanced */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center border-t transition-all duration-200 ${
          isResizing 
            ? 'bg-teal-500/30 border-teal-400/60' 
            : 'bg-transparent hover:bg-teal-500/10 border-teal-900/20 hover:border-teal-500/40'
        }`}
        onMouseDown={handleResizeStart}
        title="Drag to resize track height"
      >
        <GripVertical className={`w-4 h-4 transition-colors duration-200 ${isResizing ? 'text-teal-300' : 'text-teal-700/50 hover:text-teal-400'}`} />
      </div>
    </div>
  )
}

// Memoize to prevent re-renders during playback
export default memo(TrackLeft, (prevProps, nextProps) => {
  return prevProps.trackId === nextProps.trackId;
});
