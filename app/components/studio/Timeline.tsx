/**
 * Timeline - AudioMass-style multi-track with draggable clips
 * Supports empty tracks with drag & drop, clips that can be moved/resized
 */

'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';
import { Volume2, VolumeX, Headphones, Trash2, Music, Repeat } from 'lucide-react';
import { ContextMenu, getTrackContextMenuItems } from './ContextMenu';
import { AudioEffects } from '@/lib/audio-effects';
import AudioClip from './AudioClip';

interface TrackRowProps {
  trackId: string;
  snapEnabled: boolean;
  bpm: number;
  activeTool: 'select' | 'cut' | 'zoom' | 'move' | 'pan';
}

function TrackRow({ trackId, snapEnabled, bpm, activeTool }: TrackRowProps) {
  const {
    tracks,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
    removeTrack,
    toggleTrackLoop,
    isTrackLooping,
    addClipToTrack,
    moveClip,
    moveClipToTrack,
    resizeClip,
    splitClip,
    removeClip,
    zoom,
    selectedTrackId,
    setSelectedTrack,
    selectedClipId,
    setSelectedClip,
    reorderTrack,
  } = useStudio();

  const track = tracks.find((t) => t.id === trackId);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      if (clipData) {
        const { clipId, trackId: sourceTrackId } = JSON.parse(clipData);
        if (clipId && sourceTrackId !== trackId) {
          // Move clip to this track
          moveClipToTrack(clipId, trackId, startTime);
          console.log(`✅ Clip moved to track: ${clipId} → ${trackId}`);
          return;
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
          addClipToTrack(trackId, objectUrl, file.name, startTime);
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
      className={`bg-black backdrop-blur-sm rounded border mb-3 relative cursor-pointer transition-all flex items-center gap-0 ${
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
      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* PINNED LEFT CONTROLS */}
      <div className="sticky left-0 z-10 bg-gradient-to-r from-black via-black to-transparent p-4 pr-6 flex flex-col gap-2 border-r border-teal-900/30 shrink-0">
        {/* Track name & color */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: track.color }} />
          <span className="text-white font-medium text-sm whitespace-nowrap">{track.name}</span>
        </div>

        {/* Track controls */}
        <div className="flex items-center gap-2">
          {/* Volume */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
            className="w-16 h-1 accent-cyan-500"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-gray-400 w-8 shrink-0">{Math.round(track.volume * 100)}%</span>

          {/* Mute */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(trackId);
            }}
            className={`p-1.5 rounded shrink-0 ${
              track.mute ? 'bg-red-500/20 text-red-400' : 'bg-gray-900 text-gray-400 hover:text-white border border-teal-900/30'
            }`}
            title="Mute"
          >
            {track.mute ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>

          {/* Solo */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSolo(trackId);
            }}
            className={`p-1.5 rounded shrink-0 ${
              track.solo ? 'bg-teal-500/20 text-teal-400' : 'bg-gray-900 text-gray-400 hover:text-white border border-teal-900/30'
            }`}
            title="Solo"
          >
            <Headphones className="w-3 h-3" />
          </button>

          {/* Loop Track */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleTrackLoop(trackId);
            }}
            className={`p-1.5 rounded shrink-0 ${
              isTrackLooping(trackId) ? 'bg-teal-500/20 text-teal-400' : 'bg-gray-900 text-gray-400 hover:text-white border border-teal-900/30'
            }`}
            title="Loop current clip on this track"
          >
            <Repeat className="w-3 h-3" />
          </button>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(trackId);
            }}
            className="p-1.5 rounded bg-gray-900 text-red-400 hover:bg-red-500/20 border border-teal-900/30 shrink-0"
            title="Delete track"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* SCROLLABLE CLIPS AREA */}
      <div 
        className="relative h-24 bg-black/40 flex-1 overflow-x-auto overflow-y-hidden"
        onContextMenu={handleContextMenu}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isEmpty ? (
          /* Empty state with drop zone */
          <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-teal-900/40 rounded">
            <div className="text-center">
              <Music className="w-8 h-8 text-teal-700 mx-auto mb-2" />
              <p className="text-xs text-teal-600">Drop audio files here</p>
            </div>
          </div>
        ) : (
          /* Render clips */
          track.clips.map((clip) => (
            <AudioClip
              key={clip.id}
              clip={clip}
              zoom={zoom}
              bpm={bpm}
              snapEnabled={snapEnabled}
              activeTool={activeTool}
              isSelected={selectedClipId === clip.id}
              onSelect={() => setSelectedClip(clip.id)}
              onMove={(clipId, newStartTime) => moveClip(clipId, newStartTime)}
              onResize={(clipId, newDuration, newOffset, newStartTime) => resizeClip(clipId, newDuration, newOffset, newStartTime)}
              onSplit={(clipId, splitTime) => splitClip(clipId, splitTime)}
              onDelete={(clipId) => removeClip(clipId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function Timeline({ snapEnabled = false, bpm = 120, activeTool = 'select' as const, playheadLocked = true }: { snapEnabled?: boolean; bpm?: number; activeTool?: 'select' | 'cut' | 'zoom' | 'move' | 'pan'; playheadLocked?: boolean }) {
  const { tracks, currentTime, isPlaying, zoom } = useStudio();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fixed 5-minute timeline view (300 seconds)
  const TIMELINE_DURATION = 300; // 5 minutes
  const pixelsPerSecond = 50 * zoom;
  const timelineWidth = TIMELINE_DURATION * pixelsPerSecond;

  // Auto-scroll to keep playhead centered during playback ONLY if locked
  useEffect(() => {
    if (!isPlaying || !containerRef.current || !playheadLocked) return;

    const container = containerRef.current;
    const playheadPosition = currentTime * pixelsPerSecond;
    const containerWidth = container.clientWidth;
    const centerOffset = containerWidth / 2;

    // Scroll to keep playhead centered
    const targetScroll = playheadPosition - centerOffset + 16; // +16 for padding
    
    // Smooth scroll during playback
    container.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  }, [currentTime, isPlaying, pixelsPerSecond, playheadLocked]);

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-black/95 backdrop-blur-xl p-4 border-t border-teal-900/30 relative">
      {/* Inner container with fixed 5-minute width */}
      <div style={{ minWidth: `${timelineWidth}px` }} className="relative">
        {/* Playhead */}
        {currentTime > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-20 pointer-events-none"
            style={{
              left: `${16 + (currentTime * pixelsPerSecond)}px`, // 16px padding + time position with zoom
            }}
          >
            <div className="absolute -top-1 -left-2 w-4 h-4 bg-cyan-400 rotate-45" />
            {isPlaying && (
              <div className="absolute top-0 -left-4 w-8 h-8">
                <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping" />
              </div>
            )}
          </div>
        )}

        {tracks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Music className="w-16 h-16 text-teal-700 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No tracks yet</p>
              <p className="text-teal-600 text-sm">Click "Add Track" to get started</p>
            </div>
          </div>
        ) : (
          tracks.map((track) => (
            <TrackRow key={track.id} trackId={track.id} snapEnabled={snapEnabled} bpm={bpm} activeTool={activeTool} />
          ))
        )}
      </div>
    </div>
  );
}
