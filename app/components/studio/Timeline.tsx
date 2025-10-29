/**
 * Timeline - AudioMass-style multi-track with draggable clips
 * Supports empty tracks with drag & drop, clips that can be moved/resized
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';
import { Volume2, VolumeX, Headphones, Trash2, Music } from 'lucide-react';
import { ContextMenu, getTrackContextMenuItems } from './ContextMenu';
import { AudioEffects } from '@/lib/audio-effects';
import AudioClip from './AudioClip';

interface TrackRowProps {
  trackId: string;
}

function TrackRow({ trackId }: TrackRowProps) {
  const {
    tracks,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
    removeTrack,
    addClipToTrack,
    moveClip,
    removeClip,
    zoom,
    selectedTrackId,
    setSelectedTrack,
    selectedClipId,
    setSelectedClip,
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

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('audio/')
    );

    if (files.length === 0) return;

    // Calculate drop position on timeline
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50 * zoom;
    const startTime = Math.max(0, x / pixelsPerSecond);

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

  return (
    <div
      className={`bg-black backdrop-blur-sm rounded border p-3 mb-2 relative cursor-pointer transition-all ${
        isSelected
          ? 'border-teal-500 ring-2 ring-teal-500/50'
          : 'border-teal-900/30 hover:border-teal-700/50'
      } ${isDragOver ? 'border-teal-400 ring-2 ring-teal-400/50 bg-teal-500/10' : ''}`}
      onContextMenu={handleContextMenu}
      onClick={() => setSelectedTrack(trackId)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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

      {/* Track header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }} />
        <span className="text-white font-medium text-sm flex-1">{track.name}</span>

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
            className="w-16 h-1 accent-purple-500"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-gray-400 w-8">{Math.round(track.volume * 100)}%</span>

          {/* Mute */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(trackId);
            }}
            className={`p-1.5 rounded ${
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
            className={`p-1.5 rounded ${
              track.solo ? 'bg-teal-500/20 text-teal-400' : 'bg-gray-900 text-gray-400 hover:text-white border border-teal-900/30'
            }`}
            title="Solo"
          >
            <Headphones className="w-3 h-3" />
          </button>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(trackId);
            }}
            className="p-1.5 rounded bg-gray-900 text-red-400 hover:bg-red-500/20 border border-teal-900/30"
            title="Delete track"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Clips area */}
      <div className="relative h-20 bg-black/40 rounded overflow-x-auto overflow-y-hidden border border-teal-900/20">
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
              isSelected={selectedClipId === clip.id}
              onSelect={() => setSelectedClip(clip.id)}
              onMove={(clipId, newStartTime) => moveClip(clipId, newStartTime)}
              onResize={(clipId, newDuration, newOffset) => {
                // TODO: Implement clip resize
                console.log('Resize clip:', clipId, newDuration, newOffset);
              }}
              onDelete={(clipId) => removeClip(clipId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function Timeline() {
  const { tracks } = useStudio();

  return (
    <div className="flex-1 overflow-y-auto bg-black/95 backdrop-blur-xl p-4 border-t border-teal-900/30">
      {tracks.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Music className="w-16 h-16 text-teal-700 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No tracks yet</p>
            <p className="text-teal-600 text-sm">Click "Add Track" to get started</p>
          </div>
        </div>
      ) : (
        tracks.map((track) => <TrackRow key={track.id} trackId={track.id} />)
      )}
    </div>
  );
}
