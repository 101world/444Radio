/**
 * TransportBar - Playback controls and time display
 * Bottom bar with play/pause/stop/record controls and master volume (AudioMass style)
 */

'use client';

import { Play, Pause, Square, SkipBack, SkipForward, Rewind, FastForward, Circle, Volume2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';
import { useState } from 'react';

export default function TransportBar() {
  const {
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

  const handlePlayPause = () => {
    setPlaying(!isPlaying);
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
    <div className="h-20 bg-black border-t border-teal-900/50">
      <div className="h-full flex items-center justify-between px-6">
        {/* Left: Transport controls (AudioMass style) */}
        <div className="flex items-center gap-2">
          {/* Skip to start */}
          <button
            onClick={handleSkipToStart}
            className="p-2.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Skip to start (Home)"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Rewind 10s */}
          <button
            onClick={handleRewind}
            className="p-2.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Rewind 10s (Left Arrow)"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          {!isPlaying ? (
            <button
              onClick={handlePlayPause}
              className="p-3 rounded bg-teal-700 hover:bg-teal-600 text-white transition-all shadow-lg shadow-teal-500/30"
              title="Play (Space)"
            >
              <Play className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handlePlayPause}
              className="p-3 rounded bg-teal-700 hover:bg-teal-600 text-white transition-all shadow-lg shadow-teal-500/30"
              title="Pause (Space)"
            >
              <Pause className="w-5 h-5" />
            </button>
          )}

          {/* Stop */}
          <button
            onClick={handleStop}
            className="p-2.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>

          {/* Fast forward 10s */}
          <button
            onClick={handleFastForward}
            className="p-2.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Fast forward 10s (Right Arrow)"
          >
            <FastForward className="w-4 h-4" />
          </button>

          {/* Previous/Next track selection */}
          <div className="w-px h-8 bg-teal-900/50 mx-2" />
          <button
            onClick={playPreviousTrack}
            className="p-2.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Previous Track"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={playNextTrack}
            className="p-2.5 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors"
            title="Next Track"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Record (AudioMass feature) */}
          <div className="w-px h-8 bg-teal-900/50 mx-2" />
          <button
            onClick={handleRecord}
            className={`p-2.5 rounded border transition-all ${
              isRecording
                ? 'bg-red-600 border-red-500 text-white animate-pulse'
                : 'bg-gray-900 hover:bg-gray-800 border-teal-900/50 text-red-400'
            }`}
            title="Record (R)"
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Center: Time display */}
        <div className="flex flex-col items-center">
          <div className="text-white font-mono text-2xl font-bold tracking-wider">
            {formatTime(currentTime)}
          </div>
          <div className="text-teal-400 text-xs font-medium">
            {isRecording ? '● REC' : isPlaying ? '▶ Playing' : '⏸ Paused'}
          </div>
        </div>

        {/* Right: Master volume */}
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-teal-400" />
          <div className="flex flex-col items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-32 h-2 accent-teal-500"
              title="Master volume"
            />
            <span className="text-xs text-teal-400 mt-1 font-medium">
              Master: {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
