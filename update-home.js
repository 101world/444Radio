const fs = require('fs');

const content = `'use client'

import { useRouter } from 'next/navigation'
import { Play, Pause } from 'lucide-react'
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
  const [promptText, setPromptText] = useState('')
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
          artist?: string
          audio_url?: string
          image_url?: string
        }
        
        const audioTracks: Track[] = data.combinedMedia
          .filter((item: MediaItem) => item.audio_url)
          .map((item: MediaItem) => ({
            id: item.id,
            title: item.title || 'Untitled',
            artist: item.artist || 'Unknown Artist',
            audio_url: item.audio_url!,
            image_url: item.image_url
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
      coverUrl: t.image_url
    }))
    
    setPlaylist(playerTracks)
    playTrack(playerTracks[0])
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

      {/* Credit Indicator */}
      <div className="fixed top-4 right-4 z-50">
        <CreditIndicator />
      </div>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 z-10">
        {/* Landing View - Centered Hero */}
        <div className="max-w-4xl w-full">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            
            {/* Play button replacing music icon */}
            <button
              onClick={handlePlayAll}
              className="relative group transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full group-hover:bg-cyan-500/30 transition-all duration-300" />
              <div className="relative bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-full p-6 transition-all duration-300">
                {isPlaying && currentTrack ? (
                  <Pause className="w-12 h-12 text-cyan-400" strokeWidth={2} fill="currentColor" />
                ) : (
                  <Play className="w-12 h-12 text-cyan-400 ml-1" strokeWidth={2} fill="currentColor" />
                )}
              </div>
            </button>

            {/* Smaller title */}
            <div>
              <h1 
                className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight"
                style={{
                  fontFamily: 'Anton, Impact, Arial Black, sans-serif',
                  fontWeight: 900
                }}
              >
                444 RADIO
              </h1>
            </div>

            {/* Aesthetic describe your sound bar */}
            <div className="w-full max-w-2xl mt-4">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/20 via-cyan-400/20 to-cyan-500/20 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-300"></div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="describe your sound..."
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    className="w-full px-6 py-4 bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-2xl text-white placeholder-cyan-400/40 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 text-center text-sm md:text-base"
                  />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Floating Navigation Button */}
      <FloatingNavButton 
        showPromptToggle={false}
        onTogglePrompt={() => {}}        
      />

      {/* Floating Menu */}
      <FloatingMenu />
    </>
  )
}
`;

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('✓ Updated homepage - smaller title, play button icon, aesthetic input bar');
