/**
 * Beat Generation Modal - Stable Audio 2.5
 * Professional beat generation using Stability AI
 */

'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2, Radio } from 'lucide-react';

interface BeatGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (audioUrl: string, metadata: any) => void;
}

export default function BeatGenerationModal({ isOpen, onClose, onGenerate }: BeatGenerationModalProps) {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(30);
  const [bpm, setBpm] = useState(120);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setProgress('Initializing AI beat generation...');

    try {
      const response = await fetch('/api/studio/generate-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          duration,
          bpm,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        // Parse Replicate validation errors
        let errorMsg = errorData.error || `Request failed (${response.status})`;
        if (errorData.detail) {
          errorMsg = `Replicate error: ${errorData.detail}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      if (!data.audioUrl) {
        throw new Error('No audio URL returned from generation');
      }

      setProgress('Beat generated successfully!');
      onGenerate(data.audioUrl, {
        prompt,
        duration,
        bpm,
        type: 'beat',
      });

      setTimeout(() => {
        onClose();
        setPrompt('');
        setDuration(30);
        setBpm(120);
      }, 1500);

    } catch (error) {
      console.error('Beat generation error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setProgress(`❌ ${errorMsg}`);
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setProgress('');
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-gradient-to-b from-gray-900 via-black to-gray-900 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Generate AI Beat</h2>
              <p className="text-sm text-cyan-400/70">AI Generation • 16 credits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Describe your beat
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Hard trap beat, 808 bass, crisp hi-hats, dark atmosphere..."
              className="w-full h-32 px-4 py-3 bg-black/50 border border-cyan-500/30 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/60 resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-2">
              {prompt.length}/500 characters
            </p>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(10, Math.min(90, parseInt(e.target.value) || 30)))}
                min={10}
                max={90}
                className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-1">10-90 seconds</p>
            </div>

            {/* BPM */}
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                BPM (Tempo)
              </label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Math.max(60, Math.min(200, parseInt(e.target.value) || 120)))}
                min={60}
                max={200}
                className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-1">60-200 BPM</p>
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-sm text-cyan-400">{progress}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-cyan-500/30">
          <p className="text-sm text-gray-400">
            Cost: <span className="text-white font-semibold">16 credits</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-medium transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Beat
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
