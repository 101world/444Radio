'use client'

import { useState, useRef, useEffect } from 'react'
import { GlassPanel, GlassButton } from './glass'
import { Plus, Trash2, Move } from 'lucide-react'

export interface AutomationPoint {
  time: number // in seconds
  value: number // 0 to 1
}

export interface AutomationLane {
  id: string
  trackId: string
  parameter: 'volume' | 'pan' | 'effect'
  effectId?: string
  points: AutomationPoint[]
  color: string
}

interface AutomationEditorProps {
  lane: AutomationLane
  duration: number
  zoom: number
  playhead: number
  onAddPoint: (time: number, value: number) => void
  onMovePoint: (pointIndex: number, time: number, value: number) => void
  onDeletePoint: (pointIndex: number) => void
  onClose: () => void
}

export default function AutomationEditor({
  lane,
  duration,
  zoom,
  playhead,
  onAddPoint,
  onMovePoint,
  onDeletePoint,
  onClose
}: AutomationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)

  // Draw automation curve
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.lineWidth = 1

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Vertical grid lines (time markers)
    const interval = zoom < 20 ? 5 : zoom < 50 ? 1 : 0.5
    for (let t = 0; t <= duration; t += interval) {
      const x = (t / duration) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Draw automation curve
    if (lane.points.length > 0) {
      ctx.strokeStyle = lane.color
      ctx.lineWidth = 2
      ctx.beginPath()

      // Sort points by time
      const sortedPoints = [...lane.points].sort((a, b) => a.time - b.time)

      sortedPoints.forEach((point, index) => {
        const x = (point.time / duration) * width
        const y = height - point.value * height

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Draw points
      sortedPoints.forEach((point, index) => {
        const x = (point.time / duration) * width
        const y = height - point.value * height

        ctx.fillStyle = index === selectedPointIndex ? '#EC4899' : lane.color
        ctx.beginPath()
        ctx.arc(x, y, index === hoveredPointIndex ? 6 : 4, 0, Math.PI * 2)
        ctx.fill()

        // Draw point border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 1
        ctx.stroke()
      })
    }

    // Draw playhead
    const playheadX = (playhead / duration) * width
    ctx.strokeStyle = '#06B6D4'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()
  }, [lane, duration, zoom, playhead, selectedPointIndex, hoveredPointIndex])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const time = (x / rect.width) * duration
    const value = 1 - y / rect.height

    // Check if clicking near existing point
    const pointIndex = findNearestPoint(x, y, rect)
    if (pointIndex !== null) {
      setSelectedPointIndex(pointIndex)
    } else {
      // Add new point
      onAddPoint(Math.max(0, Math.min(duration, time)), Math.max(0, Math.min(1, value)))
      setSelectedPointIndex(lane.points.length) // Select the newly added point
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isDragging && selectedPointIndex !== null) {
      const time = (x / rect.width) * duration
      const value = 1 - y / rect.height
      onMovePoint(selectedPointIndex, Math.max(0, Math.min(duration, time)), Math.max(0, Math.min(1, value)))
    } else {
      // Update hovered point
      const pointIndex = findNearestPoint(x, y, rect)
      setHoveredPointIndex(pointIndex)
    }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pointIndex = findNearestPoint(x, y, rect)
    if (pointIndex !== null) {
      setSelectedPointIndex(pointIndex)
      setIsDragging(true)
    }
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
  }

  const findNearestPoint = (x: number, y: number, rect: DOMRect): number | null => {
    const threshold = 10 // pixels

    for (let i = 0; i < lane.points.length; i++) {
      const point = lane.points[i]
      const px = (point.time / duration) * rect.width
      const py = rect.height - point.value * rect.height

      const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2)
      if (distance < threshold) {
        return i
      }
    }

    return null
  }

  const handleDeleteSelectedPoint = () => {
    if (selectedPointIndex !== null) {
      onDeletePoint(selectedPointIndex)
      setSelectedPointIndex(null)
    }
  }

  const getParameterLabel = () => {
    switch (lane.parameter) {
      case 'volume':
        return 'Volume'
      case 'pan':
        return 'Pan'
      case 'effect':
        return `Effect ${lane.effectId || ''}`
      default:
        return 'Unknown'
    }
  }

  return (
    <GlassPanel blur="lg" glow="cyan" className="w-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-white">{getParameterLabel()} Automation</div>
          <div className="text-xs text-gray-400">{lane.points.length} points</div>
        </div>
        <div className="flex items-center gap-2">
          {selectedPointIndex !== null && (
            <GlassButton
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-3 h-3" />}
              onClick={handleDeleteSelectedPoint}
            >
              Delete Point
            </GlassButton>
          )}
          <GlassButton variant="ghost" size="sm" onClick={onClose}>
            Close
          </GlassButton>
        </div>
      </div>

      {/* Automation canvas */}
      <div className="relative bg-black/40 rounded-lg border border-white/10 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full h-48 cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {/* Instructions */}
      <div className="mt-3 text-xs text-gray-400 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Plus className="w-3 h-3" />
          <span>Click to add point</span>
        </div>
        <div className="flex items-center gap-2">
          <Move className="w-3 h-3" />
          <span>Drag to move point</span>
        </div>
        <div className="flex items-center gap-2">
          <Trash2 className="w-3 h-3" />
          <span>Select + Delete to remove</span>
        </div>
      </div>
    </GlassPanel>
  )
}
