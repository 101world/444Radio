/**
 * TransportBar - Playback controls and time display
 * Bottom bar with play/pause/stop/record controls and master volume (AudioMass style)
 */

'use client';

import { Play, Pause, Square, SkipBack, SkipForward, Rewind, FastForward, Circle, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';
import { useState } from 'react';

export default function TransportBar({ autoSeekOnPlay = false }: { autoSeekOnPlay?: boolean }) {
  const {
    tracks,
    isPlaying,
    currentTime,
    masterVolume,
    setPlaying,
    setCurrentTime,
    setMasterVolume,
    skipBackward,
    skipForward,
    playNextTrack,
    playPreviousTrack,
  } = useStudio();

  const [isRecording, setIsRecording] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    // If starting playback at 0, but clips begin later, jump to earliest clip start
    if (!isPlaying && currentTime <= 0.01 && autoSeekOnPlay) {
      try {
        const allStarts: number[] = (tracks || [])
          .flatMap((t: any) => (t?.clips || []).map((c: any) => c?.startTime || 0))
          .filter((n: number) => typeof n === 'number' && n > 0);
        if (allStarts.length) {
          const earliest = Math.min(...allStarts);
          if (earliest > 0.01) setCurrentTime(earliest);
        }
      } catch {}
    }
    await setPlaying(!isPlaying);
  };

  const handleStop = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const handleSkipToStart = () => {
    setCurrentTime(0);
  };

  const handleRewind = () => {
    skipBackward(10);
  };

  const handleFastForward = () => {
    skipForward(10);
  };

  const handleRecord = () => {
    setIsRecording(!isRecording);
    // TODO: Implement actual recording
    console.log(isRecording ? 'Stop recording' : 'Start recording');
  };

  return (
    <div className="h-12 bg-black border-t border-teal-900/50">
      <div className="h-full flex items-center justify-between px-4">
        {/* Left: Transport controls (AudioMass style) */}
        <div className="flex items-center gap-1.5">
          {/* Skip to start */}
          <button
            onClick={handleSkipToStart}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Skip to start (Home)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Rewind 10s */}
          <button
            onClick={handleRewind}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Rewind 10s (Left Arrow)"
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          {/* Play/Pause */}
          {!isPlaying ? (
            <button
              onClick={handlePlayPause}
              className="p-2 rounded bg-teal-700 hover:bg-teal-600 text-white transition-all shadow-lg shadow-teal-500/30"
              title="Play (Space)"
            >
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePlayPause}
              className="p-2 rounded bg-teal-700 hover:bg-teal-600 text-white transition-all shadow-lg shadow-teal-500/30"
              title="Pause (Space)"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {/* Stop */}
          <button
            onClick={handleStop}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* Fast forward 10s */}
          <button
            onClick={handleFastForward}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Fast forward 10s (Right Arrow)"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>

          {/* Previous/Next track selection */}
          <div className="w-px h-6 bg-teal-900/50 mx-1" />
          <button
            onClick={playPreviousTrack}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Previous Track"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={playNextTrack}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Next Track"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Record (AudioMass feature) */}
          <div className="w-px h-6 bg-teal-900/50 mx-1" />
          <button
            onClick={handleRecord}
            className={`p-1.5 rounded border transition-all ${
              isRecording
                ? 'bg-red-600 border-red-500 text-white animate-pulse'
                : 'bg-gray-900 hover:bg-gray-800 border-teal-900/50 text-red-400'
            }`}
            title="Record (R)"
          >
            <Circle className={`w-3.5 h-3.5 ${isRecording ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center: Time display */}
        <div className="flex flex-col items-center">
          <div className="text-white font-mono text-lg font-bold tracking-wider">
            {formatTime(currentTime)}
          </div>
          <div className="text-teal-400 text-[10px] font-medium">
            {isRecording ? '● REC' : isPlaying ? '▶ Playing' : '⏸ Paused'}
          </div>
        </div>

        {/* Right: Master volume */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-teal-400" />
          <div className="flex flex-col items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-24 h-1.5 accent-teal-500"
              title="Master volume"
            />
            <span className="text-[10px] text-teal-400 mt-0.5 font-medium">
              Master: {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
