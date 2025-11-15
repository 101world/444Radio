/**
 * Audio Clip - Draggable audio region on timeline
 * AudioMass-style clip that can be moved, trimmed, split
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, Scissors, Copy, Trash2 } from 'lucide-react';

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
  isSelected,
}: AudioClipComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizing, setResizing] = useState<null | 'left' | 'right'>(null);
  const clipRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = 50 * zoom;
  const clipWidth = clip.duration * pixelsPerSecond;
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

    setIsDragging(true);
    const scroller = document.querySelector('.studio-timeline-scroller') as HTMLElement | null;
    const scrollerRect = scroller?.getBoundingClientRect();
    const inner = document.querySelector('[data-testid="timeline-inner"]') as HTMLElement | null;
    const paddingLeft = inner ? (parseFloat(window.getComputedStyle(inner).paddingLeft || '0') || 0) : 0;
    const clipRect = clipRef.current?.getBoundingClientRect();
    if (scroller && scrollerRect && clipRect) {
    const contentX = scroller.scrollLeft + (e.clientX - scrollerRect.left) - paddingLeft;
      const clipLeftPx = clip.startTime * pixelsPerSecond;
      setDragOffset(contentX - clipLeftPx);
    } else {
      const rect = clipRef.current?.getBoundingClientRect();
      if (rect) setDragOffset(e.clientX - rect.left);
    }
    onSelect(clip.id);
  };

  // Drag & drop between tracks
  const handleDragStart = (e: React.DragEvent) => {
    if (activeTool !== 'select' && activeTool !== 'move') return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      clipId: clip.id,
      trackId: clip.trackId,
      clipData: clip,
    }));
    onSelect(clip.id);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Drag end handled by drop target
  };

  useEffect(() => {
    if (!isDragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const scroller = document.querySelector('.studio-timeline-scroller') as HTMLElement | null;
      const timelineContainer = scroller;
      if (!timelineContainer) return;

      const rect = timelineContainer.getBoundingClientRect();
      const innerEl = document.querySelector('[data-testid="timeline-inner"]') as HTMLElement | null;
      const paddingLeft2 = innerEl ? parseFloat(window.getComputedStyle(innerEl).paddingLeft || '0') || 0 : 0;
      const contentX = timelineContainer.scrollLeft + (e.clientX - rect.left) - paddingLeft2;
      const relativeX = contentX - dragOffset;

      if (isDragging) {
        const rawStart = Math.max(0, relativeX / pixelsPerSecond);
        const snapped = quantize(rawStart);
        onMove(clip.id, snapped);
      } else if (resizing) {
        const mouseX = contentX;
        if (resizing === 'left') {
          // New start cannot go past right edge
          const newStartPx = Math.min(clipLeft + clipWidth - 5, Math.max(0, mouseX));
          const newStartTime = quantize(newStartPx / pixelsPerSecond);
          let newDur = (clip.startTime + clip.duration) - newStartTime;
          if (newDur < 0.05) newDur = 0.05;
          const newOff = clip.offset + (clip.startTime - newStartTime);
          onResize(clip.id, newDur, Math.max(0, newOff), newStartTime);
        } else {
          // Right resize: adjust duration only
          const newEndPx = Math.max(clipLeft + 5, mouseX);
          const newEndTime = quantize(newEndPx / pixelsPerSecond);
          let newDur = newEndTime - clip.startTime;
          if (newDur < 0.05) newDur = 0.05;
          onResize(clip.id, newDur, clip.offset, clip.startTime);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, resizing, dragOffset, pixelsPerSecond, clip.id, onMove, onResize, clipLeft, clipWidth, clip.startTime, clip.duration, clip.offset, quantize]);

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
      className={`absolute top-2 bottom-2 rounded cursor-move transition-shadow ${
        isSelected
          ? 'ring-2 ring-teal-400 shadow-lg shadow-teal-500/50'
          : 'ring-1 ring-teal-900/40'
      } ${isDragging ? 'opacity-70 cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${clipLeft}px`,
        width: `${clipWidth}px`,
        backgroundColor: clip.color,
        backgroundImage: `linear-gradient(90deg, transparent 0px, rgba(0,0,0,0.1) 1px, transparent 1px)`,
        backgroundSize: `${pixelsPerSecond}px 100%`,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(clip.id);
      }}
    >
      {/* Clip content */}
      <div className="h-full flex flex-col justify-between p-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">
              {clip.name}
            </div>
            <div className="text-white/70 text-[10px]">
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
        <div className="h-8 bg-black/20 rounded flex items-center justify-center">
          <Volume2 className="w-3 h-3 text-white/30" />
        </div>
      </div>

      {/* Resize handles */}
      {isSelected && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-cyan-400/30 hover:bg-cyan-400/50"
            onMouseDown={(e) => {
              e.stopPropagation();
              setResizing('left');
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-cyan-400/30 hover:bg-cyan-400/50"
            onMouseDown={(e) => {
              e.stopPropagation();
              setResizing('right');
            }}
          />
        </>
      )}
    </div>
  );
}
