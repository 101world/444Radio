'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Layers, Send, ArrowLeft, RefreshCw, FileText, ImageIcon as ImageViewIcon, Disc3, Heart } from 'lucide-react'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import FloatingNavButton from '../components/FloatingNavButton'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { LibraryTabSkeleton } from '../components/LoadingSkeleton'

// Lazy load heavy components
const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))
const LyricsModal = lazy(() => import('../components/LyricsModal'))
const CoverArtModal = lazy(() => import('../components/CoverArtModal'))
const ReleaseModal = lazy(() => import('../components/ReleaseModal'))

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
  const [activeTab, setActiveTab] = useState<'images' | 'music' | 'releases' | 'likes'>('music')
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [releaseItems, setReleaseItems] = useState<LibraryCombined[]>([])
  const [likeItems, setLikeItems] = useState<LibraryCombined[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Modal states
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [selectedLyricsId, setSelectedLyricsId] = useState<string | null>(null)
  const [selectedLyricsTitle, setSelectedLyricsTitle] = useState<string | null>(null)
  const [showCoverModal, setShowCoverModal] = useState(false)
  const [selectedCoverUrl, setSelectedCoverUrl] = useState<string | null>(null)
  const [selectedCoverTitle, setSelectedCoverTitle] = useState<string | null>(null)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [selectedReleaseTrack, setSelectedReleaseTrack] = useState<LibraryMusic | null>(null)
  const [showReleaseToast, setShowReleaseToast] = useState(false)

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
      // Fetch from database AND R2
      const [musicRes, r2Res, imagesRes, releasesRes, likesRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/r2/list-audio'),
        fetch('/api/library/images'),
        fetch('/api/library/releases'),
        fetch('/api/library/likes')
      ])

      const musicData = await musicRes.json()
      const r2Data = await r2Res.json()
      const imagesData = await imagesRes.json()
      const releasesData = await releasesRes.json()
      const likesData = await likesRes.json()

      // Combine database + R2 files, deduplicate by audio_url
      const dbMusic = (musicData.success && Array.isArray(musicData.music)) ? musicData.music : []
      const r2Music = (r2Data.success && Array.isArray(r2Data.music)) ? r2Data.music : []
      
      const allMusic = [...dbMusic, ...r2Music]
      const uniqueMusic = Array.from(
        new Map(allMusic.map(item => [item.audio_url, item])).values()
      )
      
      setMusicItems(uniqueMusic)
      console.log('✅ Loaded', dbMusic.length, 'from DB +', r2Music.length, 'from R2 =', uniqueMusic.length, 'unique tracks')

      if (imagesData.success && Array.isArray(imagesData.images)) {
        setImageItems(imagesData.images)
        console.log('✅ Loaded', imagesData.images.length, 'images')
      }

      if (releasesData.success && Array.isArray(releasesData.releases)) {
        setReleaseItems(releasesData.releases)
        console.log('✅ Loaded', releasesData.releases.length, 'releases')
      }

      if (likesData.success && Array.isArray(likesData.likes)) {
        setLikeItems(likesData.likes)
        console.log('✅ Loaded', likesData.likes.length, 'likes')
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

  // Fetch data when switching tabs if needed
  useEffect(() => {
    // Data already fetched on mount, no need to refetch
  }, [activeTab])

  const handleDelete = async (type: 'music' | 'images' | 'releases', id: string) => {
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

  // Delete published release from combined_media table
  const handleDeleteRelease = async (id: string) => {
    if (!confirm('⚠️ Delete this release?\n\nThis will remove it from your published releases.')) return

    try {
      const res = await fetch('/api/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Optimistically update UI
        setReleaseItems(prev => prev.filter(item => item.id !== id))
        alert('✅ Release deleted successfully!')
      } else {
        alert('❌ Failed to delete release. Please try again.')
      }
    } catch (error) {
      console.error('Delete release error:', error)
      alert('❌ Failed to delete release. Please try again.')
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
      {/* Holographic 3D Background - Lazy Loaded */}
      <Suspense fallback={null}>
        <HolographicBackgroundClient />
      </Suspense>
      
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
              onClick={() => setActiveTab('releases')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'releases'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-cyan-400/60 hover:bg-cyan-500/10 hover:text-cyan-400'
              }`}
            >
              <Disc3 size={18} />
              <span>Releases</span>
              <span className="ml-1 text-xs opacity-60">({releaseItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('likes')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'likes'
                  ? 'bg-gradient-to-r from-pink-600 to-pink-400 text-white shadow-lg shadow-pink-500/30'
                  : 'bg-white/5 text-pink-400/60 hover:bg-pink-500/10 hover:text-pink-400'
              }`}
            >
              <Heart size={18} />
              <span>Likes</span>
              <span className="ml-1 text-xs opacity-60">({likeItems.length})</span>
            </button>
          </div>
        </div>

        {/* Loading State - Skeleton */}
        {isLoading && (
          <LibraryTabSkeleton />
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
                          {item.title || item.prompt || 'Untitled Track'}
                        </h3>
                        <p className="text-cyan-400/50 text-xs mt-0.5 truncate">
                          {item.title ? (item.prompt ? `${item.prompt.substring(0, 40)}...` : new Date(item.created_at).toLocaleDateString()) : new Date(item.created_at).toLocaleDateString()}
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
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedReleaseTrack(item)
                            setShowReleaseModal(true)
                          }}
                          className="w-10 h-10 rounded-full bg-gradient-to-r from-green-600/20 to-emerald-500/20 backdrop-blur-xl border border-green-500/30 hover:border-green-400 hover:from-green-500/30 hover:to-emerald-400/30 flex items-center justify-center transition-all active:scale-95"
                          title="Release Track"
                        >
                          <Send size={16} className="text-green-400" />
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
        {!isLoading && activeTab === 'releases' && (
          <div>
            {releaseItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center">
                  <Disc3 size={32} className="text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No releases yet</h3>
                <p className="text-cyan-400/50 mb-6 text-sm">Publish your tracks to see them here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {releaseItems.map((item) => (
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
                          title="Download"
                        >
                          <Download size={16} className="text-cyan-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteRelease(item.id)}
                          className="p-2.5 bg-red-500/20 rounded-lg hover:bg-red-500/40 transition-all hover:scale-105 border border-red-500/30"
                          title="Delete Release"
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

        {/* Likes Tab */}
        {!isLoading && activeTab === 'likes' && (
          <div>
            {likeItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-400/10 border border-pink-500/30 flex items-center justify-center">
                  <Heart size={32} className="text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No liked tracks yet</h3>
                <p className="text-pink-400/50 mb-6 text-sm">Like tracks from Explore to see them here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {likeItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-black/40 backdrop-blur-xl border border-pink-500/20 rounded-xl overflow-hidden hover:border-pink-400/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Cover Art */}
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-pink-500/30">
                        <img
                          src={item.image_url}
                          alt={item.title || 'Liked Track'}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white truncate">{item.title || 'Untitled'}</h4>
                        <p className="text-xs text-pink-400/60 truncate">Liked Track</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            const track = {
                              id: item.id,
                              title: item.title || 'Untitled',
                              artist: 'Unknown Artist',
                              audioUrl: item.audio_url,
                              coverUrl: item.image_url
                            }
                            setPlaylist(likeItems.map(i => ({
                              id: i.id,
                              title: i.title || 'Untitled',
                              artist: 'Unknown Artist',
                              audioUrl: i.audio_url,
                              coverUrl: i.image_url
                            })))
                            playTrack(track)
                          }}
                          className="p-2.5 bg-pink-500/20 rounded-lg hover:bg-pink-500/40 transition-all hover:scale-105 border border-pink-500/30"
                          title="Play"
                        >
                          {currentTrack?.id === item.id && isPlaying ? (
                            <Pause size={16} className="text-pink-400" />
                          ) : (
                            <Play size={16} className="text-pink-400" />
                          )}
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

      {/* Lyrics Modal - Lazy Loaded */}
      <Suspense fallback={null}>
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
      </Suspense>

      {/* Cover Art Modal - Lazy Loaded */}
      <Suspense fallback={null}>
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
      </Suspense>

      {/* Release Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        {selectedReleaseTrack && (
          <ReleaseModal
            isOpen={showReleaseModal}
            onClose={() => {
              setShowReleaseModal(false)
              setSelectedReleaseTrack(null)
            }}
            musicItem={selectedReleaseTrack}
            imageItems={imageItems}
            onSuccess={() => {
              setShowReleaseToast(true)
              setTimeout(() => setShowReleaseToast(false), 3000)
              fetchLibrary(true)
            }}
          />
        )}
      </Suspense>

      {/* Release Success Toast */}
      {showReleaseToast && (
        <div className="fixed bottom-6 right-6 z-[110] animate-fadeIn">
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl shadow-green-500/30 border border-green-400/30 flex items-center gap-3">
            <Send size={20} className="text-white" />
            <div>
              <div className="font-bold">Track Released!</div>
              <div className="text-sm text-white/80">Your track is now live on your profile</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

