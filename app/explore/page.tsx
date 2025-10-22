'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import HolographicBackgroundClient from '../components/HolographicBackgroundClient'
import FloatingNavButton from '../components/FloatingNavButton'
import { Search, Play, Pause, SkipBack, SkipForward, Radio } from 'lucide-react'
import { formatUsername } from '../../lib/username'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'

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

export default function ExplorePage() {
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchBox, setShowSearchBox] = useState(true)
  
  const { 
    currentTrack: globalCurrentTrack, 
    isPlaying: globalIsPlaying, 
    playTrack, 
    togglePlayPause,
    playNext: globalPlayNext,
    playPrevious: globalPlayPrevious,
    setPlaylist
  } = useAudioPlayer()

  // Use global player state
  const playingId = globalCurrentTrack?.id || null
  const isPlaying = globalIsPlaying

  useEffect(() => {
    fetchCombinedMedia()
  }, [])

  const fetchCombinedMedia = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/explore')
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

  const handleNext = () => {
    globalPlayNext()
  }

  const handlePrevious = () => {
    globalPlayPrevious()
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Credit Indicator - Mobile Only */}
      <div className="md:hidden">
        <CreditIndicator />
      </div>
      
      {/* Floating Menu - Desktop Only */}
      <FloatingMenu />

      {/* Main Content - 3 Section Layout */}
      <main className="flex-1 overflow-y-auto pb-32">
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
                        <img 
                          src={media.image_url} 
                          alt={media.title}
                          className="w-full h-full object-cover"
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
                        <img 
                          src={artist.avatar} 
                          alt={artist.username}
                          className="w-full h-full object-cover"
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
                        <img 
                          src={media.image_url} 
                          alt={media.title}
                          className="w-full h-full object-cover"
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
                        <Link 
                          href={`/profile/${media.user_id}`}
                          className="text-xs text-gray-300 hover:text-cyan-400 transition-colors truncate block leading-tight mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatUsername(media.users?.username || media.username)}
                        </Link>
                      </div>
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
                        <img 
                          src={media.image_url} 
                          alt={media.title}
                          className="w-full h-full object-cover"
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
                        <Link 
                          href={`/profile/${media.user_id}`}
                          className="text-sm text-gray-300 hover:text-cyan-400 transition-colors truncate block leading-tight mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {formatUsername(media.users?.username || media.username)}
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Unified Search & Player Bar - Matches Home Page Design */}
      {showSearchBox && (
      <div className="fixed bottom-0 left-0 right-0 md:bottom-8 px-4 sm:px-6 lg:px-8 pb-safe md:pb-0 z-50">
        <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
          <div className="group relative">
            {/* Glow Effect - Same as Home Page */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 blur-lg md:blur-xl opacity-30 md:opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
            
            {/* Bar Container - Same style as Home Page */}
            <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/40 md:bg-black/20 backdrop-blur-xl md:backdrop-blur-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-hover:border-cyan-400/60 transition-colors duration-200 shadow-2xl">
              {globalCurrentTrack ? (
                /* Player Mode */
                <>
                  {/* Radio Icon instead of thumbnail */}
                  <Radio 
                    size={20} 
                    className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[22px] md:h-[22px]" 
                  />
                  
                  {/* Track Info */}
                  <div className="flex-1 min-w-0 text-center md:text-left">
                    <div className="text-sm md:text-lg font-light text-gray-200 tracking-wide truncate">
                      {globalCurrentTrack.title}
                    </div>
                    <div className="text-xs text-cyan-400/60 mt-0.5 font-mono truncate">
                      {globalCurrentTrack.artist}
                    </div>
                  </div>
                  
                  {/* Player Controls */}
                  <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                    <button 
                      onClick={handlePrevious}
                      className="w-8 h-8 md:w-9 md:h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
                    >
                      <SkipBack size={14} className="text-cyan-400" />
                    </button>
                    <button 
                      onClick={togglePlayPause}
                      className="w-10 h-10 md:w-11 md:h-11 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 hover:from-cyan-700 hover:via-cyan-600 hover:to-cyan-500 rounded-full flex items-center justify-center transition-all shadow-lg shadow-cyan-500/50 active:scale-95"
                    >
                      {isPlaying ? (
                        <Pause size={18} className="text-black" />
                      ) : (
                        <Play size={18} className="text-black ml-0.5" />
                      )}
                    </button>
                    <button 
                      onClick={handleNext}
                      className="w-8 h-8 md:w-9 md:h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
                    >
                      <SkipForward size={14} className="text-cyan-400" />
                    </button>
                  </div>
                </>
              ) : (
                /* Search Mode - Same layout as Home Page */
                <>
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
                </>
              )}
            </div>
          </div>
          
          {/* Quick Info - Below the bar */}
          {!globalCurrentTrack && (
            <div className="flex items-center justify-center gap-2 mt-2 md:mt-6 text-xs md:text-sm mb-2">
              <span className="text-cyan-400/60 font-mono tracking-wider">
                ✨ Discover new music
              </span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Floating Navigation Button */}
      <FloatingNavButton 
        showPromptToggle={true}
        onTogglePrompt={() => setShowSearchBox(!showSearchBox)}
      />
    </div>
  )
}
