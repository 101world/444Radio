'use client'

import { ReactNode, useState } from 'react'

interface GlassTooltipProps {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export default function GlassTooltip({
  content,
  children,
  position = 'top',
  delay = 500,
  className = ''
}: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId)
    setIsVisible(false)
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  }

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isVisible && (
        <div
          className={`absolute z-50 px-3 py-1.5 text-xs font-medium text-white bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-lg shadow-cyan-500/20 whitespace-nowrap pointer-events-none animate-in fade-in duration-200 ${positionClasses[position]}`}
        >
          {content}
          
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-black/80 border-cyan-500/30 rotate-45 ${
              position === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b' :
              position === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t' :
              position === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r' :
              'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l'
            }`}
          />
        </div>
      )}
    </div>
  )
}
