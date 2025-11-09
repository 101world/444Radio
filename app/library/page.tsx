'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Layers, Send, ArrowLeft, RefreshCw, FileText, ImageIcon as ImageViewIcon } from 'lucide-react'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import HolographicBackgroundClient from '../components/HolographicBackgroundClient'
import FloatingNavButton from '../components/FloatingNavButton'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import LyricsModal from '../components/LyricsModal'
import CoverArtModal from '../components/CoverArtModal'

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
  const router = useRouter()
  const { user } = useUser()
  const { playTrack, currentTrack, isPlaying, togglePlayPause, setPlaylist } = useAudioPlayer()
  const [activeTab, setActiveTab] = useState<'music' | 'images' | 'combined'>('music')
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [combinedItems, setCombinedItems] = useState<LibraryCombined[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Modal states
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedLyricsId, setSelectedLyricsId] = useState<string | null>(null)
  const [selectedLyricsTitle, setSelectedLyricsTitle] = useState<string | null>(null)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null)
  const [selectedCoverTitle, setSelectedCoverTitle] = useState<string | null>(null)

  // ESC key handler for desktop navigation to profile
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && user?.id) {
        router.push(`/profile/${user.id}`)
      }
    }
    
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router, user])

  const fetchLibrary = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    try {
      const [musicRes, imagesRes, combinedRes, publishedRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/library/images'),
        fetch('/api/library/combined'),
        fetch('/api/media/profile/' + user?.id) // Get published releases from combined_media table
      ])

      const musicData = await musicRes.json()
      const imagesData = await imagesRes.json()
      const combinedData = await combinedRes.json()
      const publishedData = await publishedRes.json()

      if (musicData.success && Array.isArray(musicData.music)) {
        setMusicItems(musicData.music)
      }

      if (imagesData.success && Array.isArray(imagesData.images)) {
        setImageItems(imagesData.images)
      }

      // Use published releases from combined_media table instead of library
      if (publishedData.success && Array.isArray(publishedData.combinedMedia)) {
        // Filter only items with both audio and image (actual music releases)
        const musicReleases = publishedData.combinedMedia.filter((item: any) => 
          item.audio_url && item.image_url && item.media_type === 'music-image'
        )
        setCombinedItems(musicReleases.map((item: any) => ({
          id: item.id,
          title: item.title || 'Untitled',
          audio_url: item.audio_url,
          image_url: item.image_url,
          music_prompt: item.audio_prompt || item.music_prompt,
          image_prompt: item.image_prompt,
          is_published: true,
          created_at: item.created_at
        })))
        console.log('✅ Loaded', musicReleases.length, 'published releases')
      } else if (combinedData.success && Array.isArray(combinedData.combined)) {
        // Fallback to unpublished library items if no published releases
        const publishedLibraryItems = combinedData.combined.filter((item: LibraryCombined) => item.is_published)
        setCombinedItems(publishedLibraryItems)
        console.log('⚠️ Using library fallback:', publishedLibraryItems.length, 'items')
      } else {
        console.log('❌ No releases found')
      }
    } catch (error) {
      console.error('Error fetching library:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchLibrary()
    
    // Auto-refresh when page becomes visible (catches new generations)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLibrary()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also refresh when window gains focus
    const handleFocus = () => fetchLibrary()
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    <div className="min-h-screen bg-black text-white">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Credit Indicator - Mobile Only */}
      <div className="md:hidden">
        <CreditIndicator />
      </div>
      
      {/* Floating Menu - Desktop Only */}
      <FloatingMenu />

      {/* Back Button - Mobile (Top Left) */}
      {user?.id && (
        <button
          onClick={() => router.push(`/profile/${user.id}`)}
          className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg"
          title="Back to Profile"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      {/* ESC Button - Desktop (Top Left) */}
      {user?.id && (
        <button
          onClick={() => router.push(`/profile/${user.id}`)}
          className="hidden md:flex fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 items-center gap-2 text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg text-sm font-medium"
          title="Press ESC to go back"
        >
          <ArrowLeft size={16} />
          <span>ESC</span>
        </button>
      )}

      {/* Main Content - Starts from top */}
      <div className="max-w-7xl mx-auto px-4 pt-20 md:pt-24 pb-8">
        {/* Header with Refresh Button */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            My Library
          </h1>
          <div className="flex gap-3">
            <Link
              href="/library/release"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-400 text-white hover:from-cyan-700 hover:to-cyan-500 transition-all flex items-center gap-2 font-bold text-sm shadow-lg shadow-cyan-500/20"
            >
              <Send size={16} />
              <span>Release Manager</span>
            </Link>
            <button
              onClick={() => fetchLibrary(true)}
              disabled={isRefreshing}
              className={`px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-2 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Refresh library"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="text-sm font-medium">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
        
        {/* Category Tabs - Clean & Prominent */}
        <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-cyan-500/20 -mx-4 px-4 py-4 mb-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'images'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-400'
              }`}
            >
              <ImageIcon size={18} />
              <span>Images</span>
              <span className="ml-1 text-xs opacity-60">({imageItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('music')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'music'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-400'
              }`}
            >
              <Music size={18} />
              <span>Music</span>
              <span className="ml-1 text-xs opacity-60">({musicItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('combined')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'combined'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-400'
              }`}
            >
              <Layers size={18} />
              <span>Releases</span>
              <span className="ml-1 text-xs opacity-60">({combinedItems.length})</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-500/20 border-t-cyan-400 mb-4"></div>
            <p className="text-cyan-400/60 font-mono text-sm">Loading your creations...</p>
          </div>
        )}

        {/* Images Tab */}
        {!isLoading && activeTab === 'images' && (
          <div>
            {imageItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <ImageIcon size={32} className="text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No images yet</h3>
                <p className="text-cyan-400/50 mb-6 text-sm">Create cover art to get started</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/20">
                  <ImageIcon size={18} />
                  Create Cover Art
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {imageItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/60 hover:scale-105 transition-all duration-300 cursor-pointer"
                  >
                    {/* Image */}
                    <img
                      src={item.image_url}
                      alt={item.title || item.prompt}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />

                    {/* Hover Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end gap-2 p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCoverUrl(item.image_url)
                          setSelectedCoverTitle(item.title || item.prompt)
                          setShowCoverModal(true)
                        }}
                        className="w-full py-2.5 bg-purple-500/20 backdrop-blur-xl rounded-lg hover:bg-purple-500/40 transition-colors border border-purple-500/30 flex items-center justify-center gap-2"
                      >
                        <ImageViewIcon size={16} className="text-purple-400" />
                        <span className="text-purple-400 text-xs font-semibold">View</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.image_url, `${item.title || 'image'}.webp`); }}
                        className="w-full py-2.5 bg-cyan-500/20 backdrop-blur-xl rounded-lg hover:bg-cyan-500/40 transition-colors border border-cyan-500/30 flex items-center justify-center gap-2"
                      >
                        <Download size={16} className="text-cyan-400" />
                        <span className="text-cyan-400 text-xs font-semibold">Download</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete('images', item.id); }}
                        className="w-full py-2.5 bg-red-500/20 backdrop-blur-xl rounded-lg hover:bg-red-500/40 transition-colors border border-red-500/30 flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} className="text-red-400" />
                        <span className="text-red-400 text-xs font-semibold">Delete</span>
                      </button>
                    </div>

                    {/* Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black to-transparent">
                      <p className="text-xs text-white/90 truncate font-medium">
                        {item.title || 'Untitled Image'}
                      </p>
                      <p className="text-[10px] text-cyan-400/50 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Music Tab */}
        {!isLoading && activeTab === 'music' && (
          <div>
            {musicItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <Music size={32} className="text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No music yet</h3>
                <p className="text-cyan-400/50 mb-6 text-sm">Generate your first track</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/20">
                  <Music size={18} />
                  Create Music
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {musicItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 flex-shrink-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-lg flex items-center justify-center border border-cyan-500/30">
                        <Music size={24} className="text-cyan-400" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">
                          {item.title || 'Untitled Track'}
                        </h3>
                        <p className="text-cyan-400/50 text-xs mt-0.5">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            const track = {
                              id: item.id,
                              audioUrl: item.audio_url,
                              title: item.title || 'Untitled',
                              artist: user?.firstName || 'You',
                              imageUrl: undefined,
                              userId: user?.id
                            }
                            
                            // If this track is playing, toggle pause/play
                            if (currentTrack?.id === item.id) {
                              togglePlayPause()
                            } else {
                              // Set playlist to all music items and play this one
                              const allTracks = musicItems.map(i => ({
                                id: i.id,
                                audioUrl: i.audio_url,
                                title: i.title || 'Untitled',
                                artist: user?.firstName || 'You',
                                imageUrl: undefined,
                                userId: user?.id
                              }))
                              setPlaylist(allTracks, musicItems.findIndex(i => i.id === item.id))
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 flex items-center justify-center transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                        >
                          {currentTrack?.id === item.id && isPlaying ? (
                            <Pause size={18} className="text-black" />
                          ) : (
                            <Play size={18} className="text-black ml-0.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                          className="hidden sm:flex w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 items-center justify-center transition-all active:scale-95"
                          title="Download"
                        >
                          <Download size={16} className="text-cyan-400" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLyricsId(item.id)
                            setSelectedLyricsTitle(item.title || 'Untitled')
                            setShowLyricsModal(true)
                          }}
                          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-purple-500/30 hover:border-purple-400 hover:bg-purple-500/20 flex items-center justify-center transition-all active:scale-95"
                          title="View Lyrics"
                        >
                          <FileText size={16} className="text-purple-400" />
                        </button>

                        <button
                          onClick={() => handleDelete('music', item.id)}
                          className="w-10 h-10 rounded-full bg-red-500/10 backdrop-blur-xl border border-red-500/30 hover:border-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all active:scale-95"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Releases Tab */}
        {!isLoading && activeTab === 'combined' && (
          <div>
            {combinedItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <Layers size={32} className="text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No releases yet</h3>
                <p className="text-cyan-400/50 mb-6 text-sm">Combine music with cover art</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/20">
                  <Layers size={18} />
                  Create Release
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {combinedItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden hover:border-cyan-400/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Cover Art */}
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-cyan-500/30">
                        <img
                          src={item.image_url}
                          alt={item.title || 'Release'}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-white font-semibold text-sm truncate">
                            {item.title || 'Release'}
                          </h3>
                          {item.is_published && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-[10px] font-bold text-white shadow-lg shadow-cyan-500/20 flex-shrink-0">
                              ✨ Live
                            </span>
                          )}
                        </div>
                        <p className="text-cyan-400/50 text-xs">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!item.is_published && (
                          <button
                            onClick={() => handleSendToLabel(item.id)}
                            className="p-2.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-lg hover:from-cyan-700 hover:to-cyan-500 transition-all hover:scale-105 border border-cyan-500/30 shadow-lg shadow-cyan-500/20"
                            title="Publish"
                          >
                            <Send size={16} className="text-white" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`)}
                          className="hidden sm:flex p-2.5 bg-cyan-500/20 rounded-lg hover:bg-cyan-500/40 transition-all hover:scale-105 border border-cyan-500/30"
                        >
                          <Download size={16} className="text-cyan-400" />
                        </button>
                        <button
                          onClick={() => handleDelete('combined', item.id)}
                          className="p-2.5 bg-red-500/20 rounded-lg hover:bg-red-500/40 transition-all hover:scale-105 border border-red-500/30"
                        >
                          <Trash2 size={16} className="text-red-400" />
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

      {/* Floating Navigation Button */}
      <FloatingNavButton />

      {/* Lyrics Modal */}
      {selectedLyricsId && (
        <LyricsModal
          isOpen={showLyricsModal}
          onClose={() => {
            setShowLyricsModal(false)
            setSelectedLyricsId(null)
            setSelectedLyricsTitle(null)
          }}
          mediaId={selectedLyricsId}
          title={selectedLyricsTitle || undefined}
        />
      )}

      {/* Cover Art Modal */}
      {selectedCoverUrl && (
        <CoverArtModal
          isOpen={showCoverModal}
          onClose={() => {
            setShowCoverModal(false)
            setSelectedCoverUrl(null)
            setSelectedCoverTitle(null)
          }}
          imageUrl={selectedCoverUrl}
          title={selectedCoverTitle || undefined}
        />
      )}
    </div>
  )
}

