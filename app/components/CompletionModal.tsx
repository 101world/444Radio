'use client'

import { useState } from 'react'
import { X, Download, Share2, Eye, EyeOff } from 'lucide-react'

interface CompletionModalProps {
  isOpen: boolean
  onClose: () => void
  audioUrl: string
  coverUrl: string
  outputType: 'image' | 'video'
  prompt: string
  songId: string
}

export default function CompletionModal({
  isOpen,
  onClose,
  audioUrl,
  coverUrl,
  outputType,
  prompt,
  songId
}: CompletionModalProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const handleToggleVisibility = async () => {
    setIsToggling(true)
    try {
      const response = await fetch('/api/songs/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId, isPublic: !isPublic })
      })
      
      const data = await response.json()
      if (data.success) {
        setIsPublic(!isPublic)
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error)
    }
    setIsToggling(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      {/* Chat-style reply container */}
      <div className="relative w-full sm:max-w-2xl bg-gradient-to-br from-slate-900 to-green-950/50 rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-green-500/30 shadow-2xl shadow-green-500/20 animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-green-400 hover:text-green-300 transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          {/* AI Reply Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-400 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
              <span className="text-2xl">🎵</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-green-400">444 RADIO AI</p>
              <p className="text-green-400/60 text-sm">Your track is ready!</p>
            </div>
          </div>

          {/* User's prompt (chat bubble style) */}
          <div className="mb-6 flex justify-end">
            <div className="max-w-[80%] bg-cyan-500/20 border border-cyan-500/30 rounded-2xl rounded-tr-sm px-6 py-3">
              <p className="text-cyan-100 text-sm">{prompt}</p>
            </div>
          </div>

          {/* AI Reply - Generated content */}
          <div className="bg-black/40 rounded-2xl border border-green-500/30 overflow-hidden mb-6">
            {/* Visual Content */}
            <div className="relative">
              {outputType === 'image' ? (
                <img 
                  src={coverUrl} 
                  alt="Generated Cover Art" 
                  className="w-full h-80 object-cover"
                />
              ) : (
                <video 
                  src={coverUrl} 
                  className="w-full h-80 object-cover" 
                  controls 
                  autoPlay 
                  loop 
                  muted
                />
              )}
              
              {/* Badge */}
              <div className="absolute top-4 left-4 px-3 py-1 bg-black/80 backdrop-blur-sm border border-green-500/30 rounded-full">
                <span className="text-green-400 text-xs font-bold">
                  {outputType === 'image' ? '🎨 COVER ART' : '🎬 MUSIC VIDEO'}
                </span>
              </div>
            </div>

            {/* Audio Player */}
            <div className="p-6 bg-gradient-to-r from-green-500/10 to-cyan-500/10 border-t border-green-500/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">▶️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-green-400 font-bold truncate">Your Generated Track</p>
                  <p className="text-green-400/60 text-sm">Ready to play</p>
                </div>
              </div>
              <audio src={audioUrl} controls className="w-full" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Visibility Toggle */}
            <button
              onClick={handleToggleVisibility}
              disabled={isToggling}
              className={`w-full px-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                isPublic
                  ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                  : 'bg-slate-800 border-2 border-slate-600 text-slate-300'
              }`}
            >
              {isToggling ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Updating...</span>
                </>
              ) : isPublic ? (
                <>
                  <Eye size={20} />
                  <span>🌍 PUBLIC - Visible on Explore & Billboard</span>
                </>
              ) : (
                <>
                  <EyeOff size={20} />
                  <span>🔒 PRIVATE - Make Public?</span>
                </>
              )}
            </button>

            {/* Action buttons row */}
            <div className="grid grid-cols-2 gap-3">
              <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2">
                <Download size={18} />
                <span>Download</span>
              </button>
              <button className="px-6 py-3 bg-slate-800 text-green-400 rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                <Share2 size={18} />
                <span>Share</span>
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-black/40 border border-green-500/30 text-green-400 rounded-xl font-medium hover:bg-black/60 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Info text */}
          <p className="text-center text-green-400/40 text-xs mt-4">
            {isPublic 
              ? '✅ This track is visible to everyone'
              : '🔒 This track is only visible to you'
            }
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

