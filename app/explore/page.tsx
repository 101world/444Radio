'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import FloatingNavButton from '../components/FloatingNavButton'
import { Search, Play, Pause, ArrowLeft, FileText, Radio as RadioIcon, Users, Music, X, SlidersHorizontal, ChevronDown } from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { supabase } from '@/lib/supabase'
import { ExploreGridSkeleton } from '../components/LoadingSkeleton'
import LikeButton from '../components/LikeButton'
import ErrorBoundary from '../components/ErrorBoundary'

// Lazy load heavy 3D background and modals
const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))
const LyricsModal = lazy(() => import('../components/LyricsModal'))

// Note: Cannot export metadata from 'use client' components
// Metadata is set in parent layout

interface CombinedMedia {
  id: string
  title: string
  audio_url: string
  audioUrl?: string // Normalized field for frontend compatibility
  image_url: string
  imageUrl?: string // Normalized field for frontend compatibility
  audio_prompt: string
  image_prompt: string
  user_id: string
  username?: string
  likes: number
  plays: number
  created_at: string
  users: {
    username: string
  }
  genre?: string
  mood?: string
  bpm?: number
  vocals?: string
  language?: string
  tags?: string[]
  description?: string
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

function ExplorePageContent() {
  const router = useRouter()
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [liveStations, setLiveStations] = useState<LiveStation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchBox, setShowSearchBox] = useState(true)
  const [searchResults, setSearchResults] = useState<CombinedMedia[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchActive, setIsSearchActive] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    genre: '',
    mood: '',
    bpm_min: '',
    bpm_max: '',
    key: '',
    vocals: '',
    sort: 'relevance'
  })
  const [activeTab, setActiveTab] = useState<'tracks' | 'genres' | 'stations'>('tracks')
  const [genres, setGenres] = useState<string[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  
  // Lyrics modal state
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedLyricsId, setSelectedLyricsId] = useState<string | null>(null)
  const [selectedLyricsTitle, setSelectedLyricsTitle] = useState<string | null>(null)
  
  const { 
    currentTrack: globalCurrentTrack, 
    isPlaying: globalIsPlaying, 
    playTrack, 
    togglePlayPause,
    setPlaylist
  } = useAudioPlayer()

  // ESC key handler for desktop navigation
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/create')
      }
    }
    
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  // Use global player state
  const playingId = globalCurrentTrack?.id || null
  const isPlaying = globalIsPlaying

  useEffect(() => {
    // Prioritize main content first
    fetchCombinedMedia()
    
    // Defer live stations fetch to not block initial render
    setTimeout(() => {
      fetchLiveStations()
    }, 500)
    
    // Poll for live stations every 30 seconds
    const liveStationsInterval = setInterval(() => {
      fetchLiveStations()
    }, 30000)
    
    return () => clearInterval(liveStationsInterval)
  }, [])

  // Subscribe to combined_media updates to update likes count in realtime
  useEffect(() => {
    const supabaseClient = supabase
    const channel = supabaseClient
      .channel('combined_media')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combined_media' }, (payload) => {
        const updated = payload.new as any
        setCombinedMedia(prev => prev.map(m => m.id === updated.id ? { ...m, likes: updated.likes_count || updated.likes || m.likes, plays: updated.plays || m.plays } : m))
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [])

  const fetchLiveStations = async () => {
    try {
      console.log('🔄 Fetching live stations...')
      const res = await fetch('/api/station')
      const data = await res.json()
      console.log('📡 Live stations API response:', data)
      
      if (data.success && data.stations) {
        console.log('✅ Found', data.stations.length, 'live stations')
        const liveUsers = data.stations.map((s: {
          id: string
          clerk_user_id: string
          username: string
          current_track_image: string | null
          listener_count: number
          profile_image: string | null
        }) => ({
          id: s.id,
          title: `${s.username}'s Station`,
          coverUrl: s.current_track_image,
          isLive: true,
          listenerCount: s.listener_count || 0,
          owner: {
            userId: s.clerk_user_id,
            username: s.username,
            profileImage: s.profile_image || null
          }
        }))
        console.log('📻 Formatted live stations:', liveUsers)
        setLiveStations(liveUsers)
      } else {
        console.log('⚠️ No live stations or invalid response')
      }
    } catch (error) {
      console.error('❌ Failed to fetch live stations:', error)
    }
  }

  const fetchCombinedMedia = async () => {
    setLoading(true)
    try {
      // Fetch ALL tracks (increased limit to show all releases)
      const res = await fetch('/api/media/explore?limit=500')
      const data = await res.json()
      if (data.success) {
        setCombinedMedia(data.combinedMedia)
        
        // Extract unique artists (optimized)
        const artistMap = new Map<string, Artist>()
        data.combinedMedia.forEach((media: CombinedMedia) => {
          const username = media.users?.username || media.username
          const userId = media.user_id
          if (username && userId && !artistMap.has(userId)) {
            artistMap.set(userId, {
              username,
              user_id: userId,
              trackCount: 1,
              avatar: media.image_url
            })
          } else if (artistMap.has(userId)) {
            artistMap.get(userId)!.trackCount++
          }
        })
        // Filter out any artists with undefined user_id before displaying
        const validArtists = Array.from(artistMap.values()).filter(artist => artist.user_id && artist.user_id !== 'undefined')
        setArtists(validArtists.slice(0, 10)) // Only show top 10 valid artists
        
        // Fetch genres from dedicated API
        try {
          const genreRes = await fetch('/api/explore/genre-summary')
          const genreData = await genreRes.json()
          console.log('🎸 Genre API response:', genreData)
          if (genreData.success && Array.isArray(genreData.genres) && genreData.genres.length > 0) {
            setGenres(genreData.genres)
          } else {
            // Fallback to defaults if API fails or returns empty list
            const defaults = ['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno']
            console.warn('⚠️ Using default genres because the API returned no genres', genreData)
            setGenres(defaults)
          }
        } catch (error) {
          console.error('Failed to fetch genres:', error)
          setGenres(['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno'])
        }
      }
    } catch (error) {
      console.error('Failed to fetch media:', error)
    } finally {
      setLoading(false)
    }
  }

  // Search handler with debounce
  const performSearch = async (query: string, filters = searchFilters) => {
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
      
      if (data.success) {
        setSearchResults(data.results)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search on query change
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
  }, [searchQuery])

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
      setShowSearchBox(true) // Show search bar when paused
    } else {
      // Create playlist from current display list (either search results or all tracks)
      const sourceList = isSearchActive && searchResults.length > 0 ? searchResults : combinedMedia
      const playlistTracks = sourceList.map(m => ({
        id: m.id,
        title: m.title,
        audioUrl: m.audioUrl || m.audio_url,
        imageUrl: m.imageUrl || m.image_url,
        artist: m.users?.username || m.username || 'Unknown Artist',
        userId: m.user_id // Include userId for play tracking
      }))
      
      // Find index of the track to play
      const startIndex = combinedMedia.findIndex(m => m.id === media.id)
      
      // Set playlist with correct start index - this will auto-play the track
      setPlaylist(playlistTracks, startIndex >= 0 ? startIndex : 0)
      
      setShowSearchBox(false) // Hide search bar when playing
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:pl-20 md:pr-28">
      {/* 3D Holographic Background - Lazy loaded */}
      <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
        <HolographicBackgroundClient />
      </Suspense>
      
      {/* Credit Indicator - Mobile Only */}
      <div className="md:hidden">
        <CreditIndicator />
      </div>
      
      {/* Floating Menu - Desktop Only */}
      <FloatingMenu />

      {/* Back Button - Mobile (Top Left) */}
      <button
        onClick={() => router.push('/create')}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg"
        title="Back to Create"
      >
        <ArrowLeft size={20} />
      </button>

      {/* ESC Button - Desktop (Top Left) */}
      <button
        onClick={() => router.push('/create')}
        className="hidden md:flex fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 items-center gap-2 text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg text-sm font-medium"
        title="Press ESC to go back"
      >
        <ArrowLeft size={16} />
        <span>ESC</span>
      </button>

      {/* Main Content - 3 Section Layout */}
      <main className="flex-1 overflow-y-auto pb-32 pt-16 sm:pt-0">
        {loading ? (
          <ExploreGridSkeleton />
        ) : combinedMedia.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎵</div>
            <h2 className="text-2xl font-bold text-white mb-2">No music yet</h2>
            <p className="text-gray-400 mb-8">Be the first to create something amazing!</p>
            <Link href="/" className="inline-block px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all">
              Create Now
            </Link>
          </div>
        ) : (
          <div className="space-y-0">
            {/* SECTION 1: TOP BANNER - Full Width, Height 250px */}
            <div className="relative h-64 overflow-hidden">
              <div className="absolute inset-0">
                <video 
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                >
                  <source src="/1_1_thm2_rxl1.webm" type="video/webm" />
                  {/* Fallback for older browsers - you can add MP4 here if needed */}
                  Your browser does not support the video tag.
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
              </div>
              <div className="relative h-full flex items-end p-8">
                <div>
                  <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                    Explore Music
                  </h1>
                  <p className="text-xl text-gray-300">Discover amazing tracks from our community</p>
                </div>
              </div>
            </div>

            {/* TAB NAVIGATION + SEARCH BAR */}
            <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-40">
              {/* Search Bar */}
              <div className="px-4 pt-4 pb-2">
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') performSearch(searchQuery)
                      }}
                      placeholder="Search tracks, artists, genres, tags, keywords, moods..."
                      className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-cyan-500/50 focus:bg-white/8 focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2.5 rounded-xl border transition-all flex-shrink-0 ${
                      showFilters || searchFilters.genre || searchFilters.mood || searchFilters.key || searchFilters.vocals
                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                    title="Filters"
                  >
                    <SlidersHorizontal size={18} />
                  </button>
                </div>

                {/* Quick Filter Pills */}
                {!showFilters && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'trap', 'ambient'].map(g => (
                      <button
                        key={g}
                        onClick={() => {
                          const newFilters = { ...searchFilters, genre: searchFilters.genre === g ? '' : g }
                          setSearchFilters(newFilters)
                          performSearch(searchQuery, newFilters)
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          searchFilters.genre === g
                            ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-300'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}

                {/* Expanded Filters */}
                {showFilters && (
                  <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Genre Filter */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Genre</label>
                        <select
                          value={searchFilters.genre}
                          onChange={e => {
                            const newFilters = { ...searchFilters, genre: e.target.value }
                            setSearchFilters(newFilters)
                            performSearch(searchQuery, newFilters)
                          }}
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="">All Genres</option>
                          {['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'electronic', 'pop', 'rock', 'indie', 'classical', 'ambient', 'trap', 'drill', 'house', 'dubstep', 'reggae', 'soul', 'funk', 'blues', 'phonk', 'synthwave'].map(g => (
                            <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      {/* Mood Filter */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Mood</label>
                        <select
                          value={searchFilters.mood}
                          onChange={e => {
                            const newFilters = { ...searchFilters, mood: e.target.value }
                            setSearchFilters(newFilters)
                            performSearch(searchQuery, newFilters)
                          }}
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="">All Moods</option>
                          {['chill', 'energetic', 'dark', 'uplifting', 'melancholic', 'aggressive', 'romantic', 'dreamy', 'epic', 'peaceful', 'happy', 'sad', 'nostalgic', 'smooth', 'atmospheric'].map(m => (
                            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      {/* Key Filter */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Key</label>
                        <select
                          value={searchFilters.key}
                          onChange={e => {
                            const newFilters = { ...searchFilters, key: e.target.value }
                            setSearchFilters(newFilters)
                            performSearch(searchQuery, newFilters)
                          }}
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="">Any Key</option>
                          {['C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm', 'G', 'Gm', 'A', 'Am', 'B', 'Bm'].map(k => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                      {/* Vocals Filter */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Vocals</label>
                        <select
                          value={searchFilters.vocals}
                          onChange={e => {
                            const newFilters = { ...searchFilters, vocals: e.target.value }
                            setSearchFilters(newFilters)
                            performSearch(searchQuery, newFilters)
                          }}
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="">Any</option>
                          <option value="instrumental">Instrumental</option>
                          <option value="with-lyrics">With Lyrics</option>
                        </select>
                      </div>
                    </div>
                    {/* BPM Range + Sort */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">BPM Min</label>
                        <input
                          type="number"
                          value={searchFilters.bpm_min}
                          onChange={e => {
                            const newFilters = { ...searchFilters, bpm_min: e.target.value }
                            setSearchFilters(newFilters)
                          }}
                          placeholder="60"
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">BPM Max</label>
                        <input
                          type="number"
                          value={searchFilters.bpm_max}
                          onChange={e => {
                            const newFilters = { ...searchFilters, bpm_max: e.target.value }
                            setSearchFilters(newFilters)
                          }}
                          placeholder="200"
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Sort By</label>
                        <select
                          value={searchFilters.sort}
                          onChange={e => {
                            const newFilters = { ...searchFilters, sort: e.target.value }
                            setSearchFilters(newFilters)
                            performSearch(searchQuery, newFilters)
                          }}
                          className="w-full px-2 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500/50 focus:outline-none"
                        >
                          <option value="relevance">Relevance</option>
                          <option value="newest">Newest</option>
                          <option value="popular">Most Liked</option>
                          <option value="plays">Most Played</option>
                        </select>
                      </div>
                    </div>
                    {/* Apply / Clear */}
                    <div className="flex justify-between items-center pt-1">
                      <button
                        onClick={() => {
                          setSearchFilters({ genre: '', mood: '', bpm_min: '', bpm_max: '', key: '', vocals: '', sort: 'relevance' })
                          if (!searchQuery) {
                            setIsSearchActive(false)
                            setSearchResults([])
                          } else {
                            performSearch(searchQuery, { genre: '', mood: '', bpm_min: '', bpm_max: '', key: '', vocals: '', sort: 'relevance' })
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        Clear Filters
                      </button>
                      <button
                        onClick={() => {
                          performSearch(searchQuery, searchFilters)
                          setShowFilters(false)
                        }}
                        className="px-4 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="px-6 py-3">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => setActiveTab('tracks')}
                    className={`relative text-lg font-bold transition-all pb-2 ${
                      activeTab === 'tracks'
                        ? 'text-cyan-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    🎵 All Tracks
                    {activeTab === 'tracks' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('genres'); setSelectedGenre(null) }}
                    className={`relative text-lg font-bold transition-all pb-2 ${
                      activeTab === 'genres'
                        ? 'text-cyan-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    🎛️ Genres
                    {activeTab === 'genres' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('stations')}
                    className={`relative text-lg font-bold transition-all pb-2 flex items-center gap-2 ${
                      activeTab === 'stations'
                        ? 'text-cyan-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <RadioIcon size={18} />
                    Live Stations
                    {liveStations.length > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">
                        {liveStations.length}
                      </span>
                    )}
                    {activeTab === 'stations' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* SEARCH RESULTS */}
            {isSearchActive && (
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Search size={18} className="text-cyan-400" />
                    {isSearching ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
                    {searchQuery && <span className="text-gray-400 font-normal text-sm">for &quot;{searchQuery}&quot;</span>}
                  </h2>
                  <button onClick={clearSearch} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                    Clear Search
                  </button>
                </div>
                
                {isSearching ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">🔍</div>
                    <h3 className="text-lg font-bold text-white mb-2">No results found</h3>
                    <p className="text-gray-400 text-sm">Try different keywords, genres, or filters</p>
                  </div>
                ) : (
                  <>
                    {/* Active filter badges */}
                    {(searchFilters.genre || searchFilters.mood || searchFilters.key || searchFilters.vocals) && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {searchFilters.genre && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-300">
                            Genre: {searchFilters.genre}
                            <button onClick={() => { const f = { ...searchFilters, genre: '' }; setSearchFilters(f); performSearch(searchQuery, f) }}><X size={12} /></button>
                          </span>
                        )}
                        {searchFilters.mood && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-300">
                            Mood: {searchFilters.mood}
                            <button onClick={() => { const f = { ...searchFilters, mood: '' }; setSearchFilters(f); performSearch(searchQuery, f) }}><X size={12} /></button>
                          </span>
                        )}
                        {searchFilters.key && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-300">
                            Key: {searchFilters.key}
                            <button onClick={() => { const f = { ...searchFilters, key: '' }; setSearchFilters(f); performSearch(searchQuery, f) }}><X size={12} /></button>
                          </span>
                        )}
                        {searchFilters.vocals && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-300">
                            Vocals: {searchFilters.vocals}
                            <button onClick={() => { const f = { ...searchFilters, vocals: '' }; setSearchFilters(f); performSearch(searchQuery, f) }}><X size={12} /></button>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Search Results Grid - Desktop */}
                    <div className="hidden md:grid md:grid-cols-4 gap-x-6 gap-y-1">
                      {searchResults.map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        return (
                          <div
                            key={media.id}
                            className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              isCurrentlyPlaying ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' : 'hover:bg-white/5'
                            }`}
                            onClick={() => handlePlay(media)}
                          >
                            <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                              {media.image_url || media.imageUrl ? (
                                <Image src={media.image_url || media.imageUrl || ''} alt={media.title} width={48} height={48} className="w-full h-full object-cover" loading="lazy" quality={70} unoptimized />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
                                  <Music size={20} className="text-cyan-400/40" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                  {isCurrentlyPlaying && isPlaying ? <Pause className="text-black" size={12} /> : <Play className="text-black ml-0.5" size={12} />}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 relative z-10">
                              <h3 className="font-semibold text-white truncate text-sm leading-tight">{media.title}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Link href={`/profile/${media.user_id}`} className="text-xs text-gray-300 hover:text-cyan-400 transition-colors truncate" onClick={e => e.stopPropagation()}>
                                  {media.users?.username || media.username || 'Unknown'}
                                </Link>
                                {media.genre && <span className="text-[10px] text-cyan-500/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">{media.genre}</span>}
                                {media.bpm && <span className="text-[10px] text-gray-500">{media.bpm}bpm</span>}
                              </div>
                            </div>
                            <div onClick={e => e.stopPropagation()}>
                              <LikeButton releaseId={media.id} initialLikesCount={media.likes || 0} size="sm" showCount={true} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Search Results - Mobile */}
                    <div className="md:hidden space-y-1">
                      {searchResults.map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        return (
                          <div
                            key={media.id}
                            className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              isCurrentlyPlaying ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' : 'hover:bg-white/5'
                            }`}
                            onClick={() => handlePlay(media)}
                          >
                            <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden">
                              {media.image_url || media.imageUrl ? (
                                <Image src={media.image_url || media.imageUrl || ''} alt={media.title} width={56} height={56} className="w-full h-full object-cover" loading="lazy" quality={70} unoptimized />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
                                  <Music size={24} className="text-cyan-400/40" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white truncate leading-tight">{media.title}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm text-gray-300 truncate">{media.users?.username || media.username || 'Unknown'}</span>
                                {media.genre && <span className="text-[10px] text-cyan-500/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">{media.genre}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Play size={10} />
                              <span>{media.plays || 0}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TRACKS TAB CONTENT */}
            {activeTab === 'tracks' && !isSearchActive && (
              <>
                {/* LIVE NOW SECTION - Horizontal Scroll */}
                {liveStations.length > 0 && (
                  <div className="py-4 px-6 border-b border-white/5 bg-gradient-to-r from-red-950/20 to-pink-950/20">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xl font-bold relative z-10 flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                          Live Now
                        </span>
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full border border-red-500/30">
                          {liveStations.length} broadcasting
                        </span>
                      </h2>
                    </div>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
                  {liveStations.filter(station => station.owner.userId && station.owner.userId !== 'undefined').map((station) => (
                    <Link
                      key={station.id}
                      href={`/profile/${station.owner.userId}`}
                      className="flex-shrink-0 group cursor-pointer transition-all hover:scale-105"
                    >
                      <div className="flex flex-col items-center gap-2">
                        {/* Profile Picture with Live Indicator */}
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-red-500 ring-offset-2 ring-offset-black">
                            {station.owner.profileImage ? (
                              <Image
                                src={station.owner.profileImage}
                                alt={station.owner.username}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                                <Users size={28} className="text-white" />
                              </div>
                            )}
                          </div>
                          {/* Live Badge */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                            LIVE
                          </div>
                        </div>
                        {/* Username */}
                        <div className="text-center">
                          <div className="text-xs font-bold text-white truncate max-w-[80px]">
                            {station.owner.username}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
                            <Users size={10} />
                            {station.listenerCount}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 2: HORIZONTAL SCROLL - Full Width, Clean, Less Padding */}
            <div className="py-4 px-6 border-b border-white/5">
              <h2 className="text-2xl font-bold mb-3 relative z-10">🔥 Trending Now</h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
                {combinedMedia.slice(0, 20).map((media) => {
                  const isCurrentlyPlaying = playingId === media.id
                  
                  return (
                    <div 
                      key={media.id} 
                      className={`flex-shrink-0 group cursor-pointer rounded-lg overflow-hidden transition-all ${
                        isCurrentlyPlaying ? 'ring-2 ring-cyan-400 scale-105' : 'hover:scale-105'
                      }`}
                      onClick={() => handlePlay(media)}
                    >
                      <div className="relative w-32 h-32">
                        {media.image_url ? (
                          <Image 
                            src={media.image_url} 
                            alt={media.title}
                            width={128}
                            height={128}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            quality={75}
                            placeholder="blur"
                            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzAwMDUxMSIvPjwvc3ZnPg=="
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
                            <Music size={48} className="text-cyan-400/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                            {isCurrentlyPlaying && isPlaying ? (
                              <Pause className="text-black" size={20} />
                            ) : (
                              <Play className="text-black ml-1" size={20} />
                            )}
                          </div>
                        </div>
                        {isCurrentlyPlaying && isPlaying && (
                          <div className="absolute top-2 right-2 w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* NEW SECTION: ARTIST PROFILES - Circular Horizontal Scroll */}
            <div className="py-4 px-6 border-b border-white/5">
              <h2 className="text-2xl font-bold mb-3 relative z-10">👥 Artists</h2>
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
                {artists.filter(artist => artist.user_id && artist.user_id !== 'undefined').map((artist) => (
                  <Link 
                    key={artist.user_id}
                    href={`/profile/${artist.user_id}`}
                    className="flex-shrink-0 group cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-2">
                      {/* Circular Avatar */}
                      <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-cyan-400 transition-all">
                        {artist.avatar ? (
                          <Image 
                            src={artist.avatar} 
                            alt={artist.username}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            quality={70}
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                            <Users size={32} className="text-white" />
                          </div>
                        )}
                      </div>
                      {/* Artist Name */}
                      <div className="text-center relative z-10">
                        <p className="text-xs font-semibold text-white truncate w-20">
                          {artist.username || 'Unknown Artist'}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {artist.trackCount} {artist.trackCount === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* SECTION 3: LIST VIEW - Spotify/Apple Music Style */}
            <div className="px-6 py-4">
              <h2 className="text-2xl font-bold mb-3 relative z-10">🎵 All Tracks</h2>
              
              {/* Desktop: 4 Column List View */}
              <div className="hidden md:grid md:grid-cols-4 gap-x-6 gap-y-1">
                {combinedMedia.map((media, index) => {
                  const isCurrentlyPlaying = playingId === media.id
                  
                  return (
                    <div 
                      key={media.id} 
                      className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                        isCurrentlyPlaying 
                          ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => handlePlay(media)}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                        {media.image_url || media.imageUrl ? (
                          <Image 
                            src={media.image_url || media.imageUrl || ''} 
                            alt={media.title}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            quality={70}
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
                            <Music size={20} className="text-cyan-400/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                            {isCurrentlyPlaying && isPlaying ? (
                              <Pause className="text-black" size={12} />
                            ) : (
                              <Play className="text-black ml-0.5" size={12} />
                            )}
                          </div>
                        </div>
                        {isCurrentlyPlaying && isPlaying && (
                          <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      
                      {/* Track Info */}
                      <div className="flex-1 min-w-0 relative z-10">
                        <h3 className="font-semibold text-white truncate text-sm leading-tight">
                          {media.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {media.user_id && media.user_id !== 'undefined' ? (
                            <Link 
                              href={`/profile/${media.user_id}`}
                              className="text-xs text-gray-300 hover:text-cyan-400 transition-colors truncate leading-tight"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {media.users?.username || media.username || 'Unknown Artist'}
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-300 truncate leading-tight">
                              {media.users?.username || media.username || 'Unknown Artist'}
                            </span>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <div className="flex items-center gap-0.5">
                              <Play size={9} />
                              <span>{media.plays || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Like Button */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <LikeButton
                          releaseId={media.id}
                          initialLikesCount={media.likes || 0}
                          size="sm"
                          showCount={true}
                        />
                      </div>
                      
                      {/* Lyrics Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLyricsId(media.id)
                          setSelectedLyricsTitle(media.title)
                          setShowLyricsModal(true)
                        }}
                        className="p-1.5 hover:bg-purple-500/20 rounded-lg transition-colors border border-purple-500/30 flex-shrink-0 opacity-0 group-hover:opacity-100"
                        title="View Lyrics"
                      >
                        <FileText size={14} className="text-purple-400" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Mobile: Single Column List View */}
              <div className="md:hidden space-y-1">
                {combinedMedia.map((media) => {
                  const isCurrentlyPlaying = playingId === media.id
                  
                  return (
                    <div 
                      key={media.id} 
                      className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isCurrentlyPlaying 
                          ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => handlePlay(media)}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden">
                        {media.image_url || media.imageUrl ? (
                          <Image 
                            src={media.image_url || media.imageUrl || ''} 
                            alt={media.title}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            quality={70}
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
                            <Music size={24} className="text-cyan-400/40" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                            {isCurrentlyPlaying && isPlaying ? (
                              <Pause className="text-black" size={14} />
                            ) : (
                              <Play className="text-black ml-0.5" size={14} />
                            )}
                          </div>
                        </div>
                        {isCurrentlyPlaying && isPlaying && (
                          <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      
                      {/* Track Info */}
                      <div className="flex-1 min-w-0 relative z-10">
                        <h3 className="font-semibold text-white truncate leading-tight">
                          {media.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {media.user_id && media.user_id !== 'undefined' ? (
                            <Link 
                              href={`/profile/${media.user_id}`}
                              className="text-sm text-gray-300 hover:text-cyan-400 transition-colors truncate leading-tight"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {media.users?.username || media.username || 'Unknown Artist'}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-300 truncate leading-tight">
                              {media.users?.username || media.username || 'Unknown Artist'}
                            </span>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="flex items-center gap-0.5">
                              <Play size={10} />
                              <span>{media.plays || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Like Button */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <LikeButton
                          releaseId={media.id}
                          initialLikesCount={media.likes || 0}
                          size="sm"
                          showCount={true}
                        />
                      </div>
                      
                      {/* Lyrics Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedLyricsId(media.id)
                          setSelectedLyricsTitle(media.title)
                          setShowLyricsModal(true)
                        }}
                        className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors border border-purple-500/30 flex-shrink-0"
                        title="View Lyrics"
                      >
                        <FileText size={16} className="text-purple-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
              </>
            )}

            {/* GENRES TAB CONTENT */}
            {activeTab === 'genres' && !isSearchActive && (
              <div className="px-6 py-8">
                {genres.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎸</div>
                    <h2 className="text-2xl font-bold text-white mb-2">No Genres Yet</h2>
                    <p className="text-gray-400 mb-8">Genres will appear as artists release tracks with genre tags</p>
                    <button
                      onClick={() => setActiveTab('tracks')}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-cyan-500/30"
                    >
                      Browse All Tracks
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold mb-6 relative z-10">🎸 Browse by Genre</h2>
                    
                    {/* Genre Thumbnails Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      {genres.map((genre) => {
                        // Get all tracks for this genre
                        const genreTracks = combinedMedia.filter(m =>
                          m.genre?.toLowerCase() === genre.toLowerCase()
                        )
                        
                        // Get first track's image for thumbnail
                        const thumbnailImage = genreTracks[0]?.image_url
                        const trackCount = genreTracks.length
                        
                        // Check if this genre is currently playing
                        const isGenrePlaying = genreTracks.some(track => 
                          track.id === playingId && isPlaying
                        )

                        const handleGenreClick = () => {
                          if (genreTracks.length > 0) {
                            // Set playlist to all tracks in this genre with userId for play tracking
                            setPlaylist(genreTracks.map(m => ({
                              id: m.id,
                              title: m.title,
                              audioUrl: m.audioUrl || m.audio_url,
                              imageUrl: m.imageUrl || m.image_url,
                              artist: m.users?.username || m.username || 'Unknown Artist',
                              userId: m.user_id // Include userId for play tracking
                            })))
                            
                            // Auto-play the first track with userId
                            playTrack({
                              id: genreTracks[0].id,
                              title: genreTracks[0].title,
                              audioUrl: genreTracks[0].audioUrl || genreTracks[0].audio_url,
                              imageUrl: genreTracks[0].imageUrl || genreTracks[0].image_url,
                              artist: genreTracks[0].users?.username || genreTracks[0].username || 'Unknown Artist',
                              userId: genreTracks[0].user_id // Include userId for play tracking
                            })
                            setShowSearchBox(false)
                          }
                        }

                        return (
                          <div
                            key={genre}
                            onClick={handleGenreClick}
                            className={`group cursor-pointer transition-all hover:scale-105 ${
                              isGenrePlaying ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/30' : ''
                            }`}
                          >
                            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 hover:border-cyan-400/30 transition-all overflow-hidden">
                              {/* Genre Thumbnail */}
                              <div className="relative aspect-square">
                                {thumbnailImage ? (
                                  <Image
                                    src={thumbnailImage}
                                    alt={genre}
                                    width={200}
                                    height={200}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    quality={75}
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-cyan-900/40 to-blue-900/40 flex items-center justify-center">
                                    <Music size={48} className="text-cyan-400/40" />
                                  </div>
                                )}
                                
                                {/* Overlay with Genre Info */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col items-center justify-end p-4">
                                  <h3 className="text-white font-bold text-lg mb-1 capitalize">{genre}</h3>
                                  <p className="text-cyan-400 text-sm font-medium">{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</p>
                                </div>

                                {/* Play Button Overlay */}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                                    {isGenrePlaying ? (
                                      <Pause className="text-black" size={28} />
                                    ) : (
                                      <Play className="text-black ml-1" size={28} />
                                    )}
                                  </div>
                                </div>

                                {/* Playing Indicator */}
                                {isGenrePlaying && (
                                  <div className="absolute top-3 right-3 flex items-center gap-2 bg-cyan-400/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                                    <div className="w-2 h-2 bg-black rounded-full animate-pulse"></div>
                                    <span className="text-black text-xs font-bold">Playing</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STATIONS TAB CONTENT */}
            {activeTab === 'stations' && !isSearchActive && (
              <div className="px-6 py-8">
                {liveStations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveStations.filter(station => station.owner.userId && station.owner.userId !== 'undefined').map((station) => (
                      <Link
                        key={station.id}
                        href={`/profile/${station.owner.userId}`}
                        className="group cursor-pointer transition-all hover:scale-105"
                      >
                        <div className="bg-gradient-to-br from-red-950/20 to-pink-950/20 border border-red-500/30 rounded-xl p-6 hover:border-red-400/50 transition-all">
                          {/* Profile Picture with Live Indicator */}
                          <div className="relative mb-4 flex justify-center">
                            <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-red-500 ring-offset-4 ring-offset-black">
                              {station.owner.profileImage ? (
                                <Image
                                  src={station.owner.profileImage}
                                  alt={station.owner.username}
                                  width={128}
                                  height={128}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                                  <Users size={48} className="text-white" />
                                </div>
                              )}
                            </div>
                            {/* Live Badge */}
                            <div className="absolute bottom-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                              LIVE
                            </div>
                          </div>
                          
                          {/* Station Info */}
                          <div className="text-center">
                            <h3 className="text-xl font-bold text-white mb-2">
                              {station.title}
                            </h3>
                            <p className="text-sm text-gray-400 mb-3">
                              @{station.owner.username}
                            </p>
                            <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Users size={14} />
                                <span>{station.listenerCount} {station.listenerCount === 1 ? 'listener' : 'listeners'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <div className="text-6xl mb-4">📻</div>
                    <h2 className="text-2xl font-bold text-white mb-2">No Live Stations</h2>
                    <p className="text-gray-400">No one is broadcasting right now. Check back later!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Navigation Button */}
      <FloatingNavButton 
        showPromptToggle={false}
      />

      {/* Lyrics Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        {selectedLyricsId && (
          <LyricsModal
            isOpen={showLyricsModal}
            onClose={() => {
              setShowLyricsModal(false)
              setSelectedLyricsId(null)
              setSelectedLyricsTitle(null)
            }}
            mediaId={selectedLyricsId}
            title={selectedLyricsTitle || undefined}
          />
        )}
      </Suspense>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <ErrorBoundary>
      <ExplorePageContent />
    </ErrorBoundary>
  )
}
