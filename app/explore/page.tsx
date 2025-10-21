'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import FloatingMenu from '../components/FloatingMenu'
import HolographicBackgroundClient from '../components/HolographicBackgroundClient'
import { Search, Play, Pause, SkipBack, SkipForward, Radio } from 'lucide-react'
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
  genre?: string
  mood?: string
  bpm?: number
  vocals?: string
  language?: string
  tags?: string[]
  description?: string
}

export default function ExplorePage() {
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [currentTrack, setCurrentTrack] = useState<CombinedMedia | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Menu */}
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
                <img 
                  src={combinedMedia[0]?.image_url} 
                  alt="Featured"
                  className="w-full h-full object-cover"
                />
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
            <div className="py-6 px-6 border-b border-white/5">
              <h2 className="text-2xl font-bold mb-3">🔥 Trending Now</h2>
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

            {/* SECTION 3: LIST VIEW - Spotify/Apple Music Style */}
            <div className="px-6 py-6">
              <h2 className="text-2xl font-bold mb-4">🎵 All Tracks</h2>
              
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
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate text-sm">
                          {media.title}
                        </h3>
                        <Link 
                          href={`/profile/${media.user_id}`}
                          className="text-xs text-gray-400 hover:text-cyan-400 transition-colors truncate block"
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
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate">
                          {media.title}
                        </h3>
                        <Link 
                          href={`/profile/${media.user_id}`}
                          className="text-sm text-gray-400 hover:text-cyan-400 transition-colors truncate block"
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

      {/* Floating Unified Search & Player Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl shadow-cyan-500/20 overflow-hidden">
          <div className="flex items-center gap-3 p-3">
            {currentTrack && (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                <img 
                  src={currentTrack.image_url} 
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Radio size={14} className="text-teal-400 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                )}
              </div>
            )}
            
            {currentTrack ? (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentTrack.title || 'Untitled Track'}</p>
                <p className="text-xs text-teal-300 truncate">@{formatUsername(currentTrack.users?.username || currentTrack.username)}</p>
              </div>
            ) : (
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-400" size={18} />
                <input
                  type="text"
                  placeholder="Search tracks, artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchCombinedMedia()}
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 rounded-xl transition-all text-sm"
                />
              </div>
            )}
            
            <div className="flex items-center gap-2">
              {currentTrack && (
                <>
                  <button 
                    onClick={handlePrevious}
                    className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
                  >
                    <SkipBack size={16} className="text-white" />
                  </button>
                  <button 
                    onClick={() => currentTrack && handlePlay(currentTrack)}
                    className="w-11 h-11 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 rounded-lg flex items-center justify-center transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/50"
                  >
                    {isPlaying ? (
                      <Pause size={18} className="text-white" />
                    ) : (
                      <Play size={18} className="text-white ml-0.5" />
                    )}
                  </button>
                  <button 
                    onClick={handleNext}
                    className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
                  >
                    <SkipForward size={16} className="text-white" />
                  </button>
                </>
              )}
              
              {!currentTrack && (
                <button 
                  onClick={() => fetchCombinedMedia()}
                  className="px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 hover:scale-105"
                >
                  Search
                </button>
              )}
            </div>
          </div>
        </div>
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
