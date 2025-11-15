/**
 * Audio Clip - Draggable audio region on timeline
 * AudioMass-style clip that can be moved, trimmed, split
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, Scissors, Copy, Trash2 } from 'lucide-react';
import ClipWaveform from './ClipWaveform';

export interface AudioClip {
  id: string;
  trackId: string;
  audioUrl: string;
  name: string;
  startTime: number; // Position on timeline in seconds
  duration: number; // Clip duration in seconds
  offset: number; // Start offset within the audio file
  color: string;
}

interface AudioClipComponentProps {
  clip: AudioClip;
  zoom: number;
  bpm: number;
  snapEnabled: boolean;
  activeTool: 'select' | 'cut' | 'zoom' | 'move' | 'pan';
  onMove: (clipId: string, newStartTime: number) => void;
  onResize: (clipId: string, newDuration: number, newOffset: number, newStartTime?: number) => void;
  onSplit: (clipId: string, splitTime: number) => void;
  onDelete: (clipId: string) => void;
  onSelect: (clipId: string) => void;
  onSplitStems?: (clipId: string, audioUrl: string) => void;
  isSelected: boolean;
}

export default function AudioClipComponent({
  clip,
  zoom,
  bpm,
  snapEnabled,
  activeTool,
  onMove,
  onResize,
  onSplit,
  onDelete,
  onSelect,
  onSplitStems,
  isSelected,
}: AudioClipComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'none' | 'mouse' | 'html5'>('none');
  // Resizing is disabled for a simplified, consistent visual style requested by user
  // const [resizing, setResizing] = useState<null | 'left' | 'right'>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = 50 * zoom;
  const clipWidth = Math.max(1, clip.duration * pixelsPerSecond);
  const clipLeft = clip.startTime * pixelsPerSecond;

  const beat = 60 / Math.max(1, bpm);
  const grid = !snapEnabled ? 0 : (zoom > 2 ? beat / 4 : zoom > 1 ? beat / 2 : beat);
  const quantize = (t: number) => snapEnabled && grid > 0 ? Math.round(t / grid) * grid : t;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    
    // Cut tool: split at clicked position
    if (activeTool === 'cut') {
      const container = clipRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const timeAtPointer = clip.startTime + relX / pixelsPerSecond;
        onSplit(clip.id, quantize(timeAtPointer));
        return;
      }
    }

    // Start mouse drag
    setDragMode('mouse');
    setIsDragging(true);
    const rect = clipRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset(e.clientX - rect.left);
    }
    onSelect(clip.id);
  };

  // Drag & drop between tracks using HTML5
  const handleDragStart = (e: React.DragEvent) => {
    if (activeTool !== 'select' && activeTool !== 'move') {
      e.preventDefault();
      return;
    }
    setDragMode('html5');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      clipId: clip.id,
      trackId: clip.trackId,
      clipData: clip,
    }));
    onSelect(clip.id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDragMode('none');
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onSelect(clip.id);
  };

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!isDragging || dragMode !== 'mouse') return;

    const handleMouseMove = (e: MouseEvent) => {
      const timelineContainer = clipRef.current?.parentElement?.parentElement;
      if (!timelineContainer) return;

      const rect = timelineContainer.getBoundingClientRect();
      const relativeX = e.clientX - rect.left - dragOffset;
      const rawStart = Math.max(0, relativeX / pixelsPerSecond);
      const snapped = quantize(rawStart);
      onMove(clip.id, snapped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragMode('none');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragMode, dragOffset, pixelsPerSecond, clip.id, onMove, clipLeft, clipWidth, clip.startTime, clip.duration, clip.offset, quantize]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={clipRef}
      draggable={activeTool === 'select' || activeTool === 'move'}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`absolute top-3 bottom-3 rounded-lg cursor-move transition-shadow ${
        isSelected
          ? 'ring-2 ring-teal-400 shadow-lg shadow-teal-500/60'
          : 'ring-1 ring-teal-900/40 hover:shadow-md hover:shadow-teal-500/20'
      } ${isDragging ? 'opacity-70 cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
        backgroundColor: clip.color,
        backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 100%)`,
        backgroundSize: `${pixelsPerSecond}px 100%`,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(clip.id);
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Clip content */}
      <div className="h-full flex flex-col justify-center p-4 gap-2 overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">
              {clip.name}
            </div>
            <div className="text-white/80 text-[11px]">
              {formatTime(clip.duration)}
            </div>
          </div>
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(clip.id);
              }}
              className="p-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors"
              title="Delete clip"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Waveform placeholder */}
        <div className="h-14 bg-black/10 rounded-lg overflow-hidden">
          <ClipWaveform audioUrl={clip.audioUrl} width={Math.max(1, Math.round(clipWidth))} height={48} />
        </div>
      </div>

      {/* Resize handles hidden to support fixed, clean UI */}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-900 border border-teal-500/30 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onSplitStems && (
            <button
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-teal-500/20 flex items-center gap-2 transition-colors"
              onClick={() => {
                onSplitStems(clip.id, clip.audioUrl);
                setContextMenu(null);
              }}
            >
              <Scissors className="w-4 h-4" />
              Split into Stems
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-teal-500/20 flex items-center gap-2 transition-colors"
            onClick={() => {
              onDelete(clip.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete Clip
          </button>
        </div>
      )}
    </div>
  );
}
