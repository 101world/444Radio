/**
 * Timeline - Multi-track waveform display
 * Renders all tracks with WaveSurfer instances and controls
 */

'use client';

import { useEffect, useRef } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';
import { useWaveSurfer } from '@/hooks/useWaveSurfer';
import { Volume2, VolumeX, Headphones, Trash2 } from 'lucide-react';

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
    isPlaying,
    currentTime,
  } = useStudio();

  const track = tracks.find((t) => t.id === trackId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize WaveSurfer for this track
  const wavesurfer = useWaveSurfer({
    container: `#waveform-${trackId}`,
    height: 80,
    waveColor: track?.color || '#8b5cf6',
    progressColor: track?.color ? `${track.color}88` : '#8b5cf688',
    cursorColor: '#22d3ee',
  });

  // Load audio when track is ready
  useEffect(() => {
    if (track?.audioUrl && wavesurfer.wavesurfer) {
      wavesurfer.loadAudio(track.audioUrl);
    }
  }, [track?.audioUrl, wavesurfer.wavesurfer]);

  // Sync playback
  useEffect(() => {
    if (wavesurfer.wavesurfer && wavesurfer.isReady) {
      if (isPlaying && !wavesurfer.isPlaying) {
        wavesurfer.seekTo(currentTime);
        wavesurfer.play();
      } else if (!isPlaying && wavesurfer.isPlaying) {
        wavesurfer.pause();
      }
    }
  }, [isPlaying, wavesurfer.isReady]);

  if (!track) return null;

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-purple-500/20 p-3 mb-2">
      {/* Track header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: track.color }}
        />
        <span className="text-white font-medium text-sm flex-1">{track.name}</span>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Volume */}
          <div className="flex items-center gap-1">
            {track.mute ? (
              <VolumeX className="w-4 h-4 text-gray-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-purple-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.volume}
              onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
              className="w-16 h-1 accent-purple-500"
              title="Volume"
            />
            <span className="text-xs text-gray-400 w-8">
              {Math.round(track.volume * 100)}
            </span>
          </div>

          {/* Pan */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">L</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={track.pan}
              onChange={(e) => setTrackPan(trackId, parseFloat(e.target.value))}
              className="w-12 h-1 accent-cyan-500"
              title="Pan"
            />
            <span className="text-xs text-gray-500">R</span>
          </div>

          {/* Mute */}
          <button
            onClick={() => toggleMute(trackId)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              track.mute
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
            title="Mute"
          >
            M
          </button>

          {/* Solo */}
          <button
            onClick={() => toggleSolo(trackId)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              track.solo
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
            title="Solo"
          >
            S
          </button>

          {/* Delete */}
          <button
            onClick={() => removeTrack(trackId)}
            className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
            title="Delete track"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Waveform */}
      <div
        id={`waveform-${trackId}`}
        ref={containerRef}
        className="w-full rounded overflow-hidden bg-black/30"
      />
    </div>
  );
}

export default function Timeline() {
  const { tracks } = useStudio();

  return (
    <div className="flex-1 overflow-auto bg-black/20 backdrop-blur-xl p-4">
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="text-gray-400 mb-4">
            <Volume2 className="w-16 h-16 mx-auto mb-3 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No tracks yet</h3>
            <p className="text-sm">Generate music with AI or upload from your library</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => (
            <TrackRow key={track.id} trackId={track.id} />
          ))}
        </div>
      )}
    </div>
  );
}
