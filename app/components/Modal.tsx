/**
 * Professional Modal Component
 * Task 4: Modal System for Track Settings, Export, Save/Load
 */
'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'
import { modalStyles, buttonStyles } from '@/lib/design-system'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        className={`${modalStyles.content} ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={modalStyles.header}>
          <h2 className={modalStyles.title}>{title}</h2>
          {showCloseButton && (
            <button onClick={onClose} className={buttonStyles.icon}>
              <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            </button>
          )}
        </div>
        <div className={modalStyles.body}>{children}</div>
      </div>
    </div>
  )
}

interface ModalActionsProps {
  children: React.ReactNode
}

export function ModalActions({ children }: ModalActionsProps) {
  return <div className={modalStyles.footer}>{children}</div>
}
