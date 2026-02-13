'use client'

import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import FloatingNavButton from '../components/FloatingNavButton'
import { Search, Play, Pause, ArrowLeft, FileText, Radio as RadioIcon, Users, Music, X, SlidersHorizontal, Heart, TrendingUp, Disc3, Headphones, Zap, Clock, Hash, ChevronRight, Sparkles, Flame, Info } from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { supabase } from '@/lib/supabase'
import { ExploreGridSkeleton } from '../components/LoadingSkeleton'
import LikeButton from '../components/LikeButton'
import ErrorBoundary from '../components/ErrorBoundary'
import TrackInfoModal from '../components/TrackInfoModal'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))
const LyricsModal = lazy(() => import('../components/LyricsModal'))

// ─── Types ───
interface CombinedMedia {
  id: string; title: string; audio_url: string; audioUrl?: string; image_url: string; imageUrl?: string
  audio_prompt: string; image_prompt: string; user_id: string; username?: string; likes: number; plays: number
  created_at: string; users: { username: string }; genre?: string; mood?: string; bpm?: number; vocals?: string
  language?: string; tags?: string[]; description?: string; key_signature?: string; instruments?: string[]
  secondary_genre?: string; is_explicit?: boolean; duration_seconds?: number; artist_name?: string
  featured_artists?: string[]; release_type?: string
}
interface Artist { username: string; user_id: string; avatar: string; trackCount: number }
interface LiveStation {
  id: string; title: string; coverUrl: string | null; isLive: boolean; listenerCount: number
  owner: { userId: string; username: string; profileImage: string | null }
}

