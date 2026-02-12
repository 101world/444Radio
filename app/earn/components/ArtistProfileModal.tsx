'use client'

import { X, Users, Music2, Download, Play } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ArtistInfo {
  user_id: string
  username: string
  avatar_url?: string
  bio?: string
  trackCount: number
  totalDownloads: number
  totalPlays: number
}

interface ArtistProfileModalProps {
  artist: ArtistInfo
  onClose: () => void
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export default function ArtistProfileModal({ artist, onClose }: ArtistProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus trap and ESC close
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-lg bg-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/10 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-label={`${artist.username}'s profile`}
      >
        {/* Cinematic header gradient */}
        <div className="h-32 bg-gradient-to-br from-purple-700/40 via-cyan-600/30 to-emerald-600/20 relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.15),transparent_50%)]" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-gray-300 hover:text-white transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Avatar overlapping header */}
        <div className="px-6 -mt-14">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-gray-950 bg-gradient-to-br from-cyan-500 to-purple-600 shadow-xl">
            {artist.avatar_url ? (
              <img src={artist.avatar_url} alt={artist.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                {artist.username?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pt-4 pb-6">
          <h2 className="text-xl font-bold text-white">{artist.username}</h2>
          {artist.bio && (
            <p className="text-sm text-gray-400 mt-2 leading-relaxed max-h-24 overflow-y-auto">{artist.bio}</p>
          )}

          {/* Stats */}
          <div className="flex gap-4 mt-6">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <Music2 size={18} className="mx-auto text-cyan-400 mb-1" />
              <div className="text-lg font-bold text-white">{artist.trackCount}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Tracks</div>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <Download size={18} className="mx-auto text-emerald-400 mb-1" />
              <div className="text-lg font-bold text-white">{formatNumber(artist.totalDownloads)}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Downloads</div>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <Play size={18} className="mx-auto text-purple-400 mb-1" />
              <div className="text-lg font-bold text-white">{formatNumber(artist.totalPlays)}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Plays</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <a
              href={`/profile/${artist.user_id}`}
              className="flex-1 text-center px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition"
            >
              View Full Profile
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-white/10 border border-white/10 text-gray-300 font-medium text-sm rounded-xl hover:bg-white/20 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
