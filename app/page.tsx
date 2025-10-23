'use client'

import { useRouter } from 'next/navigation'
import { Music, Play, Pause, Sparkles } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useAudioPlayer } from './contexts/AudioPlayerContext'
import CreditIndicator from './components/CreditIndicator'
import FloatingNavButton from './components/FloatingNavButton'

// Lazy load heavy 3D components for better performance
const HolographicBackgroundClient = lazy(() => import('./components/HolographicBackgroundClient'))
const FloatingGenres = lazy(() => import('./components/FloatingGenres'))

interface Track {
  id: string
  title: string
  artist: string
  audio_url: string
  image_url?: string
}

export default function HomePage() {
  const router = useRouter()
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
        interface MediaItem {
          id: string
          title?: string
          users?: { username?: string }
          username?: string
          audio_url: string
          image_url?: string
        }
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
    
    // If already playing and has a track, just toggle
    if (currentTrack && isPlaying) {
      togglePlayPause()
      return
    }
    
    // Convert tracks to audio player format and start playing
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden" data-version="3.0">
      {/* Holographic 3D Background - Lazy loaded */}
      <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
        <HolographicBackgroundClient />
      </Suspense>
      
      {/* Floating Genre Texts - Lazy loaded */}
      <Suspense fallback={null}>
        <FloatingGenres />
      </Suspense>
      
      {/* Main Content Wrapper */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Credit Indicator - Mobile Only */}
        <div className="md:hidden">
          <CreditIndicator />
        </div>
        
        {/* Floating Menu - Desktop Only */}
        <FloatingMenu />

        {/* Landing View - Centered Hero */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 pb-40 md:pb-32">
          
          {/* Hero Section - Always Visible */}
          <div className="relative z-20 w-full max-w-4xl mx-auto text-center space-y-8">
            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text tracking-wider leading-tight" style={{
              textShadow: '0 0 40px rgba(34, 211, 238, 0.6)',
              fontFamily: 'Anton, Impact, Arial Black, sans-serif',
              fontWeight: 900
            }}>
              444 RADIO
            </h1>
            
            {/* Large Play Button */}
            <div className="mt-12 md:mt-16">
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="group relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-400/70 disabled:shadow-gray-500/30 mx-auto"
              >
                {currentTrack && isPlaying ? (
                  <Pause className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-black" fill="currentColor" />
                ) : (
                  <Play className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-black ml-1" fill="currentColor" />
                )}
                
                {/* Pulse animation when not playing and enabled */}
                {(!currentTrack || !isPlaying) && tracks.length > 0 && (
                  <div className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping"></div>
                )}
              </button>
            </div>

            {/* Describe Your Sound Bar - Integrated */}
            <div className="mt-16 md:mt-20">
              <button
                onClick={() => router.push('/create')}
                className="w-full max-w-2xl mx-auto flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-cyan-600/20 to-cyan-400/20 hover:from-cyan-600/30 hover:to-cyan-400/30 border border-cyan-500/30 hover:border-cyan-400/50 rounded-full transition-all duration-300 group"
              >
                <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                <span className="flex-1 text-left text-sm md:text-base text-gray-300 group-hover:text-white transition-colors">
                  Describe your sound...
                </span>
                <div className="text-xs text-cyan-400/60 font-mono hidden md:block">
                  Press to create
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Navigation Button */}
      <FloatingNavButton />
    </div>
  )
}
