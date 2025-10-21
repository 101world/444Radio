'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Layers, Send } from 'lucide-react'
import FloatingMenu from '../components/FloatingMenu'
import HolographicBackgroundClient from '../components/HolographicBackgroundClient'
import FloatingNavButton from '../components/FloatingNavButton'

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
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 via-cyan-300 to-white bg-clip-text text-transparent mb-3">
            Library
          </h1>
          <p className="text-cyan-400/60 text-sm md:text-base">Your creative collection</p>
          
          {/* Stats */}
          <div className="flex gap-4 mt-6 flex-wrap">
            <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <span className="text-cyan-400 font-bold">{musicItems.length}</span>
              <span className="text-cyan-400/60 text-sm ml-2">Tracks</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <span className="text-cyan-400 font-bold">{imageItems.length}</span>
              <span className="text-cyan-400/60 text-sm ml-2">Images</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <span className="text-cyan-400 font-bold">{combinedItems.length}</span>
              <span className="text-cyan-400/60 text-sm ml-2">Releases</span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-500/20 border-t-cyan-400 mb-4"></div>
            <p className="text-cyan-400/60 font-mono">Loading library...</p>
          </div>
        )}

        {/* Music Tab */}
        {!isLoading && activeTab === 'music' && (
          <div className="-mt-4">
            {musicItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <Music size={40} className="text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">No music yet</h3>
                <p className="text-cyan-400/60 mb-8 text-sm">Start by generating your first track</p>
                <Link href="/create" className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-full font-bold inline-block hover:from-cyan-700 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30">
                  Create Music
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {musicItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden hover:border-cyan-400/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-xl flex items-center justify-center border border-cyan-500/30">
                        <Music size={28} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm md:text-base truncate">
                          {item.title || item.prompt.substring(0, 40)}
                        </h3>
                        <p className="text-cyan-400/60 text-xs mt-1">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Play/Pause Button */}
                        <button
                          onClick={() => {
                            if (playingId === item.id) {
                              const audio = document.getElementById(`audio-${item.id}`) as HTMLAudioElement;
                              audio?.pause();
                              setPlayingId(null);
                            } else {
                              // Pause all other audios
                              musicItems.forEach(i => {
                                const audio = document.getElementById(`audio-${i.id}`) as HTMLAudioElement;
                                if (audio) audio.pause();
                              });
                              const audio = document.getElementById(`audio-${item.id}`) as HTMLAudioElement;
                              audio?.play();
                              setPlayingId(item.id);
                            }
                          }}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 flex items-center justify-center transition-all shadow-lg shadow-cyan-500/30 active:scale-95"
                        >
                          {playingId === item.id ? (
                            <Pause size={20} className="text-black" />
                          ) : (
                            <Play size={20} className="text-black ml-0.5" />
                          )}
                        </button>

                        {/* Release Button */}
                        <button
                          onClick={() => handleSendToLabel(item.id)}
                          className="hidden md:flex w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 items-center justify-center transition-all active:scale-95"
                          title="Release to Explore"
                        >
                          <Send size={18} className="text-cyan-400" />
                        </button>

                        {/* Download Button */}
                        <button
                          onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                          className="hidden md:flex w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 items-center justify-center transition-all active:scale-95"
                          title="Download"
                        >
                          <Download size={18} className="text-cyan-400" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete('music', item.id)}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-500/10 backdrop-blur-xl border-2 border-red-500/30 hover:border-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all active:scale-95"
                          title="Delete"
                        >
                          <Trash2 size={18} className="text-red-400" />
                        </button>
                      </div>

                      {/* Hidden Audio Element */}
                      <audio
                        id={`audio-${item.id}`}
                        src={item.audio_url}
                        onEnded={() => setPlayingId(null)}
                        className="hidden"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Images Tab */}
        {!isLoading && activeTab === 'images' && (
          <div className="-mt-4">
            {imageItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <ImageIcon size={40} className="text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">No images yet</h3>
                <p className="text-cyan-400/60 mb-8 text-sm">Start by generating your first cover art</p>
                <Link href="/create" className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-full font-bold inline-block hover:from-cyan-700 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30">
                  Create Cover Art
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {imageItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden hover:border-cyan-400/60 hover:scale-105 transition-all duration-300 cursor-pointer"
                  >
                    {/* Image Thumbnail */}
                    <img
                      src={item.image_url}
                      alt={item.title || item.prompt}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end gap-2 p-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.image_url, `${item.title || 'image'}.webp`); }}
                        className="w-full p-3 bg-cyan-500/20 backdrop-blur-xl rounded-lg hover:bg-cyan-500/40 transition-colors border border-cyan-500/30 flex items-center justify-center gap-2"
                      >
                        <Download size={18} className="text-cyan-400" />
                        <span className="text-cyan-400 text-sm font-semibold">Download</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete('images', item.id); }}
                        className="w-full p-3 bg-red-500/20 backdrop-blur-xl rounded-lg hover:bg-red-500/40 transition-colors border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        <Trash2 size={18} className="text-red-400" />
                        <span className="text-red-400 text-sm font-semibold">Delete</span>
                      </button>
                    </div>

                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate font-semibold">
                        {item.title || item.prompt.substring(0, 30)}
                      </p>
                      <p className="text-[10px] text-cyan-400/60 mt-1">
                        {new Date(item.created_at).toLocaleDateString()}
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
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <Layers size={40} className="text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">No releases yet</h3>
                <p className="text-cyan-400/60 mb-8 text-sm">Combine music with cover art to create releases</p>
                <Link href="/create" className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-full font-bold inline-block hover:from-cyan-700 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30">
                  Combine Media
                </Link>
              </div>
            ) : (
              <div className="space-y-3 -mt-4">
                {combinedItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl overflow-hidden hover:border-cyan-400/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Cover Art Thumbnail */}
                      <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-cyan-500/30">
                        <img
                          src={item.image_url}
                          alt={item.title || 'Combined media'}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-semibold text-sm md:text-base truncate">
                            {item.title || 'Combined Media'}
                          </h3>
                          {item.is_published && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-[10px] font-bold text-white shadow-lg shadow-cyan-500/30 flex-shrink-0">
                              ✨ Live
                            </span>
                          )}
                        </div>
                        <p className="text-cyan-400/60 text-xs">
                          Released: {new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!item.is_published && (
                          <button
                            onClick={() => handleSendToLabel(item.id)}
                            className="p-3 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-lg hover:from-cyan-700 hover:to-cyan-500 transition-all hover:scale-105 border border-cyan-500/30 shadow-lg shadow-cyan-500/30"
                            title="Publish to Feed"
                          >
                            <Send size={18} className="text-white" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                          className="p-3 bg-cyan-500/20 rounded-lg hover:bg-cyan-500/40 transition-all hover:scale-105 border border-cyan-500/30"
                          title="Download"
                        >
                          <Download size={18} className="text-cyan-400" />
                        </button>
                        <button
                          onClick={() => handleDelete('combined', item.id)}
                          className="p-3 bg-red-500/20 rounded-lg hover:bg-red-500/40 transition-all hover:scale-105 border border-red-500/30"
                          title="Delete"
                        >
                          <Trash2 size={18} className="text-red-400" />
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

      {/* Bottom Docked Tabs - Glassmorphism */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/40 backdrop-blur-2xl border border-cyan-500/30 rounded-full shadow-2xl shadow-cyan-500/20 p-2">
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setActiveTab('music')}
                className={`px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'music'
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-400 border border-cyan-500/20'
                }`}
              >
                <Music size={16} />
                Music
              </button>
              <button
                onClick={() => setActiveTab('images')}
                className={`px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'images'
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-400 border border-cyan-500/20'
                }`}
              >
                <ImageIcon size={16} />
                Images
              </button>
              <button
                onClick={() => setActiveTab('combined')}
                className={`px-6 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'combined'
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                    : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/20 hover:text-cyan-400 border border-cyan-500/20'
                }`}
              >
                <Layers size={16} />
                Releases
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Navigation Button */}
      <FloatingNavButton />
    </div>
  )
}

