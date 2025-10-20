'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import CombinedMediaPlayer from '../components/CombinedMediaPlayer'
import FloatingMenu from '../components/FloatingMenu'

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
    <div className="min-h-screen bg-black text-white">
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Filters */}
      <div className="sticky top-6 z-40 backdrop-blur-xl bg-white/10 border-b border-white/10 px-4 md:px-8 py-4 mt-24">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {['Trending', 'New', 'Top', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              className={`px-6 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                filter === f.toLowerCase()
                  ? 'bg-white text-black'
                  : 'bg-white/10 border border-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
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
                <div key={i} className="aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : combinedMedia.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎵</div>
              <h2 className="text-2xl font-bold text-white mb-2">No music yet</h2>
              <p className="text-gray-400 mb-8">Be the first to create something amazing!</p>
              <Link href="/" className="inline-block px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all">
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
                      className="text-sm text-[#5a8fc7] hover:text-[#7aa5d7] font-semibold"
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
