'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import CombinedMediaPlayer from '../components/CombinedMediaPlayer'

interface CombinedMedia {
  id: string
  title: string
  audio_url: string
  image_url: string
  audio_prompt: string
  image_prompt: string
  user_id: string
  likes: number
  plays: number
  created_at: string
  users: {
    username: string
  }
}

export default function ExplorePage() {
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [filter, setFilter] = useState('trending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCombinedMedia()
  }, [filter])

  const fetchCombinedMedia = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/explore')
      const data = await res.json()
      if (data.success) {
        setCombinedMedia(data.combinedMedia)
      }
    } catch (error) {
      console.error('Failed to fetch media:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/40 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg">♪</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            444RADIO
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium transition-colors">
            Create
          </Link>
          <Link href="/explore" className="px-4 py-2 text-green-400 font-bold transition-colors">
            Explore
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Filters */}
      <div className="sticky top-20 z-40 backdrop-blur-xl bg-black/20 border-b border-green-500/10 px-4 md:px-8 py-4">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {['Trending', 'New', 'Top', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              className={`px-6 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                filter === f.toLowerCase()
                  ? 'bg-gradient-to-r from-green-500 to-cyan-500 text-black'
                  : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Music Grid - Instagram Style - Bottom to Top */}
      <main className="px-4 md:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="aspect-square bg-green-500/10 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : combinedMedia.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎵</div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">No music yet</h2>
              <p className="text-green-100/60 mb-8">Be the first to create something amazing!</p>
              <Link href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform">
                Create Now
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {combinedMedia.map((media) => (
                <div key={media.id} className="group">
                  <CombinedMediaPlayer
                    audioUrl={media.audio_url}
                    imageUrl={media.image_url}
                    title={media.title}
                    audioPrompt={media.audio_prompt}
                    imagePrompt={media.image_prompt}
                    likes={media.likes}
                    plays={media.plays}
                    showControls={true}
                  />
                  <div className="mt-2">
                    <Link 
                      href={`/u/${media.users.username}`}
                      className="text-sm text-green-400 hover:text-green-300 font-semibold"
                    >
                      @{media.users.username}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {new Date(media.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
