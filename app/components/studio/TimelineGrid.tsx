/**
 * TimelineGrid - Ableton/Premiere-style time grid
 * Shows seconds/bars with major and minor gridlines
 */

'use client'

import { useMemo } from 'react'

interface TimelineGridProps {
  duration: number // Total timeline duration in seconds
  pixelsPerSecond: number
  width: number
  height: number
}

export default function TimelineGrid({ duration, pixelsPerSecond, width, height }: TimelineGridProps) {
  const gridLines = useMemo(() => {
    const lines: Array<{ x: number; type: 'minor' | 'major' | 'label'; time: number }> = []
    
    // Generate gridlines every 1 second (minor) and every 5 seconds (major)
    for (let t = 0; t <= duration; t++) {
      const x = t * pixelsPerSecond
      
      if (t % 10 === 0) {
        lines.push({ x, type: 'label', time: t })
      } else if (t % 5 === 0) {
        lines.push({ x, type: 'major', time: t })
      } else {
        lines.push({ x, type: 'minor', time: t })
      }
    }
    
    return lines
  }, [duration, pixelsPerSecond])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      <svg width={width} height={height} className="absolute inset-0">
        <defs>
          <pattern
            id="grid-minor"
            width={pixelsPerSecond}
            height={height}
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={height}
              stroke="rgba(100, 255, 255, 0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        
        {/* Minor gridlines */}
        <rect width={width} height={height} fill="url(#grid-minor)" />
        
        {/* Major gridlines and labels */}
        {gridLines.map((line, index) => (
          <g key={index}>
            {line.type === 'major' && (
              <line
                x1={line.x}
                y1="0"
                x2={line.x}
                y2={height}
                stroke="rgba(100, 255, 255, 0.15)"
                strokeWidth="1"
              />
            )}
            {line.type === 'label' && (
              <>
                <line
                  x1={line.x}
                  y1="0"
                  x2={line.x}
                  y2={height}
                  stroke="rgba(100, 255, 255, 0.25)"
                  strokeWidth="1.5"
                />
                <text
                  x={line.x + 4}
                  y="14"
                  fill="rgba(100, 255, 255, 0.6)"
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight="500"
                >
                  {formatTime(line.time)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
