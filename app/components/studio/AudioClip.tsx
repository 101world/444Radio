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
  onMove: (clipId: string, newStartTime: number) => void;
  onResize: (clipId: string, newDuration: number, newOffset: number) => void;
  onDelete: (clipId: string) => void;
  onSelect: (clipId: string) => void;
  isSelected: boolean;
}

export default function AudioClipComponent({
  clip,
  zoom,
  onMove,
  onResize,
  onDelete,
  onSelect,
  isSelected,
}: AudioClipComponentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const clipRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = 50 * zoom;
  const clipWidth = clip.duration * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    
    setIsDragging(true);
    const rect = clipRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset(e.clientX - rect.left);
    }
    onSelect(clip.id);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const timelineContainer = clipRef.current?.parentElement?.parentElement;
      if (!timelineContainer) return;

      const rect = timelineContainer.getBoundingClientRect();
      const relativeX = e.clientX - rect.left - dragOffset;
      const newStartTime = Math.max(0, relativeX / pixelsPerSecond);
      
      onMove(clip.id, newStartTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, pixelsPerSecond, clip.id, onMove]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={clipRef}
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
              // TODO: Implement trim start
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-cyan-400/30 hover:bg-cyan-400/50"
            onMouseDown={(e) => {
              e.stopPropagation();
              // TODO: Implement trim end
            }}
          />
        </>
      )}
    </div>
  );
}
