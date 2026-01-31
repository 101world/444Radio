'use client'

import { useEffect } from 'react'

/**
 * Console Blocker Component
 * Suppress all console output in production for security
 * Users should not see internal logging
 */
export default function ConsoleBlocker() {
  useEffect(() => {
    // Only in production and only in browser
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      // Store originals for internal use if needed
      const _log = console.log
      const _error = console.error
      const _warn = console.warn
      const _info = console.info
      const _debug = console.debug
      
      // Override all console methods
      console.log = () => {}
      console.error = () => {}
      console.warn = () => {}
      console.info = () => {}
      console.debug = () => {}
      
      // Also block console.trace and console.table
      console.trace = () => {}
      console.table = () => {}
      console.dir = () => {}
      console.dirxml = () => {}
      console.group = () => {}
      console.groupCollapsed = () => {}
      console.groupEnd = () => {}
      console.time = () => {}
      console.timeEnd = () => {}
      console.timeLog = () => {}
      console.assert = () => {}
      console.count = () => {}
      console.countReset = () => {}
      
      // Cleanup on unmount
      return () => {
        console.log = _log
        console.error = _error
        console.warn = _warn
        console.info = _info
        console.debug = _debug
      }
    }
  }, [])
  
  return null
}
