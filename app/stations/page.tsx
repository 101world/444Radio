'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function StationsPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded) {
      if (user) {
        // Redirect to user's own station
        router.replace(`/profile/${user.id}`)
      } else {
        // Redirect to sign in
        router.replace('/sign-in')
      }
    }
  }, [user, isLoaded, router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white/60">Redirecting to stations...</p>
      </div>
    </div>
  )
}
