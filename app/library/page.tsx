'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Layers, Send } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-purple-950 text-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/20 border-b border-purple-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-lg">🎵</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">444RADIO</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="px-4 py-2 text-purple-400 hover:text-purple-300">Home</Link>
          <Link href="/explore" className="px-4 py-2 text-purple-400 hover:text-purple-300">Explore</Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Your Library
          </h1>
          <p className="text-purple-400/60">All your AI-generated content in one place</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('music')}
            className={`
              px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2
              ${activeTab === 'music'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-black scale-105'
                : 'bg-green-500/10 text-green-400 border-2 border-green-500/30 hover:border-green-500/60'
              }
            `}
          >
            <Music size={20} />
            Music ({musicItems.length})
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`
              px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2
              ${activeTab === 'images'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black scale-105'
                : 'bg-cyan-500/10 text-cyan-400 border-2 border-cyan-500/30 hover:border-cyan-500/60'
              }
            `}
          >
            <ImageIcon size={20} />
            Images ({imageItems.length})
          </button>
          <button
            onClick={() => setActiveTab('combined')}
            className={`
              px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2
              ${activeTab === 'combined'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-black scale-105'
                : 'bg-purple-500/10 text-purple-400 border-2 border-purple-500/30 hover:border-purple-500/60'
              }
            `}
          >
            <Layers size={20} />
            Combined ({combinedItems.length})
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mb-4"></div>
            <p className="text-purple-400">Loading your library...</p>
          </div>
        )}

        {/* Music Tab */}
        {!isLoading && activeTab === 'music' && (
          <div>
            {musicItems.length === 0 ? (
              <div className="text-center py-20 backdrop-blur-xl bg-green-500/5 border-2 border-dashed border-green-500/30 rounded-3xl">
                <Music size={64} className="text-green-400/40 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-green-400 mb-2">No music yet</h3>
                <p className="text-green-400/60 mb-6">Start by generating your first track</p>
                <Link href="/" className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-black rounded-xl font-bold inline-block hover:scale-105 transition-transform">
                  Generate Music
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {musicItems.map((item) => (
                  <div
                    key={item.id}
                    className="backdrop-blur-xl bg-green-500/5 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-green-400 mb-1">
                          {item.title || item.prompt.substring(0, 60)}
                        </h3>
                        <p className="text-sm text-green-400/60 mb-3">{item.prompt}</p>
                        
                        {/* Audio Player */}
                        <audio
                          src={item.audio_url}
                          controls
                          className="w-full mb-3"
                          onPlay={() => setPlayingId(item.id)}
                          onPause={() => setPlayingId(null)}
                        />

                        <div className="flex items-center gap-4 text-xs text-green-400/60">
                          <span>📅 {new Date(item.created_at).toLocaleDateString()}</span>
                          {item.file_size && <span>💾 {(item.file_size / 1024 / 1024).toFixed(2)} MB</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete('music', item.id)}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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
              <div className="text-center py-20 backdrop-blur-xl bg-cyan-500/5 border-2 border-dashed border-cyan-500/30 rounded-3xl">
                <ImageIcon size={64} className="text-cyan-400/40 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-cyan-400 mb-2">No images yet</h3>
                <p className="text-cyan-400/60 mb-6">Start by generating your first cover art</p>
                <Link href="/" className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-xl font-bold inline-block hover:scale-105 transition-transform">
                  Generate Cover Art
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {imageItems.map((item) => (
                  <div
                    key={item.id}
                    className="backdrop-blur-xl bg-cyan-500/5 border border-cyan-500/20 rounded-2xl overflow-hidden hover:border-cyan-500/40 transition-all group"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title || item.prompt}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-bold text-cyan-400 mb-1 truncate">
                        {item.title || item.prompt.substring(0, 40)}
                      </h3>
                      <p className="text-sm text-cyan-400/60 mb-3 line-clamp-2">{item.prompt}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-cyan-400/60">
                          <div>📅 {new Date(item.created_at).toLocaleDateString()}</div>
                          {item.file_size && <div>💾 {(item.file_size / 1024).toFixed(0)} KB</div>}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownload(item.image_url, `${item.title || 'image'}.webp`)}
                            className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete('images', item.id)}
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
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
              <div className="text-center py-20 backdrop-blur-xl bg-purple-500/5 border-2 border-dashed border-purple-500/30 rounded-3xl">
                <Layers size={64} className="text-purple-400/40 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-purple-400 mb-2">No combined media yet</h3>
                <p className="text-purple-400/60 mb-6">Combine music with cover art to create releases</p>
                <Link href="/" className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-black rounded-xl font-bold inline-block hover:scale-105 transition-transform">
                  Combine Media
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {combinedItems.map((item) => (
                  <div
                    key={item.id}
                    className="backdrop-blur-xl bg-purple-500/5 border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/40 transition-all"
                  >
                    {/* Cover Art */}
                    <div className="aspect-square relative overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title || 'Combined media'}
                        className="w-full h-full object-cover"
                      />
                      {item.is_published && (
                        <div className="absolute top-4 right-4 bg-green-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                          ✓ Published
                        </div>
                      )}
                    </div>

                    {/* Info & Controls */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-purple-400 mb-2">
                        {item.title || 'Untitled Release'}
                      </h3>
                      
                      {/* Prompts */}
                      <div className="mb-4 space-y-2 text-sm">
                        {item.music_prompt && (
                          <div>
                            <span className="text-purple-400/60">🎵 Music: </span>
                            <span className="text-purple-300/80">{item.music_prompt.substring(0, 60)}...</span>
                          </div>
                        )}
                        {item.image_prompt && (
                          <div>
                            <span className="text-purple-400/60">🎨 Art: </span>
                            <span className="text-purple-300/80">{item.image_prompt.substring(0, 60)}...</span>
                          </div>
                        )}
                      </div>

                      {/* Audio Player */}
                      <audio
                        src={item.audio_url}
                        controls
                        className="w-full mb-4"
                      />

                      {/* Meta */}
                      <div className="text-xs text-purple-400/60 mb-4">
                        📅 {new Date(item.created_at).toLocaleDateString()}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {!item.is_published ? (
                          <button
                            onClick={() => handleSendToLabel(item.id)}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-black rounded-xl font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                          >
                            <Send size={18} />
                            Publish to Explore
                          </button>
                        ) : (
                          <Link
                            href="/explore"
                            className="flex-1 px-4 py-3 bg-green-500/20 border-2 border-green-500 text-green-400 rounded-xl font-bold hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2"
                          >
                            ✓ View in Explore →
                          </Link>
                        )}
                        <button
                          onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                          className="p-3 bg-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/30 transition-colors"
                          title="Download Audio"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete('combined', item.id)}
                          className="p-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
