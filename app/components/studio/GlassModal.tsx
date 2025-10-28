'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface GlassModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  buttons?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary' | 'danger'
  }>
  toolbar?: Array<{
    label: string
    onClick: () => void
  }>
}

export default function GlassModal({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
  buttons = [],
  toolbar = []
}: GlassModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widthClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full ${widthClasses[width]} glassmorphism rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Title Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {title}
            </h2>
            {toolbar.length > 0 && (
              <div className="flex gap-2">
                {toolbar.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={item.onClick}
                    className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>

        {/* Bottom Buttons */}
        {buttons.length > 0 && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all duration-300"
            >
              Cancel
            </button>
            {buttons.map((btn, idx) => {
              const variantClasses = {
                primary: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
                secondary: 'bg-white/10 hover:bg-white/20',
                danger: 'bg-red-500/80 hover:bg-red-600'
              }
              return (
                <button
                  key={idx}
                  onClick={btn.onClick}
                  className={`px-6 py-2 rounded-lg text-white font-medium transition-all duration-300 ${variantClasses[btn.variant || 'primary']}`}
                >
                  {btn.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
