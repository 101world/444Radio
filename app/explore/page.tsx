'use client'

import { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import FloatingNavButton from '../components/FloatingNavButton'
import { Search, Play, Pause, ArrowLeft, FileText, Radio as RadioIcon, Users, Music, X, SlidersHorizontal, Heart, TrendingUp, Disc3, Headphones, Zap, Clock, Hash, ChevronRight, Sparkles } from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { supabase } from '@/lib/supabase'
import { ExploreGridSkeleton } from '../components/LoadingSkeleton'
import LikeButton from '../components/LikeButton'
import ErrorBoundary from '../components/ErrorBoundary'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))
const LyricsModal = lazy(() => import('../components/LyricsModal'))

interface CombinedMedia {
  id: string
  title: string
  audio_url: string
  audioUrl?: string
  image_url: string
  imageUrl?: string
  audio_prompt: string
  image_prompt: string
  user_id: string
  username?: string
  likes: number
  plays: number
  created_at: string
  users: { username: string }
  genre?: string
  mood?: string
  bpm?: number
  vocals?: string
  language?: string
  tags?: string[]
  description?: string
  key_signature?: string
  instruments?: string[]
  secondary_genre?: string
  is_explicit?: boolean
  duration_seconds?: number
  artist_name?: string
  featured_artists?: string[]
  release_type?: string
}

interface Artist {
  username: string
  user_id: string
  avatar: string
  trackCount: number
}

interface LiveStation {
  id: string
  title: string
  coverUrl: string | null
  isLive: boolean
  listenerCount: number
  owner: {
    userId: string
    username: string
    profileImage: string | null
  }
}

