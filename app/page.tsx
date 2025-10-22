'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import FloatingMenu from './components/FloatingMenu'
import CreditIndicator from './components/CreditIndicator'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'
import FloatingGenres from './components/FloatingGenres'
import FloatingNavButton from './components/FloatingNavButton'
import FMTuner from './components/FMTuner'
import ProfileMusicPlayer from './components/ProfileMusicPlayer'
import { useAudioPlayer } from './contexts/AudioPlayerContext'
import { Play, Pause } from 'lucide-react'

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
        const formattedTracks = data.combinedMedia.map((media: any) => ({
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
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Genre Texts */}
      <FloatingGenres />
      
      {/* Main Content Wrapper */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Credit Indicator - Mobile Only */}
        <div className="md:hidden">
          <CreditIndicator />
        </div>
        
        {/* Floating Menu - Desktop Only */}
        <FloatingMenu />

        {/* Landing View - Centered Hero Section */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          
          {/* Hero Section - Always Visible */}
          <div className="relative z-20 w-full max-w-4xl mx-auto text-center space-y-6 mb-8">
            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text tracking-wider leading-tight" style={{
              textShadow: '0 0 40px rgba(34, 211, 238, 0.6)',
              fontFamily: 'serif'
            }}>
              444 RADIO
            </h1>
            
            {/* Tagline */}
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-cyan-400/90 font-light tracking-wide max-w-2xl mx-auto px-4">
              A world where music feels infinite.
            </p>

            {/* Feature Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 px-4 max-w-2xl mx-auto pt-2">
              {['Instant Generation', 'High Quality', 'Unlimited Ideas'].map((feature) => (
                <div
                  key={feature}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs md:text-sm font-mono backdrop-blur-sm hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300"
                >
                  {feature}
                </div>
              ))}
            </div>
            
            {/* Large Play Button - Always Visible */}
            <div className="flex flex-col items-center gap-3 pt-4">
              <button
                onClick={handlePlayAll}
                disabled={tracks.length === 0}
                className="group relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 disabled:from-gray-600 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-400/70"
              >
                {currentTrack && isPlaying ? (
                  <Pause className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-black" fill="currentColor" />
                ) : (
                  <Play className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-black ml-1" fill="currentColor" />
                )}
                
                {/* Pulse animation when not playing */}
                {(!currentTrack || !isPlaying) && !loading && tracks.length > 0 && (
                  <div className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping"></div>
                )}
              </button>
              
              <p className="text-cyan-500/70 text-sm md:text-base font-medium tracking-wide">
                {loading ? 'Loading...' : tracks.length === 0 ? 'No Tracks Available' : currentTrack && isPlaying ? 'Now Playing' : 'Start Broadcasting'}
              </p>
            </div>
          </div>
          
          {/* FM Tuner - Shown when tracks are loaded */}
          {!loading && tracks.length > 0 && (
            <div className="relative z-20 w-full max-w-4xl mx-auto mt-8">
              <FMTuner tracks={tracks} autoPlay={false} />
            </div>
          )}

          {/* Empty State */}
          {!loading && tracks.length === 0 && (
            <div className="text-center space-y-4 mt-8">
              <div className="text-6xl mb-4">📻</div>
              <h2 className="text-2xl font-bold text-white mb-2">No stations available</h2>
              <p className="text-gray-400 mb-8">Be the first to broadcast!</p>
              <button
                onClick={() => router.push('/create')}
                className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-full font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all"
              >
                Start Creating
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Floating Navigation Button */}
      <FloatingNavButton />

      {/* Profile Music Player */}
      <ProfileMusicPlayer />
    </div>
  )
}
