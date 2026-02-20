const fs = require('fs');

const content = `'use client'

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
      const res = await fetch('/api/media/radio')
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
    
    // Convert tracks to audio player format and start playing
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
        <div className="max-w-7xl w-full">
          <div className="flex flex-col items-center justify-center text-center space-y-4 md:space-y-8 mb-6 md:mb-12">
            
            {/* Minimalist logo/icon above title */}
            <div className="relative group transition-all duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full group-hover:bg-cyan-500/30 transition-all duration-300" />
              <Music 
                className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 text-cyan-400 relative z-10"
                strokeWidth={1.5}
              />
            </div>

            {/* Main title - no glow */}
            <div>
              <h1 
                className="text-3xl md:text-6xl lg:text-8xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight"
                style={{
                  fontFamily: 'Anton, Impact, Arial Black, sans-serif',
                  fontWeight: 900
                }}
              >
                444 RADIO
              </h1>
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
console.log('✓ Fixed page.tsx - removed title glow');

