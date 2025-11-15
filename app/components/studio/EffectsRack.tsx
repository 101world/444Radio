/**
 * EffectsRack - Audio effects toolbar
 * Shows available effects as buttons
 */

'use client';

import { useState } from 'react';
import { Sliders, Volume2, Activity, Waves, Wind, Zap } from 'lucide-react';

export default function EffectsRack() {
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);

  const effects = [
    { id: 'gain', name: 'Gain', icon: Volume2, color: 'purple' },
    { id: 'eq', name: 'EQ', icon: Sliders, color: 'pink' },
    { id: 'reverb', name: 'Reverb', icon: Waves, color: 'cyan' },
    { id: 'delay', name: 'Delay', icon: Activity, color: 'amber' },
    { id: 'fade', name: 'Fade', icon: Wind, color: 'emerald' },
    { id: 'normalize', name: 'Normalize', icon: Zap, color: 'red' },
  ];

  const colorClasses: Record<string, string> = {
    purple: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-500/50 hover:bg-pink-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30',
  };

  return (
    <div className="h-16 bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 px-4">
      <div className="h-full flex items-center gap-3">
        <span className="text-gray-400 text-sm font-medium">Effects:</span>
        
        {effects.map((effect) => {
          const Icon = effect.icon;
          return (
            <button
              key={effect.id}
              onClick={() => setSelectedEffect(effect.id)}
              className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                colorClasses[effect.color]
              } ${selectedEffect === effect.id ? 'ring-2 ring-white/50' : ''}`}
              title={effect.name}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{effect.name}</span>
            </button>
          );
        })}

        {/* Coming soon badge */}
        <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
          Effects coming soon
        </span>
      </div>
    </div>
  );
}
