/**
 * Song Generation Modal - MiniMax Music 1.5
 * Professional song generation with vocals
 */

'use client';

import { useState } from 'react';
import { X, Sparkles, Loader2, Music2 } from 'lucide-react';

interface SongGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (audioUrl: string, metadata: any) => void;
}

export default function SongGenerationModal({ isOpen, onClose, onGenerate }: SongGenerationModalProps) {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('pop');
  const [mood, setMood] = useState('upbeat');
  // Simplified UI: remove explicit vocals toggle, add output format and lyrics
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav'>('mp3');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setProgress('Initializing AI song generation...');

    try {
      const response = await fetch('/api/studio/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          genre,
          mood,
          duration,
          output_format: outputFormat,
          lyrics: lyrics?.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      setProgress('Song generated successfully!');
      onGenerate(data.audioUrl, {
        prompt,
        genre,
        mood,
        outputFormat,
        lyrics: lyrics?.trim() || undefined,
        duration,
        type: 'song',
      });

      setTimeout(() => {
        onClose();
        setPrompt('');
        setLyrics('');
      }, 1500);

    } catch (error) {
      console.error('Song generation error:', error);
      setProgress('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setProgress('');
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-gradient-to-b from-gray-900 via-black to-gray-900 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-600 to-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/50">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Generate AI Song</h2>
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
              Describe your song
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Uplifting pop song about chasing dreams, catchy chorus, female vocals..."
              className="w-full h-32 px-4 py-3 bg-black/50 border border-cyan-500/30 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/60 resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-2">
              {prompt.length}/500 characters
            </p>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-4">
            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Genre
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                disabled={isGenerating}
              >
                <option value="pop">Pop</option>
                <option value="rock">Rock</option>
                <option value="hiphop">Hip Hop</option>
                <option value="electronic">Electronic</option>
                <option value="jazz">Jazz</option>
                <option value="classical">Classical</option>
                <option value="country">Country</option>
                <option value="rnb">R&B</option>
              </select>
            </div>

            {/* Mood */}
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Mood
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                disabled={isGenerating}
              >
                <option value="upbeat">Upbeat</option>
                <option value="melancholic">Melancholic</option>
                <option value="energetic">Energetic</option>
                <option value="calm">Calm</option>
                <option value="dramatic">Dramatic</option>
                <option value="romantic">Romantic</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(15, Math.min(120, parseInt(e.target.value) || 30)))}
                min={15}
                max={120}
                className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                disabled={isGenerating}
              />
              <p className="text-xs text-gray-500 mt-1">15-120 seconds</p>
            </div>

            {/* Output Format */}
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">
                Output Format
              </label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat((e.target.value as 'mp3' | 'wav'))}
                className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
                disabled={isGenerating}
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
              </select>
            </div>
          </div>

          {/* Lyrics (optional) */}
          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Lyrics (optional)
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste your lyrics here to guide the song..."
              className="w-full h-28 px-4 py-3 bg-black/50 border border-cyan-500/30 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/60 resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-2">Optional. If provided, generation will reflect these lyrics.</p>
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
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-700 hover:to-pink-600 text-white font-medium transition-all shadow-lg shadow-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Song
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
