'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Layers, Send } from 'lucide-react'
import FloatingMenu from '../components/FloatingMenu'
import HolographicBackgroundClient from '../components/HolographicBackgroundClient'

interface LibraryMusic {
  id: string
  title: string | null
  prompt: string
  lyrics: string | null
  audio_url: string
  created_at: string
  file_size: number | null
}

interface LibraryImage {
  id: string
  title: string | null
  prompt: string
  image_url: string
  created_at: string
  file_size: number | null
}

interface LibraryCombined {
  id: string
  title: string | null
  audio_url: string
  image_url: string
  music_prompt: string | null
  image_prompt: string | null
  is_published: boolean
  created_at: string
}

export default function LibraryPage() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState<'music' | 'images' | 'combined'>('music')
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [combinedItems, setCombinedItems] = useState<LibraryCombined[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    fetchLibrary()
  }, [])

  const fetchLibrary = async () => {
    setIsLoading(true)
    try {
      const [musicRes, imagesRes, combinedRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/library/images'),
        fetch('/api/library/combined')
      ])

      const musicData = await musicRes.json()
      const imagesData = await imagesRes.json()
      const combinedData = await combinedRes.json()

      if (musicData.success && Array.isArray(musicData.music)) {
        setMusicItems(musicData.music)
      }

      if (imagesData.success && Array.isArray(imagesData.images)) {
        setImageItems(imagesData.images)
      }

      if (combinedData.success && Array.isArray(combinedData.combined)) {
        setCombinedItems(combinedData.combined)
      }
    } catch (error) {
      console.error('Error fetching library:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (type: 'music' | 'images' | 'combined', id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const res = await fetch(`/api/library/${type}?id=${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        // Refresh library
        fetchLibrary()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSendToLabel = async (id: string) => {
    if (!confirm('Publish this to Explore? It will be visible to everyone.')) return

    try {
      const res = await fetch(`/api/library/combined?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: true })
      })

      if (res.ok) {
        alert('✅ Published to Explore!\n\n🎉 Your combined media is now live!\n📍 Click "Explore" in the navigation to see it.')
        fetchLibrary()
      }
    } catch (error) {
      console.error('Publish error:', error)
      alert('❌ Failed to publish. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Menu */}
      <FloatingMenu />

      <div className="max-w-7xl mx-auto px-4 py-8 pt-24">
        {/* Header - Top Left */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-black text-white">
            Library
          </h1>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#818cf8] mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        )}

        {/* Music Tab */}
        {!isLoading && activeTab === 'music' && (
          <div>
            {musicItems.length === 0 ? (
              <div className="text-center py-20">
                <Music size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No music yet</h3>
                <p className="text-gray-400 mb-6">Start by generating your first track</p>
                <Link href="/" className="px-6 py-3 bg-white text-black rounded-full font-bold inline-block hover:bg-gray-200 transition-all">
                  Create Music
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {musicItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden hover:border-[#4f46e5]/50 transition-all"
                  >
                    {/* Thumbnail */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#4f46e5]/20 to-[#818cf8]/20 flex items-center justify-center">
                      <Music size={32} className="text-[#818cf8]" />
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <button
                        onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                        className="p-2 bg-white/20 backdrop-blur-xl rounded-lg hover:bg-white/30 transition-colors"
                      >
                        <Download size={16} className="text-white" />
                      </button>
                      <button
                        onClick={() => handleDelete('music', item.id)}
                        className="p-2 bg-red-500/20 backdrop-blur-xl rounded-lg hover:bg-red-500/40 transition-colors"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>

                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-xs text-white truncate font-medium">
                        {item.title || item.prompt.substring(0, 30)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Images Tab */}
        {!isLoading && activeTab === 'images' && (
          <div>
            {imageItems.length === 0 ? (
              <div className="text-center py-20">
                <ImageIcon size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No images yet</h3>
                <p className="text-gray-400 mb-6">Start by generating your first cover art</p>
                <Link href="/" className="px-6 py-3 bg-white text-black rounded-full font-bold inline-block hover:bg-gray-200 transition-all">
                  Create Cover Art
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {imageItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden hover:border-[#4f46e5]/50 transition-all"
                  >
                    {/* Image Thumbnail */}
                    <img
                      src={item.image_url}
                      alt={item.title || item.prompt}
                      className="w-full h-full object-cover"
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      <button
                        onClick={() => handleDownload(item.image_url, `${item.title || 'image'}.webp`)}
                        className="p-2 bg-white/20 backdrop-blur-xl rounded-lg hover:bg-white/30 transition-colors"
                      >
                        <Download size={16} className="text-white" />
                      </button>
                      <button
                        onClick={() => handleDelete('images', item.id)}
                        className="p-2 bg-red-500/20 backdrop-blur-xl rounded-lg hover:bg-red-500/40 transition-colors"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>

                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-xs text-white truncate font-medium">
                        {item.title || item.prompt.substring(0, 30)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Combined Tab */}
        {!isLoading && activeTab === 'combined' && (
          <div>
            {combinedItems.length === 0 ? (
              <div className="text-center py-20">
                <Layers size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No combined media yet</h3>
                <p className="text-gray-400 mb-6">Combine music with cover art to create releases</p>
                <Link href="/" className="px-6 py-3 bg-[#4f46e5] text-white rounded-full font-bold inline-block hover:bg-[#6366f1] transition-all">
                  Combine Media
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {combinedItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden hover:border-[#4f46e5]/50 transition-all"
                  >
                    {/* Cover Art Thumbnail */}
                    <img
                      src={item.image_url}
                      alt={item.title || 'Combined media'}
                      className="w-full h-full object-cover"
                    />

                    {/* Published Badge */}
                    {item.is_published && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-[#4f46e5] backdrop-blur-xl rounded-full text-xs font-bold text-white">
                        Published
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      {!item.is_published && (
                        <button
                          onClick={() => handleSendToLabel(item.id)}
                          className="p-2 bg-[#4f46e5] backdrop-blur-xl rounded-lg hover:bg-[#6366f1] transition-colors"
                        >
                          <Send size={16} className="text-white" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                        className="p-2 bg-white/20 backdrop-blur-xl rounded-lg hover:bg-white/30 transition-colors"
                      >
                        <Download size={16} className="text-white" />
                      </button>
                      <button
                        onClick={() => handleDelete('combined', item.id)}
                        className="p-2 bg-red-500/20 backdrop-blur-xl rounded-lg hover:bg-red-500/40 transition-colors"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>

                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-xs text-white truncate font-medium">
                        {item.title || 'Combined Media'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Docked Tabs - Glassmorphism */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full shadow-2xl shadow-black/50 p-2">
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setActiveTab('music')}
                className={`px-6 py-3 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'music'
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Music size={16} />
                Music
              </button>
              <button
                onClick={() => setActiveTab('images')}
                className={`px-6 py-3 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'images'
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                }`}
              >
                <ImageIcon size={16} />
                Images
              </button>
              <button
                onClick={() => setActiveTab('combined')}
                className={`px-6 py-3 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'combined'
                    ? 'bg-[#4f46e5] text-white'
                    : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white'
                }`}
              >
                <Layers size={16} />
                Combined
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

