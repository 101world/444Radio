'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Play, Pause, Shuffle, Repeat, Music2, SkipBack, SkipForward, X, Gift } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import SEOHeroSection from './components/SEOHeroSection'
import { useState, useEffect, lazy, Suspense } from 'react'
import { useAudioPlayer } from './contexts/AudioPlayerContext'
import Link from 'next/link'

// Lazy load heavy 3D components for better performance
const HolographicBackgroundClient = lazy(() => import('./components/HolographicBackgroundClient'))
const FloatingGenres = lazy(() => import('./components/FloatingGenres'))

interface Track {
  id: string
  title: string
  artist: string
  audio_url: string
  image_url?: string
  user_id?: string
}

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [promptText, setPromptText] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const { 
    setPlaylist, 
    playTrack, 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    isShuffled, 
    isLooping, 
    toggleShuffle, 
    toggleLoop,
    currentTime,
    duration,
    playNext,
    playPrevious
  } = useAudioPlayer()

  // Check for payment success
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowSuccessMessage(true)
      // Auto-hide after 8 seconds
      setTimeout(() => setShowSuccessMessage(false), 8000)
      // Clean URL
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams])

  useEffect(() => {
    fetchAllTracks()
  }, [])

  // Spacebar to play/pause
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        // Don't trigger if user is typing in an input
        if (document.activeElement?.tagName === 'INPUT' || 
            document.activeElement?.tagName === 'TEXTAREA') {
          return
        }
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
      if (!res.ok) {
        console.error('❌ Explore API failed:', res.status, res.statusText)
        return
      }
      const data = await res.json()
      if (data.success && data.combinedMedia) {
        interface MediaItem {
          id: string
          title?: string
          artist?: string
          audio_url?: string
          image_url?: string
          user_id?: string
        }
        
        const audioTracks: Track[] = data.combinedMedia
          .filter((item: MediaItem) => item.audio_url)
          .map((item: MediaItem) => ({
            id: item.id,
            title: item.title || 'Untitled',
            artist: item.artist || 'Unknown Artist',
            audio_url: item.audio_url!,
            image_url: item.image_url,
            user_id: item.user_id
          }))
        setTracks(audioTracks)
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = () => {
    if (!tracks.length) return
    
    if (currentTrack && isPlaying) {
      togglePlayPause()
      return
    }
    
    const playerTracks = tracks.map(t => ({
      id: t.id,
      audioUrl: t.audio_url,
      title: t.title,
      artist: t.artist,
      imageUrl: t.image_url,
      userId: t.user_id // Include userId for play tracking
    }))
    
    setPlaylist(playerTracks)
    playTrack(playerTracks[0])
  }

  const handleInputClick = () => {
    router.push('/create')
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* 3D Background with lazy loading */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>

      {/* Floating genres animation */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Suspense fallback={null}>
          <FloatingGenres />
        </Suspense>
      </div>

      {/* Minimal blur overlay - only 5% blur */}
      <div className="fixed inset-0 backdrop-blur-[0.5px] bg-black/10 -z-5"></div>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 z-10 md:pl-24">
        {/* SEO Hero Section - Hidden but crawlable */}
        <div className="sr-only">
          <SEOHeroSection />
        </div>
        
        {/* Landing View - Centered Hero */}
        <div className="max-w-4xl w-full">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            
            {/* 444 RADIO Header */}
            <div className="relative mb-3">
              <h2 
                className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight"
                style={{
                  fontFamily: 'Anton, Impact, Arial Black, sans-serif',
                  fontWeight: 900
                }}
              >
                444 RADIO
              </h2>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-lg -z-10" />
            </div>

            {/* Compact Radio Player */}
            <div className="relative group w-full max-w-md">
              {/* Glow effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-lg opacity-60 group-hover:opacity-90 transition duration-300" />
              
              <div className="relative bg-black/90 backdrop-blur-2xl border-2 border-cyan-500/50 rounded-2xl p-4 transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                {/* LED Display Header */}
                <div className="bg-black/90 border border-cyan-500/30 rounded-lg px-4 py-2 mb-3">
                  <div 
                    className="text-center text-cyan-400 text-sm tracking-[0.3em] font-mono font-bold"
                    style={{ 
                      textShadow: '0 0 12px rgba(34, 211, 238, 0.6)',
                      fontFamily: 'Courier New, monospace'
                    }}
                  >
                    AI-MUSIC GENERATOR
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Vinyl/Disc Visual */}
                  <div className="relative flex-shrink-0">
                    <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-gray-900 via-gray-800 to-black border-2 border-cyan-500/40 overflow-hidden relative group/disc shadow-lg shadow-cyan-500/20">
                      {currentTrack?.imageUrl ? (
                        <>
                          <img 
                            src={currentTrack.imageUrl} 
                            alt="Cover" 
                            className="w-full h-full object-cover"
                          />
                          {isPlaying && (
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 animate-pulse" />
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music2 className="w-10 h-10 text-cyan-400/50" />
                        </div>
                      )}
                      
                      {/* Vinyl reflection effect */}
                      {isPlaying && (
                        <div 
                          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none"
                          style={{
                            animation: 'spin 3s linear infinite'
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Info & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {/* Track Info */}
                    <div className="mb-3">
                      <h3 className="text-white font-bold text-sm truncate leading-tight mb-0.5">
                        {currentTrack?.title || 'No Track'}
                      </h3>
                      <p className="text-cyan-400/70 text-xs truncate leading-tight">
                        {currentTrack?.artist || 'Hit play to start'}
                      </p>
                    </div>

                    {/* Time Display */}
                    <div className="flex items-center justify-center mb-3">
                      <span className="text-2xl font-bold text-cyan-400 font-mono leading-none">
                        {formatTime(currentTime)}
                      </span>
                    </div>

                    {/* Track Name Above Controls */}
                    <div className="text-center mb-2">
                      <p className="text-white/80 text-xs truncate">
                        {currentTrack?.title || ''}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-2">
                      {/* Shuffle */}
                      <button
                        onClick={toggleShuffle}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          isShuffled 
                            ? 'bg-cyan-500/30 text-cyan-400' 
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-cyan-400'
                        }`}
                        title="Shuffle"
                      >
                        <Shuffle className="w-4 h-4" />
                      </button>

                      {/* Previous Track */}
                      <button
                        onClick={playPrevious}
                        className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-cyan-400 transition-all duration-200"
                        title="Previous Track"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>

                      {/* Play/Pause */}
                      <button
                        onClick={handlePlayAll}
                        className="relative group/play flex-shrink-0"
                      >
                        <div className="absolute inset-0 bg-cyan-500 rounded-full blur-md opacity-50 group-hover/play:opacity-80 transition-opacity" />
                        <div className="relative bg-cyan-500 hover:bg-cyan-400 p-3 rounded-full transition-all duration-200 transform group-hover/play:scale-110 active:scale-95 shadow-lg shadow-cyan-500/50">
                          {isPlaying && currentTrack ? (
                            <Pause className="w-5 h-5 text-white" fill="white" />
                          ) : (
                            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                          )}
                        </div>
                      </button>

                      {/* Next Track */}
                      <button
                        onClick={playNext}
                        className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-cyan-400 transition-all duration-200"
                        title="Next Track"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>

                      {/* Loop */}
                      <button
                        onClick={toggleLoop}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          isLooping 
                            ? 'bg-cyan-500/30 text-cyan-400' 
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-cyan-400'
                        }`}
                        title="Loop"
                      >
                        <Repeat className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Aesthetic describe your sound bar - navigates to create page */}
            <div className="w-full max-w-md">
              <div className="relative group cursor-pointer" onClick={handleInputClick}>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 via-cyan-400/20 to-cyan-500/20 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-300"></div>
                <div className="relative">
                  <div className="w-full px-6 py-4 bg-black/60 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl text-cyan-400/60 group-hover:text-cyan-400/80 group-hover:border-cyan-400/50 focus:outline-none transition-all duration-300 text-center text-sm md:text-base">
                    Describe Your Sound...
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Success Message Toast */}
      {showSuccessMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative group">
            {/* Glowing background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-300"></div>
            
            {/* Content */}
            <div className="relative bg-black border-2 border-cyan-400/50 rounded-2xl px-8 py-6 shadow-2xl shadow-cyan-500/50 backdrop-blur-xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-black text-white mb-2 bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                    Thank You! 🎉
                  </h3>
                  <p className="text-cyan-300 text-lg font-medium mb-1">
                    Your subscription is active!
                  </p>
                  <p className="text-cyan-400/80 text-sm">
                    Can't wait to hear what you create with <span className="font-bold text-cyan-300">444</span>
                  </p>
                </div>

                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="flex-shrink-0 text-cyan-400/60 hover:text-cyan-400 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Claim Free Credits Button - Bottom Left (adjusted for sidebar) */}
      <Link href="/decrypt">
        <div className="fixed bottom-6 left-6 md:left-24 z-40 group cursor-pointer">
          {/* Glowing background effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 rounded-full blur-md opacity-60 group-hover:opacity-90 transition-all duration-300 animate-pulse"></div>
          
          {/* Button content */}
          <div className="relative bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 rounded-full px-5 py-3 shadow-lg shadow-cyan-500/30 transition-all duration-300 group-hover:scale-110 flex items-center gap-2">
            <Gift className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-sm whitespace-nowrap">
              Claim Free Credits
            </span>
          </div>
        </div>
      </Link>

      {/* Floating Menu */}
      <FloatingMenu />
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomePageContent />
    </Suspense>
  )
}
