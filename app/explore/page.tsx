'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import CombinedMediaPlayer from '../components/CombinedMediaPlayer'
import FloatingMenu from '../components/FloatingMenu'
import { Search, Play, Pause, Volume2, SkipBack, SkipForward, Radio } from 'lucide-react'

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
}

export default function ExplorePage() {
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
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
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Search Bar - Minimal, Above Player */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-[#6366f1] text-sm"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#6366f1] hover:bg-[#818cf8] rounded-full transition-all">
            <Search className="text-white" size={14} />
          </button>
        </div>
      </div>

      {/* Full Width/Height Media Grid - Horizontal Scrolling */}
      <main className="pt-20 pb-32 px-4">
        <div className="w-full">
          {loading ? (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-64 h-80 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Row 1 */}
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                {combinedMedia.slice(0, Math.ceil(combinedMedia.length / 3)).map((media) => (
                  <div key={media.id} className="flex-shrink-0 w-64 group relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tracks, artists, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-[#818cf8] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Music Grid - Glassmorphism 3D Cards */}
      <main className="px-3 md:px-6 pb-32">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl animate-pulse"></div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {combinedMedia.map((media) => (
                <div key={media.id} className="group relative">
                  {/* 3D Glassmorphism Card with Playing State */}
                  <div className={`relative aspect-square backdrop-blur-xl rounded-xl overflow-hidden transition-all duration-300 ${
                    playingId === media.id 
                      ? 'bg-[#4f46e5]/30 border-2 border-[#818cf8] shadow-2xl shadow-[#818cf8]/50 scale-[1.02]' 
                      : 'bg-white/5 border border-white/10 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#818cf8]/20 hover:border-[#818cf8]/30'
                  }`}>
                    {/* Image */}
                    <img 
                      src={media.image_url} 
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Playing Indicator */}
                    {playingId === media.id && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-[#818cf8] rounded-full animate-pulse">
                        <Radio size={12} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
                        <span className="text-xs font-bold text-white">LIVE</span>
                      </div>
                    )}
                    
                    {/* Play Button Overlay */}
                    <div 
                      onClick={() => handlePlay(media)}
                      className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer flex items-center justify-center"
                    >
                      <button className="w-16 h-16 bg-[#818cf8] hover:bg-[#7aa5d7] rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-2xl">
                        {playingId === media.id && isPlaying ? (
                          <Pause className="text-white" size={28} />
                        ) : (
                          <Play className="text-white ml-1" size={28} />
                        )}
                      </button>
                    </div>

                    {/* Always Visible Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                      <p className="text-xs font-bold text-white truncate">{media.title}</p>
                      <Link 
                        href={`/u/${media.users?.username || media.username || 'unknown'}`}
                        className="text-xs text-[#818cf8] hover:text-[#7aa5d7] font-semibold"
                      >
                        @{media.users?.username || media.username || 'Unknown User'}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Digital Radio Player - Bottom Center */}
      {currentTrack && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-gradient-to-r from-[#4f46e5]/95 via-[#6366f1]/95 to-[#4f46e5]/95 backdrop-blur-2xl border border-[#818cf8]/30 rounded-2xl shadow-2xl shadow-[#818cf8]/50 p-4 min-w-[300px] md:min-w-[500px]">
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
                    <Radio size={20} className="text-[#818cf8] animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Radio size={12} className="text-[#818cf8] animate-pulse" />
                  <span className="text-xs font-bold text-[#818cf8]">NOW PLAYING</span>
                </div>
                <p className="text-sm font-black text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-gray-300 truncate">
                  @{currentTrack.users?.username || currentTrack.username || 'Unknown'}
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
                  className="w-10 h-10 bg-[#818cf8] hover:bg-[#7aa5d7] rounded-full flex items-center justify-center transition-all transform hover:scale-110 shadow-lg"
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

      {/* Right-Side Vertical Category Slider - Attached to Player Height */}
      {currentTrack && (
        <div className="fixed right-4 bottom-24 z-40 hidden lg:block">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-[#6366f1] scrollbar-track-white/5">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-[#818cf8] mb-2 text-center">CATEGORIES</p>
            {['Trending', 'New', 'Top', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz', 'Rock', 'Classical', 'R&B', 'Country', 'Indie', 'Metal', 'Blues', 'Reggae', 'Folk'].map((category) => (
              <button
                key={category}
                onClick={() => setFilter(category.toLowerCase())}
                className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap transition-all text-sm ${
                  filter === category.toLowerCase()
                    ? 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white shadow-lg'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        onEnded={handleNext}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Bottom-Docked Category Tabs with Horizontal Scroll */}
      <div className="fixed bottom-0 left-0 right-0 p-3 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-2 shadow-2xl">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2">
              {['Trending', 'New', 'Top', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz', 'Rock', 'Classical', 'R&B', 'Country'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f.toLowerCase())}
                  className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all text-sm ${
                    filter === f.toLowerCase()
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

