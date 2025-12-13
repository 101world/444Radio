/**
 * Tooltip Component
 * Task 13: Keyboard shortcuts tooltips
 */
'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tooltipStyles } from '@/lib/design-system'

interface TooltipProps {
  content: string
  shortcut?: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({ 
  content, 
  shortcut, 
  children, 
  position = 'top',
  delay = 500 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const updatePosition = () => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let x = 0
    let y = 0

    switch (position) {
      case 'top':
        x = rect.left + rect.width / 2
        y = rect.top - 10
        break
      case 'bottom':
        x = rect.left + rect.width / 2
        y = rect.bottom + 10
        break
      case 'left':
        x = rect.left - 10
        y = rect.top + rect.height / 2
        break
      case 'right':
        x = rect.right + 10
        y = rect.top + rect.height / 2
        break
    }

    setCoords({ x, y })
  }

  const handleMouseEnter = () => {
    updatePosition()
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const positionClasses = {
    top: '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left: '-translate-x-full -translate-y-1/2',
    right: '-translate-y-1/2',
  }

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`${tooltipStyles.base} ${positionClasses[position]}`}
            style={{
              position: 'fixed',
              left: `${coords.x}px`,
              top: `${coords.y}px`,
            }}
          >
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut && (
                <kbd className="px-2 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] font-mono">
                  {shortcut}
                </kbd>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
