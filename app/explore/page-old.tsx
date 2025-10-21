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

  // Group media into 2x2 sections
  const sections = []
  for (let i = 0; i < combinedMedia.length; i += 4) {
    sections.push(combinedMedia.slice(i, i + 4))
  }

  const sectionTitles = ['Trending Now', 'Popular Tracks', 'Fresh Releases', 'More Music', 'Discover', 'Rising Stars']

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Main Content Area - Horizontal Scrolling Sections */}
      <main className="flex-1 overflow-y-auto pb-48">
        {loading ? (
          <div className="px-4 py-8 space-y-8">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="h-6 w-32 bg-white/5 rounded mb-4 animate-pulse"></div>
                <div className="flex gap-3 overflow-x-auto pb-4">
                  {[...Array(8)].map((_, j) => (
                    <div key={j} className="bg-white/5 backdrop-blur-xl rounded-xl w-32 h-32 flex-shrink-0 animate-pulse"></div>
                  ))}
                </div>
              </div>
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
          <div className="space-y-8 px-4 py-6">
            {sections.map((sectionMedia, sectionIndex) => (
              <div key={sectionIndex}>
                <h2 className="text-lg font-bold text-white mb-4 px-2">
                  {sectionTitles[sectionIndex % sectionTitles.length]}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                  {sectionMedia.map((media) => {
                const isCurrentlyPlaying = playingId === media.id
                
                return (
                <div 
                  key={media.id} 
                  className={`flex-shrink-0 group relative backdrop-blur-xl rounded-xl overflow-hidden transition-all duration-200 cursor-pointer w-32 ${
                    isCurrentlyPlaying
                      ? 'ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-400/30'
                      : 'hover:ring-2 hover:ring-white/20'
                  }`}
                  onClick={() => handlePlay(media)}
                >
                  {/* Compact Card Layout */}
                  <div className="flex flex-col">
                    {/* Thumbnail - Small Square */}
                    <div className="relative w-32 h-32 overflow-hidden">
                      <img 
                        src={media.image_url} 
                        alt={media.title}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                          {isCurrentlyPlaying && isPlaying ? (
                            <Pause className="text-white" size={16} />
                          ) : (
                            <Play className="text-white ml-0.5" size={16} />
                          )}
                        </div>
                      </div>
                      
                      {/* Playing Indicator */}
                      {isCurrentlyPlaying && (
                        <div className="absolute top-1 left-1 w-3 h-3 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full shadow-lg animate-pulse"></div>
                      )}
                    </div>
                    
                    {/* Track Info - Compact */}
                    <div className="p-2 bg-black/40 backdrop-blur-sm">
                      <h3 className="text-xs font-bold text-white truncate">
                        {media.title || 'Untitled'}
                      </h3>
                      <p className="text-[10px] text-teal-300 truncate">
                        @{media.users?.username || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Unified Search & Player Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl shadow-cyan-500/20 overflow-hidden">
          {/* Unified Bar */}
          <div className="flex items-center gap-3 p-3">
            {/* Now Playing Thumbnail (if playing) */}
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
            
            {/* Track Info or Search Icon */}
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
            
            {/* Player Controls */}
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
              
              {/* Search Button */}
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
