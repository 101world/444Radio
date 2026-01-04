'use client'

import { useState, useRef, useEffect } from 'react'

interface GlassFaderProps {
  value: number // 0-1
  onChange: (value: number) => void
  orientation?: 'vertical' | 'horizontal'
  label?: string
  color?: 'cyan' | 'purple' | 'pink' | 'green'
  className?: string
  showValue?: boolean
}

export default function GlassFader({
  value,
  onChange,
  orientation = 'vertical',
  label,
  color = 'cyan',
  className = '',
  showValue = true
}: GlassFaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const colorClasses = {
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/50',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/50',
    pink: 'from-pink-500 to-pink-600 shadow-pink-500/50',
    green: 'from-green-500 to-green-600 shadow-green-500/50'
  }

  const handleMouseDown = () => setIsDragging(true)

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let newValue: number

    if (orientation === 'vertical') {
      const y = Math.max(0, Math.min(rect.height, rect.bottom - e.clientY))
      newValue = y / rect.height
    } else {
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
      newValue = x / rect.width
    }

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
    <div className={`flex ${orientation === 'vertical' ? 'flex-col' : 'flex-row'} items-center gap-2 ${className}`}>
      {label && (
        <div className="text-xs text-gray-400 font-mono">
          {label}
        </div>
      )}
      
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={`
          relative
          ${orientation === 'vertical' ? 'w-8 h-32' : 'w-32 h-8'}
          bg-black/60
          backdrop-blur-md
          border
          border-white/10
          rounded-full
          cursor-pointer
          hover:border-white/20
          transition-all
        `}
      >
        {/* Track */}
        <div
          className={`
            absolute
            bg-gradient-to-${orientation === 'vertical' ? 't' : 'r'}
            ${colorClasses[color]}
            rounded-full
            ${orientation === 'vertical' 
              ? 'bottom-0 left-0 right-0' 
              : 'left-0 top-0 bottom-0'
            }
            transition-all
            duration-75
            shadow-lg
          `}
          style={{
            [orientation === 'vertical' ? 'height' : 'width']: `${value * 100}%`
          }}
        />

        {/* Thumb */}
        <div
          className={`
            absolute
            w-4
            h-4
            bg-white
            rounded-full
            shadow-lg
            transform
            -translate-x-1/2
            ${orientation === 'vertical' ? '-translate-y-1/2' : 'translate-y-1/2'}
            ${isDragging ? 'scale-125' : 'scale-100'}
            transition-transform
          `}
          style={{
            [orientation === 'vertical' ? 'bottom' : 'left']: `${value * 100}%`,
            [orientation === 'vertical' ? 'left' : 'top']: '50%'
          }}
        />
      </div>

      {showValue && (
        <div className="text-xs text-white font-mono font-bold min-w-[2rem] text-center">
          {displayValue}
        </div>
      )}
    </div>
  )
}
