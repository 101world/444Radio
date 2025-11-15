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

  const handleDragOver = (e: React.DragEvent) => { 
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true); 
  };
  
  const handleDragLeave = (e: React.DragEvent) => { 
    e.preventDefault(); 
    setIsDragOver(false); 
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); 
    setIsDragOver(false);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50 * zoom;
    const startTime = Math.max(0, x / pixelsPerSecond);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      
      if (jsonData && jsonData.trim()) {
        const parsed = JSON.parse(jsonData);
        
        // Handle library track drop
        if (parsed.type === 'library-track' && parsed.trackData) {
          const { trackData } = parsed;
          if (trackData.audio_url) {
            addClipToTrack(trackId, trackData.audio_url, trackData.title || 'Library Track', startTime);
            return;
          }
        }
        
        // Handle clip move between tracks
        if (parsed.clipId && parsed.trackId !== trackId) {
          moveClipToTrack(parsed.clipId, trackId, startTime);
          return;
        }
      }

      // Handle file drops
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
          audio.onerror = () => resolve();
          setTimeout(resolve, 2000); // Timeout fallback
        });
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  return (
    <div
      className={`relative bg-gradient-to-r from-gray-950/30 to-black/50 flex-1 overflow-x-auto overflow-y-hidden border-b border-teal-900/20 timeline-scrollbar-hidden ${isDragOver ? 'ring-2 ring-teal-500/50 bg-teal-500/5 backdrop-blur-sm' : ''}`}
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
