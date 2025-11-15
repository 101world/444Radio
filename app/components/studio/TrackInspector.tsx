/**
 * TrackInspector - Right sidebar for selected track details
 * Shows track properties, AI-powered effects chain, and controls
 * Logic Pro / Ableton Live-style inspector with Replicate integration
 */

'use client';

import { useState, useCallback } from 'react';
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
  Loader2,
} from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';
import { useUser } from '@clerk/nextjs';

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
    addClipToTrack,
  } = useStudio();
  const { user } = useUser();
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    autotune: true,
    effects: true,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<string>('');
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [showEffectsChainModal, setShowEffectsChainModal] = useState(false);
  const [correctionStrength, setCorrectionStrength] = useState(0.5);
  const [pitchShift, setPitchShift] = useState(0);

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Apply pitch correction using Replicate AutoTune
  const applyPitchCorrection = useCallback(async () => {
    if (!selectedTrack || selectedTrack.clips.length === 0) {
      alert('No audio clips to process');
      return;
    }

    setIsProcessing(true);
    setProcessingType('autotune');
    setProcessingStatus('Uploading audio...');

    try {
      const firstClip = selectedTrack.clips[0];
      
      // Call Replicate API
      setProcessingStatus('Processing with AI...');
      const response = await fetch('/api/studio/autotune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: firstClip.audioUrl,
          trackId: selectedTrack.id,
          trackName: selectedTrack.name,
          correctionStrength,
          pitchShift,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      setProcessingStatus('Adding processed track...');
      
      // Add the autotuned audio as a new clip
      if (data.audioUrl) {
        addClipToTrack(selectedTrack.id, data.audioUrl, `${selectedTrack.name} (Autotuned)`, firstClip.startTime + firstClip.duration + 1);
      }

      setProcessingStatus('Complete!');
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);

    } catch (error) {
      console.error('Autotune error:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);
    }
  }, [selectedTrack, addClipToTrack, correctionStrength, pitchShift]);

  // Apply AI audio effects using Stable Audio
  const applyAIEffect = useCallback(async (effectPrompt: string) => {
    if (!selectedTrack || selectedTrack.clips.length === 0) {
      alert('No audio clips to process');
      return;
    }

    setIsProcessing(true);
    setProcessingType('effect');
    setProcessingStatus('Generating AI effect...');

    try {
      const firstClip = selectedTrack.clips[0];
      
      const response = await fetch('/api/studio/ai-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: firstClip.audioUrl,
          prompt: effectPrompt,
          trackId: selectedTrack.id,
          trackName: selectedTrack.name,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Effect generation failed');
      }

      setProcessingStatus('Adding effect track...');
      
      if (data.audioUrl) {
        addClipToTrack(selectedTrack.id, data.audioUrl, `${selectedTrack.name} (${effectPrompt})`, firstClip.startTime);
      }

      setProcessingStatus('Complete!');
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);

    } catch (error) {
      console.error('AI effect error:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);
    }
  }, [selectedTrack, addClipToTrack]);

  // Generate effect for effects chain (uses MusicGen)
  const generateEffectToChain = useCallback(async (effectPrompt: string) => {
    if (!selectedTrack || !user) return;

    try {
      setIsProcessing(true);
      setProcessingType('effect');
      setProcessingStatus('Generating effect with AI...');

      const response = await fetch('/api/studio/generate-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effectPrompt,
          trackId: selectedTrack.id,
          trackName: selectedTrack.name,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Effect generation failed');
      }

      setProcessingStatus(`Effect generated! "${data.effectName}"`);
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
        setShowEffectsChainModal(false);
        // Effect will appear in the effects chain list
        // TODO: Store effect metadata in track.effects array
      }, 3000);

    } catch (error) {
      console.error('Effect chain error:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);
    }
  }, [selectedTrack, user]);

  if (!selectedTrack) {
    return (
      <div className="w-80 bg-gradient-to-b from-black via-cyan-950/40 to-black backdrop-blur-xl border-l border-cyan-500/30 flex flex-col">
        <div className="h-16 border-b border-cyan-500/30 flex items-center justify-between px-4">
          <h2 className="text-lg font-bold text-cyan-400">Track Inspector</h2>
        </div>
        
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
    <div className="w-80 bg-gradient-to-b from-black via-cyan-950/40 to-black backdrop-blur-xl border-l border-cyan-500/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-cyan-500/30 flex items-center justify-between px-4 shrink-0">
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
        {/* Auto-Tune Section */}
        <div className="border-b border-cyan-500/20">
          <button
            onClick={() => toggleSection('autotune')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-sm font-semibold text-cyan-400">AI Auto-Tune</span>
            </div>
            {expandedSections.autotune ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.autotune && (
            <div className="px-4 pb-4 space-y-4">
              {/* Processing indicator */}
              {isProcessing && processingType === 'autotune' && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-sm font-medium text-cyan-400">Processing Audio...</span>
                  </div>
                  {processingStatus && (
                    <p className="text-xs text-gray-400">{processingStatus}</p>
                  )}
                </div>
              )}

              {/* Correction Strength */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block flex items-center justify-between">
                  <span>Correction Strength</span>
                  <span className="text-cyan-400 font-mono">{Math.round(correctionStrength * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={correctionStrength}
                  onChange={(e) => setCorrectionStrength(parseFloat(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-2 accent-cyan-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Natural</span>
                  <span>Robotic</span>
                </div>
              </div>

              {/* Pitch Shift */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block flex items-center justify-between">
                  <span>Pitch Shift (semitones)</span>
                  <span className="text-cyan-400 font-mono">{pitchShift > 0 ? '+' : ''}{pitchShift}</span>
                </label>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={pitchShift}
                  onChange={(e) => setPitchShift(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-2 accent-cyan-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-12</span>
                  <span>0</span>
                  <span>+12</span>
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={applyPitchCorrection}
                disabled={isProcessing || selectedTrack.clips.length === 0}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing && processingType === 'autotune' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Apply Auto-Tune
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Powered by Replicate AI • Creates new clip
              </p>
            </div>
          )}
        </div>

        {/* Track Properties Section - HIDDEN per user request */}
        {/* Properties are now controlled via Timeline track headers */}

        {/* Effects Chain Section */}
        <div className="border-b border-cyan-500/20">
          <button
            onClick={() => toggleSection('effects')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
          >
            <span className="text-sm font-semibold text-cyan-400">Effects Chain</span>
            {expandedSections.effects ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.effects && (
            <div className="px-4 pb-4 space-y-2">
              {/* Processing indicator */}
              {isProcessing && processingType === 'effect' && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-sm font-medium text-cyan-400">Generating Effect...</span>
                  </div>
                  {processingStatus && (
                    <p className="text-xs text-gray-400">{processingStatus}</p>
                  )}
                </div>
              )}

              {/* Effects list will go here */}
              {selectedTrack.effects && selectedTrack.effects.length > 0 ? (
                selectedTrack.effects.map((effect: Effect) => (
                  <div
                    key={effect.id}
                    className="bg-gray-800/50 border border-cyan-500/20 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-white">
                          {effect.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            effect.enabled
                              ? 'bg-cyan-500/20 text-cyan-400'
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
              <button 
                onClick={() => setShowEffectsChainModal(true)}
                disabled={isProcessing}
                className="w-full px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 font-medium transition-all flex items-center justify-center gap-2 mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Effect
              </button>
            </div>
          )}
        </div>

        {/* Audio Info Section */}
        <div className="border-b border-cyan-500/20">
          <button
            onClick={() => toggleSection('info')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
          >
            <span className="text-sm font-semibold text-cyan-400">Audio Info</span>
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

      {/* Effects Chain Modal */}
      {showEffectsChainModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-gray-900 to-black border border-cyan-500/30 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Generate Effect</h3>
              </div>
              <button
                onClick={() => setShowEffectsChainModal(false)}
                className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">
                Describe the audio effect you want to create:
              </label>
              <textarea
                id="effect-chain-prompt"
                placeholder="e.g., 'warm analog tape saturation with subtle compression' or 'spacious hall reverb with long decay'"
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none h-32"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const promptInput = document.getElementById('effect-chain-prompt') as HTMLTextAreaElement;
                  const prompt = promptInput?.value.trim();
                  if (prompt) {
                    generateEffectToChain(prompt);
                  }
                }}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Generating...' : 'Generate Effect'}
              </button>
              <button
                onClick={() => setShowEffectsChainModal(false)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-xs text-cyan-400">
                💰 Costs 0.5 credits per generation
              </p>
            </div>

            {processingStatus && (
              <div className="mt-3 p-3 bg-gray-800/50 border border-gray-600 rounded-lg">
                <p className="text-sm text-gray-300">{processingStatus}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
