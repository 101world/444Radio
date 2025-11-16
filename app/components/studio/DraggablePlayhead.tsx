/**
 * DraggablePlayhead - Ableton/Premiere-style draggable playhead
 * Supports grid snapping and keyboard navigation
 */

'use client'

import { useState, useEffect, useRef } from 'react'

interface DraggablePlayheadProps {
  currentTime: number
  pixelsPerSecond: number
  height: number
  isPlaying: boolean
  snapToGrid: boolean
  gridInterval: number // in seconds
  onSeek: (time: number) => void
}

export default function DraggablePlayhead({
  currentTime,
  pixelsPerSecond,
  height,
  isPlaying,
  snapToGrid,
  gridInterval,
  onSeek,
}: DraggablePlayheadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const playheadRef = useRef<HTMLDivElement>(null)

  const position = currentTime * pixelsPerSecond

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPlaying) return // Don't allow dragging while playing
    e.stopPropagation()
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = playheadRef.current?.parentElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      let newTime = Math.max(0, x / pixelsPerSecond)

      // Snap to grid if enabled
      if (snapToGrid && gridInterval > 0) {
        newTime = Math.round(newTime / gridInterval) * gridInterval
      }

      onSeek(newTime)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, pixelsPerSecond, snapToGrid, gridInterval, onSeek])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      const nudgeAmount = e.shiftKey ? 5 : 1 // Shift for larger steps
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onSeek(Math.max(0, currentTime - nudgeAmount))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onSeek(currentTime + nudgeAmount)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTime, onSeek])

  return (
    <div
      ref={playheadRef}
      className={`absolute top-0 w-1 z-30 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${isPlaying ? 'pointer-events-none' : ''}`}
      style={{
        transform: `translateX(${position}px)`,
        left: 0,
        height: `${height}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Playhead line */}
      <div className="absolute inset-0 bg-cyan-400 will-change-transform" />
      
      {/* Playhead handle */}
      <div className="absolute -top-2 -left-3 w-5 h-5 bg-cyan-400 rotate-45 shadow-lg" />
      
      {/* Playing indicator */}
      {isPlaying && (
        <div className="absolute top-0 -left-4 w-8 h-8">
          <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping" />
        </div>
      )}
      
      {/* Time tooltip */}
      {isDragging && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-cyan-400 rounded px-2 py-1 text-xs font-mono text-cyan-400 whitespace-nowrap shadow-lg">
          {formatTime(currentTime)}
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}
