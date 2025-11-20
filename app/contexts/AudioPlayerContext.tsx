'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'

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
  queue: Track[]
  isLooping: boolean
  isShuffled: boolean
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
  addToPlaylist: (track: Track) => boolean
  addToQueue: (track: Track) => boolean
  removeFromQueue: (trackId: string) => void
  reorderQueue: (startIndex: number, endIndex: number) => void
  clearQueue: () => void
  playFromQueue: (track: Track) => void
  toggleLoop: () => void
  toggleShuffle: () => void
  skipBackward: (seconds?: number) => void
  skipForward: (seconds?: number) => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useUser()
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.7)
  const [playlist, setPlaylist] = useState<Track[]>([])
  const [queue, setQueue] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLooping, setIsLooping] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playTimeRef = useRef<number>(0)
  const hasTrackedPlayRef = useRef<boolean>(false)

  // Define pause first so it can be used in useEffect
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem('444radio-queue')
    if (savedQueue) {
      try {
        const parsedQueue = JSON.parse(savedQueue)
        setQueue(parsedQueue)
        console.log('[Queue] Loaded from localStorage:', parsedQueue.length, 'tracks')
      } catch (error) {
        console.error('[Queue] Failed to load from localStorage:', error)
      }
    }
    
    // Listen for studio playback events
    const handleStudioPlay = () => {
      console.log('🎛️ Studio started playing, pausing global player');
      pause();
    };
    
    window.addEventListener('audio:pause-global', handleStudioPlay);
    return () => window.removeEventListener('audio:pause-global', handleStudioPlay);
  }, [pause])

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('444radio-queue', JSON.stringify(queue))
      console.log('[Queue] Saved to localStorage:', queue.length, 'tracks')
    } else {
      localStorage.removeItem('444radio-queue')
      console.log('[Queue] Cleared from localStorage')
    }
  }, [queue])

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(error => {
          console.error('Error resuming audio:', error)
          setIsPlaying(false)
        })
    }
      // When the global player resumes or plays, notify studio to pause
      try { window.dispatchEvent(new CustomEvent('audio:pause-studio')); } catch {}
  }, [])

  const playTrack = useCallback(async (track: Track) => {
    if (!track) {
      console.error('❌ Cannot play: track is null/undefined');
      return;
    }

    if (!track.audioUrl) {
      console.error('❌ Cannot play: audioUrl is missing for track:', track.title || track.id);
      console.error('Track data:', JSON.stringify(track, null, 2));
      return;
    }

    // Validate URL format - allow blob: URLs and relative paths
    const isValidUrl = track.audioUrl.startsWith('blob:') || 
                      track.audioUrl.startsWith('http://') || 
                      track.audioUrl.startsWith('https://') ||
                      track.audioUrl.startsWith('/');
    
    if (!isValidUrl) {
      console.error('❌ Cannot play: invalid audioUrl format:', track.audioUrl);
      console.error('Track:', track.title || track.id);
      return;
    }

    if (!audioRef.current) {
      console.error('❌ Audio ref not initialized');
      return;
    }

    console.log('🎵 Playing track:', track.title, 'URL:', track.audioUrl);

    // Reset play tracking
    playTimeRef.current = 0
    hasTrackedPlayRef.current = false

    setCurrentTrack(track)
    
    // Always use proxy for R2 and Replicate URLs to avoid CORS issues
    const computeUrl = (u: string) => {
      try {
        // Don't proxy blob URLs or relative paths
        if (u.startsWith('blob:') || u.startsWith('/')) {
          return u;
        }
        
        const target = new URL(u)
        const r2Hosts: string[] = []
        if (process.env.NEXT_PUBLIC_R2_AUDIO_URL) r2Hosts.push(new URL(process.env.NEXT_PUBLIC_R2_AUDIO_URL).hostname)
        if (process.env.NEXT_PUBLIC_R2_IMAGES_URL) r2Hosts.push(new URL(process.env.NEXT_PUBLIC_R2_IMAGES_URL).hostname)
        if (process.env.NEXT_PUBLIC_R2_VIDEOS_URL) r2Hosts.push(new URL(process.env.NEXT_PUBLIC_R2_VIDEOS_URL).hostname)
        const isR2 = target.hostname.endsWith('.r2.dev') || target.hostname.endsWith('.r2.cloudflarestorage.com') || r2Hosts.includes(target.hostname)
        const isReplicate = target.hostname.includes('replicate.delivery') || target.hostname.includes('replicate.com')
        const needsProxy = isR2 || isReplicate
        return needsProxy ? `/api/r2/proxy?url=${encodeURIComponent(u)}` : u
      } catch (err) { 
        console.error('❌ URL computation failed:', err, 'Original URL:', u);
        return u 
      }
    }
    
    let finalUrl: string;
    try {
      finalUrl = computeUrl(track.audioUrl);
      if (!finalUrl) {
        console.error('❌ computeUrl returned empty string for:', track.audioUrl);
        return;
      }
    } catch (computeError) {
      console.error('❌ Failed to compute final URL:', computeError);
      return;
    }
    
    const isProxied = finalUrl.startsWith('/api/r2/proxy')
    console.log('Using URL:', isProxied ? 'proxy' : 'direct', finalUrl)
    
    const audio = audioRef.current
    
    // Stop any existing playback completely
    audio.pause()
    audio.src = ''
    audio.load()
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Now set the new source and load it
    audio.src = finalUrl
    audio.load()
    
    // Wait for the new source to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Now play
      try {
      await audio.play()
      setIsPlaying(true)
      console.log('✅ Playback started successfully for', track.title)
      // Notify Studio to stop playback to prevent overlapping audio
      try { window.dispatchEvent(new CustomEvent('audio:pause-studio')); } catch {}
    } catch (error) {
      console.error('❌ Error playing audio:', error)
      console.error('Track:', track.title)
      console.error('Audio URL:', track.audioUrl)
      console.error('Final URL:', finalUrl)
      console.error('Audio element src:', audio.src)
      console.error('Audio element error:', audio.error)
      setIsPlaying(false)
    }

    // Find track in playlist and update index
    const index = playlist.findIndex(t => t.id === track.id)
    if (index !== -1) {
      setCurrentIndex(index)
    }
  }, [playlist])

  const playNext = useCallback(async () => {
    if (playlist.length === 0) return
    
    let nextIndex: number
    if (isShuffled) {
      // Pick a random track (not the current one)
      const availableIndices = playlist
        .map((_, index) => index)
        .filter(index => index !== currentIndex)
      
      if (availableIndices.length === 0) {
        // Only one track, just replay it
        nextIndex = 0
      } else {
        nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
      }
    } else {
      // Normal sequential play
      nextIndex = (currentIndex + 1) % playlist.length
    }
    
    setCurrentIndex(nextIndex)
    await playTrack(playlist[nextIndex])
  }, [playlist, currentIndex, playTrack, isShuffled])

  const playPrevious = useCallback(async () => {
    if (playlist.length === 0) return
    
    let prevIndex: number
    if (isShuffled) {
      // Pick a random track (not the current one)
      const availableIndices = playlist
        .map((_, index) => index)
        .filter(index => index !== currentIndex)
      
      if (availableIndices.length === 0) {
        prevIndex = 0
      } else {
        prevIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
      }
    } else {
      // Normal sequential play
      prevIndex = currentIndex === 0 ? playlist.length - 1 : currentIndex - 1
    }
    
    setCurrentIndex(prevIndex)
    await playTrack(playlist[prevIndex])
  }, [playlist, currentIndex, playTrack, isShuffled])

  // Initialize audio element once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.crossOrigin = 'anonymous'
      audioRef.current.volume = volume
      console.log('Audio element initialized')

      return () => {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
      }
    }
  }, []) // Empty dependency array - only run once on mount

  // Listen for studio playback events to pause the global audio when Studio starts playing
  useEffect(() => {
    const onStudioPauseGlobal = () => {
      pause();
    }
    window.addEventListener('studio:pause-global-audio', onStudioPauseGlobal as EventListener);
    return () => window.removeEventListener('studio:pause-global-audio', onStudioPauseGlobal as EventListener);
  }, [pause]);

  // Set up media session handlers separately
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => resume())
      navigator.mediaSession.setActionHandler('pause', () => pause())
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious())
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext())
    }
  }, [pause, resume, playNext, playPrevious])

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

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
      const userId = user?.id || null
      
      // Try combined_media first, then fall back to songs
      const mediaResponse = await fetch('/api/media/track-play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: trackId, userId })
      })
      
      // If media tracking fails, try songs table
      if (!mediaResponse.ok) {
        await fetch('/api/songs/track-play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId, userId })
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
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handlePlaying = () => setIsPlaying(true)
    const handleEnded = () => {
      setIsPlaying(false)
      if (isLooping && currentTrack) {
        // Loop current track
        audio.currentTime = 0
        audio.play().catch(err => console.error('Loop play error:', err))
      } else {
        // Play next track in playlist
        playNext()
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [isLooping, currentTrack, playNext])

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

  const setPlaylistAndPlay = async (tracks: Track[], startIndex: number = 0) => {
    // Normalize audio_url to audioUrl and filter out invalid tracks
    const normalizedTracks = tracks.map(t => ({
      ...t,
      audioUrl: t.audioUrl || (t as any).audio_url, // Handle both formats
      imageUrl: t.imageUrl || (t as any).image_url, // Handle both formats
    }));
    
    const validTracks = normalizedTracks.filter(t => t && t.audioUrl);
    
    if (validTracks.length === 0) {
      console.warn('[Playlist] No valid tracks provided');
      return;
    }
    
    console.log('[Playlist] Normalized and filtered:', validTracks.length, 'valid tracks out of', tracks.length, 'total');
    
    setPlaylist(validTracks);
    setCurrentIndex(startIndex);
    if (validTracks.length > 0 && validTracks[startIndex]) {
      await playTrack(validTracks[startIndex]);
    }
  }

  const shufflePlaylist = () => {
    // Don't actually shuffle the playlist array, just enable shuffle mode
    // The playNext/playPrevious functions will handle random selection
    const newShuffleState = !isShuffled
    setIsShuffled(newShuffleState)
    
    // If enabling shuffle, disable loop
    if (newShuffleState && isLooping) {
      setIsLooping(false)
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
    const existingTrack = playlist.find(t => t.id === track.id)
    if (!existingTrack) {
      const newPlaylist = [...playlist, track]
      setPlaylist(newPlaylist)
      console.log('[Queue] Added to playlist:', track.title, 'Total tracks:', newPlaylist.length)
      return true
    } else {
      console.log('[Queue] Track already in playlist:', track.title)
      return false
    }
  }

  const addToQueue = (track: Track) => {
    const existingTrack = queue.find(t => t.id === track.id)
    if (!existingTrack) {
      const newQueue = [...queue, track]
      setQueue(newQueue)
      console.log('[Queue] Added to persistent queue:', track.title, 'Total tracks:', newQueue.length)
      return true
    } else {
      console.log('[Queue] Track already in persistent queue:', track.title)
      return false
    }
  }

  const removeFromQueue = (trackId: string) => {
    const newQueue = queue.filter(t => t.id !== trackId)
    setQueue(newQueue)
    console.log('[Queue] Removed from queue, remaining:', newQueue.length)
  }

  const reorderQueue = (startIndex: number, endIndex: number) => {
    const result = Array.from(queue)
    const [removed] = result.splice(startIndex, 1)
    result.splice(endIndex, 0, removed)
    setQueue(result)
    console.log('[Queue] Reordered from index', startIndex, 'to', endIndex)
  }

  const clearQueue = () => {
    setQueue([])
    console.log('[Queue] Cleared all tracks')
  }

  const playFromQueue = (track: Track) => {
    // Find the track index in queue
    const trackIndex = queue.findIndex(t => t.id === track.id)
    if (trackIndex !== -1) {
      // Set queue as the active playlist and play from the selected track
      setPlaylist(queue)
      setCurrentIndex(trackIndex)
      playTrack(track)
      console.log('[Queue] Playing from queue:', track.title, 'at index', trackIndex)
    }
  }

  const toggleLoop = () => {
    const newLoopState = !isLooping
    setIsLooping(newLoopState)
    // If enabling loop, disable shuffle
    if (newLoopState && isShuffled) {
      setIsShuffled(false)
    }
  }

  const toggleShuffle = () => {
    const newShuffleState = !isShuffled
    setIsShuffled(newShuffleState)
    // If enabling shuffle, disable loop
    if (newShuffleState && isLooping) {
      setIsLooping(false)
    }
  }

  const skipBackward = (seconds: number = 10) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seconds)
    }
  }

  const skipForward = (seconds: number = 10) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + seconds)
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
        queue,
        isLooping,
        isShuffled,
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
        addToPlaylist,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        playFromQueue,
        toggleLoop,
        toggleShuffle,
        skipBackward,
        skipForward
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
