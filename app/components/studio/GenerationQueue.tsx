/**
 * GenerationQueue - Real-time queue display for AI generations
 * Shows all active generation tasks with status updates
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle, Music, Waves, Sparkles, Scissors } from 'lucide-react';

export interface QueueItem {
  id: string;
  type: 'song' | 'beat' | 'effect' | 'stems';
  prompt: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: string;
  result?: {
    audioUrl?: string;
    stems?: Record<string, string>; // For stem splitting
    metadata?: any;
  };
  error?: string;
  trackId?: string; // Which track this will populate
  timestamp: number;
}

interface GenerationQueueProps {
  items: QueueItem[];
  onRemove?: (id: string) => void;
}

const ICON_MAP = {
  song: Music,
  beat: Waves,
  effect: Sparkles,
  stems: Scissors,
};

const STATUS_COLORS = {
  queued: 'text-gray-400',
  processing: 'text-cyan-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

export default function GenerationQueue({ items, onRemove }: GenerationQueueProps) {
  const [visible, setVisible] = useState(true);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 w-96 bg-gradient-to-b from-gray-900 via-black to-gray-900 border border-cyan-500/30 rounded-lg shadow-2xl shadow-cyan-500/20 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-cyan-500/30">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <span className="text-white font-semibold text-sm">Generation Queue</span>
          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
            {items.filter(i => i.status === 'processing' || i.status === 'queued').length}
          </span>
        </div>
        <button
          onClick={() => setVisible(!visible)}
          className="text-gray-400 hover:text-white transition-colors text-xs"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Queue Items */}
      {visible && (
        <div className="max-h-96 overflow-y-auto p-2 space-y-2">
          {items.map((item) => {
            const Icon = ICON_MAP[item.type];
            const statusColor = STATUS_COLORS[item.status];

            return (
              <div
                key={item.id}
                className="bg-gray-800/50 border border-cyan-500/20 rounded-lg p-3 space-y-2"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">
                        {item.type === 'song' && '🎤 Song'}
                        {item.type === 'beat' && '🥁 Beat'}
                        {item.type === 'effect' && '✨ Effect'}
                        {item.type === 'stems' && '✂️ Stems'}
                      </div>
                      <div className="text-gray-400 text-xs truncate mt-0.5">
                        {item.prompt}
                      </div>
                    </div>
                  </div>

                  {/* Status Icon */}
                  {item.status === 'processing' && (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
                  )}
                  {item.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  )}
                  {item.status === 'failed' && (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                </div>

                {/* Progress */}
                {item.progress && item.status === 'processing' && (
                  <div className="text-xs text-cyan-400">
                    {item.progress}
                  </div>
                )}

                {/* Error */}
                {item.error && item.status === 'failed' && (
                  <div className="text-xs text-red-400">
                    ❌ {item.error}
                  </div>
                )}

                {/* Success Message */}
                {item.status === 'completed' && (
                  <div className="text-xs text-green-400">
                    ✅ Added to track {item.trackId ? `"${item.trackId}"` : ''}
                  </div>
                )}

                {/* Progress Bar */}
                {item.status === 'processing' && (
                  <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Stats */}
      <div className="p-2 border-t border-cyan-500/30 flex items-center justify-between text-xs">
        <div className="text-gray-400">
          <span className="text-green-400 font-semibold">
            {items.filter(i => i.status === 'completed').length}
          </span> completed
        </div>
        <div className="text-gray-400">
          <span className="text-red-400 font-semibold">
            {items.filter(i => i.status === 'failed').length}
          </span> failed
        </div>
      </div>
    </div>
  );
}
