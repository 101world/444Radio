'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'

/**
 * Hook to ensure the current user is synced to the database
 * Call this in the root layout or app component
 */
export function useUserSync() {
  const { user, isLoaded } = useUser()
  const hasSynced = useRef(false)

  useEffect(() => {
    if (isLoaded && user && !hasSynced.current) {
      hasSynced.current = true
      
      // Sync user to database
      fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log('✅ User synced to database')
          } else {
            console.error('❌ Failed to sync user:', data.error)
          }
        })
        .catch(err => {
          console.error('❌ User sync error:', err)
        })
    }
  }, [isLoaded, user])
}
