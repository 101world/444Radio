/**
 * LoopRegion - Ableton-style loop region selector
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Repeat } from 'lucide-react'

interface LoopRegionProps {
  loopStart: number
  loopEnd: number
  pixelsPerSecond: number
  width: number
  enabled: boolean
  onLoopChange: (start: number, end: number) => void
  onToggle: (enabled: boolean) => void
}

export default function LoopRegion({
  loopStart,
  loopEnd,
  pixelsPerSecond,
  width,
  enabled,
  onLoopChange,
  onToggle,
}: LoopRegionProps) {
  const [isDragging, setIsDragging] = useState<'region' | 'start' | 'end' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartLoop, setDragStartLoop] = useState({ start: 0, end: 0 })
  const regionRef = useRef<HTMLDivElement>(null)

  const loopStartX = loopStart * pixelsPerSecond
  const loopEndX = loopEnd * pixelsPerSecond
  const loopWidth = loopEndX - loopStartX

  const handleRegionMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging('region')
    setDragStartX(e.clientX)
    setDragStartLoop({ start: loopStart, end: loopEnd })
  }

  const handleStartHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging('start')
    setDragStartX(e.clientX)
    setDragStartLoop({ start: loopStart, end: loopEnd })
  }

  const handleEndHandleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging('end')
    setDragStartX(e.clientX)
    setDragStartLoop({ start: loopStart, end: loopEnd })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartX
      const deltaTime = deltaX / pixelsPerSecond

      if (isDragging === 'region') {
        const newStart = Math.max(0, dragStartLoop.start + deltaTime)
        const duration = dragStartLoop.end - dragStartLoop.start
        onLoopChange(newStart, newStart + duration)
      } else if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(dragStartLoop.end - 1, dragStartLoop.start + deltaTime))
        onLoopChange(newStart, dragStartLoop.end)
      } else if (isDragging === 'end') {
        const newEnd = Math.max(dragStartLoop.start + 1, dragStartLoop.end + deltaTime)
        onLoopChange(dragStartLoop.start, newEnd)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartX, dragStartLoop, pixelsPerSecond, onLoopChange])

  if (!enabled || loopWidth < 1) return null

  return (
    <>
      {/* Loop region overlay */}
      <div
        ref={regionRef}
        className="absolute top-0 h-8 bg-cyan-500/10 border-t-2 border-b-2 border-cyan-400/40 cursor-move z-20"
        style={{
          transform: `translateX(${loopStartX}px)`,
          width: `${loopWidth}px`,
        }}
        onMouseDown={handleRegionMouseDown}
      >
        {/* Start handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-400 cursor-ew-resize hover:bg-cyan-300 transition-colors"
          onMouseDown={handleStartHandleMouseDown}
        />
        
        {/* End handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 bg-cyan-400 cursor-ew-resize hover:bg-cyan-300 transition-colors"
          onMouseDown={handleEndHandleMouseDown}
        />

        {/* Loop label */}
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 flex items-center gap-1 text-xs font-bold text-cyan-400 pointer-events-none">
          <Repeat className="w-3 h-3" />
          <span>LOOP</span>
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => onToggle(!enabled)}
        className={`absolute top-1 right-1 p-1.5 rounded transition-colors z-30 ${
          enabled
            ? 'bg-cyan-500 text-white hover:bg-cyan-600'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
        }`}
        title={enabled ? 'Disable Loop' : 'Enable Loop'}
      >
        <Repeat className="w-4 h-4" />
      </button>
    </>
  )
}
