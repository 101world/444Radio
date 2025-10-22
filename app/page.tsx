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

        {/* Landing View - FM Tuner Centered */}
        <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 pt-24 pb-32 md:py-8">
          
          {/* Instant Play Button - Centered Above Tuner */}
          {!loading && tracks.length > 0 && (
            <div className="relative z-20 mb-8 flex flex-col items-center gap-4">
              <h1 className="text-6xl md:text-7xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-clip-text tracking-wider text-center" style={{
                textShadow: '0 0 30px rgba(34, 211, 238, 0.5)',
                fontFamily: 'serif'
              }}>
                444 RADIO
              </h1>
              <p className="text-cyan-400/80 text-lg md:text-xl font-light tracking-wide text-center">
                A world where music feels infinite.
              </p>
              
              {/* Large Play Button */}
              <button
                onClick={handlePlayAll}
                className="group relative mt-4 w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 flex items-center justify-center transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-lg shadow-cyan-500/50 hover:shadow-cyan-400/60"
              >
                {currentTrack && isPlaying ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center gap-1">
                    <div className="w-1.5 md:w-2 h-6 md:h-8 bg-black rounded-full"></div>
                    <div className="w-1.5 md:w-2 h-6 md:h-8 bg-black rounded-full"></div>
                  </div>
                ) : (
                  <Play className="w-10 h-10 md:w-12 md:h-12 text-black ml-1" fill="currentColor" />
                )}
                
                {/* Pulse animation when not playing */}
                {(!currentTrack || !isPlaying) && (
                  <div className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping"></div>
                )}
              </button>
              
              <p className="text-cyan-500/60 text-sm font-medium tracking-wide">
                {currentTrack && isPlaying ? 'Now Playing' : 'Start Broadcasting'}
              </p>
            </div>
          )}
          
          {loading ? (
            <div className="text-center space-y-4">
              <div className="text-cyan-400 text-2xl font-mono animate-pulse">
                Tuning stations...
              </div>
            </div>
          ) : tracks.length > 0 ? (
            <div className="relative z-20">
              <FMTuner tracks={tracks} autoPlay=false} />
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4"></div>
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
      
      {/* Global Music Player */}
      <ProfileMusicPlayer />
    </div>
  )
}