// Genre color mapping for visual variety
const GENRE_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  'lofi': { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
  'hiphop': { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  'hip-hop': { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  'jazz': { bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
  'chill': { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/30', glow: 'shadow-teal-500/20' },
  'rnb': { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30', glow: 'shadow-pink-500/20' },
  'r&b': { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30', glow: 'shadow-pink-500/20' },
  'techno': { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  'electronic': { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
  'pop': { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
  'rock': { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  'indie': { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'classical': { bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30', glow: 'shadow-slate-500/20' },
  'ambient': { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
  'trap': { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  'house': { bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30', glow: 'shadow-violet-500/20' },
  'reggae': { bg: 'bg-green-500/15', text: 'text-green-300', border: 'border-green-500/30', glow: 'shadow-green-500/20' },
  'latin': { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
  'k-pop': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30', glow: 'shadow-fuchsia-500/20' },
  'phonk': { bg: 'bg-red-600/15', text: 'text-red-400', border: 'border-red-600/30', glow: 'shadow-red-600/20' },
  'drill': { bg: 'bg-gray-500/15', text: 'text-gray-300', border: 'border-gray-500/30', glow: 'shadow-gray-500/20' },
}

function getGenreStyle(genre?: string) {
  if (!genre) return { bg: 'bg-white/5', text: 'text-gray-400', border: 'border-white/10', glow: '' }
  return GENRE_COLORS[genre.toLowerCase()] || { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', glow: 'shadow-cyan-500/10' }
}

function formatPlays(count: number) {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return count.toString()
}

function formatDuration(seconds?: number) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Track Card Component ───
function TrackCard({ media, isCurrentlyPlaying, isPlaying, onPlay, onLyrics }: {
  media: CombinedMedia
  isCurrentlyPlaying: boolean
  isPlaying: boolean
  onPlay: () => void
  onLyrics: () => void
}) {
  const genreStyle = getGenreStyle(media.genre)

  return (
    <div
      className={`group relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
        isCurrentlyPlaying
          ? 'bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent ring-1 ring-cyan-500/30'
          : 'hover:bg-white/[0.04]'
      }`}
      onClick={onPlay}
    >
      {/* Cover Art */}
      <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden shadow-lg">
        {media.image_url || media.imageUrl ? (
          <Image
            src={media.image_url || media.imageUrl || ''}
            alt={media.title}
            width={48} height={48}
            className="w-full h-full object-cover"
            loading="lazy" quality={75} unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-900/60 to-blue-900/60 flex items-center justify-center">
            <Disc3 size={20} className="text-cyan-400/50" />
          </div>
        )}
        <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity ${
          isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
            isCurrentlyPlaying ? 'bg-cyan-400' : 'bg-white'
          }`}>
            {isCurrentlyPlaying && isPlaying ? (
              <Pause className="text-black" size={12} />
            ) : (
              <Play className="text-black ml-0.5" size={12} />
            )}
          </div>
        </div>
        {isCurrentlyPlaying && isPlaying && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse ring-2 ring-black" />
        )}
      </div>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className={`font-semibold truncate text-sm leading-tight ${
            isCurrentlyPlaying ? 'text-cyan-300' : 'text-white'
          }`}>
            {media.title}
          </h3>
          {media.is_explicit && (
            <span className="flex-shrink-0 text-[8px] bg-white/20 text-white/70 px-1 py-0.5 rounded font-bold leading-none">E</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {media.user_id && media.user_id !== 'undefined' ? (
            <Link
              href={`/profile/${media.user_id}`}
              className="text-xs text-gray-400 hover:text-cyan-400 transition-colors truncate leading-tight"
              onClick={e => e.stopPropagation()}
            >
              {media.users?.username || media.username || 'Unknown'}
            </Link>
          ) : (
            <span className="text-xs text-gray-500 truncate">{media.users?.username || 'Unknown'}</span>
          )}
          {media.genre && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${genreStyle.bg} ${genreStyle.text} ${genreStyle.border} font-medium`}>
              {media.genre}
            </span>
          )}
        </div>
      </div>

      {/* Metadata badges (desktop, hover) */}
      <div className="hidden lg:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {media.bpm && (
          <span className="text-[10px] text-gray-500 flex items-center gap-0.5" title="BPM">
            <Zap size={9} />{media.bpm}
          </span>
        )}
        {media.key_signature && (
          <span className="text-[10px] text-gray-500 flex items-center gap-0.5" title="Key">
            <Hash size={9} />{media.key_signature}
          </span>
        )}
        {media.duration_seconds && (
          <span className="text-[10px] text-gray-500 flex items-center gap-0.5" title="Duration">
            <Clock size={9} />{formatDuration(media.duration_seconds)}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-shrink-0">
        <span className="flex items-center gap-0.5" title="Plays">
          <Headphones size={10} />{formatPlays(media.plays || 0)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <LikeButton releaseId={media.id} initialLikesCount={media.likes || 0} size="sm" showCount={true} />
        <button
          onClick={e => { e.stopPropagation(); onLyrics() }}
          className="p-1.5 hover:bg-purple-500/15 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="View Lyrics"
        >
          <FileText size={13} className="text-purple-400/70" />
        </button>
      </div>
    </div>
  )
}

// ─── Featured Track Card (Large, horizontal scroll) ───
function FeaturedTrackCard({ media, isCurrentlyPlaying, isPlaying, onPlay }: {
  media: CombinedMedia
  isCurrentlyPlaying: boolean
  isPlaying: boolean
  onPlay: () => void
}) {
  const genreStyle = getGenreStyle(media.genre)

  return (
    <div
      className={`group relative flex-shrink-0 w-40 cursor-pointer transition-all duration-300 ${
        isCurrentlyPlaying ? 'scale-[1.02]' : 'hover:scale-[1.03]'
      }`}
      onClick={onPlay}
    >
      <div className={`relative aspect-square rounded-xl overflow-hidden shadow-xl ${
        isCurrentlyPlaying ? `ring-2 ring-cyan-400 ${genreStyle.glow} shadow-2xl` : 'ring-1 ring-white/5'
      }`}>
        {media.image_url ? (
          <Image src={media.image_url} alt={media.title} width={160} height={160}
            className="w-full h-full object-cover" loading="lazy" quality={80} unoptimized />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
            <Disc3 size={40} className="text-cyan-400/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-sm transition-transform group-hover:scale-110 ${
            isCurrentlyPlaying ? 'bg-cyan-400/90' : 'bg-white/90'
          }`}>
            {isCurrentlyPlaying && isPlaying ? (
              <Pause className="text-black" size={20} />
            ) : (
              <Play className="text-black ml-1" size={20} />
            )}
          </div>
        </div>
        {isCurrentlyPlaying && isPlaying && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full">
            <div className="flex items-end gap-[2px] h-3">
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '50%' }} />
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '0.1s' }} />
              <div className="w-[2px] bg-cyan-400 rounded-full animate-pulse" style={{ height: '60%', animationDelay: '0.2s' }} />
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {media.genre && (
            <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full border ${genreStyle.bg} ${genreStyle.text} ${genreStyle.border} font-medium backdrop-blur-sm mb-1`}>
              {media.genre}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <h3 className={`font-semibold text-sm truncate ${isCurrentlyPlaying ? 'text-cyan-300' : 'text-white'}`}>
          {media.title}
        </h3>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {media.users?.username || media.username || 'Unknown'}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
          <span className="flex items-center gap-0.5"><Headphones size={9} /> {formatPlays(media.plays || 0)}</span>
          <span className="flex items-center gap-0.5"><Heart size={9} /> {media.likes || 0}</span>
        </div>
      </div>
    </div>
  )
}


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

  // Lyrics modal
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedLyricsId, setSelectedLyricsId] = useState<string | null>(null)
  const [selectedLyricsTitle, setSelectedLyricsTitle] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const {
    currentTrack: globalCurrentTrack,
    isPlaying: globalIsPlaying,
    playTrack,
    togglePlayPause,
    setPlaylist
  } = useAudioPlayer()

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/create')
    }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  const playingId = globalCurrentTrack?.id || null
  const isPlaying = globalIsPlaying

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
          id: s.id as string,
          title: `${s.username}'s Station`,
          coverUrl: s.current_track_image as string | null,
          isLive: true,
          listenerCount: (s.listener_count || 0) as number,
          owner: {
            userId: s.clerk_user_id as string,
            username: s.username as string,
            profileImage: (s.profile_image || null) as string | null
          }
        })))
      }
    } catch (error) {
      console.error('Failed to fetch live stations:', error)
    }
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
          const username = media.users?.username || media.username
          const userId = media.user_id
          if (username && userId && !artistMap.has(userId)) {
            artistMap.set(userId, { username, user_id: userId, trackCount: 1, avatar: media.image_url })
          } else if (artistMap.has(userId)) {
            artistMap.get(userId)!.trackCount++
          }
        })
        setArtists(Array.from(artistMap.values()).filter(a => a.user_id && a.user_id !== 'undefined').slice(0, 12))

        try {
          const genreRes = await fetch('/api/explore/genre-summary')
          const genreData = await genreRes.json()
          if (genreData.success && Array.isArray(genreData.genres) && genreData.genres.length > 0) {
            setGenres(genreData.genres)
          } else {
            setGenres(['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno'])
          }
        } catch {
          setGenres(['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno'])
        }
      }
    } catch (error) {
      console.error('Failed to fetch media:', error)
    } finally {
      setLoading(false)
    }
  }

  const performSearch = useCallback(async (query: string, filters = searchFilters) => {
    if (!query.trim() && !filters.genre && !filters.mood && !filters.key && !filters.vocals) {
      setSearchResults([])
      setIsSearchActive(false)
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    setIsSearchActive(true)
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
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchFilters])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() || searchFilters.genre || searchFilters.mood) {
        performSearch(searchQuery, searchFilters)
      } else if (isSearchActive) {
        setIsSearchActive(false)
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, performSearch, isSearchActive, searchFilters])

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setIsSearchActive(false)
    setShowFilters(false)
    setSearchFilters({ genre: '', mood: '', bpm_min: '', bpm_max: '', key: '', vocals: '', sort: 'relevance' })
  }

  const handlePlay = (media: CombinedMedia) => {
    if (playingId === media.id && isPlaying) {
      togglePlayPause()
    } else {
      const sourceList = isSearchActive && searchResults.length > 0 ? searchResults : combinedMedia
      const playlistTracks = sourceList.map(m => ({
        id: m.id,
        title: m.title,
        audioUrl: m.audioUrl || m.audio_url,
        imageUrl: m.imageUrl || m.image_url,
        artist: m.users?.username || m.username || 'Unknown Artist',
        userId: m.user_id
      }))
      const startIndex = sourceList.findIndex(m => m.id === media.id)
      setPlaylist(playlistTracks, startIndex >= 0 ? startIndex : 0)
    }
  }

  const openLyrics = (media: CombinedMedia) => {
    setSelectedLyricsId(media.id)
    setSelectedLyricsTitle(media.title)
    setShowLyricsModal(true)
  }

  // Computed data
  const trendingTracks = combinedMedia.slice(0, 20)
  const newReleases = [...combinedMedia].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8)
  const mostPlayed = [...combinedMedia].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 8)
  const activeFilterCount = [searchFilters.genre, searchFilters.mood, searchFilters.key, searchFilters.vocals, searchFilters.bpm_min, searchFilters.bpm_max].filter(Boolean).length

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:pl-20 md:pr-28">
      <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
        <HolographicBackgroundClient />
      </Suspense>

      <div className="md:hidden"><CreditIndicator /></div>
      <FloatingMenu />

      {/* Back / ESC */}
      <button onClick={() => router.push('/create')} className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-black/80 transition-all shadow-lg">
        <ArrowLeft size={20} />
      </button>
      <button onClick={() => router.push('/create')} className="hidden md:flex fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 items-center gap-2 text-cyan-400 hover:bg-black/80 transition-all shadow-lg text-sm font-medium">
        <ArrowLeft size={16} /><span>ESC</span>
      </button>

      <main className="flex-1 overflow-y-auto pb-32 pt-16 sm:pt-0">
        {loading ? (
          <ExploreGridSkeleton />
        ) : combinedMedia.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-2xl font-bold text-white mb-2">No music yet</h2>
            <p className="text-gray-400 mb-8">Be the first to create something amazing!</p>
            <Link href="/" className="inline-block px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all">Create Now</Link>
          </div>
        ) : (
          <div className="space-y-0">

            {/* ═══ HERO BANNER ═══ */}
            <div className="relative h-56 md:h-72 overflow-hidden">
              <div className="absolute inset-0">
                <video autoPlay loop muted playsInline className="w-full h-full object-cover">
                  <source src="/1_1_thm2_rxl1.webm" type="video/webm" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
              </div>
              <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} className="text-cyan-400" />
                  <span className="text-xs font-medium text-cyan-400/80 uppercase tracking-wider">Discover</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                  Explore Music
                </h1>
                <p className="text-sm md:text-base text-gray-400 mt-1 max-w-md">
                  {combinedMedia.length} tracks from {artists.length} artists
                </p>
              </div>
            </div>

            {/* ═══ STICKY SEARCH & NAV ═══ */}
            <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.06]">
              <div className="px-4 md:px-6 pt-3 pb-2">
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1 group">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') performSearch(searchQuery) }}
                      placeholder="Search tracks, artists, genres, moods, tags..."
                      className="w-full pl-10 pr-10 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:border-cyan-500/40 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    />
                    {searchQuery && (
                      <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`relative p-2.5 rounded-xl border transition-all flex-shrink-0 ${
                      showFilters || activeFilterCount > 0
                        ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                        : 'bg-white/[0.04] border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <SlidersHorizontal size={16} />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-[9px] text-black font-bold rounded-full flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Quick genre pills */}
                {!showFilters && !isSearchActive && (
                  <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'trap', 'ambient', 'electronic', 'pop'].map(g => {
                      const style = getGenreStyle(g)
                      return (
                        <button
                          key={g}
                          onClick={() => {
                            const newFilters = { ...searchFilters, genre: searchFilters.genre === g ? '' : g }
                            setSearchFilters(newFilters)
                            performSearch(searchQuery, newFilters)
                          }}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all border ${
                            searchFilters.genre === g
                              ? `${style.bg} ${style.text} ${style.border}`
                              : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/10'
                          }`}
                        >
                          {g}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Expanded Filters Panel */}
                {showFilters && (
                  <div className="mt-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FilterSelect label="Genre" value={searchFilters.genre}
                        onChange={v => { const f = { ...searchFilters, genre: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                        options={['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'electronic', 'pop', 'rock', 'indie', 'classical', 'ambient', 'trap', 'drill', 'house', 'dubstep', 'reggae', 'soul', 'funk', 'blues', 'phonk', 'synthwave']}
                        placeholder="All Genres"
                      />
                      <FilterSelect label="Mood" value={searchFilters.mood}
                        onChange={v => { const f = { ...searchFilters, mood: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                        options={['chill', 'energetic', 'dark', 'uplifting', 'melancholic', 'aggressive', 'romantic', 'dreamy', 'epic', 'peaceful', 'happy', 'sad', 'nostalgic', 'smooth', 'atmospheric']}
                        placeholder="All Moods"
                      />
                      <FilterSelect label="Key" value={searchFilters.key}
                        onChange={v => { const f = { ...searchFilters, key: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                        options={['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm']}
                        placeholder="Any Key"
                      />
                      <FilterSelect label="Vocals" value={searchFilters.vocals}
                        onChange={v => { const f = { ...searchFilters, vocals: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                        options={['instrumental', 'with-lyrics']}
                        placeholder="Any"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">BPM Min</label>
                        <input type="number" value={searchFilters.bpm_min}
                          onChange={e => setSearchFilters({ ...searchFilters, bpm_min: e.target.value })}
                          placeholder="60" className="w-full px-2.5 py-1.5 bg-black/40 border border-white/[0.08] rounded-lg text-white text-xs placeholder-gray-700 focus:border-cyan-500/40 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">BPM Max</label>
                        <input type="number" value={searchFilters.bpm_max}
                          onChange={e => setSearchFilters({ ...searchFilters, bpm_max: e.target.value })}
                          placeholder="200" className="w-full px-2.5 py-1.5 bg-black/40 border border-white/[0.08] rounded-lg text-white text-xs placeholder-gray-700 focus:border-cyan-500/40 focus:outline-none" />
                      </div>
                      <FilterSelect label="Sort By" value={searchFilters.sort}
                        onChange={v => { const f = { ...searchFilters, sort: v }; setSearchFilters(f); performSearch(searchQuery, f) }}
                        options={[{ value: 'relevance', label: 'Relevance' }, { value: 'newest', label: 'Newest' }, { value: 'popular', label: 'Most Liked' }, { value: 'plays', label: 'Most Played' }]}
                        placeholder="Relevance"
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <button onClick={clearSearch} className="text-[11px] text-gray-500 hover:text-white transition-colors">Clear All</button>
                      <button
                        onClick={() => { performSearch(searchQuery, searchFilters); setShowFilters(false) }}
                        className="px-4 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                      >Apply Filters</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tab Navigation */}
              {!isSearchActive && (
                <div className="px-6 flex items-center gap-1">
                  {([
                    { key: 'tracks' as const, label: 'Tracks', icon: Music },
                    { key: 'genres' as const, label: 'Genres', icon: Disc3 },
                    { key: 'stations' as const, label: 'Live', icon: RadioIcon, badge: liveStations.length > 0 ? liveStations.length : undefined },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all ${
                        activeTab === tab.key ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <tab.icon size={15} />
                      {tab.label}
                      {'badge' in tab && tab.badge && (
                        <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/20">
                          {tab.badge}
                        </span>
                      )}
                      {activeTab === tab.key && (
                        <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-cyan-400 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ═══ SEARCH RESULTS ═══ */}
            {isSearchActive && (
              <div className="px-4 md:px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Search size={14} className="text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {isSearching ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
                      </h2>
                      {searchQuery && <p className="text-xs text-gray-500">for &quot;{searchQuery}&quot;</p>}
                    </div>
                  </div>
                  <button onClick={clearSearch} className="text-xs text-gray-500 hover:text-cyan-400 transition-colors flex items-center gap-1">
                    <X size={12} /> Clear
                  </button>
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {searchFilters.genre && <FilterBadge label={`Genre: ${searchFilters.genre}`} color="cyan" onRemove={() => { const f = { ...searchFilters, genre: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                    {searchFilters.mood && <FilterBadge label={`Mood: ${searchFilters.mood}`} color="purple" onRemove={() => { const f = { ...searchFilters, mood: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                    {searchFilters.key && <FilterBadge label={`Key: ${searchFilters.key}`} color="amber" onRemove={() => { const f = { ...searchFilters, key: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                    {searchFilters.vocals && <FilterBadge label={`Vocals: ${searchFilters.vocals}`} color="green" onRemove={() => { const f = { ...searchFilters, vocals: '' }; setSearchFilters(f); performSearch(searchQuery, f) }} />}
                  </div>
                )}

                {isSearching ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                      <Search size={28} className="text-gray-600" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">No results found</h3>
                    <p className="text-gray-500 text-sm">Try different keywords, genres, or filters</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:grid md:grid-cols-3 gap-x-4">
                      {searchResults.map(media => (
                        <TrackCard key={media.id} media={media}
                          isCurrentlyPlaying={playingId === media.id}
                          isPlaying={isPlaying}
                          onPlay={() => handlePlay(media)}
                          onLyrics={() => openLyrics(media)}
                        />
                      ))}
                    </div>
                    <div className="md:hidden space-y-0.5">
                      {searchResults.map(media => (
                        <TrackCard key={media.id} media={media}
                          isCurrentlyPlaying={playingId === media.id}
                          isPlaying={isPlaying}
                          onPlay={() => handlePlay(media)}
                          onLyrics={() => openLyrics(media)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ═══ TRACKS TAB ═══ */}
            {activeTab === 'tracks' && !isSearchActive && (
              <>
                {/* LIVE NOW */}
                {liveStations.length > 0 && (
                  <div className="py-4 px-4 md:px-6 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <h2 className="text-base font-bold text-red-400">Live Now</h2>
                      <span className="text-[10px] bg-red-500/15 text-red-400/80 px-2 py-0.5 rounded-full">{liveStations.length}</span>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {liveStations.filter(s => s.owner.userId && s.owner.userId !== 'undefined').map(station => (
                        <Link key={station.id} href={`/profile/${station.owner.userId}`} className="flex-shrink-0 group">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="relative">
                              <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-red-500/60 ring-offset-2 ring-offset-black">
                                {station.owner.profileImage ? (
                                  <Image src={station.owner.profileImage} alt={station.owner.username} width={56} height={56} className="w-full h-full object-cover" unoptimized />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-red-600/40 to-pink-600/40 flex items-center justify-center">
                                    <Users size={22} className="text-white/60" />
                                  </div>
                                )}
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <div className="w-1 h-1 bg-white rounded-full" /> LIVE
                              </div>
                            </div>
                            <span className="text-[10px] font-medium text-gray-400 truncate max-w-[64px] group-hover:text-white transition-colors">{station.owner.username}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* TRENDING */}
                <section className="py-5 px-4 md:px-6 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                      <TrendingUp size={14} className="text-orange-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Trending</h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {trendingTracks.map(media => (
                      <FeaturedTrackCard key={media.id} media={media}
                        isCurrentlyPlaying={playingId === media.id}
                        isPlaying={isPlaying}
                        onPlay={() => handlePlay(media)}
                      />
                    ))}
                  </div>
                </section>

                {/* ARTISTS */}
                <section className="py-5 px-4 md:px-6 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <Users size={14} className="text-cyan-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Artists</h2>
                  </div>
                  <div className="flex gap-5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {artists.map(artist => (
                      <Link key={artist.user_id} href={`/profile/${artist.user_id}`} className="flex-shrink-0 group">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-16 h-16 rounded-full overflow-hidden ring-1 ring-white/10 group-hover:ring-cyan-400/50 transition-all shadow-lg">
                            {artist.avatar ? (
                              <Image src={artist.avatar} alt={artist.username} width={64} height={64} className="w-full h-full object-cover" loading="lazy" quality={70} unoptimized />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-cyan-600/40 to-blue-600/40 flex items-center justify-center">
                                <Users size={24} className="text-white/50" />
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <p className="text-[11px] font-semibold text-gray-300 group-hover:text-white truncate w-16 transition-colors">{artist.username}</p>
                            <p className="text-[9px] text-gray-600">{artist.trackCount} tracks</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                {/* NEW RELEASES */}
                {newReleases.length > 0 && (
                  <section className="py-5 px-4 md:px-6 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                        <Sparkles size={14} className="text-green-400" />
                      </div>
                      <h2 className="text-lg font-bold text-white">New Releases</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                      {newReleases.map(media => (
                        <FeaturedTrackCard key={`new-${media.id}`} media={media}
                          isCurrentlyPlaying={playingId === media.id}
                          isPlaying={isPlaying}
                          onPlay={() => handlePlay(media)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* MOST PLAYED */}
                {mostPlayed.some(m => (m.plays || 0) > 0) && (
                  <section className="py-5 px-4 md:px-6 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Headphones size={14} className="text-purple-400" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Most Played</h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                      {mostPlayed.filter(m => (m.plays || 0) > 0).map(media => (
                        <FeaturedTrackCard key={`top-${media.id}`} media={media}
                          isCurrentlyPlaying={playingId === media.id}
                          isPlaying={isPlaying}
                          onPlay={() => handlePlay(media)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* ALL TRACKS */}
                <section className="px-4 md:px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <Music size={14} className="text-cyan-400" />
                    </div>
                    <h2 className="text-lg font-bold text-white">All Tracks</h2>
                    <span className="text-xs text-gray-600">{combinedMedia.length}</span>
                  </div>

                  <div className="hidden md:grid md:grid-cols-3 gap-x-4">
                    {combinedMedia.map(media => (
                      <TrackCard key={media.id} media={media}
                        isCurrentlyPlaying={playingId === media.id}
                        isPlaying={isPlaying}
                        onPlay={() => handlePlay(media)}
                        onLyrics={() => openLyrics(media)}
                      />
                    ))}
                  </div>
                  <div className="md:hidden space-y-0.5">
                    {combinedMedia.map(media => (
                      <TrackCard key={media.id} media={media}
                        isCurrentlyPlaying={playingId === media.id}
                        isPlaying={isPlaying}
                        onPlay={() => handlePlay(media)}
                        onLyrics={() => openLyrics(media)}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ═══ GENRES TAB ═══ */}
            {activeTab === 'genres' && !isSearchActive && (
              <div className="px-4 md:px-6 py-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                    <Disc3 size={14} className="text-violet-400" />
                  </div>
                  <h2 className="text-lg font-bold text-white">Browse by Genre</h2>
                </div>

                {genres.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">🎸</div>
                    <h2 className="text-xl font-bold text-white mb-2">No Genres Yet</h2>
                    <p className="text-gray-500 text-sm">Genres appear as artists release tracks</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {genres.map(genre => {
                      const genreTracks = combinedMedia.filter(m => m.genre?.toLowerCase() === genre.toLowerCase())
                      const thumb = genreTracks[0]?.image_url
                      const count = genreTracks.length
                      const gStyle = getGenreStyle(genre)
                      const isGenrePlaying = genreTracks.some(t => t.id === playingId && isPlaying)

                      return (
                        <div
                          key={genre}
                          onClick={() => {
                            if (genreTracks.length > 0) {
                              setPlaylist(genreTracks.map(m => ({
                                id: m.id, title: m.title,
                                audioUrl: m.audioUrl || m.audio_url,
                                imageUrl: m.imageUrl || m.image_url,
                                artist: m.users?.username || m.username || 'Unknown Artist',
                                userId: m.user_id
                              })))
                              playTrack({
                                id: genreTracks[0].id, title: genreTracks[0].title,
                                audioUrl: genreTracks[0].audioUrl || genreTracks[0].audio_url,
                                imageUrl: genreTracks[0].imageUrl || genreTracks[0].image_url,
                                artist: genreTracks[0].users?.username || genreTracks[0].username || 'Unknown Artist',
                                userId: genreTracks[0].user_id
                              })
                            }
                          }}
                          className={`group cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                            isGenrePlaying ? 'ring-2 ring-cyan-400 rounded-xl' : ''
                          }`}
                        >
                          <div className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/10 transition-all">
                            {thumb ? (
                              <Image src={thumb} alt={genre} width={200} height={200} className="w-full h-full object-cover" loading="lazy" quality={75} unoptimized />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-cyan-900/30 to-blue-900/30 flex items-center justify-center">
                                <Disc3 size={40} className="text-cyan-400/20" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col justify-end p-3">
                              <span className={`inline-block self-start text-[10px] px-2 py-0.5 rounded-full border ${gStyle.bg} ${gStyle.text} ${gStyle.border} font-medium backdrop-blur-sm mb-1`}>
                                {count} {count === 1 ? 'track' : 'tracks'}
                              </span>
                              <h3 className="text-white font-bold text-base capitalize">{genre}</h3>
                            </div>
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                                {isGenrePlaying ? <Pause className="text-black" size={24} /> : <Play className="text-black ml-1" size={24} />}
                              </div>
                            </div>
                            {isGenrePlaying && (
                              <div className="absolute top-2 right-2 bg-cyan-400/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                                <span className="text-black text-[9px] font-bold">Playing</span>
                              </div>
                            )}
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
              <div className="px-4 md:px-6 py-6">
                {liveStations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {liveStations.filter(s => s.owner.userId && s.owner.userId !== 'undefined').map(station => (
                      <Link key={station.id} href={`/profile/${station.owner.userId}`} className="group">
                        <div className="bg-gradient-to-br from-red-950/20 to-pink-950/10 border border-red-500/20 rounded-xl p-5 hover:border-red-400/40 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-red-500/50 ring-offset-2 ring-offset-black">
                                {station.owner.profileImage ? (
                                  <Image src={station.owner.profileImage} alt={station.owner.username} width={64} height={64} className="w-full h-full object-cover" unoptimized />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-red-600/40 to-pink-600/40 flex items-center justify-center">
                                    <Users size={24} className="text-white/60" />
                                  </div>
                                )}
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                                <div className="w-1 h-1 bg-white rounded-full" /> LIVE
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-white truncate">{station.title}</h3>
                              <p className="text-sm text-gray-500">@{station.owner.username}</p>
                              <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                                <Users size={11} /><span>{station.listenerCount} listening</span>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-600 group-hover:text-red-400 transition-colors" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                      <RadioIcon size={28} className="text-gray-600" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">No Live Stations</h2>
                    <p className="text-gray-500 text-sm">No one is broadcasting right now</p>
                  </div>
                )}
              </div>
            )}
          </div>
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
    </div>
  )
}

// ─── Helper Components ───
function FilterSelect({ label, value, onChange, options, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: (string | { value: string; label: string })[]
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 bg-black/40 border border-white/[0.08] rounded-lg text-white text-xs focus:border-cyan-500/40 focus:outline-none appearance-none"
      >
        <option value="" className="bg-black">{placeholder}</option>
        {options.map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value
          const lbl = typeof opt === 'string' ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt.label
          return <option key={val} value={val} className="bg-black">{lbl}</option>
        })}
      </select>
    </div>
  )
}

function FilterBadge({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  const colors: Record<string, string> = {
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    green: 'bg-green-500/10 border-green-500/20 text-green-300',
  }
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${colors[color] || colors.cyan}`}>
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors"><X size={10} /></button>
    </span>
  )
}

export default function ExplorePage() {
  return (
    <ErrorBoundary>
      <ExplorePageContent />
    </ErrorBoundary>
  )
}
