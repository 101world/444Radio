'use client'

import { useUser } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import { useEffect } from 'react'

/**
 * /profile → redirects to /profile/[currentUserId]
 * Prevents 404 when navigating to /profile without a userId
 */
export default function ProfileRedirect() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded && user) {
      redirect(`/profile/${user.id}`)
    } else if (isLoaded && !user) {
      redirect('/sign-in')
    }
  }, [isLoaded, user])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="animate-pulse text-white/60 text-sm">Redirecting to profile...</div>
    </div>
  )
}