// ─── Genre Colors ───
const GENRE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'lofi': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  'lo-fi': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
  'hiphop': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'hip-hop': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  'jazz': { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30' },
  'chill': { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  'rnb': { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30' },
  'r&b': { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30' },
  'techno': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  'electronic': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  'pop': { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
  'rock': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  'indie': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  'classical': { bg: 'bg-slate-400/20', text: 'text-slate-300', border: 'border-slate-400/30' },
  'ambient': { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  'trap': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
  'house': { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' },
  'reggae': { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  'latin': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
  'k-pop': { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30' },
  'phonk': { bg: 'bg-red-600/20', text: 'text-red-400', border: 'border-red-600/30' },
  'drill': { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' },
  'soul': { bg: 'bg-orange-400/20', text: 'text-orange-300', border: 'border-orange-400/30' },
  'funk': { bg: 'bg-yellow-600/20', text: 'text-yellow-400', border: 'border-yellow-600/30' },
  'blues': { bg: 'bg-blue-600/20', text: 'text-blue-300', border: 'border-blue-600/30' },
}

function getGenreStyle(genre?: string) {
  if (!genre || genre.toLowerCase() === 'unknown') return null
  return GENRE_COLORS[genre.toLowerCase()] || { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/25' }
}

function formatPlays(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatDuration(s?: number) {
  if (!s) return null
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

// ═══════════════════════════════════════════════
// GRID TRACK CARD — Square cover art, stacked info
// ═══════════════════════════════════════════════
function GridTrackCard({ media, isCurrentlyPlaying, isPlaying, onPlay, onLyrics, onInfo }: {
  media: CombinedMedia; isCurrentlyPlaying: boolean; isPlaying: boolean; onPlay: () => void; onLyrics: () => void; onInfo?: () => void
}) {
  const gs = getGenreStyle(media.genre)
  return (
    <div className="group cursor-pointer w-[140px] flex-shrink-0" onClick={onPlay}>
      <div className={`relative w-[140px] h-[140px] rounded-xl overflow-hidden transition-all duration-200 ${
        isCurrentlyPlaying ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/20' : 'ring-1 ring-white/[0.06] hover:ring-white/15 hover:shadow-lg hover:shadow-black/30'
      }`}>
        {media.image_url || media.imageUrl ? (
          <Image src={media.image_url || media.imageUrl || ''} alt={media.title} width={140} height={140}
            className="w-full h-full object-cover" loading="lazy" quality={70} unoptimized />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
            <Music size={20} className="text-gray-700" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {/* Play overlay */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all ${
          isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md shadow-2xl transition-transform group-hover:scale-110 ${
            isCurrentlyPlaying ? 'bg-cyan-400' : 'bg-white/90'
          }`}>
            {isCurrentlyPlaying && isPlaying
              ? <Pause className="text-black" size={14} />
              : <Play className="text-black ml-0.5" size={14} />}
          </div>
        </div>
        {/* Now playing pulse */}
        {isCurrentlyPlaying && isPlaying && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur px-2 py-1 rounded-full">
            <div className="flex items-end gap-[2px] h-3">
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '40%' }} />
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '0.15s' }} />
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '55%', animationDelay: '0.3s' }} />
            </div>
          </div>
        )}
        {/* Genre badge bottom-left */}
        {gs && (
          <div className="absolute bottom-2 left-2">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border backdrop-blur-sm ${gs.bg} ${gs.text} ${gs.border}`}>
              {media.genre}
            </span>
          </div>
        )}
        {/* Info button top-left */}
        {onInfo && (
          <button onClick={e => { e.stopPropagation(); onInfo() }}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-gray-400 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all z-10"
            title="Track info">
            <Info size={10} />
          </button>
        )}
      </div>
      {/* Info below card */}
      <div className="mt-1.5 w-[140px]">
        <h3 className={`font-semibold text-[11px] truncate leading-tight ${isCurrentlyPlaying ? 'text-cyan-300' : 'text-white'}`}>
          {media.title}
        </h3>
        {media.user_id && media.user_id !== 'undefined' ? (
          <Link href={`/profile/${media.user_id}`} className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors truncate block" onClick={e => e.stopPropagation()}>
            {media.artist_name || media.users?.username || media.username || 'Unknown'}
          </Link>
        ) : (
          <span className="text-[10px] text-gray-600 truncate block">{media.users?.username || 'Unknown'}</span>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-gray-600">
          <span className="flex items-center gap-0.5"><Headphones size={8} />{formatPlays(media.plays || 0)}</span>
          <span className="flex items-center gap-0.5"><Heart size={8} />{media.likes || 0}</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// LIST TRACK ROW — Compact row for All Tracks
// ═══════════════════════════════════════════════
function ListTrackRow({ media, index, isCurrentlyPlaying, isPlaying, onPlay, onLyrics }: {
  media: CombinedMedia; index: number; isCurrentlyPlaying: boolean; isPlaying: boolean; onPlay: () => void; onLyrics: () => void
}) {
  const gs = getGenreStyle(media.genre)
  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
        isCurrentlyPlaying ? 'bg-cyan-500/8 border border-cyan-500/20' : 'hover:bg-white/[0.03] border border-transparent'
      }`}
      onClick={onPlay}
    >
      {/* Index / play icon */}
      <div className="w-6 text-center flex-shrink-0">
        <span className={`text-xs font-medium group-hover:hidden ${isCurrentlyPlaying ? 'text-cyan-400' : 'text-gray-600'}`}>
          {isCurrentlyPlaying && isPlaying ? (
            <div className="flex items-end justify-center gap-[2px] h-3">
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '40%' }} />
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '.1s' }} />
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '50%', animationDelay: '.2s' }} />
            </div>
          ) : index + 1}
        </span>
        <button className="hidden group-hover:block">
          {isCurrentlyPlaying && isPlaying
            ? <Pause size={14} className="text-cyan-400 mx-auto" />
            : <Play size={14} className="text-white ml-0.5 mx-auto" />}
        </button>
      </div>
      {/* Cover */}
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/[0.06]">
        {media.image_url || media.imageUrl ? (
          <Image src={media.image_url || media.imageUrl || ''} alt={media.title} width={40} height={40}
            className="w-full h-full object-cover" loading="lazy" quality={60} unoptimized />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center"><Music size={16} className="text-gray-700" /></div>
        )}
      </div>
      {/* Info + metadata + actions — all flow together */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-medium truncate ${isCurrentlyPlaying ? 'text-cyan-300' : 'text-white'}`}>{media.title}</h3>
          {/* Desktop metadata inline */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-600 flex-shrink-0">
            {media.bpm && <span className="flex items-center gap-0.5"><Zap size={9} />{media.bpm}</span>}
            {media.key_signature && <span className="flex items-center gap-0.5"><Hash size={9} />{media.key_signature}</span>}
            {media.duration_seconds && <span><Clock size={9} className="inline mr-0.5" />{formatDuration(media.duration_seconds)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {media.user_id && media.user_id !== 'undefined' ? (
            <Link href={`/profile/${media.user_id}`} className="text-[11px] text-gray-500 hover:text-cyan-400 transition-colors truncate" onClick={e => e.stopPropagation()}>
              {media.artist_name || media.users?.username || media.username || 'Unknown'}
            </Link>
          ) : (
            <span className="text-[11px] text-gray-600 truncate">{media.users?.username || 'Unknown'}</span>
          )}
          {gs && (
            <span className={`text-[9px] px-1.5 py-px rounded-full border font-medium ${gs.bg} ${gs.text} ${gs.border}`}>{media.genre}</span>
          )}
        </div>
      </div>
      {/* Plays + Actions — tight group */}
      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
          <Headphones size={9} />{formatPlays(media.plays || 0)}
        </span>
        <LikeButton releaseId={media.id} initialLikesCount={media.likes || 0} size="sm" showCount={false} />
        <button onClick={e => { e.stopPropagation(); onLyrics() }} className="p-1.5 hover:bg-purple-500/15 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Lyrics">
          <FileText size={12} className="text-purple-400/60" />
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
function ExplorePageContent() {
  const router = useRouter()
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [liveStations, setLiveStations] = useState<LiveStation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CombinedMedia[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    genre: '', mood: '', bpm_min: '', bpm_max: '', key: '', vocals: '', sort: 'relevance'
  })
  const [activeTab, setActiveTab] = useState<'tracks' | 'genres' | 'stations'>('tracks')
  const [genres, setGenres] = useState<string[]>([])
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedLyricsId, setSelectedLyricsId] = useState<string | null>(null)
  const [selectedLyricsTitle, setSelectedLyricsTitle] = useState<string | null>(null)
  const [infoMedia, setInfoMedia] = useState<CombinedMedia | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { currentTrack: globalCurrentTrack, isPlaying: globalIsPlaying, playTrack, togglePlayPause, setPlaylist } = useAudioPlayer()
  const playingId = globalCurrentTrack?.id || null
  const isPlaying = globalIsPlaying

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.push('/create') }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  useEffect(() => {
    fetchCombinedMedia()
    setTimeout(() => fetchLiveStations(), 500)
    const interval = setInterval(fetchLiveStations, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('combined_media')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combined_media' }, (payload) => {
        const updated = payload.new as Record<string, unknown>
        setCombinedMedia(prev => prev.map(m =>
          m.id === updated.id
            ? { ...m, likes: (updated.likes_count || updated.likes || m.likes) as number, plays: (updated.plays || m.plays) as number }
            : m
        ))
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [])

  const fetchLiveStations = async () => {
    try {
      const res = await fetch('/api/station')
      const data = await res.json()
      if (data.success && data.stations) {
        setLiveStations(data.stations.map((s: Record<string, unknown>) => ({
          id: s.id as string, title: `${s.username}'s Station`, coverUrl: s.current_track_image as string | null,
          isLive: true, listenerCount: (s.listener_count || 0) as number,
          owner: { userId: s.clerk_user_id as string, username: s.username as string, profileImage: (s.profile_image || null) as string | null }
        })))
      }
    } catch (error) { console.error('Failed to fetch live stations:', error) }
  }

  const fetchCombinedMedia = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/explore?limit=500')
      const data = await res.json()
      if (data.success) {
        setCombinedMedia(data.combinedMedia)
        const artistMap = new Map<string, Artist>()
        data.combinedMedia.forEach((media: CombinedMedia) => {
          const username = media.artist_name || media.users?.username || media.username
          const userId = media.user_id
          if (username && userId && !artistMap.has(userId)) {
            artistMap.set(userId, { username, user_id: userId, trackCount: 1, avatar: media.image_url })
          } else if (artistMap.has(userId)) { artistMap.get(userId)!.trackCount++ }
        })
        setArtists(Array.from(artistMap.values()).filter(a => a.user_id && a.user_id !== 'undefined').slice(0, 20))
        try {
          const genreRes = await fetch('/api/explore/genre-summary')
          const genreData = await genreRes.json()
          if (genreData.success && Array.isArray(genreData.genres) && genreData.genres.length > 0) {
            setGenres(genreData.genres)
          } else { setGenres(['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno']) }
        } catch { setGenres(['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno']) }
      }
    } catch (error) { console.error('Failed to fetch media:', error) }
    finally { setLoading(false) }
  }

  const performSearch = useCallback(async (query: string, filters = searchFilters) => {
    if (!query.trim() && !filters.genre && !filters.mood && !filters.key && !filters.vocals) {
      setSearchResults([]); setIsSearchActive(false); setIsSearching(false); return
    }
    setIsSearching(true); setIsSearchActive(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (filters.genre) params.set('genre', filters.genre)
      if (filters.mood) params.set('mood', filters.mood)
      if (filters.bpm_min) params.set('bpm_min', filters.bpm_min)
      if (filters.bpm_max) params.set('bpm_max', filters.bpm_max)
      if (filters.key) params.set('key', filters.key)
      if (filters.vocals) params.set('vocals', filters.vocals)
      if (filters.sort) params.set('sort', filters.sort)
      params.set('limit', '100')
      const res = await fetch(`/api/search?${params.toString()}`)
      const data = await res.json()
      setSearchResults(data.success ? data.results : [])
    } catch { setSearchResults([]) }
    finally { setIsSearching(false) }
  }, [searchFilters])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() || searchFilters.genre || searchFilters.mood) {
        performSearch(searchQuery, searchFilters)
      } else if (isSearchActive) { setIsSearchActive(false); setSearchResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, performSearch, isSearchActive, searchFilters])

  const clearSearch = () => {
    setSearchQuery(''); setSearchResults([]); setIsSearchActive(false); setShowFilters(false)
    setSearchFilters({ genre: '', mood: '', bpm_min: '', bpm_max: '', key: '', vocals: '', sort: 'relevance' })
  }

  const handlePlay = (media: CombinedMedia) => {
    if (playingId === media.id && isPlaying) { togglePlayPause() } else {
      const sourceList = isSearchActive && searchResults.length > 0 ? searchResults : combinedMedia
      const playlistTracks = sourceList.map(m => ({
        id: m.id, title: m.title, audioUrl: m.audioUrl || m.audio_url, imageUrl: m.imageUrl || m.image_url,
        artist: m.artist_name || m.users?.username || m.username || 'Unknown Artist', userId: m.user_id,
        genre: m.genre || undefined, mood: m.mood || undefined, tags: m.tags || undefined
      }))
      const startIndex = sourceList.findIndex(m => m.id === media.id)
      setPlaylist(playlistTracks, startIndex >= 0 ? startIndex : 0)
    }
  }

  const openLyrics = (media: CombinedMedia) => {
    setSelectedLyricsId(media.id); setSelectedLyricsTitle(media.title); setShowLyricsModal(true)
  }

  // ─── Derived ───
  const INTERNAL_GENRES = ['stem', 'effects', 'loop', 'sfx']
  const nonStemMedia = combinedMedia.filter(m => !INTERNAL_GENRES.includes(m.genre?.toLowerCase() || ''))
  const hotTracks = [...nonStemMedia].sort((a, b) => ((b.plays || 0) + (b.likes || 0) * 3) - ((a.plays || 0) + (a.likes || 0) * 3)).slice(0, 20)
  const newReleases = [...nonStemMedia].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20)

  // Per-genre horizontal rows — only genres with 3+ tracks
  const genreRows = genres
    .map(g => ({
      genre: g,
      tracks: nonStemMedia.filter(m => m.genre?.toLowerCase() === g.toLowerCase()),
    }))
    .filter(row => row.tracks.length >= 3)
  const activeFilterCount = [searchFilters.genre, searchFilters.mood, searchFilters.key, searchFilters.vocals, searchFilters.bpm_min, searchFilters.bpm_max].filter(Boolean).length

  return (
    <div className="min-h-screen text-white">
      {/* 3D Holographic Background */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>
      {/* Subtle overlay so content stays readable */}
      <div className="fixed inset-0 bg-black/15 backdrop-blur-[0.5px] -z-[5] pointer-events-none" />

      <div className="md:hidden"><CreditIndicator /></div>
      <FloatingMenu />

      {/* ESC button — positioned to NOT overlap sidebar */}
      <button onClick={() => router.push('/create')} className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
        <ArrowLeft size={16} />
      </button>

      <main className="relative z-10 md:pl-[72px] pb-32">

        {/* ═══ BANNER VIDEO ═══ */}
        <div className="relative h-44 md:h-56 overflow-hidden">
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
            <source src="/1_1_thm2_rxl1.webm" type="video/webm" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 md:px-6 pb-4">
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-semibold">DISCOVER</span>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-0.5 tracking-tight">Explore Music</h1>
            <p className="text-gray-400 text-xs mt-1">{combinedMedia.length} tracks &middot; {artists.length} artists</p>
          </div>
        </div>

        {/* ═══ TOP BAR — Compact Search ═══ */}
        <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex items-center gap-3 px-4 md:px-6 h-14">
            {/* Track count */}
            <span className="text-[10px] text-gray-500 hidden sm:block flex-shrink-0">{combinedMedia.length} tracks</span>

            {/* Search — compact, center-weighted */}
            <div className="relative flex-1 max-w-md mx-auto group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-cyan-400 transition-colors" />
              <input
                ref={searchInputRef} type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') performSearch(searchQuery) }}
                placeholder="Search tracks, genres, moods..."
                className="w-full pl-9 pr-8 py-2 bg-white/[0.04] border border-white/[0.06] rounded-full text-white text-xs placeholder-gray-600 focus:border-cyan-500/30 focus:bg-white/[0.06] focus:outline-none transition-all"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={12} /></button>
              )}
            </div>

            {/* Filter button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-full border flex-shrink-0 transition-all ${
                showFilters || activeFilterCount > 0 ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-white'
              }`}
            >
              <SlidersHorizontal size={14} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan-500 text-[8px] text-black font-bold rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Tab pills */}
            {!isSearchActive && (
              <div className="hidden md:flex items-center gap-0.5 bg-white/[0.03] rounded-full p-0.5 flex-shrink-0">
                {([
                  { key: 'tracks' as const, label: 'Tracks', icon: Music },
                  { key: 'genres' as const, label: 'Genres', icon: Disc3 },
                  { key: 'stations' as const, label: 'Live', icon: RadioIcon, count: liveStations.length },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                      activeTab === tab.key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                    {'count' in tab && tab.count > 0 && (
                      <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[9px] flex items-center justify-center">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="px-4 md:px-6 pb-3 pt-1">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2.5">
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  <MiniSelect label="Genre" value={searchFilters.genre}
                    onChange={v => { const f = { ...searchFilters, genre: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                    options={['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'electronic', 'pop', 'rock', 'indie', 'ambient', 'trap', 'house', 'phonk', 'drill', 'soul']} placeholder="Genre" />
                  <MiniSelect label="Mood" value={searchFilters.mood}
                    onChange={v => { const f = { ...searchFilters, mood: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                    options={['chill', 'energetic', 'dark', 'uplifting', 'melancholic', 'aggressive', 'romantic', 'dreamy', 'epic', 'happy', 'sad']} placeholder="Mood" />
                  <MiniSelect label="Key" value={searchFilters.key}
                    onChange={v => { const f = { ...searchFilters, key: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                    options={['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm']} placeholder="Key" />
                  <MiniSelect label="Vocals" value={searchFilters.vocals}
                    onChange={v => { const f = { ...searchFilters, vocals: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                    options={['instrumental', 'with-lyrics']} placeholder="Vocals" />
                  <div>
                    <input type="number" value={searchFilters.bpm_min} onChange={e => setSearchFilters({ ...searchFilters, bpm_min: e.target.value })}
                      placeholder="BPM min" className="w-full px-2 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-white text-[10px] placeholder-gray-700 focus:border-cyan-500/30 focus:outline-none" />
                  </div>
                  <div>
                    <input type="number" value={searchFilters.bpm_max} onChange={e => setSearchFilters({ ...searchFilters, bpm_max: e.target.value })}
                      placeholder="BPM max" className="w-full px-2 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-white text-[10px] placeholder-gray-700 focus:border-cyan-500/30 focus:outline-none" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <button onClick={clearSearch} className="text-[10px] text-gray-600 hover:text-white transition-colors">Clear all</button>
                  <button onClick={() => { performSearch(searchQuery, searchFilters); setShowFilters(false) }}
                    className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/25 rounded-full text-cyan-400 text-[10px] font-medium hover:bg-cyan-500/25 transition-colors">
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick genre pills (only when not searching) */}
          {!isSearchActive && !showFilters && activeTab === 'tracks' && (
            <div className="flex items-center gap-1.5 px-4 md:px-6 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'trap', 'ambient', 'electronic', 'pop', 'rock', 'house', 'phonk'].map(g => {
                const style = getGenreStyle(g)
                if (!style) return null
                return (
                  <button key={g}
                    onClick={() => { const f = { ...searchFilters, genre: searchFilters.genre === g ? '' : g }; setSearchFilters(f); performSearch(searchQuery, f) }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${
                      searchFilters.genre === g ? `${style.bg} ${style.text} ${style.border}` : 'bg-white/[0.02] border-white/[0.05] text-gray-600 hover:text-gray-400 hover:border-white/10'
                    }`}
                  >{g}</button>
                )
              })}
            </div>
          )}

          {/* Mobile tabs */}
          {!isSearchActive && (
            <div className="md:hidden flex items-center gap-0.5 px-4 pb-2">
              {([
                { key: 'tracks' as const, label: 'Tracks', icon: Music },
                { key: 'genres' as const, label: 'Genres', icon: Disc3 },
                { key: 'stations' as const, label: 'Live', icon: RadioIcon, count: liveStations.length },
              ] as const).map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                    activeTab === tab.key ? 'bg-white/10 text-white' : 'text-gray-600'
                  }`}
                >
                  <tab.icon size={12} />
                  {tab.label}
                  {'count' in tab && tab.count > 0 && <span className="w-4 h-4 bg-red-500/20 text-red-400 text-[9px] rounded-full flex items-center justify-center">{tab.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ═══ CONTENT ═══ */}
        {loading ? (
          <div className="px-4 md:px-6 pt-6"><ExploreGridSkeleton /></div>
        ) : combinedMedia.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🎵</div>
            <h2 className="text-xl font-bold text-white mb-2">No music yet</h2>
            <p className="text-gray-500 text-sm mb-6">Be the first to create something amazing!</p>
            <Link href="/" className="inline-block px-6 py-2.5 bg-cyan-500 text-black rounded-full text-sm font-bold hover:bg-cyan-400 transition-all">Create Now</Link>
          </div>
        ) : (
          <>
            {/* ═══ SEARCH RESULTS ═══ */}
            {isSearchActive && (
              <div className="px-4 md:px-6 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-cyan-400" />
                    <span className="text-sm font-semibold text-white">
                      {isSearching ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
                    </span>
                    {searchQuery && <span className="text-xs text-gray-600">for &quot;{searchQuery}&quot;</span>}
                  </div>
                  <button onClick={clearSearch} className="text-[10px] text-gray-600 hover:text-cyan-400 flex items-center gap-0.5"><X size={10} /> Clear</button>
                </div>
                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {searchFilters.genre && <FilterBadge label={searchFilters.genre} onRemove={() => { const f = { ...searchFilters, genre: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                    {searchFilters.mood && <FilterBadge label={searchFilters.mood} onRemove={() => { const f = { ...searchFilters, mood: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                    {searchFilters.key && <FilterBadge label={`Key: ${searchFilters.key}`} onRemove={() => { const f = { ...searchFilters, key: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                    {searchFilters.vocals && <FilterBadge label={searchFilters.vocals} onRemove={() => { const f = { ...searchFilters, vocals: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                  </div>
                )}
                {isSearching ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-16">
                    <Search size={28} className="text-gray-700 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-white mb-1">No results</h3>
                    <p className="text-gray-600 text-xs">Try different keywords or filters</p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {searchResults.map(media => (
                      <GridTrackCard key={media.id} media={media}
                        isCurrentlyPlaying={playingId === media.id} isPlaying={isPlaying}
                        onPlay={() => handlePlay(media)} onLyrics={() => openLyrics(media)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ TRACKS TAB ═══ */}
            {activeTab === 'tracks' && !isSearchActive && (
              <div className="space-y-0">
                {/* LIVE NOW */}
                {liveStations.length > 0 && (
                  <div className="px-4 md:px-6 pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {liveStations.filter(s => s.owner.userId && s.owner.userId !== 'undefined').map(station => (
                        <Link key={station.id} href={`/profile/${station.owner.userId}`} className="flex-shrink-0 group">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/60 ring-offset-2 ring-offset-black">
                              {station.owner.profileImage ? (
                                <Image src={station.owner.profileImage} alt={station.owner.username} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-red-600/40 to-pink-600/40 flex items-center justify-center">
                                  <Users size={18} className="text-white/60" />
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] font-medium text-gray-500 truncate w-12 text-center group-hover:text-white transition-colors">{station.owner.username}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* NEW RELEASES — Horizontal scroll */}
                {newReleases.length > 0 && (
                  <section className="pt-3 pb-4">
                    <div className="px-4 md:px-6">
                      <SectionHeader icon={Sparkles} label="New Releases" iconColor="text-green-400" gradientFrom="from-green-500/20" gradientTo="to-emerald-500/20" />
                    </div>
                    <div className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                      {newReleases.map(media => (
                        <GridTrackCard key={`new-${media.id}`} media={media}
                          isCurrentlyPlaying={playingId === media.id} isPlaying={isPlaying}
                          onPlay={() => handlePlay(media)} onLyrics={() => openLyrics(media)} onInfo={() => setInfoMedia(media)} />
                      ))}
                    </div>
                  </section>
                )}

                {/* ARTISTS — Horizontal scroll */}
                <section className="py-4 border-t border-white/[0.03]">
                  <div className="px-4 md:px-6">
                    <SectionHeader icon={Users} label="Artists" iconColor="text-cyan-400" gradientFrom="from-cyan-500/20" gradientTo="to-blue-500/20" />
                  </div>
                  <div className="flex gap-4 overflow-x-auto px-4 md:px-6 pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {artists.map(artist => (
                      <Link key={artist.user_id} href={`/profile/${artist.user_id}`} className="flex-shrink-0 group">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-cyan-400/40 transition-all">
                            {artist.avatar ? (
                              <Image src={artist.avatar} alt={artist.username} width={48} height={48} className="w-full h-full object-cover" loading="lazy" quality={60} unoptimized />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-cyan-800/40 to-blue-800/40 flex items-center justify-center"><Users size={16} className="text-white/40" /></div>
                            )}
                          </div>
                          <p className="text-[9px] font-medium text-gray-400 group-hover:text-white truncate w-12 text-center transition-colors">{artist.username}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                {/* HOT RIGHT NOW — Horizontal scroll */}
                <section className="py-4 border-t border-white/[0.03]">
                  <div className="px-4 md:px-6">
                    <SectionHeader icon={Flame} label="Hot Right Now" iconColor="text-orange-400" gradientFrom="from-orange-500/20" gradientTo="to-red-500/20" />
                  </div>
                  <div className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {hotTracks.map(media => (
                      <GridTrackCard key={media.id} media={media}
                        isCurrentlyPlaying={playingId === media.id} isPlaying={isPlaying}
                        onPlay={() => handlePlay(media)} onLyrics={() => openLyrics(media)} onInfo={() => setInfoMedia(media)} />
                    ))}
                  </div>
                </section>

                {/* PER-GENRE ROWS — Horizontal scroll per genre */}
                {genreRows.map(({ genre, tracks }) => {
                  const gs = getGenreStyle(genre)
                  return (
                    <section key={`genre-row-${genre}`} className="py-4 border-t border-white/[0.03]">
                      <div className="px-4 md:px-6 flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${gs ? gs.bg : 'bg-cyan-500/20'}`}>
                            <Disc3 size={12} className={gs ? gs.text : 'text-cyan-400'} />
                          </div>
                          <h2 className="text-sm font-bold text-white capitalize">{genre}</h2>
                          <span className="text-[10px] text-gray-600">{tracks.length}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (tracks.length > 0) {
                              const pl = tracks.map(m => ({
                                id: m.id, title: m.title, audioUrl: m.audioUrl || m.audio_url,
                                imageUrl: m.imageUrl || m.image_url, artist: m.artist_name || m.users?.username || m.username || 'Unknown Artist', userId: m.user_id
                              }))
                              setPlaylist(pl)
                              playTrack(pl[0])
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all border ${
                            gs ? `${gs.bg} ${gs.text} ${gs.border} hover:opacity-80` : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                          }`}
                        >
                          <Play size={10} /> Play All
                        </button>
                      </div>
                      <div className="flex gap-3 overflow-x-auto px-4 md:px-6 pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                        {tracks.map(media => (
                          <GridTrackCard key={`${genre}-${media.id}`} media={media}
                            isCurrentlyPlaying={playingId === media.id} isPlaying={isPlaying}
                            onPlay={() => handlePlay(media)} onLyrics={() => openLyrics(media)} onInfo={() => setInfoMedia(media)} />
                        ))}
                      </div>
                    </section>
                  )
                })}

                {/* ALL TRACKS — List view */}
                <section className="px-4 md:px-6 py-4 border-t border-white/[0.03]">
                  <SectionHeader icon={Music} label={`All Tracks`} iconColor="text-cyan-400" gradientFrom="from-cyan-500/20" gradientTo="to-blue-500/20" count={nonStemMedia.length} />
                  <div className="space-y-0.5">
                    {nonStemMedia.map((media, i) => (
                      <ListTrackRow key={media.id} media={media} index={i}
                        isCurrentlyPlaying={playingId === media.id} isPlaying={isPlaying}
                        onPlay={() => handlePlay(media)} onLyrics={() => openLyrics(media)} />
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* ═══ GENRES TAB ═══ */}
            {activeTab === 'genres' && !isSearchActive && (
              <div className="px-4 md:px-6 pt-4">
                <SectionHeader icon={Disc3} label="Browse by Genre" iconColor="text-violet-400" gradientFrom="from-violet-500/20" gradientTo="to-purple-500/20" />
                {genres.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-3">🎸</div>
                    <h2 className="text-lg font-bold text-white mb-1">No Genres Yet</h2>
                    <p className="text-gray-600 text-xs">Genres appear as artists release tracks</p>
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {genres.map(genre => {
                      const genreTracks = combinedMedia.filter(m => m.genre?.toLowerCase() === genre.toLowerCase())
                      const thumb = genreTracks[0]?.image_url
                      const count = genreTracks.length
                      const gs = getGenreStyle(genre)
                      const isGenrePlaying = genreTracks.some(t => t.id === playingId && isPlaying)
                      return (
                        <div key={genre}
                          onClick={() => {
                            if (genreTracks.length > 0) {
                              setPlaylist(genreTracks.map(m => ({
                                id: m.id, title: m.title, audioUrl: m.audioUrl || m.audio_url,
                                imageUrl: m.imageUrl || m.image_url, artist: m.artist_name || m.users?.username || m.username || 'Unknown Artist', userId: m.user_id
                              })))
                              playTrack({
                                id: genreTracks[0].id, title: genreTracks[0].title, audioUrl: genreTracks[0].audioUrl || genreTracks[0].audio_url,
                                imageUrl: genreTracks[0].imageUrl || genreTracks[0].image_url, artist: genreTracks[0].artist_name || genreTracks[0].users?.username || genreTracks[0].username || 'Unknown Artist', userId: genreTracks[0].user_id
                              })
                            }
                          }}
                          className={`flex-shrink-0 w-[140px] group cursor-pointer transition-all duration-200 hover:scale-[1.02] ${isGenrePlaying ? 'ring-2 ring-cyan-400 rounded-xl' : ''}`}
                        >
                          <div className="relative w-[140px] h-[140px] rounded-xl overflow-hidden border border-white/[0.06]">
                            {thumb ? (
                              <Image src={thumb} alt={genre} width={140} height={140} className="w-full h-full object-cover" loading="lazy" quality={70} unoptimized />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center"><Disc3 size={24} className="text-gray-700" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-2">
                              {gs && <span className={`inline-block self-start text-[8px] px-1.5 py-px rounded-full border ${gs.bg} ${gs.text} ${gs.border} font-medium mb-0.5`}>{count} tracks</span>}
                              <h3 className="text-white font-bold text-[11px] capitalize">{genre}</h3>
                            </div>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                                {isGenrePlaying ? <Pause className="text-black" size={14} /> : <Play className="text-black ml-0.5" size={14} />}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ STATIONS TAB ═══ */}
            {activeTab === 'stations' && !isSearchActive && (
              <div className="px-4 md:px-6 pt-4">
                {liveStations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {liveStations.filter(s => s.owner.userId && s.owner.userId !== 'undefined').map(station => (
                      <Link key={station.id} href={`/profile/${station.owner.userId}`} className="group">
                        <div className="bg-gradient-to-br from-red-950/20 to-pink-950/10 border border-red-500/15 rounded-xl p-4 hover:border-red-400/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/50 ring-offset-2 ring-offset-black">
                                {station.owner.profileImage ? (
                                  <Image src={station.owner.profileImage} alt={station.owner.username} width={48} height={48} className="w-full h-full object-cover" unoptimized />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-red-600/40 to-pink-600/40 flex items-center justify-center"><Users size={20} className="text-white/60" /></div>
                                )}
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[7px] font-bold px-1.5 py-px rounded-full animate-pulse">LIVE</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-white truncate">{station.title}</h3>
                              <p className="text-[11px] text-gray-600">@{station.owner.username}</p>
                            </div>
                            <ChevronRight size={14} className="text-gray-700 group-hover:text-red-400 transition-colors" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <RadioIcon size={28} className="text-gray-700 mx-auto mb-3" />
                    <h2 className="text-lg font-bold text-white mb-1">No Live Stations</h2>
                    <p className="text-gray-600 text-xs">No one is broadcasting right now</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <FloatingNavButton showPromptToggle={false} />

      <Suspense fallback={null}>
        {selectedLyricsId && (
          <LyricsModal
            isOpen={showLyricsModal}
            onClose={() => { setShowLyricsModal(false); setSelectedLyricsId(null); setSelectedLyricsTitle(null) }}
            mediaId={selectedLyricsId}
            title={selectedLyricsTitle || undefined}
          />
        )}
      </Suspense>

      {infoMedia && (
        <TrackInfoModal
          track={infoMedia}
          onClose={() => setInfoMedia(null)}
          onPlay={() => { handlePlay(infoMedia); setInfoMedia(null) }}
        />
      )}
    </div>
  )
}

// ─── Helpers ───

function SectionHeader({ icon: Icon, label, iconColor, gradientFrom, gradientTo, count }: {
  icon: React.ComponentType<{ size?: number; className?: string }>; label: string
  iconColor: string; gradientFrom: string; gradientTo: string; count?: number
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center`}>
        <Icon size={12} className={iconColor} />
      </div>
      <h2 className="text-sm font-bold text-white">{label}</h2>
      {count !== undefined && <span className="text-[10px] text-gray-600">{count}</span>}
    </div>
  )
}

function MiniSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} title={label}
      className="w-full px-2 py-1.5 bg-black/40 border border-white/[0.06] rounded-lg text-white text-[10px] focus:border-cyan-500/30 focus:outline-none appearance-none">
      <option value="" className="bg-black">{placeholder}</option>
      {options.map(o => <option key={o} value={o} className="bg-black">{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
    </select>
  )
}

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors"><X size={9} /></button>
    </span>
  )
}

export default function ExplorePage() {
  return <ErrorBoundary><ExplorePageContent /></ErrorBoundary>
}
