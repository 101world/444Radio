'use client'

import { X, Play, Heart, Download, Clock, Music, Disc3, Mic2, Hash, MapPin, Tag } from 'lucide-react'
import Image from 'next/image'

interface TrackInfo {
  id: string
  title: string
  image_url?: string
  imageUrl?: string
  audio_url?: string
  audioUrl?: string
  user_id?: string
  username?: string
  artist_name?: string
  genre?: string
  secondary_genre?: string
  mood?: string
  bpm?: number
  key_signature?: string
  vocals?: string
  language?: string
  tags?: string[]
  description?: string
  instruments?: string[]
  plays?: number
  likes?: number
  downloads?: number
  created_at?: string
  duration_seconds?: number
  release_type?: string
  is_explicit?: boolean
  featured_artists?: string[]
  record_label?: string
  version_tag?: string
  users?: { username: string }
}

interface TrackInfoModalProps {
  track: TrackInfo
  onClose: () => void
  onPlay?: () => void
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TrackInfoModal({ track, onClose, onPlay }: TrackInfoModalProps) {
  const coverUrl = track.image_url || track.imageUrl
  const artist = track.artist_name || track.users?.username || track.username || 'Unknown'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-gray-950/95 border border-white/[0.08] rounded-2xl backdrop-blur-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-gray-400 hover:text-white transition">
          <X size={14} />
        </button>

        {/* Cover art */}
        <div className="relative w-full aspect-square max-h-[240px] overflow-hidden rounded-t-2xl">
          {coverUrl ? (
            <Image src={coverUrl} alt={track.title} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
              <Music size={48} className="text-gray-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />
          {onPlay && (
            <button onClick={onPlay} className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 hover:bg-cyan-400 transition">
              <Play size={18} className="text-black ml-0.5" fill="currentColor" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 -mt-4 relative">
          <h2 className="text-lg font-bold text-white leading-tight">{track.title}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{artist}</p>
          {track.featured_artists && track.featured_artists.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">feat. {track.featured_artists.join(', ')}</p>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            {(track.plays !== undefined && track.plays > 0) && (
              <span className="flex items-center gap-1"><Play size={10} />{track.plays} plays</span>
            )}
            {(track.likes !== undefined && track.likes > 0) && (
              <span className="flex items-center gap-1"><Heart size={10} />{track.likes}</span>
            )}
            {(track.downloads !== undefined && track.downloads > 0) && (
              <span className="flex items-center gap-1"><Download size={10} />{track.downloads}</span>
            )}
          </div>

          {/* Metadata grid */}
          <div className="mt-4 space-y-0">
            {track.genre && (
              <MetaRow icon={<Disc3 size={12} />} label="Genre" value={track.secondary_genre ? `${track.genre} / ${track.secondary_genre}` : track.genre} />
            )}
            {track.mood && (
              <MetaRow icon={<Tag size={12} />} label="Mood" value={track.mood} />
            )}
            {track.bpm && (
              <MetaRow icon={<Hash size={12} />} label="BPM" value={String(track.bpm)} />
            )}
            {track.key_signature && (
              <MetaRow icon={<Music size={12} />} label="Key" value={track.key_signature} />
            )}
            {track.vocals && (
              <MetaRow icon={<Mic2 size={12} />} label="Vocals" value={track.vocals} />
            )}
            {track.language && (
              <MetaRow icon={<MapPin size={12} />} label="Language" value={track.language} />
            )}
            {track.duration_seconds && (
              <MetaRow icon={<Clock size={12} />} label="Duration" value={formatDuration(track.duration_seconds)} />
            )}
            {track.release_type && track.release_type !== 'single' && (
              <MetaRow icon={<Disc3 size={12} />} label="Release" value={track.release_type} />
            )}
            {track.record_label && (
              <MetaRow icon={<Tag size={12} />} label="Label" value={track.record_label} />
            )}
            {track.version_tag && (
              <MetaRow icon={<Tag size={12} />} label="Version" value={track.version_tag} />
            )}
            {track.is_explicit && (
              <MetaRow icon={<Tag size={12} />} label="Content" value="Explicit" />
            )}
            {track.created_at && (
              <MetaRow icon={<Clock size={12} />} label="Released" value={formatDate(track.created_at)} />
            )}
          </div>

          {/* Tags */}
          {track.tags && track.tags.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1">
                {track.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] text-gray-400">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Instruments */}
          {track.instruments && track.instruments.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Instruments</p>
              <div className="flex flex-wrap gap-1">
                {track.instruments.map(inst => (
                  <span key={inst} className="px-2 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded-full text-[10px] text-gray-400">{inst}</span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {track.description && (
            <div className="mt-4">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-gray-400 leading-relaxed">{track.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.03]">
      <span className="text-gray-600">{icon}</span>
      <span className="text-[10px] text-gray-500 w-16">{label}</span>
      <span className="text-xs text-gray-300 capitalize">{value}</span>
    </div>
  )
}
