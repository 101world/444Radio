'use client'

import { useState, useRef, useEffect } from 'react'

interface GlassKnobProps {
  value: number // 0-1
  onChange: (value: number) => void
  label?: string
  color?: 'cyan' | 'purple' | 'pink' | 'green'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showValue?: boolean
}

export default function GlassKnob({
  value,
  onChange,
  label,
  color = 'cyan',
  size = 'md',
  className = '',
  showValue = true
}: GlassKnobProps) {
  const [isDragging, setIsDragging] = useState(false)
  const knobRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startValueRef = useRef(0)

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  }

  const colorClasses = {
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/50',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/50',
    pink: 'from-pink-500 to-pink-600 shadow-pink-500/50',
    green: 'from-green-500 to-green-600 shadow-green-500/50'
  }

  // Convert value (0-1) to rotation angle (-135 to 135 degrees)
  const rotation = (value * 270) - 135

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    startYRef.current = e.clientY
    startValueRef.current = value
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const deltaY = startYRef.current - e.clientY
    const sensitivity = 0.005
    const newValue = startValueRef.current + (deltaY * sensitivity)
    
    onChange(Math.max(0, Math.min(1, newValue)))
  }

  const handleMouseUp = () => setIsDragging(false)

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  const displayValue = Math.round(value * 100)

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {label && (
        <div className="text-xs text-gray-400 font-mono">
          {label}
        </div>
      )}

      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        className={`
          relative
          ${sizeClasses[size]}
          bg-black/60
          backdrop-blur-md
          border-2
          border-white/20
          rounded-full
          cursor-pointer
          hover:border-white/30
          transition-all
          ${isDragging ? 'scale-110' : 'scale-100'}
        `}
      >
        {/* Rotation indicator */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            className={`
              w-1
              h-1/3
              bg-gradient-to-t
              ${colorClasses[color]}
              rounded-full
              shadow-lg
              origin-bottom
            `}
          />
        </div>

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      </div>

      {showValue && (
        <div className="text-xs text-white font-mono font-bold">
          {displayValue}
        </div>
      )}
    </div>
  )
}
