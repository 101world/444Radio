/**
 * TrackInspector - Right sidebar for selected track details
 * Shows track properties, effects chain, and controls
 * Logic Pro / Ableton Live-style inspector
 */

'use client';

import { useState } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Trash2, 
  Plus, 
  X,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';
import MasterChannel from './MasterChannel';

interface Effect {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  parameters: Record<string, number>;
}

export default function TrackInspector() {
  const { 
    tracks, 
    selectedTrackId,
    setSelectedTrack,
    setTrackVolume, 
    setTrackPan,
    toggleMute,
    removeTrack,
  } = useStudio();
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    properties: true,
    effects: true,
  });

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!selectedTrack) {
    return (
      <div className="w-80 bg-gradient-to-b from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-l border-purple-500/30 flex flex-col">
        <div className="h-16 border-b border-purple-500/30 flex items-center justify-between px-4">
          <h2 className="text-lg font-bold text-purple-400">Track Inspector</h2>
        </div>
        
        {/* Always show Master Channel */}
        <MasterChannel />
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-gray-400">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a track to view details</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gradient-to-b from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-l border-purple-500/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-purple-500/30 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: selectedTrack.color }}
          />
          <h2 className="text-lg font-bold text-white truncate max-w-[150px]">
            {selectedTrack.name}
          </h2>
        </div>
        <button
          onClick={() => setSelectedTrack(null)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
          title="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Master Channel at top */}
        <MasterChannel />
        
        {/* Track Properties Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('properties')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
          >
            <span className="text-sm font-semibold text-purple-400">Properties</span>
            {expandedSections.properties ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.properties && (
            <div className="px-4 pb-4 space-y-4">
              {/* Volume */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Volume</label>
                <div className="flex items-center gap-2">
                  {selectedTrack.mute ? (
                    <VolumeX className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-purple-400" />
                  )}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedTrack.volume}
                    onChange={(e) => setTrackVolume(selectedTrack.id, parseFloat(e.target.value))}
                    className="flex-1 h-2 accent-purple-500"
                  />
                  <span className="text-xs text-gray-400 w-12 text-right">
                    {Math.round(selectedTrack.volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Pan */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Pan</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">L</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={selectedTrack.pan}
                    onChange={(e) => setTrackPan(selectedTrack.id, parseFloat(e.target.value))}
                    className="flex-1 h-2 accent-purple-500"
                  />
                  <span className="text-xs text-gray-400 w-4">R</span>
                  <span className="text-xs text-gray-400 w-8 text-right">
                    {selectedTrack.pan === 0 ? 'C' : 
                     selectedTrack.pan < 0 ? `L${Math.abs(Math.round(selectedTrack.pan * 100))}` :
                     `R${Math.round(selectedTrack.pan * 100)}`}
                  </span>
                </div>
              </div>

              {/* Mute button */}
              <button
                onClick={() => toggleMute(selectedTrack.id)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedTrack.mute
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                }`}
              >
                {selectedTrack.mute ? 'Unmute' : 'Mute'}
              </button>

              {/* Delete button */}
              <button
                onClick={() => {
                  removeTrack(selectedTrack.id);
                  setSelectedTrack(null);
                }}
                className="w-full px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 font-medium transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Track
              </button>
            </div>
          )}
        </div>

        {/* Effects Chain Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('effects')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
          >
            <span className="text-sm font-semibold text-purple-400">Effects Chain</span>
            {expandedSections.effects ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.effects && (
            <div className="px-4 pb-4 space-y-2">
              {/* Effects list will go here */}
              {selectedTrack.effects && selectedTrack.effects.length > 0 ? (
                selectedTrack.effects.map((effect: Effect) => (
                  <div
                    key={effect.id}
                    className="bg-gray-800/50 border border-purple-500/20 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-white">
                          {effect.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            effect.enabled
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {effect.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {effect.type}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-400">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No effects added</p>
                  <p className="text-xs mt-1">Right-click track to add</p>
                </div>
              )}

              {/* Add Effect Button */}
              <button className="w-full px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 font-medium transition-all flex items-center justify-center gap-2 mt-3">
                <Plus className="w-4 h-4" />
                Add Effect
              </button>
            </div>
          )}
        </div>

        {/* Audio Info Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection('info')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
          >
            <span className="text-sm font-semibold text-purple-400">Audio Info</span>
            {expandedSections.info ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.info && (
            <div className="px-4 pb-4 space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Duration:</span>
                <span className="text-white">0:00</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Sample Rate:</span>
                <span className="text-white">44.1 kHz</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Channels:</span>
                <span className="text-white">Stereo</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Format:</span>
                <span className="text-white">WAV</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
