'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import CombinedMediaPlayer from '../components/CombinedMediaPlayer'
import FloatingMenu from '../components/FloatingMenu'
import HolographicBackgroundClient from '../components/HolographicBackgroundClient'
import SocialCTA from '../components/SocialCTA'
import { Search, Play, Pause, Volume2, SkipBack, SkipForward, Radio, TrendingUp, Sparkles } from 'lucide-react'
import { formatUsername } from '../../lib/username'

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
  // Metadata fields
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
  trackCount: number
  avatar?: string
}

export default function ExplorePage() {
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [artists, setArtists] = useState<Artist[]>([])
  const [filter, setFilter] = useState('trending')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [currentTrack, setCurrentTrack] = useState<CombinedMedia | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    fetchCombinedMedia()
  }, [filter])

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
                avatar: media.image_url // Use first track's image as avatar
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
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      setCurrentTrack(media)
      setPlayingId(media.id)
      setIsPlaying(true)
      if (audioRef.current) {
        audioRef.current.src = media.audio_url
        audioRef.current.play()
      }
    }
  }

  const handleNext = () => {
    if (!currentTrack) return
    const currentIndex = combinedMedia.findIndex(m => m.id === currentTrack.id)
    const nextIndex = (currentIndex + 1) % combinedMedia.length
    handlePlay(combinedMedia[nextIndex])
  }

  const handlePrevious = () => {
    if (!currentTrack) return
    const currentIndex = combinedMedia.findIndex(m => m.id === currentTrack.id)
    const prevIndex = (currentIndex - 1 + combinedMedia.length) % combinedMedia.length
    handlePlay(combinedMedia[prevIndex])
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Full Width Header Banner */}
      <div className="relative w-full h-80 overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600 via-cyan-500 to-cyan-400 animate-gradient"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10"></div>
        
        {/* Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-8">
          <div className="flex items-center gap-3 mb-4">
            <Radio size={48} className="text-white animate-pulse" />
            <TrendingUp size={48} className="text-cyan-200" />
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tight">
            Explore
          </h1>
          <p className="text-xl md:text-2xl text-cyan-50 font-medium mb-8">
            Discover the latest tracks from artists worldwide
          </p>
          
          {/* Search Bar */}
          <div className="w-full max-w-2xl flex items-center gap-3">
            <input
              type="text"
              placeholder="Search for tracks, artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-6 py-4 bg-white/20 backdrop-blur-xl border-2 border-white/30 text-white placeholder-white/60 focus:outline-none focus:border-white rounded-2xl transition-all text-lg"
            />
            <button 
              onClick={() => fetchCombinedMedia()}
              className="px-8 py-4 bg-white text-cyan-600 rounded-2xl font-bold hover:scale-105 transition-transform shadow-2xl"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Artist Profiles - Horizontal Scroll */}
      {!loading && artists.length > 0 && (
        <div className="py-8 px-4 md:px-8 border-b border-white/10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={24} className="text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">Featured Artists</h2>
            </div>
            <div className="relative">
              <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                {artists.map((artist) => (
                  <Link 
                    key={artist.user_id}
                    href={`/u/${artist.username}`}
                    className="flex-shrink-0 snap-start group"
                  >
                    <div className="flex flex-col items-center gap-3 w-32 transition-transform hover:scale-105">
                      {/* Circular Avatar */}
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-cyan-400/50 group-hover:border-cyan-400 transition-all shadow-lg shadow-cyan-400/20">
                        <img 
                          src={artist.avatar || '/default-avatar.png'} 
                          alt={artist.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Artist Name */}
                      <div className="text-center">
                        <p className="text-sm font-bold text-white truncate w-full">
                          @{formatUsername(artist.username)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {artist.trackCount} {artist.trackCount === 1 ? 'track' : 'tracks'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Width 4-Column Grid - Clean, Professional */}
      <main className="px-4 md:px-8 py-8 pb-32">
        <div className="w-full">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-xl rounded-xl h-20 animate-pulse"></div>
              ))}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {combinedMedia.map((media) => {
                const isCurrentlyPlaying = playingId === media.id
                
                return (
                <div 
                  key={media.id} 
                  className={`group relative backdrop-blur-xl rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
                    isCurrentlyPlaying
                      ? 'bg-cyan-500/10 shadow-lg shadow-cyan-400/20'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => handlePlay(media)}
                >
                  {/* Vertical Card Layout */}
                  <div className="flex flex-col">
                    {/* Thumbnail - Square */}
                    <div className="relative aspect-square w-full overflow-hidden">
                      <img 
                        src={media.image_url} 
                        alt={media.title}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                          {isCurrentlyPlaying && isPlaying ? (
                            <Pause className="text-white" size={20} />
                          ) : (
                            <Play className="text-white ml-0.5" size={20} />
                          )}
                        </div>
                      </div>
                      
                      {/* Playing Indicator */}
                      {isCurrentlyPlaying && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-cyan-500 rounded-full">
                          <Radio size={10} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
                          <span className="text-xs font-bold text-white">PLAYING</span>
                        </div>
                      )}
                      
                      {/* Metadata Tags Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                        {media.genre && (
                          <span className="px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-full text-xs text-white">{media.genre}</span>
                        )}
                        {media.bpm && (
                          <span className="px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-full text-xs text-white">{media.bpm} BPM</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Track Info */}
                    <div className="p-3">
                      <h3 className="text-sm font-bold text-white truncate mb-1">
                        {media.title || 'Untitled Track'}
                      </h3>
                      <Link 
                        href={`/u/${media.users?.username || 'unknown'}`}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors inline-block truncate w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{media.users?.username || 'Unknown Artist'}
                      </Link>
                      
                      {/* Mood Badge */}
                      {media.mood && (
                        <div className="mt-2 inline-block px-2 py-0.5 bg-white/5 rounded-full text-xs text-gray-400">
                          {media.mood}
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Play size={12} />
                          {media.plays || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Digital Radio Player - Bottom Center */}
      {currentTrack && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gradient-to-r from-cyan-600/95 via-cyan-500/95 to-cyan-600/95 backdrop-blur-2xl border border-cyan-400/30 rounded-2xl shadow-2xl shadow-cyan-500/50 p-4 min-w-[300px] md:min-w-[500px]">
            <div className="flex items-center gap-4">
              {/* Album Art */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                <img 
                  src={currentTrack.image_url} 
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Radio size={20} className="text-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Radio size={12} className="text-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold text-cyan-400">NOW PLAYING</span>
                </div>
                <p className="text-sm font-black text-white truncate">{currentTrack.title || 'Untitled Track'}</p>
                <p className="text-xs text-gray-300 truncate">
                  @{formatUsername(currentTrack.users?.username || currentTrack.username)}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrevious}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
                >
                  <SkipBack size={14} className="text-white" />
                </button>
                <button 
                  onClick={() => currentTrack && handlePlay(currentTrack)}
                  className="w-10 h-10 bg-cyan-500 hover:bg-cyan-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-lg"
                >
                  {isPlaying ? (
                    <Pause size={18} className="text-white" />
                  ) : (
                    <Play size={18} className="text-white ml-0.5" />
                  )}
                </button>
                <button 
                  onClick={handleNext}
                  className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
                >
                  <SkipForward size={14} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social CTA Section */}
      <div className="pb-32">
        <SocialCTA />
      </div>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        onEnded={handleNext}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  )
}
