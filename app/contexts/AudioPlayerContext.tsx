'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react'

interface Track {
  id: string
  audioUrl: string
  title: string
  artist?: string
  imageUrl?: string
  userId?: string
}

interface AudioPlayerContextType {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  playlist: Track[]
  playTrack: (track: Track) => void
  pause: () => void
  resume: () => void
  togglePlayPause: () => void
  setVolume: (volume: number) => void
  seekTo: (time: number) => void
  playNext: () => void
  playPrevious: () => void
  setPlaylist: (tracks: Track[], startIndex?: number) => void
  shufflePlaylist: () => void
  removeFromPlaylist: (trackId: string) => void
  addToPlaylist: (track: Track) => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.7)
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playTimeRef = useRef<number>(0)
  const hasTrackedPlayRef = useRef<boolean>(false)

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => {
        console.error('Error resuming audio:', error)
        setIsPlaying(false)
      })
      setIsPlaying(true)
    }
  }, [])

  const playTrack = useCallback((track: Track) => {
    if (!audioRef.current) {
      console.error('Audio ref not initialized')
      return
    }

    console.log('Playing track:', track.title, track.audioUrl)

    // Reset play tracking
    playTimeRef.current = 0
    hasTrackedPlayRef.current = false

    setCurrentTrack(track)
    audioRef.current.src = track.audioUrl
    audioRef.current.play().catch(error => {
      console.error('Error playing audio:', error)
      setIsPlaying(false)
    })
    setIsPlaying(true)

    // Find track in playlist and update index
    const index = playlist.findIndex(t => t.id === track.id)
    if (index !== -1) {
      setCurrentIndex(index)
    }
  }, [playlist])

  const playNext = useCallback(() => {
    if (playlist.length === 0) return
    const nextIndex = (currentIndex + 1) % playlist.length
    setCurrentIndex(nextIndex)
    playTrack(playlist[nextIndex])
  }, [playlist, currentIndex, playTrack])

  const playPrevious = useCallback(() => {
    if (playlist.length === 0) return
    const prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1
    setCurrentIndex(prevIndex)
    playTrack(playlist[prevIndex])
  }, [playlist, currentIndex, playTrack])

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio()
      audioRef.current.volume = volume
      console.log('Audio element initialized')

      // Enable background playback
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => resume())
        navigator.mediaSession.setActionHandler('pause', () => pause())
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious())
        navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
      }

      return () => {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
      }
    }
  }, [volume, playNext, playPrevious, pause, resume])

  // Update media session metadata
  useEffect(() => {
    if (currentTrack && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || 'Unknown Artist',
        artwork: currentTrack.imageUrl ? [
          { src: currentTrack.imageUrl, sizes: '512x512', type: 'image/png' }
        ] : undefined
      })
    }
  }, [currentTrack])

  // Track play count after 3 seconds
  useEffect(() => {
    if (!isPlaying || !currentTrack) {
      playTimeRef.current = 0
      return
    }

    const interval = setInterval(() => {
      playTimeRef.current += 1

      // Track play after 3 seconds
      if (playTimeRef.current >= 3 && !hasTrackedPlayRef.current) {
        hasTrackedPlayRef.current = true
        trackPlay(currentTrack.id)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isPlaying, currentTrack])

  // Track play count API call
  const trackPlay = async (trackId: string) => {
    try {
      // Try combined_media first, then fall back to songs
      const mediaResponse = await fetch('/api/media/track-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: trackId })
      })
      
      // If media tracking fails, try songs table
      if (!mediaResponse.ok) {
        await fetch('/api/songs/track-play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId })
        })
      }
    } catch (error) {
      console.error('Failed to track play:', error)
    }
  }

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      playNext()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }

  const setVolume = (vol: number) => {
    setVolumeState(vol)
    if (audioRef.current) {
      audioRef.current.volume = vol
    }
  }

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const setPlaylistAndPlay = (tracks: Track[], startIndex: number = 0) => {
    setPlaylist(tracks)
    setCurrentIndex(startIndex)
    if (tracks.length > 0) {
      playTrack(tracks[startIndex])
    }
  }

  const shufflePlaylist = () => {
    const shuffled = [...playlist].sort(() => Math.random() - 0.5)
    setPlaylist(shuffled)
    setCurrentIndex(0)
    if (shuffled.length > 0) {
      playTrack(shuffled[0])
    }
  }

  const removeFromPlaylist = (trackId: string) => {
    const newPlaylist = playlist.filter(track => track.id !== trackId)
    setPlaylist(newPlaylist)
    
    // If we removed the current track, play the next one
    if (currentTrack?.id === trackId && newPlaylist.length > 0) {
      const newIndex = Math.min(currentIndex, newPlaylist.length - 1)
      setCurrentIndex(newIndex)
      playTrack(newPlaylist[newIndex])
    } else if (newPlaylist.length === 0) {
      // If playlist is empty, stop playback
      pause()
    }
  }

  const addToPlaylist = (track: Track) => {
    // Check if track already exists in playlist
    if (!playlist.find(t => t.id === track.id)) {
      setPlaylist([...playlist, track])
    }
  }

  return (
    <AudioPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        playlist,
        playTrack,
        pause,
        resume,
        togglePlayPause,
        setVolume,
        seekTo,
        playNext,
        playPrevious,
        setPlaylist: setPlaylistAndPlay,
        shufflePlaylist,
        removeFromPlaylist,
        addToPlaylist
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return context
}
