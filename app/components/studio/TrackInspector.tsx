/**
 * TrackInspector - Right sidebar for selected track details
 * Shows track properties, AI-powered effects chain, and controls
 * Logic Pro / Ableton Live-style inspector
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
  Download,
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
    addTrack,
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
  const [autotuneScale, setAutotuneScale] = useState('C:maj');
  const [autotuneFormat, setAutotuneFormat] = useState('wav');
  const [effectPrompt, setEffectPrompt] = useState('');
  const [effectDuration, setEffectDuration] = useState(10);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedAudioName, setGeneratedAudioName] = useState<string>('');
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [isStemming, setIsStemming] = useState(false);
  const [stemsStatus, setStemsStatus] = useState<string>('');

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Apply pitch correction using Auto-Tune
  const applyPitchCorrection = useCallback(async () => {
    if (!selectedTrack || selectedTrack.clips.length === 0) {
      alert('No audio clips to process');
      return;
    }

    setIsProcessing(true);
    setProcessingType('autotune');
    setProcessingStatus('Processing audio...');

    try {
      const firstClip = selectedTrack.clips[0];
      
      // Call Auto-Tune API
      setProcessingStatus('Applying pitch correction...');
      const response = await fetch('/api/studio/autotune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: firstClip.audioUrl,
          scale: autotuneScale,
          outputFormat: autotuneFormat,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      setProcessingStatus('Audio processed successfully!');
      
      // Store generated audio for preview
      if (data.audioUrl) {
        setGeneratedAudioUrl(data.audioUrl);
        setGeneratedAudioName(`${selectedTrack.name} (Auto-Tuned)`);
        setRemainingCredits(data.remainingCredits);
        // Broadcast credits update to studio header
        if (typeof data.remainingCredits === 'number') {
          window.dispatchEvent(new CustomEvent('credits:update', { detail: { credits: data.remainingCredits } }));
        }
      }

      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 2000);

    } catch (error) {
      console.error('Auto-tune error:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);
    }
  }, [selectedTrack, autotuneScale, autotuneFormat]);

  // Generate effect using AI audio synthesis
  const generateEffectToChain = useCallback(async (variation = false) => {
    if (!selectedTrack || !user) return;

    if (!effectPrompt.trim()) {
      alert('Please enter an effect description');
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingType('effect');
      setProcessingStatus('Generating audio effect...');

      const response = await fetch('/api/studio/generate-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effectPrompt,
          secondsTotal: effectDuration,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Effect generation failed');
      }

      setProcessingStatus('Effect generated successfully!');
      
      // Store generated effect for preview
      if (data.audioUrl) {
        setGeneratedAudioUrl(data.audioUrl);
        setGeneratedAudioName(`Effect: ${effectPrompt.slice(0, 30)}...`);
        setRemainingCredits(data.remainingCredits);
        if (typeof data.remainingCredits === 'number') {
          window.dispatchEvent(new CustomEvent('credits:update', { detail: { credits: data.remainingCredits } }));
        }
      }

      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
        setShowEffectsChainModal(false);
      }, 2000);

    } catch (error) {
      console.error('Effect generation error:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStatus('');
      }, 3000);
    }
  }, [selectedTrack, user, effectPrompt, effectDuration]);

  // Split current track's first clip into stems via Replicate
  const splitIntoStems = useCallback(async () => {
    if (!selectedTrack) {
      alert('Select a track first');
      return;
    }
    if (!selectedTrack.clips.length) {
      alert('No audio clip found on this track');
      return;
    }

    const firstClip = selectedTrack.clips[0];
    const startTime = firstClip.startTime || 0;

    try {
      setIsStemming(true);
      setStemsStatus('Contacting AI to split stems...');

      const resp = await fetch('/api/studio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: firstClip.audioUrl }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'Stems splitting failed');
      }

      const stems: Record<string, string> = data.stems || {};
      const entries = Object.entries(stems);
      if (!entries.length) throw new Error('No stems returned');

      setStemsStatus('Placing stems on timeline...');

      // Friendly naming map
      const nameForKey = (k: string) => {
        const key = k.toLowerCase();
        if (key.includes('vocals')) return 'Vocals';
        if (key.includes('drums')) return 'Drums';
        if (key.includes('bass')) return 'Bass';
        if (key.includes('other')) return 'Other';
        if (key.includes('instrumental')) return 'Instrumental';
        if (key.includes('sonification')) return 'Sonification';
        return k;
      };

      // Create new tracks for each stem and add clip aligned with source
      for (const [key, url] of entries) {
        const trackName = `${selectedTrack.name} – ${nameForKey(key)}`;
        const newTrackId = addTrack(trackName);
        addClipToTrack(newTrackId, url, trackName, startTime);
      }

      // Notify and finish
      try { window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Stems added to new tracks', type: 'success' } })); } catch {}
      if (typeof data.remainingCredits === 'number') {
        try { window.dispatchEvent(new CustomEvent('credits:update', { detail: { credits: data.remainingCredits } })); } catch {}
      }
      setStemsStatus('');
      setIsStemming(false);
    } catch (err) {
      console.error('Split stems error:', err);
      setStemsStatus(err instanceof Error ? err.message : 'Stems splitting failed');
      setTimeout(() => { setIsStemming(false); setStemsStatus(''); }, 3000);
    }
  }, [selectedTrack, addTrack, addClipToTrack]);

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

              {/* Scale Selection */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Musical Scale
                </label>
                <select
                  value={autotuneScale}
                  onChange={(e) => setAutotuneScale(e.target.value)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
                >
                  <option value="C:maj">C Major</option>
                  <option value="C:min">C Minor</option>
                  <option value="D:maj">D Major</option>
                  <option value="D:min">D Minor</option>
                  <option value="E:maj">E Major</option>
                  <option value="E:min">E Minor</option>
                  <option value="F:maj">F Major</option>
                  <option value="F:min">F Minor</option>
                  <option value="G:maj">G Major</option>
                  <option value="G:min">G Minor</option>
                  <option value="A:maj">A Major</option>
                  <option value="A:min">A Minor</option>
                  <option value="B:maj">B Major</option>
                  <option value="B:min">B Minor</option>
                </select>
              </div>

              {/* Output Format */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Output Format
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAutotuneFormat('wav')}
                    disabled={isProcessing}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                      autotuneFormat === 'wav'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-800/50 border border-gray-600 text-gray-400 hover:border-cyan-500/50'
                    }`}
                  >
                    WAV
                  </button>
                  <button
                    onClick={() => setAutotuneFormat('mp3')}
                    disabled={isProcessing}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
                      autotuneFormat === 'mp3'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-800/50 border border-gray-600 text-gray-400 hover:border-cyan-500/50'
                    }`}
                  >
                    MP3
                  </button>
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

              <p className="text-xs text-cyan-400/80 text-center">
                💰 0.5 credits per generation
              </p>
            </div>
          )}
        </div>

        {/* Generated Audio Preview Section */}
        {generatedAudioUrl && (
          <div className="border-b border-cyan-500/20">
            <div className="px-4 py-3 bg-cyan-500/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold text-cyan-400">Generated Audio</span>
                </div>
                <button
                  onClick={() => {
                    setGeneratedAudioUrl(null);
                    setGeneratedAudioName('');
                  }}
                  className="p-1 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                  title="Clear generated audio"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-400 mb-2">{generatedAudioName}</p>
                <audio 
                  src={(generatedAudioUrl && (generatedAudioUrl.includes('.r2.dev') || generatedAudioUrl.includes('.r2.cloudflarestorage.com')))
                    ? `/api/r2/proxy?url=${encodeURIComponent(generatedAudioUrl)}`
                    : generatedAudioUrl || ''}
                  controls 
                  className="w-full"
                  style={{ height: '32px' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => {
                    if (selectedTrack && generatedAudioUrl) {
                      const lastClip = selectedTrack.clips[selectedTrack.clips.length - 1];
                      const startTime = lastClip ? lastClip.startTime + lastClip.duration + 1 : 0;
                      addClipToTrack(selectedTrack.id, generatedAudioUrl, generatedAudioName, startTime);
                      // Notify parent page
                      window.dispatchEvent(new CustomEvent('studio:notify', { detail: { message: 'Generated audio added to track', type: 'success' } }));
                      setGeneratedAudioUrl(null);
                      setGeneratedAudioName('');
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-all"
                >
                  Send to Track
                </button>
                <a
                  href={(generatedAudioUrl && (generatedAudioUrl.includes('.r2.dev') || generatedAudioUrl.includes('.r2.cloudflarestorage.com')))
                    ? `/api/r2/proxy?url=${encodeURIComponent(generatedAudioUrl)}`
                    : generatedAudioUrl || ''}
                  download={generatedAudioName}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-all text-center"
                >
                  Download
                </a>
              </div>

              {remainingCredits !== null && (
                <p className="text-xs text-cyan-400/60 text-center">
                  {remainingCredits} credits remaining
                </p>
              )}
            </div>
          </div>
        )}

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

        {/* Stems Section */}
        <div className="border-b border-cyan-500/20">
          <button
            onClick={() => toggleSection('stems')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-500/10 transition-colors"
          >
            <span className="text-sm font-semibold text-cyan-400">Stems</span>
            {expandedSections.stems ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.stems && (
            <div className="px-4 pb-4 space-y-3">
              {isStemming && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span className="text-sm font-medium text-cyan-400">Splitting into stems...</span>
                  </div>
                  {stemsStatus && <p className="text-xs text-gray-400">{stemsStatus}</p>}
                </div>
              )}

              <button
                onClick={splitIntoStems}
                disabled={isStemming || selectedTrack.clips.length === 0}
                className="w-full px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStemming ? 'Processing…' : 'Split Track Into Stems'}
              </button>
              <p className="text-xs text-cyan-400/70">Creates new tracks for Vocals, Drums, Bass, etc. 💰 Cost: 15 credits</p>
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
                <h3 className="text-lg font-bold text-white">Generate Audio Effect</h3>
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
                Describe the audio effect:
              </label>
              <textarea
                value={effectPrompt}
                onChange={(e) => setEffectPrompt(e.target.value)}
                placeholder="e.g., 'warm analog tape saturation' or 'spacious hall reverb'"
                className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none h-24"
              />
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block flex items-center justify-between">
                <span>Duration</span>
                <span className="text-cyan-400 font-mono">{effectDuration}s</span>
              </label>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={effectDuration}
                onChange={(e) => setEffectDuration(parseInt(e.target.value))}
                disabled={isProcessing}
                className="w-full h-2 accent-cyan-500 disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0s</span>
                <span>12.5s</span>
                <span>25s</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => generateEffectToChain(false)}
                disabled={isProcessing || !effectPrompt.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Generating...' : 'Generate Effect'}
              </button>
              <button
                onClick={() => generateEffectToChain(true)}
                disabled={isProcessing || !effectPrompt.trim()}
                className="px-4 py-2.5 rounded-lg bg-cyan-600/50 hover:bg-cyan-600 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Generate a new variation with same settings"
              >
                New Variation
              </button>
            </div>

            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-xs text-cyan-400">
                💰 {Math.ceil(effectDuration / 5) * 0.5} credits ({effectDuration}s)
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
