'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Heart, Share2 } from 'lucide-react'

interface CombinedMediaPlayerProps {
  audioUrl: string
  imageUrl: string
  title?: string
  audioPrompt?: string
  imagePrompt?: string
  likes?: number
  plays?: number
  onLike?: () => void
  showControls?: boolean
}

export default function CombinedMediaPlayer({
  audioUrl,
  imageUrl,
  title = 'Untitled Track',
  audioPrompt,
  imagePrompt,
  likes = 0,
  plays = 0,
  onLike,
  showControls = true
}: CombinedMediaPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newTime = Number(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = Number(e.target.value)
    audio.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume || 0.5
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative group">
      {/* Album Cover */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
          >
            {isPlaying ? (
              <Pause size={32} className="text-black ml-0" />
            ) : (
              <Play size={32} className="text-black ml-1" />
            )}
          </button>
        </div>

        {/* Stats Overlay */}
        {showControls && (
          <div className="absolute top-4 right-4 flex gap-2">
            <div className="px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm flex items-center gap-1">
              <Heart size={14} className="text-pink-400" />
              {likes}
            </div>
            <div className="px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm">
              ▶ {plays}
            </div>
          </div>
        )}
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} src={audioUrl} />

      {/* Controls */}
      {showControls && (
        <div className="mt-4 space-y-3">
          {/* Title */}
          <div>
            <h3 className="text-lg font-bold text-white truncate">{title}</h3>
            {audioPrompt && (
              <p className="text-sm text-gray-400 truncate">{audioPrompt}</p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
              >
                {isPlaying ? (
                  <Pause size={20} className="text-white" />
                ) : (
                  <Play size={20} className="text-white ml-0.5" />
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors">
                  {isMuted || volume === 0 ? (
                    <VolumeX size={20} />
                  ) : (
                    <Volume2 size={20} />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onLike && (
                <button
                  onClick={onLike}
                  className="p-2 text-gray-400 hover:text-pink-400 transition-colors"
                  title="Like"
                >
                  <Heart size={20} />
                </button>
              )}
              <button
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = audioUrl
                  a.download = `${title}.mp3`
                  a.click()
                }}
                className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                title="Download"
              >
                <Download size={20} />
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: title,
                      text: `Check out this track: ${audioPrompt}`,
                      url: window.location.href
                    })
                  } else {
                    navigator.clipboard.writeText(window.location.href)
                    alert('Link copied to clipboard!')
                  }
                }}
                className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                title="Share"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

