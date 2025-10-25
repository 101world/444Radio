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

  // Spacebar play/pause handler for desktop
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        handlePlayAll()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [tracks, currentTrack, isPlaying])

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

      {/* Floating Nav Button and Credit Indicator */}
      <FloatingNavButton />
      <CreditIndicator />

      {/* Floating Menu */}
      <FloatingMenu />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-12 pb-32">
        <div className="text-center max-w-6xl w-full space-y-8 sm:space-y-12">
          {/* Logo */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <div className="relative group cursor-pointer" onClick={() => router.push('/')}>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-600 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse"></div>
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-black rounded-full flex items-center justify-center border-4 border-cyan-400 shadow-lg shadow-cyan-500/50 group-hover:scale-110 transition-transform duration-300">
                <Music className="text-cyan-400 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-4 sm:space-y-6">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text tracking-wider leading-tight" style={{
              textShadow: '0 0 40px rgba(34, 211, 238, 0.4), 0 0 80px rgba(34, 211, 238, 0.2)',
              fontWeight: 900
            }}>
              444 RADIO
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-cyan-100 font-medium tracking-wide max-w-3xl mx-auto" style={{
              textShadow: '0 0 20px rgba(34, 211, 238, 0.3)'
            }}>
              AI-Powered Music Creation
            </p>
          </div>

          {/* Play Button */}
          <div className="flex justify-center pt-4 sm:pt-8">
            <button
              onClick={handlePlayAll}
              disabled={loading || tracks.length === 0}
              className="group relative px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-base sm:text-lg rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <div className="flex items-center gap-3">
                {loading ? (
                  <>
                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    {isPlaying && currentTrack ? (
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                    <span>{isPlaying && currentTrack ? 'PAUSE' : 'PLAY ALL'}</span>
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 opacity-75" />
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Track Count */}
          {!loading && tracks.length > 0 && (
            <p className="text-cyan-400/70 text-sm sm:text-base font-medium">
              {tracks.length} tracks available
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center pt-4 sm:pt-8">
            <button
              onClick={() => router.push('/create')}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-sm sm:text-base rounded-full transition-all duration-300 shadow-lg shadow-green-500/50 hover:shadow-green-500/70 hover:scale-105"
            >
              CREATE MUSIC
            </button>
            <button
              onClick={() => router.push('/explore')}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold text-sm sm:text-base rounded-full transition-all duration-300 border-2 border-white/20 hover:border-white/40 hover:scale-105"
            >
              EXPLORE
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-8 sm:pt-16 max-w-4xl mx-auto">
            <div className="bg-white/5 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-6 hover:bg-white/10 transition-all hover:scale-105 hover:border-cyan-400/50">
              <div className="text-3xl sm:text-4xl mb-3">🎵</div>
              <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-2">AI Generation</h3>
              <p className="text-sm sm:text-base text-gray-400">Create unique music with advanced AI technology</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-6 hover:bg-white/10 transition-all hover:scale-105 hover:border-cyan-400/50">
              <div className="text-3xl sm:text-4xl mb-3">🎨</div>
              <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-2">Custom Covers</h3>
              <p className="text-sm sm:text-base text-gray-400">Design stunning album artwork automatically</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-6 hover:bg-white/10 transition-all hover:scale-105 hover:border-cyan-400/50">
              <div className="text-3xl sm:text-4xl mb-3">⚡</div>
              <h3 className="text-lg sm:text-xl font-bold text-cyan-400 mb-2">Instant Results</h3>
              <p className="text-sm sm:text-base text-gray-400">Get your tracks in seconds, not hours</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-gray-500 text-xs sm:text-sm border-t border-white/5">
        <p>© 2024 444 Radio. Powered by AI. Made with 💙</p>
      </footer>
    </div>
  )
}
