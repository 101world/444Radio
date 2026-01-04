'use client'

import { ReactNode } from 'react'

interface GlassButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  icon?: ReactNode
}

export default function GlassButton({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled = false,
  icon
}: GlassButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }

  const variantClasses = {
    primary: `
      bg-gradient-to-r from-cyan-500/20 to-purple-500/20
      border border-cyan-500/50
      hover:from-cyan-500/30 hover:to-purple-500/30
      hover:border-cyan-500/70
      text-white
      shadow-[0_0_20px_rgba(6,182,212,0.3)]
      hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]
    `,
    secondary: `
      bg-white/5
      border border-white/20
      hover:bg-white/10
      hover:border-white/30
      text-white
    `,
    danger: `
      bg-red-500/20
      border border-red-500/50
      hover:bg-red-500/30
      hover:border-red-500/70
      text-red-200
      shadow-[0_0_20px_rgba(239,68,68,0.3)]
    `,
    ghost: `
      bg-transparent
      border border-transparent
      hover:bg-white/5
      text-gray-400
      hover:text-white
    `
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        backdrop-blur-md
        rounded-lg
        font-semibold
        transition-all
        duration-300
        flex
        items-center
        gap-2
        justify-center
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:hover:shadow-none
        ${className}
      `}
    >
      {icon}
      {children}
    </button>
  )
}
