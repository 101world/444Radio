import { useEffect } from 'react'

export function useEscapeKey(callback: () => void, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        callback()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [callback, isActive])
}
