'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2, Scissors, ExternalLink, X, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface EarnTrack {
  id: string
  title: string
  image_url: string
  username: string
}

interface SuccessModalProps {
  track: EarnTrack
  splitJobId?: string
  onClose: () => void
}

export default function SuccessModal({ track, splitJobId, onClose }: SuccessModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    modalRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md bg-gray-950 border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10"
        role="dialog"
        aria-label="Purchase successful"
      >
        {/* Success animation */}
        <div className="flex flex-col items-center pt-10 pb-4 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent" />
          <div className="relative w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white relative">Purchase Complete!</h3>
          <p className="text-sm text-gray-400 mt-1 relative">Track downloaded successfully</p>
        </div>

        {/* Track info */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
              {track.image_url ? (
                <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles size={16} className="text-gray-500" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{track.title}</p>
              <p className="text-xs text-gray-400">by @{track.username}</p>
            </div>
          </div>
        </div>

        {/* Stem split info */}
        {splitJobId && (
          <div className="px-6 pb-4">
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scissors size={16} className="text-purple-400" />
                <span className="text-sm font-semibold text-purple-300">Stem Split Queued</span>
              </div>
              <p className="text-xs text-gray-400">Your stems are being processed and will appear in your Create page chat.</p>
              <Link
                href="/create"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-purple-400 hover:text-purple-300 font-medium transition"
              >
                Go to Create <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/20 transition"
            >
              Continue Browsing
            </button>
            <Link
              href="/library"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-xl text-center shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition"
            >
              View Library
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
