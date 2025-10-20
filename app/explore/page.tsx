'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import CombinedMediaPlayer from '../components/CombinedMediaPlayer'
import FloatingMenu from '../components/FloatingMenu'
import { Search } from 'lucide-react'

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
  const [searchQuery, setSearchQuery] = useState('')

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

      {/* Header with 444hz Title and Search */}
      <div className="pt-24 px-4 md:px-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-black text-center mb-6 text-white">444hz</h1>
          
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search tracks, artists, genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-[#5a8fc7] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Music Grid - Glassmorphism 3D Cards */}
      <main className="px-3 md:px-6 pb-32">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl animate-pulse"></div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {combinedMedia.map((media) => (
                <div key={media.id} className="group relative">
                  {/* 3D Glassmorphism Card */}
                  <div className="relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#5a8fc7]/20 hover:border-[#5a8fc7]/30">
                    {/* Image */}
                    <img 
                      src={media.image_url} 
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Glassmorphism Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
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
                      </div>
                    </div>

                    {/* Always Visible Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                      <p className="text-xs font-bold text-white truncate">{media.title}</p>
                      <Link 
                        href={`/u/${media.users.username}`}
                        className="text-xs text-[#5a8fc7] hover:text-[#7aa5d7] font-semibold"
                      >
                        @{media.users.username}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bottom-Docked Category Tabs with Horizontal Scroll */}
      <div className="fixed bottom-0 left-0 right-0 p-3 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-2 shadow-2xl">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2">
              {['Trending', 'New', 'Top', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz', 'Rock', 'Classical', 'R&B', 'Country'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f.toLowerCase())}
                  className={`px-4 py-2 rounded-full font-semibold whitespace-nowrap transition-all text-sm ${
                    filter === f.toLowerCase()
                      ? 'bg-white text-black shadow-lg'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
