'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Minimize2, GripVertical } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function FloatingAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlayPause,
    setVolume,
    seekTo,
    playNext,
    playPrevious,
  } = useAudioPlayer()

  // Position and size state
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 200 })
  const [size, setSize] = useState({ width: 400, height: 140 })
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
  const playerRef = useRef<HTMLDivElement>(null)

  // Don't show if no track is loaded
  if (!currentTrack) return null

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    seekTo(time)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
  }

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return
    
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  // Resize handler
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    })
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x))
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.y))
        setPosition({ x: newX, y: newY })
      }
      
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        const newWidth = Math.max(300, Math.min(800, resizeStart.width + deltaX))
        const newHeight = Math.max(120, Math.min(400, resizeStart.height + deltaY))
        setSize({ width: newWidth, height: newHeight })
      }
    }

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, size.width, size.height])

  // Toggle expand/collapse
  const toggleExpand = () => {
    if (isExpanded) {
      setSize({ width: 300, height: 80 })
    } else {
      setSize({ width: 400, height: 140 })
    }
    setIsExpanded(!isExpanded)
  }

  return (
    <div
      ref={playerRef}
      className="fixed z-50 rounded-2xl shadow-2xl cursor-move select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(34, 211, 238, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Drag Handle & Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-500/10">
        <div className="flex items-center gap-2 flex-1">
          <GripVertical size={16} className="text-cyan-500/50" />
          {currentTrack.imageUrl && (
            <img
              src={currentTrack.imageUrl}
              alt={currentTrack.title}
              className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-xs truncate">
              {currentTrack.title}
            </p>
            {currentTrack.artist && (
              <p className="text-gray-400 text-[10px] truncate">
                {currentTrack.artist}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={toggleExpand}
            className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Player Content */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {/* Controls */}
        <div className="flex items-center justify-center gap-4 no-drag">
          <button
            onClick={playPrevious}
            className="text-gray-400 hover:text-white transition-colors"
            title="Previous"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-cyan-500/30"
          >
            {isPlaying ? (
              <Pause size={18} className="text-black" fill="currentColor" />
            ) : (
              <Play size={18} className="text-black ml-0.5" fill="currentColor" />
            )}
          </button>

          <button
            onClick={playNext}
            className="text-gray-400 hover:text-white transition-colors"
            title="Next"
          >
            <SkipForward size={18} />
          </button>

          <div className="flex-1"></div>

          <button
            onClick={() => setVolume(volume === 0 ? 0.5 : 0)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Volume"
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Progress Bar */}
        {isExpanded && (
          <>
            <div className="w-full flex items-center gap-2 no-drag">
              <span className="text-[10px] text-gray-400 w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(34 211 238) 0%, rgb(34 211 238) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.1) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <span className="text-[10px] text-gray-400 w-10">
                {formatTime(duration)}
              </span>
            </div>

            {/* Volume Slider */}
            <div className="w-full flex items-center gap-2 no-drag">
              <Volume2 size={14} className="text-gray-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(34 211 238) 0%, rgb(34 211 238) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
              <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(volume * 100)}%</span>
            </div>
          </>
        )}
      </div>

      {/* Resize Handle */}
      {isExpanded && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize no-drag"
          onMouseDown={handleResizeStart}
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(34, 211, 238, 0.3) 50%)'
          }}
        />
      )}

      {/* Custom slider styles */}
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgb(34 211 238);
          cursor: pointer;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
        }

        input[type="range"]::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgb(34 211 238);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
        }
      `}</style>
    </div>
  )
}
