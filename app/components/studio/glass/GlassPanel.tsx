'use client'

import { ReactNode } from 'react'

interface GlassPanelProps {
  children: ReactNode
  className?: string
  glow?: 'cyan' | 'purple' | 'pink' | 'none'
  blur?: 'sm' | 'md' | 'lg' | 'xl'
  onClick?: () => void
}

export default function GlassPanel({ 
  children, 
  className = '', 
  glow = 'none',
  blur = 'md',
  onClick 
}: GlassPanelProps) {
  const blurClasses = {
    sm: 'backdrop-blur-sm',
    md: 'backdrop-blur-md',
    lg: 'backdrop-blur-lg',
    xl: 'backdrop-blur-xl'
  }

  const glowClasses = {
    cyan: 'shadow-[0_0_30px_rgba(6,182,212,0.3)] border-cyan-500/30 hover:border-cyan-500/50',
    purple: 'shadow-[0_0_30px_rgba(168,85,247,0.3)] border-purple-500/30 hover:border-purple-500/50',
    pink: 'shadow-[0_0_30px_rgba(236,72,153,0.3)] border-pink-500/30 hover:border-pink-500/50',
    none: 'border-white/10 hover:border-white/20'
  }

  return (
    <div
      onClick={onClick}
      className={`
        ${blurClasses[blur]}
        bg-black/40 
        border 
        ${glowClasses[glow]}
        rounded-xl 
        transition-all 
        duration-300
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
