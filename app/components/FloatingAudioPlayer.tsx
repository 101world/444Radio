'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Minimize2, GripVertical, ChevronDown, ChevronUp, List, X, Repeat, Repeat1, Shuffle, RotateCcw, RotateCw, Maximize, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

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
    playlist,
    queue,
    playTrack,
    playFromQueue,
    removeFromPlaylist,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isLooping,
    isShuffled,
    toggleLoop,
    toggleShuffle,
    skipBackward,
    skipForward
  } = useAudioPlayer()

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false)

  // Position and size state
  const [position, setPosition] = useState({ x: 20, y: typeof window !== 'undefined' ? window.innerHeight - 200 : 100 })
  const [size, setSize] = useState({ width: 400, height: 140 })
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [showCoverArt, setShowCoverArt] = useState(false)
  const [activeTab, setActiveTab] = useState<'player' | 'queue'>('player')
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  
  const playerRef = useRef<HTMLDivElement>(null)

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Dragging handlers (only for desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return
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

  // Resize handler (only for desktop)
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isMobile) return
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    })
  }

  useEffect(() => {
    if (isMobile) return // No dragging/resizing on mobile

    const handleMove = (e: MouseEvent) => {
      if (isDragging && typeof window !== 'undefined') {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x))
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.y))
        setPosition({ x: newX, y: newY })
      }
      
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        const newWidth = Math.max(320, Math.min(900, resizeStart.width + deltaX))
        const newHeight = Math.max(140, Math.min(500, resizeStart.height + deltaY))
        setSize({ width: newWidth, height: newHeight })
      }
    }

    if (isDragging || isResizing) {
      document.body.style.cursor = isDragging ? 'move' : 'nwse-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isMobile, isDragging, isResizing, dragOffset, resizeStart, size.width, size.height])

  // Toggle expand/collapse
  const toggleExpand = () => {
    if (isExpanded) {
      setSize({ width: 300, height: 80 })
    } else {
      setSize({ width: 400, height: 140 })
    }
    setIsExpanded(!isExpanded)
  }

  // Close size menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSizeMenu && !(e.target as HTMLElement).closest('.size-menu-container')) {
        setShowSizeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSizeMenu])

  // Don't show if no track is loaded
  if (!currentTrack) return null

  // Mobile layout - docked at top
  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 shadow-2xl transition-all duration-300" style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
        }}>
          <div className="px-3 py-2">
            {/* Track Info & Controls Row */}
            <div className="flex items-center gap-3">
              {/* Album Art */}
              {currentTrack.imageUrl && (
                <Image
                  src={currentTrack.imageUrl}
                  alt={currentTrack.title}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              )}
              
              {/* Track Info */}
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

              {/* Playback Controls */}
              {!isMobileCollapsed && (
                <div className="flex items-center gap-2">
                  {/* Shuffle */}
                  <button
                    onClick={toggleShuffle}
                    className={`transition-colors ${isShuffled ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    title="Shuffle"
                  >
                    <Shuffle size={14} />
                  </button>

                  {/* Previous */}
                  <button
                    onClick={playPrevious}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Previous"
                  >
                    <SkipBack size={16} />
                  </button>

                  {/* Play/Pause */}
                  <button
                    onClick={togglePlayPause}
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-cyan-500/30"
                  >
                    {isPlaying ? (
                      <Pause size={14} className="text-black" fill="currentColor" />
                    ) : (
                      <Play size={14} className="text-black ml-0.5" fill="currentColor" />
                    )}
                  </button>

                  {/* Next */}
                  <button
                    onClick={playNext}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Next"
                  >
                    <SkipForward size={16} />
                  </button>

                  {/* Loop */}
                  <button
                    onClick={toggleLoop}
                    className={`transition-colors ${isLooping ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                    title={isLooping ? "Loop: On" : "Loop: Off"}
                  >
                    <Repeat size={14} />
                  </button>
                </div>
              )}

              {/* Quick Play/Pause when collapsed */}
              {isMobileCollapsed && (
                <button
                  onClick={togglePlayPause}
                  className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-cyan-500/30"
                >
                  {isPlaying ? (
                    <Pause size={12} className="text-black" fill="currentColor" />
                  ) : (
                    <Play size={12} className="text-black ml-0.5" fill="currentColor" />
                  )}
                </button>
              )}

              {/* Queue Button */}
              <button
                onClick={() => setShowQueue(!showQueue)}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
                title="Queue"
              >
                <List size={18} />
              </button>

              {/* Collapse Button */}
              <button
                onClick={() => setIsMobileCollapsed(!isMobileCollapsed)}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
                title={isMobileCollapsed ? "Expand" : "Collapse"}
              >
                {isMobileCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>

            {/* Progress Bar - Only show when expanded */}
            {!isMobileCollapsed && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] text-gray-400 w-8 text-right">
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
                <span className="text-[9px] text-gray-400 w-8">
                  {formatTime(duration)}
                </span>
              </div>
            )}

            {/* Queue Section - Expandable */}
            {showQueue && !isMobileCollapsed && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Queue ({playlist.length})</span>
                </div>
                <div className="max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
                  {playlist.length === 0 ? (
                    <div className="py-4 text-center text-gray-500 text-xs">
                      No tracks in queue
                    </div>
                  ) : (
                    playlist.map((track, index) => {
                      const isCurrentTrack = currentTrack?.id === track.id
                      return (
                        <div
                          key={`${track.id}-${index}`}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1 transition-colors ${
                            isCurrentTrack
                              ? 'bg-cyan-500/20 border border-cyan-500/30'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <button
                            onClick={() => playTrack(track)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            <span className="text-[9px] text-gray-500 w-4 flex-shrink-0">
                              {index + 1}
                            </span>
                            {track.imageUrl && (
                              <Image
                                src={track.imageUrl}
                                alt={track.title}
                                width={28}
                                height={28}
                                className="w-7 h-7 rounded object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-[10px] truncate ${
                                isCurrentTrack ? 'text-cyan-400 font-semibold' : 'text-white'
                              }`}>
                                {track.title}
                              </p>
                              {track.artist && (
                                <p className="text-[9px] text-gray-400 truncate">
                                  {track.artist}
                                </p>
                              )}
                            </div>
                            {isCurrentTrack && isPlaying && (
                              <div className="flex gap-0.5 flex-shrink-0">
                                <div className="w-0.5 h-2 bg-cyan-400 animate-pulse"></div>
                                <div className="w-0.5 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-0.5 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                              </div>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromPlaylist(track.id)
                            }}
                            className="text-gray-500 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                            title="Remove from queue"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Custom slider styles */}
        <style jsx>{`
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgb(34 211 238);
            cursor: pointer;
            box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
          }

          input[type="range"]::-moz-range-thumb {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: rgb(34 211 238);
            cursor: pointer;
            border: none;
            box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
          }
        `}</style>
      </>
    )
  }

  // Desktop layout - floating player
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
            <Image
              src={currentTrack.imageUrl}
              alt={currentTrack.title}
              width={32}
              height={32}
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
        
        <div className="flex items-center gap-1 no-drag relative">
          {/* Size Picker */}
          <div className="relative size-menu-container">
            <button
              onClick={() => setShowSizeMenu(!showSizeMenu)}
              className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
              title="Resize player"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
              </svg>
            </button>
            
            {/* Size Menu Dropdown */}
            {showSizeMenu && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-cyan-500/20 rounded-lg shadow-xl z-50 min-w-[140px]">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setSize({ width: 350, height: 120 })
                      setShowSizeMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                      size.width === 350 ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    Small
                  </button>
                  <button
                    onClick={() => {
                      setSize({ width: 400, height: 140 })
                      setShowSizeMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                      size.width === 400 ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => {
                      setSize({ width: 500, height: 180 })
                      setShowSizeMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                      size.width === 500 ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    Large
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleExpand}
            className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      {isExpanded && (
        <div className="flex border-b border-cyan-500/10 no-drag">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'player'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Player
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors relative ${
              activeTab === 'queue'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Queue
            {playlist.length > 0 && (
              <span className="ml-1 text-[9px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">
                {playlist.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Player Content */}
      {activeTab === 'player' && (
        <div className="px-4 py-3 flex flex-col gap-2">
          {/* Main Controls */}
          <div className="flex items-center justify-center gap-3 no-drag">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              className={`transition-colors ${isShuffled ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>

            {/* Rewind 10s */}
            <button
              onClick={() => skipBackward(10)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Rewind 10s"
            >
              <RotateCcw size={16} />
            </button>

            {/* Previous */}
            <button
              onClick={playPrevious}
              className="text-gray-400 hover:text-white transition-colors"
              title="Previous"
            >
              <SkipBack size={18} />
            </button>

            {/* Play/Pause */}
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

            {/* Next */}
            <button
              onClick={playNext}
              className="text-gray-400 hover:text-white transition-colors"
              title="Next"
            >
              <SkipForward size={18} />
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => skipForward(10)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Forward 10s"
            >
              <RotateCw size={16} />
            </button>

            {/* Loop */}
            <button
              onClick={toggleLoop}
              className={`transition-colors ${isLooping ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
              title={isLooping ? "Loop: On" : "Loop: Off"}
            >
              <Repeat size={16} />
            </button>
          </div>

          {/* Progress Bar & Volume */}
          {isExpanded && (
            <>
              <div className="w-full flex items-center gap-2 no-drag mt-1">
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

              {/* Volume & Cover Art */}
              <div className="w-full flex items-center gap-3 no-drag">
                {/* Volume Slider */}
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
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

              {/* Cover Art Button */}
              <button
                onClick={() => setShowCoverArt(true)}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
                title="View Cover Art"
              >
                <Maximize size={16} />
              </button>
            </div>
          </>
        )}
      </div>
      )}

      {/* Queue Content */}
      {activeTab === 'queue' && isExpanded && (
        <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: `${size.height - 120}px` }}>
          {queue.length === 0 ? (
            <div className="py-8 text-center text-gray-400">
              <List size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">Your queue is empty</p>
              <p className="text-[10px] mt-1 opacity-60">Add tracks to build your playlist</p>
            </div>
          ) : (
            <>
              {/* Queue Actions */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                <p className="text-xs text-gray-400">
                  {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
                </p>
                <button
                  onClick={clearQueue}
                  className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Clear All
                </button>
              </div>

              {/* Draggable Queue */}
              <DragDropContext onDragEnd={(result: DropResult) => {
                if (!result.destination) return
                reorderQueue(result.source.index, result.destination.index)
              }}>
                <Droppable droppableId="queue">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-1"
                    >
                      {queue.map((track, index) => {
                        const isCurrentTrack = currentTrack?.id === track.id
                        return (
                          <Draggable key={track.id} draggableId={track.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                                  snapshot.isDragging
                                    ? 'bg-cyan-500/30 shadow-lg shadow-cyan-500/20 scale-105'
                                    : isCurrentTrack
                                    ? 'bg-cyan-500/20 border border-cyan-500/30'
                                    : 'hover:bg-white/5'
                                }`}
                              >
                                {/* Drag Handle */}
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-400 flex-shrink-0">
                                  <GripVertical size={14} />
                                </div>

                                {/* Track Number */}
                                <span className="text-[10px] text-gray-500 w-5 font-mono flex-shrink-0">
                                  {index + 1}
                                </span>

                                {/* Track Info */}
                                <button
                                  onClick={() => playFromQueue(track)}
                                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                >
                                  {track.imageUrl && (
                                    <Image
                                      src={track.imageUrl}
                                      alt={track.title}
                                      width={32}
                                      height={32}
                                      className="w-8 h-8 rounded object-cover flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] truncate ${
                                      isCurrentTrack ? 'text-cyan-400 font-semibold' : 'text-white'
                                    }`}>
                                      {track.title}
                                    </p>
                                    {track.artist && (
                                      <p className="text-[9px] text-gray-400 truncate">
                                        {track.artist}
                                      </p>
                                    )}
                                  </div>
                                  {isCurrentTrack && isPlaying && (
                                    <div className="flex gap-0.5 flex-shrink-0">
                                      <div className="w-0.5 h-2 bg-cyan-400 animate-pulse"></div>
                                      <div className="w-0.5 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                      <div className="w-0.5 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                  )}
                                </button>

                                {/* Remove Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeFromQueue(track.id)
                                  }}
                                  className="text-gray-500 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                                  title="Remove from queue"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </>
          )}
        </div>
      )}

      {/* Resize Handle */}
      {isExpanded && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize no-drag group/resize hover:bg-cyan-500/20 rounded-tl-lg transition-colors"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <svg className="w-full h-full p-1 text-cyan-400/40 group-hover/resize:text-cyan-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22 22H20V20H22V22M22 18H20V16H22V18M18 22H16V20H18V22M18 18H16V16H18V18M14 22H12V20H14V22M22 14H20V12H22V14Z"/>
          </svg>
        </div>
      )}

      {/* Cover Art Modal - Improved Fullscreen Experience */}
      {showCoverArt && currentTrack && (
        <div 
          className="fixed inset-0 z-[100] bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4 md:p-8"
          onClick={() => setShowCoverArt(false)}
        >
          <div className="max-w-4xl w-full space-y-8" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setShowCoverArt(false)}
              className="absolute top-4 right-4 md:top-8 md:right-8 text-white/60 hover:text-white transition-colors bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full p-3"
              aria-label="Close"
            >
              <X size={24} />
            </button>

            {/* Cover Art */}
            {currentTrack.imageUrl && (
              <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl shadow-cyan-500/20 ring-1 ring-white/10">
                <Image
                  src={currentTrack.imageUrl}
                  alt={currentTrack.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}

            {/* Track Info */}
            <div className="text-center space-y-3">
              <h2 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                {currentTrack.title}
              </h2>
              {currentTrack.artist && (
                <p className="text-xl md:text-2xl text-cyan-400">
                  {currentTrack.artist}
                </p>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-3">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(34 211 238) 0%, rgb(34 211 238) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div className="flex justify-between text-sm md:text-base text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 md:gap-8">
              <button
                onClick={toggleShuffle}
                className={`transition-colors ${isShuffled ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                aria-label="Shuffle"
              >
                <Shuffle size={28} />
              </button>

              <button
                onClick={() => skipBackward(10)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Rewind 10s"
              >
                <RotateCcw size={28} />
              </button>

              <button
                onClick={playPrevious}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Previous"
              >
                <SkipBack size={32} />
              </button>

              <button
                onClick={togglePlayPause}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 flex items-center justify-center transition-all active:scale-95 shadow-2xl shadow-cyan-500/50"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={36} className="text-black" fill="currentColor" />
                ) : (
                  <Play size={36} className="text-black ml-1" fill="currentColor" />
                )}
              </button>

              <button
                onClick={playNext}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Next"
              >
                <SkipForward size={32} />
              </button>

              <button
                onClick={() => skipForward(10)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Forward 10s"
              >
                <RotateCw size={28} />
              </button>

              <button
                onClick={toggleLoop}
                className={`transition-colors ${isLooping ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                aria-label={isLooping ? "Loop: On" : "Loop: Off"}
              >
                <Repeat size={28} />
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-4 max-w-md mx-auto">
              <button
                onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(34 211 238) 0%, rgb(34 211 238) ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <span className="text-sm text-gray-400 w-12 text-right">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
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
