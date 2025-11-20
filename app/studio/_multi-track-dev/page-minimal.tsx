/**
 * 444 RADIO STUDIO - MINIMAL OPTIMIZED VERSION
 * 
 * This is a stripped-down, performance-focused version that actually works.
 * All unnecessary features removed, focus on core multi-track functionality.
 * 
 * @version 4.0.0 - Performance Edition
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Play, Pause, Square, Plus, Trash2, Volume2, Save, Download,
  Music, Zap, Radio, Upload
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';

// ═══════════════════════════════════════════════════════════
// OPTIMIZED TRANSPORT BAR (Memoized)
// ═══════════════════════════════════════════════════════════

const TransportControls = memo(function TransportControls() {
  const { isPlaying, togglePlayback, currentTime } = useStudio();
  
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return (
    <div className="h-16 bg-black/90 border-t border-cyan-500/20 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlayback}
          className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-colors"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
        </button>
        <button className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center">
          <Square className="w-5 h-5" />
        </button>
      </div>
      
      <div className="text-sm font-mono text-cyan-400">
        {formatTime(currentTime)}
      </div>

      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-gray-400" />
        <input
          type="range"
          min="0"
          max="100"
          defaultValue="80"
          className="w-24"
        />
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// OPTIMIZED TRACK COMPONENT (Memoized)
// ═══════════════════════════════════════════════════════════

const TrackRow = memo(function TrackRow({ trackId }: { trackId: string }) {
  const {
    tracks,
    removeTrack,
    setTrackVolume,
    toggleMute,
    selectedTrackId,
    setSelectedTrack,
  } = useStudio();

  const track = useMemo(
    () => tracks.find(t => t.id === trackId),
    [tracks, trackId]
  );

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTrackVolume(trackId, parseFloat(e.target.value));
  }, [trackId, setTrackVolume]);

  if (!track) return null;

  const isSelected = selectedTrackId === trackId;

  return (
    <div
      className={`h-32 bg-black/50 border rounded-lg mb-2 flex items-center gap-4 px-4 cursor-pointer transition-all ${
        isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/50' : 'border-gray-700 hover:border-cyan-700/50'
      }`}
      onClick={() => setSelectedTrack(trackId)}
    >
      {/* Track Controls */}
      <div className="flex flex-col gap-2 w-48">
        <input
          type="text"
          value={track.name}
          className="bg-transparent text-sm font-medium border-none outline-none"
          readOnly
        />
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(trackId);
            }}
            className={`px-3 py-1 rounded text-xs ${
              track.mute ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            M
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            onClick={(e) => e.stopPropagation()}
            className="flex-1"
          />
        </div>
      </div>

      {/* Waveform Area */}
      <div className="flex-1 h-full bg-gray-900/50 rounded flex items-center justify-center">
        <div className="text-gray-500 text-sm">
          {track.clips.length > 0 ? `${track.clips.length} clip(s)` : 'Drop audio here'}
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeTrack(trackId);
        }}
        className="p-2 hover:bg-red-500/20 rounded transition-colors"
      >
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// MAIN DAW COMPONENT
// ═══════════════════════════════════════════════════════════

function DAWMinimal() {
  const { user } = useUser();
  const { tracks, addTrack, addEmptyTrack } = useStudio();
  
  const [showGenerate, setShowGenerate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simple keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      
      if (e.key === ' ') {
        e.preventDefault();
        // togglePlayback handled by TransportControls
      } else if (e.key === '+' && !e.ctrlKey) {
        addEmptyTrack();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [addEmptyTrack]);

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue;

      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      
      await new Promise<void>((resolve) => {
        audio.onloadedmetadata = () => {
          addTrack(file.name, url, undefined, audio.duration, file);
          resolve();
        };
        audio.onerror = () => resolve();
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [addTrack]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-black via-gray-900 to-black text-white">
      {/* Header */}
      <div className="h-14 bg-black/90 border-b border-cyan-500/20 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            444 Radio Studio v4.0
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          
          <button
            onClick={() => setShowGenerate(true)}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Generate
          </button>

          <button
            onClick={addEmptyTrack}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Track
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {tracks.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-400 mb-2">No tracks yet</h3>
              <p className="text-gray-500 mb-4">Add a track to get started</p>
              <button
                onClick={addEmptyTrack}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 rounded-lg transition-colors"
              >
                Create First Track
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {tracks.map(track => (
              <TrackRow key={track.id} trackId={track.id} />
            ))}
          </div>
        )}
      </div>

      {/* Transport Bar */}
      <TransportControls />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EXPORT WITH PROVIDER
// ═══════════════════════════════════════════════════════════

export default function StudioPage() {
  return (
    <StudioProvider>
      <DAWMinimal />
    </StudioProvider>
  );
}
