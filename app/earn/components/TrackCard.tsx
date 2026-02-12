'use client'

import { Play, Pause, Download, Music2 } from 'lucide-react'
import LikeButton from '../../components/LikeButton'

interface EarnTrack {
  id: string
  title: string
  audio_url: string
  image_url: string
  user_id: string
  username: string
  avatar_url?: string
  genre?: string
  plays: number
  likes: number
  downloads: number
  created_at: string
  earn_price: number
}

interface TrackCardProps {
  track: EarnTrack
  isCurrentTrack: boolean
  isPlaying: boolean
  onPlay: () => void
  onDownload: () => void
  onOpenArtist: () => void
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function TrackCard({ track, isCurrentTrack, isPlaying, onPlay, onDownload, onOpenArtist }: TrackCardProps) {
  return (
    <div className={`group relative bg-white/5 border rounded-2xl p-4 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.08] hover:shadow-xl hover:shadow-cyan-500/5 hover:border-cyan-500/20 ${
      isCurrentTrack ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-white/10'
    }`}>
      <div className="flex gap-4">
        {/* Cover art */}
        <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-purple-700/50 to-cyan-600/50">
          {track.image_url ? (
            <img 
              src={track.image_url} 
              alt={track.title} 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music2 size={28} className="text-white/40" />
            </div>
          )}
          
          {/* Play overlay */}
          <button
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isCurrentTrack && isPlaying
                ? 'bg-cyan-500 scale-100 opacity-100'
                : 'bg-white/90 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100'
            }`}>
              {isCurrentTrack && isPlaying ? (
                <Pause size={18} className="text-white" />
              ) : (
                <Play size={18} className="text-black ml-0.5" />
              )}
            </div>
          </button>

          {/* Now playing indicator */}
          {isCurrentTrack && isPlaying && (
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="w-0.5 bg-cyan-400 rounded-full animate-pulse"
                  style={{ 
                    height: `${8 + Math.random() * 8}px`,
                    animationDelay: `${i * 0.15}s` 
                  }}
                />
              ))}
            </div>
          )}

          {/* Genre badge */}
          {track.genre && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-gray-300 font-medium">
              {track.genre}
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-semibold text-white truncate text-sm leading-tight">{track.title}</h4>
              <button
                onClick={onOpenArtist}
                className="text-xs text-gray-400 hover:text-cyan-400 transition truncate block mt-0.5"
              >
                @{track.username}
              </button>
            </div>
            <span className="text-[10px] text-gray-600 whitespace-nowrap mt-0.5">
              {timeAgo(track.created_at)}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Play size={10} />
              <span>{formatNumber(track.plays)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Download size={10} />
              <span>{formatNumber(track.downloads)}</span>
            </div>
            <div className="ml-auto">
              <LikeButton
                releaseId={track.id}
                initialLikesCount={track.likes || 0}
                size="sm"
                showCount={true}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onPlay}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-xs font-medium transition"
            >
              {isCurrentTrack && isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isCurrentTrack && isPlaying ? 'Pause' : 'Preview'}
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold transition shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25"
            >
              <Download size={12} />
              2 cr
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
