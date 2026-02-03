/**
 * Console Suppressor for Production
 * Hides all console logs, errors, and warnings from users
 * Makes the app look professional and secure
 */

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
}

export function suppressConsole() {
  if (typeof window === 'undefined') return // Server-side, keep logs for debugging

  // Only suppress in production
  if (process.env.NODE_ENV === 'production') {
    console.log = () => {}
    console.error = () => {}
    console.warn = () => {}
    console.info = () => {}
    console.debug = () => {}
  }
  
  // In development, suppress SES warnings only
  if (process.env.NODE_ENV === 'development') {
    const originalWarn = console.warn
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || ''
      // Suppress SES lockdown warnings
      if (message.includes('SES') || message.includes('lockdown-install') || message.includes('Removing unpermitted intrinsics')) {
        return
      }
      originalWarn.apply(console, args)
    }
  }
}

export function restoreConsole() {
  console.log = originalConsole.log
  console.error = originalConsole.error
  console.warn = originalConsole.warn
  console.info = originalConsole.info
  console.debug = originalConsole.debug
}

// Auto-suppress on import in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  suppressConsole()
}
