/**
 * MasterChannel - Master track mixer strip
 * Always visible in inspector, controls master output
 */

'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function MasterChannel() {
  const { masterVolume, setMasterVolume } = useStudio();

  return (
    <div className="border-b border-gray-700 bg-gradient-to-b from-pink-900/10 to-cyan-900/10">
      <div className="px-4 py-3 border-b border-gray-700/50">
        <h3 className="text-sm font-bold text-pink-400">Master Channel</h3>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Master Volume */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Master Volume</label>
          <div className="flex items-center gap-2">
            {masterVolume === 0 ? (
              <VolumeX className="w-4 h-4 text-gray-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-pink-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="flex-1 h-2 accent-pink-500"
            />
            <span className="text-xs text-gray-400 w-12 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>

        {/* VU Meter Placeholder */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Output Level</label>
          <div className="h-20 bg-black/30 rounded border border-gray-700 flex items-end justify-center gap-1 p-2">
            {/* Simple VU meter visualization */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t transition-all ${
                  i < Math.floor(masterVolume * 20)
                    ? i < 14
                      ? 'bg-green-500'
                      : i < 18
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                    : 'bg-gray-800'
                }`}
                style={{ 
                  height: `${((i + 1) / 20) * 100}%`,
                  opacity: i < Math.floor(masterVolume * 20) ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="pt-3 border-t border-gray-700/50 space-y-1 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Peak:</span>
            <span className="text-white">-6.2 dB</span>
          </div>
          <div className="flex justify-between">
            <span>RMS:</span>
            <span className="text-white">-12.4 dB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
