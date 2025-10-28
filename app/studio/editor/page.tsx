'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function StudioEditorPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in')
    }
  }, [isLoaded, user, router])

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Studio...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top Bar with 444Radio branding */}
      <div className="h-14 bg-gradient-to-r from-purple-900/50 via-pink-900/50 to-purple-900/50 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-white hover:text-purple-400 transition-colors"
          >
            ← Back to 444Radio
          </button>
          <div className="h-6 w-px bg-white/20"></div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            444 Studio
          </h1>
          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
            Pro
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            <span className="text-purple-400 font-semibold">{user.username || user.firstName || 'User'}</span>
          </div>
        </div>
      </div>

      {/* AudioMass iFrame */}
      <iframe
        src="/studio/index.html"
        className="flex-1 w-full border-0"
        title="444 Studio - AudioMass Editor"
        allow="microphone; clipboard-read; clipboard-write"
      />

      {/* Bottom Save Bar */}
      <div className="h-16 bg-gradient-to-r from-purple-900/50 via-pink-900/50 to-purple-900/50 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-6 z-50">
        <div className="text-sm text-gray-400">
          💡 <strong>Tip:</strong> Export your track and upload it to your Library via the <span className="text-purple-400">Upload</span> page
        </div>
        <button
          onClick={() => router.push('/studio/upload')}
          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all duration-300"
        >
          Upload to Library →
        </button>
      </div>
    </div>
  )
}
