/**
 * Release Modal - Publish studio tracks to Explore/Library
 * Exports audio and uploads to combined_media table
 */

'use client';

import { useState } from 'react';
import { X, Upload, Loader2, Music } from 'lucide-react';

interface ReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRelease: (title: string, audioBlob: Blob) => Promise<void>;
  projectName: string;
}

export default function ReleaseModal({ isOpen, onClose, onRelease, projectName }: ReleaseModalProps) {
  const [title, setTitle] = useState(projectName || '');
  const [isReleasing, setIsReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsReleasing(true);
    setError(null);

    try {
      // Create a temporary audio blob (stub - will be replaced with actual export)
      const audioBlob = new Blob([], { type: 'audio/wav' });
      
      await onRelease(title.trim(), audioBlob);
      onClose();
    } catch (err) {
      console.error('Release failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to release track');
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gradient-to-b from-black via-cyan-950/60 to-black border border-cyan-500/50 rounded-2xl p-6 shadow-2xl shadow-cyan-500/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-600/20 flex items-center justify-center">
              <Upload className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Release Track</h2>
              <p className="text-sm text-cyan-400/60">Publish to Explore & Library</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isReleasing}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-cyan-100 mb-2">
              Track Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isReleasing}
              placeholder="Enter track title..."
              maxLength={100}
              className="w-full px-4 py-3 rounded-lg bg-black/50 border border-cyan-500/30 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <p className="text-xs text-cyan-400/60 mt-1">
              {title.length}/100 characters
            </p>
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-lg bg-cyan-900/20 border border-cyan-500/30">
            <div className="flex items-start gap-3">
              <Music className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <div className="text-sm text-cyan-100/80">
                <p className="font-medium mb-1">What happens when you release:</p>
                <ul className="space-y-1 text-xs text-cyan-400/60">
                  <li>• Your track will appear in Explore</li>
                  <li>• It will be added to your Library</li>
                  <li>• Other users can discover and play it</li>
                  <li>• You can update or remove it later</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isReleasing}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReleasing || !title.trim()}
              className="flex-1 px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isReleasing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Releasing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Release Track</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
