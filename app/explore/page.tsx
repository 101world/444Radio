'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import FloatingNavButton from '../components/FloatingNavButton'
import { Search, Play, Pause, ArrowLeft, FileText, Radio as RadioIcon, Users } from 'lucide-react'
import { formatUsername } from '../../lib/username'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import LyricsModal from '../components/LyricsModal'

// Lazy load heavy 3D background
const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))

interface CombinedMedia {
  id: string
  title: string
  audio_url: string
  image_url: string
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

export default function ExplorePage() {
  const router = useRouter()
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [liveStations, setLiveStations] = useState<LiveStation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchBox, setShowSearchBox] = useState(true)
  
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
    fetchCombinedMedia()
    fetchLiveStations()
  }, [])

  const fetchLiveStations = async () => {
    try {
      const res = await fetch('/api/station')
      const data = await res.json()
      if (data.success && data.stations) {
        const liveUsers = data.stations.map((s: {
          id: string
          user_id: string
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
            userId: s.user_id,
            username: s.username,
            profileImage: s.profile_image || null
          }
        }))
        setLiveStations(liveUsers)
      }
    } catch (error) {
      console.error('Failed to fetch live stations:', error)
    }
  }

  const fetchCombinedMedia = async () => {
    setLoading(true)
    try {
      // Add limit parameter to reduce initial load time
      const res = await fetch('/api/media/explore?limit=50')
      const data = await res.json()
      if (data.success) {
        setCombinedMedia(data.combinedMedia)
        
        // Extract unique artists
        const artistMap = new Map<string, Artist>()
        data.combinedMedia.forEach((media: CombinedMedia) => {
          const username = media.users?.username || media.username
          const userId = media.user_id
          if (username && userId) {
            if (artistMap.has(userId)) {
              artistMap.get(userId)!.trackCount++
            } else {
              artistMap.set(userId, {
                username,
                user_id: userId,
                trackCount: 1,
                avatar: media.image_url
              })
            }
          }
        })
        setArtists(Array.from(artistMap.values()))
      }
    } catch (error) {
      console.error('Failed to fetch media:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = (media: CombinedMedia) => {
    if (playingId === media.id && isPlaying) {
      togglePlayPause()
      setShowSearchBox(true) // Show search bar when paused
    } else {
      // Set the playlist with all combined media
      setPlaylist(combinedMedia.map(m => ({
        id: m.id,
        title: m.title,
        audioUrl: m.audio_url,
        imageUrl: m.image_url,
        artist: formatUsername(m.users?.username || m.username)
      })))
      
      // Play the selected track
      playTrack({
        id: media.id,
        title: media.title,
        audioUrl: media.audio_url,
        imageUrl: media.image_url,
        artist: formatUsername(media.users?.username || media.username)
      })
      setShowSearchBox(false) // Hide search bar when playing
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
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
          <div className="space-y-0">
            {/* Banner skeleton */}
            <div className="h-64 bg-white/5 animate-pulse"></div>
            {/* Horizontal scroll skeleton */}
            <div className="px-6 py-6">
              <div className="h-6 w-32 bg-white/5 rounded mb-4 animate-pulse"></div>
              <div className="flex gap-2 overflow-x-auto">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="w-32 h-32 bg-white/5 rounded-lg flex-shrink-0 animate-pulse"></div>
                ))}
              </div>
            </div>
            {/* Grid skeleton */}
            <div className="px-6 py-6">
              <div className="h-6 w-32 bg-white/5 rounded mb-4 animate-pulse"></div>
              <div className="grid grid-cols-5 gap-4">
                {[...Array(15)].map((_, i) => (
                  <div key={i} className="bg-white/5 rounded-lg h-48 animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
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

            {/* LIVE NOW SECTION - Horizontal Scroll Below Banner */}
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
                  {liveStations.map((station) => (
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
                        />
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
                {artists.map((artist) => (
                  <Link 
                    key={artist.user_id}
                    href={`/profile/${artist.user_id}`}
                    className="flex-shrink-0 group cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-2">
                      {/* Circular Avatar */}
                      <div className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-cyan-400 transition-all">
                        <Image 
                          src={artist.avatar} 
                          alt={artist.username}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          quality={70}
                        />
                      </div>
                      {/* Artist Name */}
                      <div className="text-center relative z-10">
                        <p className="text-xs font-semibold text-white truncate w-20">
                          {formatUsername(artist.username)}
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
                        <Image 
                          src={media.image_url} 
                          alt={media.title}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          quality={70}
                        />
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
                          <Link 
                            href={`/profile/${media.user_id}`}
                            className="text-xs text-gray-300 hover:text-cyan-400 transition-colors truncate leading-tight"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatUsername(media.users?.username || media.username || media.user_id)}
                          </Link>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <div className="flex items-center gap-0.5">
                              <Play size={9} />
                              <span>{media.plays || 0}</span>
                            </div>
                          </div>
                        </div>
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
                        <Image 
                          src={media.image_url} 
                          alt={media.title}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          quality={70}
                        />
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
                          <Link 
                            href={`/profile/${media.user_id}`}
                            className="text-sm text-gray-300 hover:text-cyan-400 transition-colors truncate leading-tight"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatUsername(media.users?.username || media.username || media.user_id)}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="flex items-center gap-0.5">
                              <Play size={10} />
                              <span>{media.plays || 0}</span>
                            </div>
                          </div>
                        </div>
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
          </div>
        )}
      </main>

      {/* Floating Search Bar - No Player Controls */}
      {showSearchBox && (
      <div className="fixed bottom-0 left-0 right-0 md:bottom-8 px-4 sm:px-6 lg:px-8 pb-safe md:pb-0 z-50">
        <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
          <div className="group relative">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 blur-lg md:blur-xl opacity-30 md:opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
            
            {/* Search Bar Container */}
            <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/40 md:bg-black/20 backdrop-blur-xl md:backdrop-blur-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-hover:border-cyan-400/60 transition-colors duration-200 shadow-2xl">
              <Search 
                size={20} 
                className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[22px] md:h-[22px]" 
              />
              <div className="flex-1 text-center md:text-left">
                <input
                  type="text"
                  placeholder="Search tracks, artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchCombinedMedia()}
                  className="w-full bg-transparent text-sm md:text-lg font-light text-gray-200 placeholder-gray-400/60 tracking-wide focus:outline-none"
                />
                <div className="text-xs text-cyan-400/60 mt-0.5 font-mono hidden md:block">
                  Press Enter to search
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Info - Below the bar */}
          <div className="flex items-center justify-center gap-2 mt-2 md:mt-6 text-xs md:text-sm mb-2">
            <span className="text-cyan-400/60 font-mono tracking-wider">
              ✨ Discover new music
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Floating Navigation Button */}
      <FloatingNavButton 
        showPromptToggle={true}
        onTogglePrompt={() => setShowSearchBox(!showSearchBox)}
      />

      {/* Lyrics Modal */}
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
    </div>
  )
}
