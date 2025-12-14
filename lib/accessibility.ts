import { useEffect } from 'react'

export interface KeyboardShortcut {
  key: string
  description: string
  action: () => void
  shift?: boolean
  ctrl?: boolean
  alt?: boolean
}

/**
 * Global keyboard shortcuts hook with accessibility
 * Provides keyboard navigation for audio player and app-wide shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return
      }

      shortcuts.forEach(shortcut => {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const shiftMatches = !shortcut.shift || e.shiftKey
        const ctrlMatches = !shortcut.ctrl || (e.ctrlKey || e.metaKey)
        const altMatches = !shortcut.alt || e.altKey

        if (keyMatches && shiftMatches && ctrlMatches && altMatches) {
          e.preventDefault()
          shortcut.action()
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

/**
 * Focus management for modals and dialogs
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element on mount
    firstElement?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const closeButton = container.querySelector<HTMLElement>('[data-close-button]')
        closeButton?.click()
      }
    }

    container.addEventListener('keydown', handleTabKey)
    container.addEventListener('keydown', handleEscapeKey)

    return () => {
      container.removeEventListener('keydown', handleTabKey)
      container.removeEventListener('keydown', handleEscapeKey)
    }
  }, [containerRef, isActive])
}

/**
 * Skip to main content for screen readers
 */
export function useSkipToContent() {
  useEffect(() => {
    const handleSkipLink = (e: Event) => {
      e.preventDefault()
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        mainContent.tabIndex = -1
        mainContent.focus()
        mainContent.removeAttribute('tabindex')
      }
    }

    const skipLink = document.getElementById('skip-to-content')
    skipLink?.addEventListener('click', handleSkipLink)
    
    return () => skipLink?.removeEventListener('click', handleSkipLink)
  }, [])
}

/**
 * Announce content changes to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Audio player keyboard shortcuts
 */
export const AUDIO_PLAYER_SHORTCUTS: KeyboardShortcut[] = [
  { key: ' ', description: 'Play/Pause', action: () => {} }, // Will be filled by component
  { key: 'ArrowRight', description: 'Skip forward 10s', action: () => {} },
  { key: 'ArrowLeft', description: 'Skip backward 10s', action: () => {} },
  { key: 'ArrowRight', shift: true, description: 'Next track', action: () => {} },
  { key: 'ArrowLeft', shift: true, description: 'Previous track', action: () => {} },
  { key: 'ArrowUp', description: 'Volume up', action: () => {} },
  { key: 'ArrowDown', description: 'Volume down', action: () => {} },
  { key: 'm', description: 'Mute/Unmute', action: () => {} },
  { key: 'l', description: 'Toggle loop', action: () => {} },
  { key: 's', description: 'Toggle shuffle', action: () => {} },
]
