'use client'

import { useRouter } from 'next/navigation'
import { Music, Play, Pause } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'
import FloatingGenres from './components/FloatingGenres'
import { useAudioPlayer } from './contexts/AudioPlayerContext'
import { useState, useEffect } from 'react'

interface Track {
  id: string
  title: string
  artist: string
  audio_url: string
  image_url?: string
}

interface MediaItem {
  id: string
  title?: string
  users?: { username?: string }
  username?: string
  audio_url: string
  image_url?: string
}

export default function HomePage() {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const { setPlaylist, playTrack, currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()

  useEffect(() => {
    fetchAllTracks()
  }, [])

  const fetchAllTracks = async () => {
    try {
      const res = await fetch('/api/media/explore')
      const data = await res.json()
      if (data.success && data.combinedMedia) {
        const formattedTracks = data.combinedMedia.map((media: MediaItem) => ({
          id: media.id,
          title: media.title || 'Untitled',
          artist: media.users?.username || media.username || 'Unknown Artist',
          audio_url: media.audio_url,
          image_url: media.image_url
        }))
        setTracks(formattedTracks)
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = () => {
    if (tracks.length === 0) return
    
    if (currentTrack && isPlaying) {
      togglePlayPause()
      return
    }
    
    const playerTracks = tracks.map(t => ({
      id: t.id,
      audioUrl: t.audio_url,
      title: t.title,
      artist: t.artist,
      imageUrl: t.image_url
    }))
    
    setPlaylist(playerTracks, 0)
    playTrack(playerTracks[0])
  }

  const handleFocus = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      router.push('/create')
    }, 400)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />

      {/* Floating Genre Texts */}
      <FloatingGenres />

      {/* Dark overlay to reduce clutter */}
      <div className="absolute inset-0 bg-black/60 z-[2]" />

      {/* Main Content Wrapper */}
      <div
        className={\elative z-10 flex-1 flex flex-col transition-opacity duration-500 \\}
      >
        {/* Floating Menu */}
        <FloatingMenu />

        {/* Landing View */}
        <div className="flex-1 flex flex-col items-center md:justify-center px-4 sm:px-6 lg:px-8 pt-16 md:py-8">
          
          {/* Welcome Text */}
          <div className="text-center space-y-2 md:space-y-6 md:mb-16 will-change-auto flex-shrink-0">
            
            {/* Logo & Title */}
            <div className="flex flex-col items-center justify-center gap-2 md:gap-5 md:flex-row">
              <img
                src="/radio-logo.svg"
                alt="444 Radio"
                className="w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 md:transition-transform md:hover:scale-110 md:duration-300"
                style={{ filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.8))' }}
              />
              <h1 
                className="text-3xl md:text-6xl lg:text-8xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight"
                style={{
                  fontFamily: 'Anton, Impact, Arial Black, sans-serif',
                  textShadow: '0 0 30px rgba(34, 211, 238, 0.9), 0 0 60px rgba(34, 211, 238, 0.6), 0 0 90px rgba(34, 211, 238, 0.4)',
                  fontWeight: 900
                }}
              >
                444 RADIO
              </h1>
            </div>

            {/* Tagline */}
            <p className="text-xs md:text-xl lg:text-2xl text-gray-300 font-light tracking-wide max-w-2xl mx-auto px-4">
              A world where music feels infinite.
            </p>

            {/* Feature Pills - Desktop Only */}
            <div className="hidden md:flex flex-wrap items-center justify-center gap-2 lg:gap-3 px-4 max-w-2xl mx-auto mt-8">
              {['Instant Generation', 'High Quality', 'Unlimited Ideas'].map((feature) => (
                <div
                  key={feature}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs lg:text-sm font-mono backdrop-blur-sm hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 cursor-default"
                >
                  {feature}
                </div>
              ))}
            </div>

            {/* Play Button - Always Visible */}
            <div className="mt-6 md:mt-10">
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0 || loading}
                className="group relative w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-400/70 disabled:shadow-gray-500/30 mx-auto"
              >
                {currentTrack && isPlaying ? (
                  <Pause className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-black" fill="currentColor" />
                ) : (
                  <Play className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-black ml-1" fill="currentColor" />
                )}
                
                {(!currentTrack || !isPlaying) && tracks.length > 0 && !loading && (
                  <div className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping"></div>
                )}
              </button>
              
              <p className="text-cyan-500/70 text-xs md:text-sm font-medium tracking-wide mt-3">
                {loading ? 'Loading...' : tracks.length === 0 ? 'No Tracks' : currentTrack && isPlaying ? 'Now Playing' : 'Start Broadcasting'}
              </p>
            </div>
          </div>

          {/* Spacer for mobile */}
          <div className="flex-1 md:hidden"></div>
        </div>

        {/* Prompt Input - Fixed to bottom */}
        <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto px-4 sm:px-6 lg:px-8 pb-safe md:pb-0 z-20">
          <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
            <div
              className="group relative cursor-pointer active:scale-95 md:hover:scale-105 transition-transform duration-200"
              onClick={handleFocus}
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 rounded-3xl blur-lg md:blur-xl opacity-30 md:opacity-40 group-hover:opacity-70 group-active:opacity-60 transition-opacity duration-300"></div>

              {/* Input Container */}
              <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/40 md:bg-black/20 backdrop-blur-xl md:backdrop-blur-3xl rounded-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-active:border-cyan-400/60 md:group-hover:border-cyan-400/60 transition-colors duration-200 shadow-2xl">
                <Music
                  size={20}
                  className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[22px] md:h-[22px]"
                />
                <div className="flex-1 text-center md:text-left">
                  <div className="text-sm md:text-lg font-light text-gray-200 tracking-wide">
                    Describe your sound...
                  </div>
                  <div className="text-xs text-cyan-400/60 mt-0.5 font-mono hidden md:block">
                    Click to start creating
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-2 mt-2 md:mt-6 text-xs md:text-sm mb-2">
              <span className="text-cyan-400/60 font-mono tracking-wider">
                 Tap to create
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-cyan-400 text-lg md:text-2xl font-mono">
            Loading...
          </div>
        </div>
      )}
    </div>
  )
}
