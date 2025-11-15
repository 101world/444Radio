/**
 * TrackClips - Right scrollable clips area for a track
 */

 'use client'

import { useState } from 'react';
import { Music } from 'lucide-react';
import AudioClip from './AudioClip';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TrackClips({ trackId, snapEnabled, bpm, activeTool, onSplitStems }: { trackId: string; snapEnabled: boolean; bpm: number; activeTool: any; onSplitStems?: (clipId: string, audioUrl: string) => void }) {
  const {
    tracks,
    addClipToTrack,
    moveClip,
    moveClipToTrack,
    resizeClip,
    splitClip,
    removeClip,
    zoom,
    selectedClipId,
    setSelectedClip,
    trackHeight,
  } = useStudio();

  const track = tracks.find(t => t.id === trackId);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!track) return null;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    // similar to old logic in TrackRow
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50 * zoom;
    const startTime = Math.max(0, x / pixelsPerSecond);

    try {
      const clipData = e.dataTransfer.getData('application/json');
      if (clipData && clipData !== 'undefined' && clipData !== 'null' && clipData.trim() !== '') {
        try {
          const { clipId, trackId: sourceTrackId } = JSON.parse(clipData);
          if (clipId && sourceTrackId !== trackId) {
            moveClipToTrack(clipId, trackId, startTime);
            return;
          }
        } catch {}
      }

      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
      if (!files.length) return;
      for (const file of files) {
        const objectUrl = URL.createObjectURL(file);
        const audio = new Audio(objectUrl);
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => {
            addClipToTrack(trackId, objectUrl, file.name, startTime, audio.duration || undefined);
            resolve();
          };
        });
      }
    } catch (err) {}
  };

  return (
    <div
      className={`relative bg-gradient-to-r from-gray-950/30 to-black/50 flex-1 overflow-visible border-b border-teal-900/20 ${isDragOver ? 'ring-2 ring-teal-500/40 bg-teal-900/10' : ''}`}
      style={{ height: `${trackHeight}px` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {track.clips.length === 0 ? (
        <div className="absolute inset-3 flex items-center justify-center border border-dashed border-teal-700/30 rounded-lg">
          <div className="text-center opacity-40">
            <Music className="w-6 h-6 text-teal-600 mx-auto mb-1" />
            <p className="text-[10px] text-teal-700">Drop audio here</p>
          </div>
        </div>
      ) : (
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
            onSplitStems={onSplitStems}
          />
        ))
      )}
    </div>
  )
}
