'use client'

import { useEffect, useRef } from 'react'

interface GlassMeterProps {
  level: number // 0 to 1
  orientation?: 'vertical' | 'horizontal'
  color?: 'cyan' | 'purple' | 'pink' | 'green'
  showPeak?: boolean
  className?: string
}

export default function GlassMeter({
  level,
  orientation = 'vertical',
  color = 'cyan',
  showPeak = true,
  className = ''
}: GlassMeterProps) {
  const peakRef = useRef(0)
  const peakTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (level > peakRef.current) {
      peakRef.current = level
      clearTimeout(peakTimeoutRef.current)
      peakTimeoutRef.current = setTimeout(() => {
        peakRef.current = 0
      }, 1500)
    }
  }, [level])

  const colorClasses = {
    cyan: 'from-cyan-500/80 to-cyan-400/80',
    purple: 'from-purple-500/80 to-purple-400/80',
    pink: 'from-pink-500/80 to-pink-400/80',
    green: 'from-green-500/80 to-green-400/80'
  }

  const peakColorClasses = {
    cyan: 'bg-cyan-400',
    purple: 'bg-purple-400',
    pink: 'bg-pink-400',
    green: 'bg-green-400'
  }

  if (orientation === 'vertical') {
    return (
      <div className={`relative w-3 h-full bg-black/40 backdrop-blur-sm rounded-full border border-white/10 overflow-hidden ${className}`}>
        {/* Level fill */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${colorClasses[color]} transition-all duration-100`}
          style={{ height: `${level * 100}%` }}
        />
        
        {/* Peak indicator */}
        {showPeak && peakRef.current > 0 && (
          <div
            className={`absolute left-0 right-0 h-0.5 ${peakColorClasses[color]} transition-all duration-1500`}
            style={{ bottom: `${peakRef.current * 100}%` }}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`relative h-3 w-full bg-black/40 backdrop-blur-sm rounded-full border border-white/10 overflow-hidden ${className}`}>
      {/* Level fill */}
      <div
        className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${colorClasses[color]} transition-all duration-100`}
        style={{ width: `${level * 100}%` }}
      />
      
      {/* Peak indicator */}
      {showPeak && peakRef.current > 0 && (
        <div
          className={`absolute top-0 bottom-0 w-0.5 ${peakColorClasses[color]} transition-all duration-1500`}
          style={{ left: `${peakRef.current * 100}%` }}
        />
      )}
    </div>
  )
}
