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

      {/* Main Content Area - Scrollable 2x2 Song Grids */}
      <main className="flex-1 overflow-y-auto pb-96">
        {loading ? (
          <div className="px-4 py-8 space-y-8">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="h-6 w-32 bg-white/5 rounded mb-4 animate-pulse"></div>
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="bg-white/5 backdrop-blur-xl rounded-xl h-64 animate-pulse"></div>
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
                <h2 className="text-lg font-bold text-white mb-4">
                  {sectionTitles[sectionIndex % sectionTitles.length]}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {sectionMedia.map((media) => {
                const isCurrentlyPlaying = playingId === media.id
                
                return (
                <div 
                  key={media.id} 
                  className={`group relative backdrop-blur-xl rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
                    isCurrentlyPlaying
                      ? 'bg-teal-500/20 shadow-lg shadow-cyan-400/30 ring-2 ring-cyan-400/50'
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
                        <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                          {isCurrentlyPlaying && isPlaying ? (
                            <Pause className="text-white" size={20} />
                          ) : (
                            <Play className="text-white ml-0.5" size={20} />
                          )}
                        </div>
                      </div>
                      
                      {/* Playing Indicator */}
                      {isCurrentlyPlaying && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full shadow-lg">
                          <Radio size={10} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
                          <span className="text-xs font-bold text-white">PLAYING</span>
                        </div>
                      )}
                      
                      {/* Metadata Tags Overlay */}
                      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
                        {media.genre && (
                          <span className="px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-full text-xs text-teal-300 font-semibold">{media.genre}</span>
                        )}
                        {media.bpm && (
                          <span className="px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-full text-xs text-cyan-300 font-semibold">{media.bpm} BPM</span>
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
                        className="text-xs text-teal-400 hover:text-cyan-300 font-semibold transition-colors inline-block truncate w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        @{media.users?.username || 'Unknown Artist'}
                      </Link>
                      
                      {/* Mood Badge */}
                      {media.mood && (
                        <div className="mt-2 inline-block px-2 py-0.5 bg-teal-500/10 backdrop-blur-sm border border-teal-500/30 rounded-full text-xs text-teal-300 font-medium">
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
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Artist Profiles Line - Above Search Bar */}
      {!loading && artists.length > 0 && (
        <div className="fixed bottom-40 left-0 right-0 z-40 bg-black/70 backdrop-blur-lg border-t border-teal-500/20 py-3">
          <div className="flex gap-3 overflow-x-auto px-4 scrollbar-hide">
            {artists.map((artist) => (
              <Link 
                key={artist.user_id}
                href={`/u/${artist.username}`}
                className="flex-shrink-0 group"
              >
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-teal-500/20 border border-teal-500/20 hover:border-cyan-400/50 rounded-full transition-all">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-teal-400/50 group-hover:border-cyan-400 transition-all shadow-lg shadow-teal-500/30">
                    <img 
                      src={artist.avatar || '/default-avatar.png'} 
                      alt={artist.username}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-semibold text-white whitespace-nowrap">
                    {formatUsername(artist.username)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bottom-Docked Glass Morphism Search Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-gradient-to-t from-black/98 via-black/90 to-transparent backdrop-blur-2xl border-t border-teal-500/30 shadow-2xl shadow-cyan-500/20">
          <div className="px-4 py-6">
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-teal-400" size={22} />
                <input
                  type="text"
                  placeholder="Search for tracks, artists, genres..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && fetchCombinedMedia()}
                  className="w-full pl-14 pr-32 py-5 bg-white/10 backdrop-blur-xl border-2 border-teal-500/30 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-500/30 rounded-2xl transition-all text-base font-medium"
                  style={{
                    background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                  }}
                />
                <button 
                  onClick={() => fetchCombinedMedia()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60 hover:scale-105"
                >
                  Search
                </button>
              </div>
              
              {/* Now Playing Mini Bar */}
              {currentTrack && (
                <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 backdrop-blur-xl border border-teal-400/40 rounded-xl shadow-lg">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                    <img 
                      src={currentTrack.image_url} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Radio size={16} className="text-teal-400 animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{currentTrack.title || 'Untitled Track'}</p>
                    <p className="text-xs text-teal-300 truncate">@{formatUsername(currentTrack.users?.username || currentTrack.username)}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
                        <Pause size={20} className="text-white" />
                      ) : (
                        <Play size={20} className="text-white ml-0.5" />
                      )}
                    </button>
                    <button 
                      onClick={handleNext}
                      className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-all"
                    >
                      <SkipForward size={16} className="text-white" />
                    </button>
                  </div>
                </div>
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
