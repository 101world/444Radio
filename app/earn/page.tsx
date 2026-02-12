'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { 
  Play, Pause, Download, Heart, Search, TrendingUp, Clock, Music2, 
  Filter, X, Sparkles, DollarSign, ChevronDown, ExternalLink,
  Users, Award, Zap, ArrowLeft
} from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import LikeButton from '../components/LikeButton'
import FloatingMenu from '../components/FloatingMenu'
import FloatingNavButton from '../components/FloatingNavButton'
import CreditIndicator from '../components/CreditIndicator'
import ArtistProfileModal from './components/ArtistProfileModal'
import DownloadModal from './components/DownloadModal'
import SuccessModal from './components/SuccessModal'
import ListTrackModal from './components/ListTrackModal'
import TrackCard from './components/TrackCard'

// Types
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
  listed_on_earn: boolean
  earn_price: number
  artist_share: number
  admin_share: number
}

interface ArtistInfo {
  user_id: string
  username: string
  avatar_url?: string
  bio?: string
  trackCount: number
  totalDownloads: number
  totalPlays: number
}

type FilterType = 'most_downloaded' | 'latest' | 'trending'

export default function EarnPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { currentTrack, isPlaying, playTrack, togglePlayPause, setPlaylist } = useAudioPlayer()

  // State
  const [tracks, setTracks] = useState<EarnTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [credits, setCredits] = useState(0)
  const [filter, setFilter] = useState<FilterType>('trending')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [genres, setGenres] = useState<string[]>(['All'])

  // Modal state
  const [selectedArtist, setSelectedArtist] = useState<ArtistInfo | null>(null)
  const [downloadTrack, setDownloadTrack] = useState<EarnTrack | null>(null)
  const [successData, setSuccessData] = useState<{ track: EarnTrack; splitJobId?: string } | null>(null)
  const [showListModal, setShowListModal] = useState(false)

  // Fetch tracks
  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ 
        filter, 
        genre: selectedGenre === 'All' ? '' : selectedGenre,
        q: searchQuery 
      })
      const res = await fetch(`/api/earn/tracks?${params}`)
      const data = await res.json()
      if (data.success) {
        setTracks(data.tracks || [])
        if (data.genres?.length) {
          setGenres(['All', ...data.genres])
        }
      }
    } catch (err) {
      console.error('Failed to fetch earn tracks:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, selectedGenre, searchQuery])

  // Fetch credits
  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setCredits(data.credits || 0)
    } catch {
      setCredits(0)
    }
  }, [])

  useEffect(() => {
    fetchTracks()
  }, [fetchTracks])

  useEffect(() => {
    if (isSignedIn) fetchCredits()
  }, [isSignedIn, fetchCredits])

  // Play handler — integrate with global audio player
  const handlePlay = useCallback((track: EarnTrack) => {
    const audioTrack = {
      id: track.id,
      audioUrl: track.audio_url,
      title: track.title,
      artist: track.username,
      imageUrl: track.image_url,
      userId: track.user_id
    }

    if (currentTrack?.id === track.id) {
      togglePlayPause()
    } else {
      // Set all earn tracks as playlist
      const playlist = tracks.map(t => ({
        id: t.id,
        audioUrl: t.audio_url,
        title: t.title,
        artist: t.username,
        imageUrl: t.image_url,
        userId: t.user_id
      }))
      setPlaylist(playlist)
      playTrack(audioTrack)
    }
  }, [currentTrack, togglePlayPause, playTrack, setPlaylist, tracks])

  // Purchase handler
  const handlePurchase = async (trackId: string, splitStems: boolean) => {
    try {
      const res = await fetch('/api/earn/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, splitStems })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Purchase failed')

      // Optimistic update
      setTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, downloads: (t.downloads || 0) + 1 } : t
      ))
      setCredits(prev => prev - (4 + (splitStems ? 5 : 0)))

      // Show success
      const track = tracks.find(t => t.id === trackId)
      if (track) {
        setDownloadTrack(null)
        setSuccessData({ track, splitJobId: data.splitJobId })
      }
    } catch (err: any) {
      alert(err.message || 'Purchase failed')
      fetchCredits() // Refresh credits on failure
    }
  }

  // Open artist profile
  const handleOpenArtist = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/earn/artist/${userId}`)
      const data = await res.json()
      if (data.success) {
        setSelectedArtist(data.artist)
      }
    } catch {
      console.error('Failed to load artist')
    }
  }, [])

  // Track listing callback
  const handleTrackListed = () => {
    setShowListModal(false)
    fetchTracks()
  }

  // Filtered + searched tracks
  const displayTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase()
    return tracks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.username?.toLowerCase().includes(q) ||
      t.genre?.toLowerCase().includes(q)
    )
  }, [tracks, searchQuery])

  // Stats
  const totalDownloads = useMemo(() => tracks.reduce((s, t) => s + (t.downloads || 0), 0), [tracks])
  const totalArtists = useMemo(() => new Set(tracks.map(t => t.user_id)).size, [tracks])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Nav components */}
      <CreditIndicator />
      <FloatingMenu />
      <FloatingNavButton />

      {/* Main content */}
      <div className="relative z-10 md:ml-20 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">

          {/* Header */}
          <header className="pt-8 pb-6">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => router.push('/create')} className="p-2 rounded-lg hover:bg-white/10 transition">
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <DollarSign size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">EARN</span>
                  </h1>
                  <p className="text-sm text-gray-400">Community marketplace — list tracks, earn credits, discover AI music</p>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl">
                <Music2 size={16} className="text-cyan-400" />
                <span className="text-sm text-gray-300"><strong className="text-white">{tracks.length}</strong> tracks listed</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl">
                <Download size={16} className="text-emerald-400" />
                <span className="text-sm text-gray-300"><strong className="text-white">{totalDownloads}</strong> downloads</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-xl">
                <Users size={16} className="text-purple-400" />
                <span className="text-sm text-gray-300"><strong className="text-white">{totalArtists}</strong> artists earning</span>
              </div>
              <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl backdrop-blur-xl">
                <Zap size={16} className="text-emerald-400" />
                <span className="text-sm text-emerald-300"><strong className="text-white">{credits}</strong> credits</span>
              </div>
            </div>
          </header>

          {/* Filters + Search + List button */}
          <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
            {/* Filter pills */}
            <div className="flex gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl backdrop-blur-xl">
              {([
                { key: 'trending' as FilterType, label: 'Trending', icon: TrendingUp },
                { key: 'most_downloaded' as FilterType, label: 'Most Downloaded', icon: Download },
                { key: 'latest' as FilterType, label: 'Latest', icon: Clock },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    filter === f.key 
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/25' 
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <f.icon size={14} />
                  <span className="hidden sm:inline">{f.label}</span>
                </button>
              ))}
            </div>

            {/* Genre select */}
            <div className="relative">
              <select
                value={selectedGenre}
                onChange={e => setSelectedGenre(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 text-gray-300 text-sm px-4 py-2 pr-8 rounded-xl backdrop-blur-xl focus:outline-none focus:border-cyan-500/50 cursor-pointer"
              >
                {genres.map(g => <option key={g} value={g} className="bg-gray-900">{g}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tracks, artists..."
                className="w-full bg-white/5 border border-white/10 text-white text-sm pl-10 pr-4 py-2 rounded-xl backdrop-blur-xl placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* List Track button */}
            {isSignedIn && (
              <button
                onClick={() => setShowListModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02]"
              >
                <Sparkles size={16} />
                List Your Track
              </button>
            )}
          </section>

          {/* Track Grid */}
          <main>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-xl bg-white/10" />
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-white/10 rounded w-3/4" />
                        <div className="h-3 bg-white/10 rounded w-1/2" />
                        <div className="h-3 bg-white/10 rounded w-1/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : displayTracks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayTracks.map(track => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isCurrentTrack={currentTrack?.id === track.id}
                    isPlaying={currentTrack?.id === track.id && isPlaying}
                    onPlay={() => handlePlay(track)}
                    onDownload={() => setDownloadTrack(track)}
                    onOpenArtist={() => handleOpenArtist(track.user_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Music2 size={32} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No tracks listed yet</h3>
                <p className="text-gray-500 max-w-md mb-6">Be the first to list your AI-generated tracks and start earning credits from the community.</p>
                {isSignedIn && (
                  <button
                    onClick={() => setShowListModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-xl"
                  >
                    <Sparkles size={18} />
                    List Your First Track
                  </button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
      {selectedArtist && (
        <ArtistProfileModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />
      )}
      {downloadTrack && (
        <DownloadModal
          track={downloadTrack}
          userCredits={credits}
          onClose={() => setDownloadTrack(null)}
          onConfirm={(splitStems: boolean) => handlePurchase(downloadTrack.id, splitStems)}
        />
      )}
      {successData && (
        <SuccessModal
          track={successData.track}
          splitJobId={successData.splitJobId}
          onClose={() => setSuccessData(null)}
        />
      )}
      {showListModal && (
        <ListTrackModal
          onClose={() => setShowListModal(false)}
          onListed={handleTrackListed}
        />
      )}
    </div>
  )
}
