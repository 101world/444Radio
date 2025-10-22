'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Minimize2, GripVertical, ChevronDown, ChevronUp, List, X } from 'lucide-react'
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
    playlist,
    playTrack,
  } = useAudioPlayer()

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false)

  // Position and size state
  const [position, setPosition] = useState({ x: 20, y: typeof window !== 'undefined' ? window.innerHeight - 200 : 100 })
  const [size, setSize] = useState({ width: 400, height: 140 })
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  
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
                <img
                  src={currentTrack.imageUrl}
                  alt={currentTrack.title}
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
                  <button
                    onClick={playPrevious}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Previous"
                  >
                    <SkipBack size={16} />
                  </button>

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

                  <button
                    onClick={playNext}
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Next"
                  >
                    <SkipForward size={16} />
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
          </div>
        </div>

        {/* Queue Modal for Mobile */}
        {showQueue && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end">
            <div className="w-full bg-gradient-to-b from-gray-900 to-black rounded-t-2xl max-h-[70vh] overflow-hidden shadow-2xl border-t border-cyan-500/20">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <List size={20} className="text-cyan-400" />
                  Queue ({playlist.length} tracks)
                </h3>
                <button
                  onClick={() => setShowQueue(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Queue List */}
              <div className="overflow-y-auto max-h-[calc(70vh-60px)] scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent">
                {playlist.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <List size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No tracks in queue</p>
                  </div>
                ) : (
                  playlist.map((track, index) => {
                    const isCurrentTrack = currentTrack?.id === track.id
                    return (
                      <button
                        key={`${track.id}-${index}`}
                        onClick={() => {
                          playTrack(track)
                          setShowQueue(false)
                        }}
                        className={`w-full flex items-center gap-3 p-3 transition-colors border-b border-white/5 ${
                          isCurrentTrack 
                            ? 'bg-cyan-500/10 border-l-4 border-l-cyan-400' 
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="text-gray-500 text-xs font-mono w-6 text-center">
                          {index + 1}
                        </div>
                        {track.imageUrl && (
                          <img
                            src={track.imageUrl}
                            alt={track.title}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <p className={`text-sm truncate ${
                            isCurrentTrack ? 'text-cyan-400 font-semibold' : 'text-white'
                          }`}>
                            {track.title}
                          </p>
                          {track.artist && (
                            <p className="text-xs text-gray-400 truncate">
                              {track.artist}
                            </p>
                          )}
                        </div>
                        {isCurrentTrack && isPlaying && (
                          <div className="flex gap-0.5">
                            <div className="w-0.5 h-3 bg-cyan-400 animate-pulse"></div>
                            <div className="w-0.5 h-3 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-0.5 h-3 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

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
            onClick={() => setShowQueue(!showQueue)}
            className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
            title="Queue"
          >
            <List size={14} />
          </button>
          <button
            onClick={toggleExpand}
            className="text-gray-400 hover:text-cyan-400 transition-colors p-1"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Queue Panel - Desktop */}
      {showQueue && (
        <div 
          className="absolute left-full ml-2 top-0 w-80 rounded-xl shadow-2xl overflow-hidden no-drag"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(34, 211, 238, 0.2)',
            maxHeight: `${size.height}px`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/10">
            <h3 className="text-white font-semibold text-xs flex items-center gap-2">
              <List size={14} className="text-cyan-400" />
              Queue ({playlist.length})
            </h3>
            <button
              onClick={() => setShowQueue(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <X size={14} />
            </button>
          </div>

          {/* Queue List */}
          <div className="overflow-y-auto" style={{ maxHeight: `${size.height - 40}px` }}>
            {playlist.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <List size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No tracks in queue</p>
              </div>
            ) : (
              playlist.map((track, index) => {
                const isCurrentTrack = currentTrack?.id === track.id
                return (
                  <button
                    key={`${track.id}-${index}`}
                    onClick={() => playTrack(track)}
                    className={`w-full flex items-center gap-2 p-2 transition-colors border-b border-white/5 ${
                      isCurrentTrack 
                        ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' 
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="text-gray-500 text-[10px] font-mono w-5 text-center">
                      {index + 1}
                    </div>
                    {track.imageUrl && (
                      <img
                        src={track.imageUrl}
                        alt={track.title}
                        className="w-8 h-8 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 text-left">
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
                      <div className="flex gap-0.5">
                        <div className="w-0.5 h-2 bg-cyan-400 animate-pulse"></div>
                        <div className="w-0.5 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-0.5 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

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
