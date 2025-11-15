/**
 * Timeline - AudioMass-style multi-track with draggable clips
 * Supports empty tracks with drag & drop, clips that can be moved/resized
 */

'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';
import { Volume2, VolumeX, Headphones, Trash2, Music, Repeat } from 'lucide-react';
import { ContextMenu, getTrackContextMenuItems } from './ContextMenu';
import TrackLeft from './TrackLeft';
import TrackClips from './TrackClips';
import TimelineScrollIndicator from './TimelineScrollIndicator';

interface TrackRowProps {
  trackId: string;
  snapEnabled: boolean;
  bpm: number;
  activeTool: 'select' | 'cut' | 'zoom' | 'move' | 'pan';
  onSplitStems?: (clipId: string, audioUrl: string) => void;
}

function TrackRow({ trackId, snapEnabled, bpm, activeTool, onSplitStems }: TrackRowProps) {
  const {
    tracks,
    reorderTrack,
    zoom,
    selectedTrackId,
    setSelectedTrack,
    addClipToTrack,
    moveClipToTrack,
    removeTrack,
  } = useStudio();

  const track = tracks.find((t) => t.id === trackId);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

      
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Calculate drop position on timeline
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50 * zoom;
    const rawTime = Math.max(0, x / pixelsPerSecond);
    const beat = 60 / Math.max(1, bpm);
    const grid = !snapEnabled ? 0 : (zoom > 2 ? beat / 4 : zoom > 1 ? beat / 2 : beat);
    const startTime = snapEnabled ? Math.round(rawTime / grid) * grid : rawTime;

    // Check if this is a clip being dragged from another track
    try {
      const clipData = e.dataTransfer.getData('application/json');
      if (clipData && clipData !== 'undefined' && clipData !== 'null' && clipData.trim() !== '') {
        try {
          const { clipId, trackId: sourceTrackId } = JSON.parse(clipData);
          if (clipId && sourceTrackId !== trackId) {
            // Move clip to this track
            moveClipToTrack(clipId, trackId, startTime);
            console.log(`✅ Clip moved to track: ${clipId} → ${trackId}`);
            return;
          }
        } catch {
          // ignore malformed data and continue as file drop
        }
      }
    } catch (err) {
      // Not a clip drag, continue to file handling
    }

    // Handle audio file drops
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('audio/')
    );

    if (files.length === 0) return;

    // Add each file as a clip to this track
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio(objectUrl);
      
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => {
          // Use duration from metadata for better clip length
          const duration = audio.duration || undefined;
          addClipToTrack(trackId, objectUrl, file.name, startTime, duration);
          resolve();
        };
      });
    }
  };

  // Context menu items (simplified - no single-file operations when empty)
  const contextMenuItems = track?.clips.length
    ? getTrackContextMenuItems({
        onDelete: () => removeTrack(trackId),
        onDuplicate: () => console.log('Duplicate track'),
        onReverse: () => console.log('Reverse'),
        onNormalize: () => console.log('Normalize'),
        onFadeIn: () => console.log('Fade In'),
        onFadeOut: () => console.log('Fade Out'),
        onGain: () => console.log('Gain'),
        onDelay: () => console.log('Delay'),
        onReverb: () => console.log('Reverb'),
        onCompressor: () => console.log('Compressor'),
        onDistortion: () => console.log('Distortion'),
        onBitcrusher: () => console.log('Bitcrusher'),
        onTelephonizer: () => console.log('Telephonizer'),
        onLowPass: () => console.log('Low Pass'),
        onHighPass: () => console.log('High Pass'),
        onSpeedChange: () => console.log('Speed Change'),
        onVocalRemover: () => console.log('Vocal Remover'),
        onStereoWiden: () => console.log('Stereo Widen'),
      })
    : [
        {
          label: 'Delete Track',
          onClick: () => removeTrack(trackId),
          shortcut: 'Delete',
        },
      ];

  if (!track) return null;

  const isSelected = selectedTrackId === trackId;
  const isEmpty = track.clips.length === 0;

  const thisIndex = tracks.findIndex(t => t?.id === trackId);

  const handleRowDragStart = (e: React.DragEvent) => {
    if (activeTool !== 'pan') return;
    e.dataTransfer.setData('text/track-id', trackId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e: React.DragEvent) => {
    if (activeTool !== 'pan') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRowDrop = (e: React.DragEvent) => {
    if (activeTool !== 'pan') return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/track-id');
    if (!draggedId) return;
    reorderTrack(draggedId, thisIndex);
  };

  return (
    <div
      className={`bg-black backdrop-blur-sm rounded border mb-3 relative cursor-pointer transition-all flex items-center gap-0 min-h-[9rem] ${
        isSelected
          ? 'border-teal-500 ring-2 ring-teal-500/50'
          : 'border-teal-900/30 hover:border-teal-700/50'
      } ${isDragOver ? 'border-teal-400 ring-2 ring-teal-400/50 bg-teal-500/10' : ''}`}
      onClick={() => setSelectedTrack(trackId)}
      draggable={activeTool === 'pan'}
      onDragStart={handleRowDragStart}
      onDragOverCapture={handleRowDragOver}
      onDropCapture={handleRowDrop}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <TrackLeft trackId={trackId} />
      <TrackClips trackId={trackId} snapEnabled={snapEnabled} bpm={bpm} activeTool={activeTool} onSplitStems={onSplitStems} />
    </div>
  );
}

export default function Timeline({ snapEnabled = false, bpm = 120, activeTool = 'select' as const, playheadLocked = true, onSplitStems, clipsContainerRef }: { snapEnabled?: boolean; bpm?: number; activeTool?: 'select' | 'cut' | 'zoom' | 'move' | 'pan'; playheadLocked?: boolean; onSplitStems?: (clipId: string, audioUrl: string) => void; clipsContainerRef?: React.RefObject<HTMLDivElement | null> }) {
  const { tracks, currentTime, isPlaying, zoom, leftGutterWidth, setLeftGutterWidth, setZoom } = useStudio();
  const internalClipsRef = useRef<HTMLDivElement | null>(null);
  const clipsScrollRef = clipsContainerRef ?? internalClipsRef;
  const rootScrollRef = useRef<HTMLDivElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);

  // Fixed 5-minute timeline view (300 seconds)
  const TIMELINE_DURATION = 300; // 5 minutes
  // Left gutter for pinned track header — measured dynamically
  const LEFT_GUTTER = leftGutterWidth;
  const pixelsPerSecond = 50 * zoom;
  const timelineWidth = TIMELINE_DURATION * pixelsPerSecond;

  // Auto-scroll to keep playhead centered during playback ONLY if locked
  useEffect(() => {
    if (!clipsScrollRef.current || !playheadLocked) return;
    const container = clipsScrollRef.current;
    const playheadPosition = currentTime * pixelsPerSecond;
    const containerWidth = container.clientWidth;
    const maxScroll = Math.max(0, timelineWidth - containerWidth);
    if (isPlaying) {
      const target = Math.min(maxScroll, Math.max(0, playheadPosition - containerWidth / 2 + 16));
      container.scrollLeft = target;
    }
  }, [currentTime, isPlaying, pixelsPerSecond, playheadLocked, timelineWidth]);

  // Wheel handler - keyboard modifiers map to actions
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!clipsScrollRef.current) return;
    const delta = e.deltaY;
    // Alt + wheel -> zoom in/out
    if (e.altKey) {
      e.preventDefault();
      const factor = delta < 0 ? 1.06 : 0.94;
      setZoom(Math.max(0.1, Math.min(10, zoom * factor)));
      return;
    }
    // Ctrl + wheel -> vertical scroll of the whole timeline
    if (e.ctrlKey) {
      e.preventDefault();
      const root = rootScrollRef.current || document.scrollingElement || document.body;
      if (root) {
        root.scrollTop += delta;
      }
      return;
    }
    // Default: map wheel to horizontal scroll
    e.preventDefault();
    clipsScrollRef.current.scrollLeft += delta;
  };

  // Observe left column width and update studio context
  useEffect(() => {
    if (!leftColumnRef.current || typeof setLeftGutterWidth !== 'function') return;
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width || 0);
          if (w > 0) setLeftGutterWidth(w);
        }
      });
      ro.observe(leftColumnRef.current);
    } catch (e) {
      // No-op if ResizeObserver isn't available
    }
    return () => ro?.disconnect();
  }, [leftColumnRef, setLeftGutterWidth]);

  const handleScroll = () => {
    if (!clipsScrollRef.current) return;
    const left = clipsScrollRef.current.scrollLeft;
    try {
      window.dispatchEvent(new CustomEvent('studio:timeline-scroll', { detail: { left } } as any));
    } catch {}
  };

  return (
    <div ref={rootScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-black/95 backdrop-blur-xl border-t border-teal-900/30 relative timeline-scrollbar-hidden">
      {/* Single scrollable container for both headers and clips */}
      <div className="space-y-0">
        {tracks.length === 0 ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <Music className="w-16 h-16 text-teal-700 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No tracks yet</p>
              <p className="text-teal-600 text-sm">Click "Add Track" to get started</p>
            </div>
          </div>
        ) : (
          tracks.map((track, index) => (
            <div key={`track-row-${track.id}`} className="flex items-stretch border-b border-teal-900/20 hover:bg-teal-900/5 transition-colors">
              {/* Track Header (Left) */}
              <div className="shrink-0">
                <TrackLeft trackId={track.id} />
              </div>
              
              {/* Track Clips Area (Right - only first track scrollable for unified scrollbar) */}
                <div 
                ref={index === 0 ? clipsScrollRef : undefined}
                onScroll={index === 0 ? handleScroll : undefined}
                onWheel={index === 0 ? handleWheel : undefined}
                className={index === 0 ? "flex-1 overflow-x-auto relative timeline-scrollbar-hidden" : "flex-1 overflow-hidden relative"}
              >
                <div style={{ minWidth: `${timelineWidth}px` }} className="relative h-full">
                  {/* Playhead - only show on first track, but extends through all */}
                  {index === 0 && (
                    <div
                      className="fixed top-0 bottom-0 w-1 bg-cyan-400 z-30 pointer-events-none"
                      style={{
                        left: `calc(224px + ${currentTime * pixelsPerSecond}px)`,
                      }}
                    >
                      <div className="absolute -top-2 -left-3 w-5 h-5 bg-cyan-400 rotate-45 shadow-lg" />
                      {isPlaying && (
                        <div className="absolute top-0 -left-4 w-8 h-8">
                          <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <TrackClips 
                    trackId={track.id} 
                    snapEnabled={snapEnabled} 
                    bpm={bpm} 
                    activeTool={activeTool} 
                    onSplitStems={onSplitStems} 
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Glassmorphism Scroll Indicator */}
      <TimelineScrollIndicator scrollContainerRef={clipsScrollRef} />
    </div>
  );
}
