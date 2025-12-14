'use client'

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string
  tooltip?: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Accessible button component with ARIA labels and keyboard navigation
 */
const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ ariaLabel, tooltip, children, variant = 'secondary', size = 'md', className = '', ...props }, ref) => {
    const baseStyles = 'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed'
    
    const variantStyles = {
      primary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg hover:shadow-cyan-500/50',
      secondary: 'bg-white/10 hover:bg-white/20 text-white',
      ghost: 'text-gray-400 hover:text-white hover:bg-white/5',
      danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300'
    }
    
    const sizeStyles = {
      sm: 'p-1.5 text-xs rounded',
      md: 'p-2 text-sm rounded-lg',
      lg: 'p-3 text-base rounded-xl'
    }
    
    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        title={tooltip || ariaLabel}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)

AccessibleButton.displayName = 'AccessibleButton'

export default AccessibleButton
