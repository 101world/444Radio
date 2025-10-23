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
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile for performance optimization
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
      {/* Holographic 3D Background - Desktop Only for Performance */}
      {!isMobile && (
        <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      )}
      
      {/* Floating Genre Texts - Desktop Only for Performance */}
      {!isMobile && (
        <Suspense fallback={null}>
          <FloatingGenres />
        </Suspense>
      )}
      
      {/* Floating Nav Button and Credit Indicator */}
      <FloatingNavButton />
      <CreditIndicator />
      
      {/* Main Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 md:px-12 pb-40 md:pb-32">
        {/* Hero Section with Integrated Describe Bar */}
        <div className="text-center space-y-8 w-full max-w-3xl">
          {/* Main Title */}
          <h1 className="text-7xl md:text-[10rem] font-black tracking-tighter text-cyan-400"
              style={{ 
                fontFamily: 'Anton, Impact, "Arial Black", sans-serif',
                fontWeight: 900,
                textShadow: '0 0 80px rgba(34, 211, 238, 0.6), 0 0 40px rgba(34, 211, 238, 0.4), 0 0 20px rgba(34, 211, 238, 0.3)'
              }}>
            444 RADIO
          </h1>

          {/* Play Button - Centered */}
          <div className="flex justify-center mt-12">
            <button
              onClick={handlePlayAll}
              disabled={loading || tracks.length === 0}
              className="group relative px-12 py-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-700 rounded-full transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:shadow-[0_0_50px_rgba(34,211,238,0.8)]"
            >
              <div className="flex items-center gap-4">
                {loading ? (
                  <>
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-2xl font-bold text-white">Loading...</span>
                  </>
                ) : currentTrack && isPlaying ? (
                  <>
                    <Pause className="w-8 h-8 text-white fill-white" />
                    <span className="text-2xl font-bold text-white">Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-8 h-8 text-white fill-white" />
                    <span className="text-2xl font-bold text-white">
                      {currentTrack ? 'Resume' : 'Play All'}
                    </span>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Describe Your Sound Input - Integrated */}
          <div className="relative mt-8">
            <input
              type="text"
              placeholder="Describe your sound..."
              onFocus={() => router.push('/create')}
              readOnly
              className="w-full px-6 py-4 bg-white/10 border border-cyan-400/30 rounded-full text-white placeholder-gray-400 cursor-pointer transition-all duration-300 hover:bg-white/15 hover:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
            <Sparkles className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Floating Menu */}
      <FloatingMenu />
    </div>
  )
}
