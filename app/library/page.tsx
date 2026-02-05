'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Send, ArrowLeft, RefreshCw, FileText, ImageIcon as ImageViewIcon, Heart } from 'lucide-react'
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
  audioUrl?: string // Normalized field for frontend compatibility
  created_at: string
  file_size: number | null
  likes?: number
}

interface LibraryImage {
  id: string
  title: string | null
  prompt: string
  image_url: string
  imageUrl?: string // Normalized field for frontend compatibility
  created_at: string
  file_size: number | null
}

interface LibraryCombined {
  id: string
  title: string | null
  audio_url: string
  audioUrl?: string // Normalized field for frontend compatibility
  image_url: string
  imageUrl?: string // Normalized field for frontend compatibility
  music_prompt: string | null
  image_prompt: string | null
  is_published: boolean
  created_at: string
  likes?: number
  username?: string
}

export default function LibraryPage() {
  const router = useRouter()
  const { user } = useUser()
  const { playTrack, currentTrack, isPlaying, togglePlayPause, setPlaylist } = useAudioPlayer()
  const [activeTab, setActiveTab] = useState<'images' | 'music' | 'videos' | 'releases' | 'liked'>('music')
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [videoItems, setVideoItems] = useState<LibraryMusic[]>([]) // Reuse music interface for videos
  const [releaseItems, setReleaseItems] = useState<LibraryCombined[]>([])
  const [likedItems, setLikedItems] = useState<LibraryCombined[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const supabaseClient = supabase
  
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
      // Fetch all user's content from DB, R2, and releases
      const [musicRes, r2AudioRes, imagesRes, r2ImagesRes, videosRes, r2VideosRes, releasesRes, likedRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/r2/list-audio'),
        fetch('/api/library/images'),
        fetch('/api/r2/list-images'),
        fetch('/api/library/videos'),
        fetch('/api/r2/list-videos'),
        fetch('/api/library/releases'),
        fetch('/api/library/liked')
      ])

      const musicData = await musicRes.json()
      const r2AudioData = await r2AudioRes.json()
      const imagesData = await imagesRes.json()
      const r2ImagesData = await r2ImagesRes.json()
      const videosData = await videosRes.json()
      const r2VideosData = await r2VideosRes.json()
      const releasesData = await releasesRes.json()
      const likedData = await likedRes.json()

      // Use ONLY database music - it has correct titles from generation
      if (musicData.success && Array.isArray(musicData.music)) {
        const uniqueMusic = musicData.music
        
        // Check for potentially expired Replicate URLs (older than 48 hours)
        const now = Date.now()
        const expiredWarningCount = uniqueMusic.filter((track: any) => {
          if (track.audio_url?.includes('replicate.delivery')) {
            const createdAt = new Date(track.created_at).getTime()
            const ageHours = (now - createdAt) / (1000 * 60 * 60)
            return ageHours > 48
          }
          return false
        }).length
        
        if (expiredWarningCount > 0) {
          console.warn(`⚠️ ${expiredWarningCount} tracks may have expired URLs (Replicate > 48h old)`)
        }
        
        setMusicItems(uniqueMusic)
        console.log('✅ Loaded', uniqueMusic.length, 'music tracks from database')
      }

      // Merge database images with R2 images, deduplicate by image_url
      if (imagesData.success && Array.isArray(imagesData.images)) {
        const dbImages = imagesData.images
        const r2Images = r2ImagesData.success && Array.isArray(r2ImagesData.images) ? r2ImagesData.images : []
        
        // Combine and deduplicate
        const allImages = [...dbImages, ...r2Images]
        const uniqueImages = Array.from(
          new Map(allImages.map(item => [item.image_url, item])).values()
        )
        
        setImageItems(uniqueImages)
        console.log('✅ Loaded', uniqueImages.length, 'images (DB:', dbImages.length, '+ R2:', r2Images.length, ')')
      }

      // Merge database videos with R2 videos, deduplicate by URL
      if (videosData.success || r2VideosData.success) {
        const dbVideos = (videosData.success && Array.isArray(videosData.videos)) ? videosData.videos : []
        const r2Videos = (r2VideosData.success && Array.isArray(r2VideosData.videos)) ? r2VideosData.videos : []
        
        // Combine and deduplicate by audioUrl/media_url
        const allVideos = [...dbVideos, ...r2Videos]
        const uniqueVideos = Array.from(
          new Map(allVideos.map(item => [item.audioUrl || item.audio_url || item.media_url, item])).values()
        )
        
        setVideoItems(uniqueVideos)
        console.log('✅ Loaded', uniqueVideos.length, 'videos (DB:', dbVideos.length, '+ R2:', r2Videos.length, ')')
      }

      if (releasesData.success && Array.isArray(releasesData.releases)) {
        setReleaseItems(releasesData.releases)
        console.log('✅ Loaded', releasesData.releases.length, 'releases')
      }
      if (likedData.success && Array.isArray(likedData.liked)) {
        setLikedItems(likedData.liked)
        console.log('💚 Loaded', likedData.liked.length, 'liked tracks')
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

  // Subscribe to user_likes changes and update Liked tab realtime
  useEffect(() => {
    if (!user?.id) return
    const channel = supabaseClient
      .channel(`user_likes:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_likes', filter: `user_id=eq.${user.id}` }, async (payload) => {
        console.log('[supabase] user_likes change:', payload.eventType, payload)
        if (payload.eventType === 'INSERT') {
          const newLike = payload.new as any
          // Fetch the user's combined library and find the created release
          const resp = await fetch('/api/library/combined')
          if (resp.ok) {
            const json = await resp.json()
            const combined = (json.combined || []).find((c: any) => c.id === newLike.release_id)
            if (combined) {
              setLikedItems(prev => [combined, ...prev])
            }
          }
        }
        if (payload.eventType === 'DELETE') {
          const oldLike = payload.old as any
          setLikedItems(prev => prev.filter(item => item.id !== oldLike.release_id))
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user?.id])

  // BroadcastChannel listener for in-browser immediate updates
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('like-updates')
      bc.onmessage = (ev) => {
        const { releaseId, liked, likesCount } = ev.data as any
        if (liked) {
          // Add to liked items if not already present
          (async () => {
            const resp = await fetch('/api/library/combined')
            if (resp.ok) {
              const json = await resp.json()
              const combined = (json.combined || []).find((c: any) => c.id === releaseId)
              if (combined) setLikedItems(prev => [combined, ...prev])
            }
          })()
        } else {
          setLikedItems(prev => prev.filter(i => i.id !== releaseId))
        }
      }
      return () => bc.close()
    } catch (error) {
      // BroadcastChannel may not be supported
    }
  }, [])

  // Subscribe to combined_media updates for likes_count changes etc.
  useEffect(() => {
    const mediaChannel = supabaseClient
      .channel('combined_media_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'combined_media' }, (payload) => {
        const updatedMedia = payload.new as any
        // Update tracks in musicItems, releaseItems, likedItems
        setMusicItems(prev => prev.map(m => m.id === updatedMedia.id ? { ...m, likes: updatedMedia.likes_count || updatedMedia.likes || m.likes } : m))
        setReleaseItems(prev => prev.map(m => m.id === updatedMedia.id ? { ...m, likes: updatedMedia.likes_count || updatedMedia.likes || m.likes } : m))
        setLikedItems(prev => prev.map(m => m.id === updatedMedia.id ? { ...m, likes: updatedMedia.likes_count || updatedMedia.likes || m.likes } : m))
      })
      .subscribe()

    return () => {
      mediaChannel.unsubscribe()
    }
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
        // Optimistically update UI
        if (type === 'music') {
          setMusicItems(prev => prev.filter(item => item.id !== id))
        } else if (type === 'images') {
          setImageItems(prev => prev.filter(item => item.id !== id))
        } else if (type === 'releases') {
          setReleaseItems(prev => prev.filter(item => item.id !== id))
        }
        alert('✅ Deleted successfully!')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('❌ Failed to delete. Please try again.')
    }
  }

  const handleSendToLabel = async (musicId: string) => {
    // Open release modal to select cover art
    const track = musicItems.find(m => m.id === musicId)
    if (track) {
      setSelectedReleaseTrack(track)
      setShowReleaseModal(true)
    }
  }

  const handleReleaseSuccess = () => {
    setShowReleaseModal(false)
    setSelectedReleaseTrack(null)
    setShowReleaseToast(true)
    fetchLibrary() // Refresh to show new release
    
    // Hide toast after 3 seconds
    setTimeout(() => {
      setShowReleaseToast(false)
    }, 3000)
  }

  const handleDownload = async (url: string, filename: string, format: 'mp3' | 'wav' = 'mp3') => {
    try {
      if (format === 'mp3') {
        // Use download proxy to avoid CORS issues
        const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        try {
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.status}`)
          }
          const arrayBuffer = await response.arrayBuffer()
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          
          const wavBlob = audioBufferToWav(audioBuffer)
          const wavUrl = URL.createObjectURL(wavBlob)
          
          const link = document.createElement('a')
          link.href = wavUrl
          link.download = filename.replace('.mp3', '.wav')
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          URL.revokeObjectURL(wavUrl)
        } catch (error) {
          console.error('WAV conversion error:', error)
          alert('Failed to convert to WAV')
        }
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Download failed. Please try again.')
    }
  }

  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44
    const arrayBuffer = new ArrayBuffer(length)
    const view = new DataView(arrayBuffer)
    const channels: Float32Array[] = []
    let offset = 0
    let pos = 0

    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2 }
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4 }

    setUint32(0x46464952)
    setUint32(length - 8)
    setUint32(0x45564157)
    setUint32(0x20746d66)
    setUint32(16)
    setUint16(1)
    setUint16(buffer.numberOfChannels)
    setUint32(buffer.sampleRate)
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels)
    setUint16(buffer.numberOfChannels * 2)
    setUint16(16)
    setUint32(0x61746164)
    setUint32(length - pos - 4)

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(pos, sample, true)
        pos += 2
      }
      offset++
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
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
              onClick={() => setActiveTab('videos')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'videos'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-400 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-400'
              }`}
            >
              <ImageViewIcon size={18} />
              <span>Videos</span>
              <span className="ml-1 text-xs opacity-60">({videoItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('releases')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'releases'
                  ? 'bg-gradient-to-r from-green-600 to-green-400 text-white shadow-lg shadow-green-500/30'
                  : 'bg-white/5 text-green-400/60 hover:bg-green-500/10 hover:text-green-400'
              }`}
            >
              <Send size={18} />
              <span>Releases</span>
              <span className="ml-1 text-xs opacity-60">({releaseItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('liked')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'liked'
                  ? 'bg-gradient-to-r from-pink-600 to-pink-400 text-white shadow-lg shadow-pink-500/30'
                  : 'bg-white/5 text-pink-400/60 hover:bg-pink-500/10 hover:text-pink-400'
              }`}
            >
              <Heart size={18} />
              <span>Liked</span>
              <span className="ml-1 text-xs opacity-60">({likedItems.length})</span>
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
                          {/* Show a clean title, avoiding R2 metadata/filenames */}
                          {item.title && !item.title.startsWith('r2_') && !item.title.includes('user_') ? 
                            item.title : 
                            (item.prompt && item.prompt !== 'Legacy R2 file' ? 
                              (item.prompt.length > 40 ? `${item.prompt.substring(0, 40)}...` : item.prompt) : 
                              'Untitled Track'
                            )
                          }
                        </h3>
                        <p className="text-cyan-400/50 text-xs mt-0.5 truncate">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={async () => {
                            const track = {
                              id: item.id,
                              audioUrl: item.audioUrl || item.audio_url, // Use normalized field with fallback
                              title: item.title || 'Untitled',
                              artist: user?.firstName || 'You'
                            }
                            
                            // If this track is playing, toggle pause/play
                            if (currentTrack?.id === item.id) {
                              togglePlayPause()
                            } else {
                              // Set playlist to all music items and play this one
                              const allTracks = musicItems.map(i => ({
                                id: i.id,
                                audioUrl: i.audioUrl || i.audio_url, // Use normalized field with fallback
                                title: i.title || 'Untitled',
                                artist: user?.firstName || 'You',
                                userId: user?.id // Include userId for play tracking
                              }))
                              await setPlaylist(allTracks, musicItems.findIndex(i => i.id === item.id))
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

                        <div className="hidden sm:flex gap-1">
                          <button
                            onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'mp3')}
                            className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                            title="Download MP3"
                          >
                            <Download size={14} className="text-cyan-400" />
                            <span className="text-xs text-cyan-400 font-medium">MP3</span>
                          </button>
                          <button
                            onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'wav')}
                            className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                            title="Download WAV (High Quality)"
                          >
                            <Download size={14} className="text-cyan-300" />
                            <span className="text-xs text-cyan-300 font-medium">WAV</span>
                          </button>
                        </div>

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

        {/* Videos Tab */}
        {!isLoading && activeTab === 'videos' && (
          <div>
            {videoItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-400/10 border border-purple-500/30 flex items-center justify-center">
                  <ImageViewIcon size={32} className="text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No videos yet</h3>
                <p className="text-purple-400/50 mb-6 text-sm">Upload a video to generate synced audio</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl font-bold hover:from-purple-700 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/20">
                  <ImageViewIcon size={18} />
                  Create Video
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {videoItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-video bg-black/60 backdrop-blur-xl border border-purple-500/20 rounded-xl overflow-hidden hover:border-purple-400/60 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      // Play video with generated audio
                      const videoUrl = item.audioUrl || item.audio_url
                      window.open(videoUrl, '_blank')
                    }}
                  >
                    <video 
                      src={item.audioUrl || item.audio_url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause()
                        e.currentTarget.currentTime = 0
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-semibold text-xs truncate">
                          {item.title || 'Video with Synced Audio'}
                        </p>
                        <p className="text-purple-400/70 text-[10px] mt-0.5 truncate">
                          {item.prompt && `"${item.prompt.substring(0, 40)}${item.prompt.length > 40 ? '...' : ''}"`}
                        </p>
                      </div>
                    </div>
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 rounded-full bg-purple-600/80 backdrop-blur-sm flex items-center justify-center">
                        <Play size={24} className="text-white ml-1" />
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
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-400/10 border border-green-500/30 flex items-center justify-center">
                  <Send size={32} className="text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No releases yet</h3>
                <p className="text-green-400/50 mb-6 text-sm">Release your tracks from the Music tab to see them here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {releaseItems.map((item) => (
                  <div
                    key={item.id}
                    className="group relative bg-black/40 backdrop-blur-xl border border-green-500/20 rounded-xl overflow-hidden hover:border-green-400/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Cover Art */}
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-green-500/30">
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
                            <span className="px-2 py-0.5 bg-gradient-to-r from-green-600 to-green-400 rounded-full text-[10px] font-bold text-white shadow-lg shadow-green-500/20 flex-shrink-0">
                              ✨ Live
                            </span>
                          )}
                        </div>
                        <p className="text-green-400/50 text-xs">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            const track = {
                              id: item.id,
                              title: item.title || 'Untitled',
                              artist: 'Unknown Artist',
                              audioUrl: item.audioUrl || item.audio_url,
                              imageUrl: item.imageUrl || item.image_url,
                              userId: user?.id // Include userId for play tracking
                            }
                            setPlaylist([track])
                            playTrack(track)
                          }}
                          className="p-2.5 bg-green-500/20 rounded-lg hover:bg-green-500/40 transition-all hover:scale-105 border border-green-500/30"
                          title="Play"
                        >
                          {currentTrack?.id === item.id && isPlaying ? (
                            <Pause size={16} className="text-green-400" />
                          ) : (
                            <Play size={16} className="text-green-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete('releases', item.id)}
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

        {/* Liked Tab */}
        {!isLoading && activeTab === 'liked' && (
          <div>
            {likedItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-400/10 border border-pink-500/30 flex items-center justify-center">
                  <Heart size={32} className="text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No liked tracks yet</h3>
                <p className="text-pink-400/50 mb-6 text-sm">Like tracks to see them here</p>
                <Link href="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-400 text-white rounded-xl font-bold hover:from-pink-700 hover:to-pink-500 transition-all shadow-lg shadow-pink-500/20">
                  Explore Music
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {likedItems.map((item: any) => (
                  <div key={item.id} className="group relative bg-black/40 backdrop-blur-xl border border-pink-500/20 rounded-xl overflow-hidden hover:border-pink-400/60 transition-all duration-300">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-pink-500/30">
                        <img src={item.image_url} alt={item.title || 'Release'} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{item.title || 'Release'}</h3>
                        <p className="text-pink-400/50 text-xs">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={async () => {
                            const track = { id: item.id, title: item.title || 'Untitled', artist: 'Unknown Artist', audioUrl: item.audioUrl || item.audio_url, imageUrl: item.imageUrl || item.image_url, userId: user?.id }
                            await setPlaylist([track])
                            await playTrack(track)
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

