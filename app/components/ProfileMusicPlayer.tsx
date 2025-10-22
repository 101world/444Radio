'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Shuffle } from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { useUser } from '@clerk/nextjs'

interface Song {
  id: string
  title: string
  audio_url: string
  image_url?: string
  users?: {
    username: string
  }
}

export default function ProfileMusicPlayer() {
  const { user } = useUser()
  const { playTrack, setPlaylist, shufflePlaylist, isPlaying, currentTrack, pause, resume } = useAudioPlayer()
  const [userSongs, setUserSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [isShuffleMode, setIsShuffleMode] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchUserSongs()
    }
  }, [user])

  const fetchUserSongs = async () => {
    try {
      const response = await fetch(`/api/songs/profile/${user?.id}`)
      const data = await response.json()
      if (data.songs) {
        setUserSongs(data.songs)
      }
    } catch (error) {
      console.error('Failed to fetch user songs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlay = () => {
    if (userSongs.length === 0) return

    const tracks = userSongs.map(song => ({
      id: song.id,
      audioUrl: song.audio_url,
      title: song.title,
      artist: user?.username || 'You',
      imageUrl: song.image_url
    }))

    if (isShuffleMode) {
      setPlaylist(tracks, 0)
      shufflePlaylist()
    } else {
      setPlaylist(tracks, 0)
    }
  }

  const handleTogglePlay = () => {
    if (isPlaying && currentTrack && userSongs.some(s => s.id === currentTrack.id)) {
      pause()
    } else if (!isPlaying && currentTrack && userSongs.some(s => s.id === currentTrack.id)) {
      resume()
    } else {
      handlePlay()
    }
  }

  const handleToggleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsShuffleMode(!isShuffleMode)
    if (!isShuffleMode && userSongs.length > 0) {
      const tracks = userSongs.map(song => ({
        id: song.id,
        audioUrl: song.audio_url,
        title: song.title,
        artist: user?.username || 'You',
        imageUrl: song.image_url
      }))
      setPlaylist(tracks, 0)
      shufflePlaylist()
    }
  }

  if (loading || userSongs.length === 0) return null

  const isPlayingUserSong = isPlaying && currentTrack && userSongs.some(s => s.id === currentTrack.id)

  return (
    <div className="fixed bottom-24 right-6 z-40 flex items-center gap-2">
      {/* Shuffle Button */}
      <button
        onClick={handleToggleShuffle}
        className={`p-3 rounded-full backdrop-blur-xl border transition-all hover:scale-110 ${
          isShuffleMode
            ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400'
            : 'bg-black/40 border-white/20 text-gray-400 hover:text-white'
        }`}
        title="Shuffle"
      >
        <Shuffle size={18} />
      </button>

      {/* Play Button */}
      <button
        onClick={handleTogglePlay}
        className="group relative p-4 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 transition-all hover:scale-110 shadow-lg shadow-cyan-500/50 active:scale-95"
        title={isPlayingUserSong ? "Pause" : "Play Your Music"}
      >
        {isPlayingUserSong ? (
          <Pause size={24} className="text-black" />
        ) : (
          <Play size={24} className="text-black ml-0.5" />
        )}
        
        {/* Ripple effect when playing */}
        {isPlayingUserSong && (
          <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-20"></div>
        )}
      </button>

      {/* Song count badge */}
      <div className="absolute -top-2 -right-2 bg-cyan-500 text-black text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
        {userSongs.length}
      </div>
    </div>
  )
}
