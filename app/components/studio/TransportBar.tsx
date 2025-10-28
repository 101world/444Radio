/**
 * TransportBar - Playback controls and time display
 * Bottom bar with play/pause/stop controls and master volume
 */

'use client';

import { Play, Pause, Square, SkipBack, Volume2 } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TransportBar() {
  const {
    isPlaying,
    currentTime,
    masterVolume,
    setPlaying,
    setCurrentTime,
    setMasterVolume,
  } = useStudio();

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

  return (
    <div className="h-20 bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-xl border-t border-purple-500/30">
      <div className="h-full flex items-center justify-between px-6">
        {/* Left: Transport controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSkipToStart}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
            title="Skip to start"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {!isPlaying ? (
            <button
              onClick={handlePlayPause}
              className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-lg shadow-purple-500/50"
              title="Play"
            >
              <Play className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handlePlayPause}
              className="p-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all shadow-lg shadow-purple-500/50"
              title="Pause"
            >
              <Pause className="w-6 h-6" />
            </button>
          )}

          <button
            onClick={handleStop}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-400 transition-colors"
            title="Stop"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Time display */}
        <div className="flex flex-col items-center">
          <div className="text-white font-mono text-2xl font-bold">
            {formatTime(currentTime)}
          </div>
          <div className="text-gray-400 text-xs">
            {isPlaying ? 'Playing' : 'Paused'}
          </div>
        </div>

        {/* Right: Master volume */}
        <div className="flex items-center gap-3">
          <Volume2 className="w-5 h-5 text-purple-400" />
          <div className="flex flex-col items-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-32 h-2 accent-purple-500"
              title="Master volume"
            />
            <span className="text-xs text-gray-400 mt-1">
              Master: {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
