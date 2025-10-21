'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, SkipForward } from 'lucide-react'

interface Track {
  id: string
  title: string
  artist: string
  audio_url: string
  image_url?: string
}

interface FMTunerProps {
  tracks: Track[]
  autoPlay?: boolean
  onTrackChange?: (track: Track) => void
}

export default function FMTuner({ tracks, autoPlay = false, onTrackChange }: FMTunerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [frequency, setFrequency] = useState(88.8)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const tunerRef = useRef<HTMLDivElement>(null)

  const currentTrack = tracks[currentIndex]

  // Map frequency to track index (88.0 - 108.0 MHz range)
  const frequencyRange = { min: 88.0, max: 108.0 }
  const frequencyToIndex = (freq: number) => {
    if (tracks.length === 0) return 0
    const normalized = (freq - frequencyRange.min) / (frequencyRange.max - frequencyRange.min)
    return Math.floor(normalized * tracks.length) % tracks.length
  }

  const indexToFrequency = (index: number) => {
    if (tracks.length === 0) return 88.8
    const normalized = index / tracks.length
    return frequencyRange.min + normalized * (frequencyRange.max - frequencyRange.min)
  }

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.src = currentTrack.audio_url
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error('Playback failed:', err))
      }
      if (onTrackChange) {
        onTrackChange(currentTrack)
      }
    }
  }, [currentIndex, currentTrack])

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error('Playback failed:', err))
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying])

  const handleTunerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tracks.length === 0) return
    
    const rect = tunerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newFreq = frequencyRange.min + percentage * (frequencyRange.max - frequencyRange.min)
    
    setIsAnimating(true)
    setFrequency(newFreq)
    const newIndex = frequencyToIndex(newFreq)
    setCurrentIndex(newIndex)
    
    setTimeout(() => setIsAnimating(false), 800)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || tracks.length === 0) return
    
    const rect = tunerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percentage = x / rect.width
    const newFreq = frequencyRange.min + percentage * (frequencyRange.max - frequencyRange.min)
    
    setFrequency(newFreq)
    const newIndex = frequencyToIndex(newFreq)
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const nextStation = () => {
    if (tracks.length === 0) return
    
    setIsAnimating(true)
    const newIndex = (currentIndex + 1) % tracks.length
    setCurrentIndex(newIndex)
    setFrequency(indexToFrequency(newIndex))
    
    setTimeout(() => setIsAnimating(false), 800)
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  // Calculate needle rotation (-60deg to 60deg range)
  const getNeedleRotation = () => {
    const normalized = (frequency - frequencyRange.min) / (frequencyRange.max - frequencyRange.min)
    return -60 + normalized * 120
  }

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Vintage FM Tuner */}
      <div className="relative bg-gradient-to-b from-amber-900 via-amber-800 to-amber-950 rounded-3xl p-8 shadow-2xl border-4 border-amber-950">
        {/* Wood grain texture overlay */}
        <div className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            rgba(101, 67, 33, 0.1) 0px,
            rgba(101, 67, 33, 0.2) 1px,
            transparent 1px,
            transparent 3px
          )`
        }}></div>

        {/* Radio Display Panel */}
        <div className="relative bg-black/90 rounded-2xl p-6 mb-6 border-4 border-amber-950/50 shadow-inner">
          {/* 444RADIO Branding */}
          <div className="text-center mb-4">
            <h1 className="text-5xl font-black text-transparent bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text tracking-wider" style={{
              textShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
              fontFamily: 'serif'
            }}>
              444RADIO
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
              <span className="text-amber-500/80 text-xs font-bold tracking-[0.3em]">FM STEREO</span>
              <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
            </div>
          </div>

          {/* Frequency Display */}
          <div className="bg-gradient-to-b from-green-950 to-green-900 rounded-lg p-4 mb-4 border-2 border-green-950">
            <div className="text-center">
              <div className="text-6xl font-bold text-green-400 font-mono tracking-wider" style={{
                textShadow: '0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.4)',
                fontFamily: 'monospace'
              }}>
                {frequency.toFixed(1)}
              </div>
              <div className="text-green-500/70 text-sm font-bold mt-1">MHz FM</div>
            </div>
          </div>

          {/* Current Track Info */}
          {currentTrack && (
            <div className="text-center space-y-1 mb-4">
              <div className="text-amber-300 font-bold text-lg truncate px-4">
                {currentTrack.title}
              </div>
              <div className="text-amber-500/80 text-sm truncate px-4">
                {currentTrack.artist}
              </div>
            </div>
          )}

          {/* Tuner Dial with Needle */}
          <div 
            ref={tunerRef}
            className="relative h-32 bg-gradient-to-b from-gray-900 to-black rounded-xl overflow-hidden cursor-pointer border-2 border-amber-900/50"
            onClick={handleTunerClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Frequency Markers */}
            <div className="absolute inset-0 flex items-end justify-between px-2 pb-2">
              {[88, 92, 96, 100, 104, 108].map((freq) => (
                <div key={freq} className="flex flex-col items-center">
                  <div className="h-8 w-0.5 bg-amber-600/50"></div>
                  <span className="text-amber-500/60 text-[10px] font-bold mt-1">{freq}</span>
                </div>
              ))}
            </div>

            {/* Center Pivot Point */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg z-20 border-2 border-amber-900"></div>

            {/* Needle */}
            <div 
              className={`absolute bottom-2 left-1/2 origin-bottom -translate-x-0.5 transition-transform ${
                isAnimating ? 'duration-700 ease-out' : isDragging ? 'duration-75' : 'duration-300'
              }`}
              style={{ 
                transform: `translateX(-50%) rotate(${getNeedleRotation()}deg)`,
                height: '100px'
              }}
            >
              <div className="w-1 h-full bg-gradient-to-t from-red-600 via-red-500 to-red-400 rounded-full shadow-lg" style={{
                boxShadow: '0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.4)'
              }}></div>
              {/* Needle tip */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-lg"></div>
            </div>

            {/* Glow effect when playing */}
            {isPlaying && (
              <div className="absolute inset-0 bg-gradient-radial from-amber-500/10 to-transparent animate-pulse pointer-events-none"></div>
            )}
          </div>

          {/* Station Indicator Lights */}
          <div className="flex justify-center gap-2 mt-4">
            {tracks.slice(0, 8).map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex 
                    ? 'bg-red-500 shadow-lg shadow-red-500/50' 
                    : 'bg-gray-700'
                }`}
              ></div>
            ))}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={togglePlayPause}
            className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 border-4 border-amber-950 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="text-amber-200" size={28} fill="currentColor" />
            ) : (
              <Play className="text-amber-200 ml-1" size={28} fill="currentColor" />
            )}
          </button>

          <button
            onClick={nextStation}
            className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-700 to-amber-900 hover:from-amber-600 hover:to-amber-800 border-4 border-amber-950 shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <SkipForward className="text-amber-200" size={28} fill="currentColor" />
          </button>
        </div>

        {/* Speaker Grilles (decorative) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-2 h-12 bg-amber-950/50 rounded-full"></div>
          ))}
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-2 h-12 bg-amber-950/50 rounded-full"></div>
          ))}
        </div>
      </div>
    </div>
  )
}
