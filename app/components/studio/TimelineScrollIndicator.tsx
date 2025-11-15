/**
 * TimelineScrollIndicator - Unified glassmorphism scrollbar overlay
 * Appears only when scrolling, minimal and elegant
 */
'use client'

import { useEffect, useRef, useState } from 'react'

interface ScrollIndicatorProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>
}

export default function TimelineScrollIndicator({ scrollContainerRef }: ScrollIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false)
  const [indicatorWidth, setIndicatorWidth] = useState(0)
  const [indicatorLeft, setIndicatorLeft] = useState(0)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateScrollIndicator = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      
      // Calculate indicator size and position
      const visibleRatio = clientWidth / scrollWidth
      const scrollRatio = scrollLeft / (scrollWidth - clientWidth)
      
      // Only show if content is wider than container
      if (visibleRatio >= 1) {
        setShowIndicator(false)
        return
      }

      const indicatorW = Math.max(50, visibleRatio * clientWidth)
      const maxLeft = clientWidth - indicatorW
      const indicatorL = scrollRatio * maxLeft

      setIndicatorWidth(indicatorW)
      setIndicatorLeft(indicatorL)
      setShowIndicator(true)

      // Hide after 1.5s of no scrolling
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowIndicator(false)
      }, 1500)
    }

    container.addEventListener('scroll', updateScrollIndicator)
    window.addEventListener('resize', updateScrollIndicator)
    
    // Initial check
    updateScrollIndicator()

    return () => {
      container.removeEventListener('scroll', updateScrollIndicator)
      window.removeEventListener('resize', updateScrollIndicator)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [scrollContainerRef])

  if (!showIndicator) return null

  return (
    <div 
      className="fixed bottom-4 left-1/2 -translate-x-1/2 h-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-teal-500/20 shadow-2xl shadow-black/40 pointer-events-none z-50 transition-opacity duration-300"
      style={{ 
        width: '40%',
        maxWidth: '600px'
      }}
    >
      <div
        className="absolute top-0 h-full rounded-full bg-gradient-to-r from-teal-500/80 to-cyan-500/80 transition-all duration-150 ease-out shadow-lg shadow-teal-500/40"
        style={{
          width: `${indicatorWidth}px`,
          left: `${indicatorLeft}px`,
        }}
      />
    </div>
  )
}
