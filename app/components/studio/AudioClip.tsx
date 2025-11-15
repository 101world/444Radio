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
  onSplitStems?: (clipId: string, audioUrl: string, clipName?: string) => void;
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
  const [dragPreviewPos, setDragPreviewPos] = useState({ x: 0, y: 0 });
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
      setDragPreviewPos({ x: e.clientX, y: e.clientY });
      
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
    <>
      <div
        ref={clipRef}
        draggable={activeTool === 'select' || activeTool === 'move'}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`absolute top-2 bottom-2 rounded-xl transition-all duration-150 ${
          isSelected
            ? 'ring-2 ring-teal-400 shadow-2xl shadow-teal-500/50 scale-[1.02] z-10'
            : 'ring-1 ring-white/10 hover:ring-teal-500/40 hover:shadow-xl hover:shadow-teal-500/20 hover:scale-[1.01]'
        } ${isDragging ? 'opacity-50 scale-105 z-20' : ''} ${
          activeTool === 'select' || activeTool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        style={{
          left: `${clipLeft}px`,
          width: `${clipWidth}px`,
          background: `linear-gradient(135deg, ${clip.color}ee 0%, ${clip.color}dd 50%, ${clip.color}cc 100%)`,
          backdropFilter: 'blur(8px)',
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(clip.id);
        }}
        onContextMenu={handleContextMenu}
      >
      {/* Clip content */}
      <div className="h-full flex flex-col justify-between p-3 gap-2 overflow-hidden relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-bold truncate drop-shadow-lg">
              {clip.name}
            </div>
            <div className="text-white/70 text-[10px] font-medium">
              {formatTime(clip.duration)}
            </div>
          </div>
          {isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(clip.id);
              }}
              className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all border border-red-500/20 hover:border-red-400/40 shadow-lg"
              title="Delete clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Waveform */}
        <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden border border-white/5 shadow-inner">
          <ClipWaveform audioUrl={clip.audioUrl} width={Math.max(1, Math.round(clipWidth))} height={56} />
        </div>
      </div>

      {/* Resize handles hidden to support fixed, clean UI */}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-950/95 backdrop-blur-xl border border-teal-500/40 rounded-xl shadow-2xl shadow-black/50 z-50 py-2 min-w-[180px] overflow-hidden"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {onSplitStems && (
            <button
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-white hover:bg-gradient-to-r hover:from-teal-500/20 hover:to-cyan-500/20 flex items-center gap-3 transition-all border-b border-white/5"
              onClick={() => {
                onSplitStems(clip.id, clip.audioUrl, clip.name);
                setContextMenu(null);
              }}
            >
              <Scissors className="w-4 h-4 text-teal-400" />
              Split into Stems
            </button>
          )}
          <button
            className="w-full px-4 py-2.5 text-left text-sm font-medium text-white hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 flex items-center gap-3 transition-all"
            onClick={() => {
              onDelete(clip.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            Delete Clip
          </button>
        </div>
      )}

      {/* Drag Preview Ghost - shown while dragging */}
      {isDragging && dragMode === 'mouse' && (
        <div
          className="fixed pointer-events-none z-[9999] rounded-xl shadow-2xl shadow-teal-500/60 opacity-80 animate-pulse"
          style={{
            left: dragPreviewPos.x - 50,
            top: dragPreviewPos.y - 20,
            width: `${Math.min(clipWidth, 200)}px`,
            height: '40px',
            background: `linear-gradient(135deg, ${clip.color}ff 0%, ${clip.color}ee 50%, ${clip.color}dd 100%)`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="h-full flex items-center justify-center px-3">
            <span className="text-white text-xs font-bold truncate drop-shadow-lg">
              {clip.name}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
