'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Music, Image as ImageIcon, Trash2, Download, Play, Pause, Send, ArrowLeft, RefreshCw, FileText, ImageIcon as ImageViewIcon, Heart, Scissors, ChevronDown, ChevronUp, Volume2, ShoppingBag, Layers, Repeat, Radio, Info, Mic } from 'lucide-react'
import FloatingMenu from '../components/FloatingMenu'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { LibraryTabSkeleton } from '../components/LoadingSkeleton'

// Lazy load heavy components
const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))
const LyricsModal = lazy(() => import('../components/LyricsModal'))
const CoverArtModal = lazy(() => import('../components/CoverArtModal'))
const TwoStepReleaseModal = lazy(() => import('../components/TwoStepReleaseModal'))
const TrackInfoModal = lazy(() => import('../components/TrackInfoModal'))

interface LibraryMusic {
  id: string
  title: string | null
  prompt: string
  lyrics: string | null
  audio_url: string
  audioUrl?: string // Normalized field for frontend compatibility
  media_url?: string // Fallback URL field
  video_url?: string // Video URL for visualizer-generated content
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
  const [activeTab, setActiveTab] = useState<'images' | 'music' | 'videos' | 'releases' | 'liked' | 'stems' | 'mixmaster' | 'bought' | 'extract' | 'loops' | 'effects' | 'autotune'>('music')
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [videoItems, setVideoItems] = useState<LibraryMusic[]>([]) // Reuse music interface for videos
  const [releaseItems, setReleaseItems] = useState<LibraryCombined[]>([])
  const [likedItems, setLikedItems] = useState<LibraryCombined[]>([])
  const [stemGroups, setStemGroups] = useState<any[]>([])
  const [mixmasterItems, setMixmasterItems] = useState<LibraryMusic[]>([])
  const [boughtItems, setBoughtItems] = useState<any[]>([])
  const [extractGroups, setExtractGroups] = useState<any[]>([])
  const [loopsItems, setLoopsItems] = useState<any[]>([])
  const [effectsItems, setEffectsItems] = useState<any[]>([])
  const [autotuneItems, setAutotuneItems] = useState<any[]>([])
  const [expandedExtracts, setExpandedExtracts] = useState<Set<number>>(new Set())
  const [expandedStems, setExpandedStems] = useState<Set<number>>(new Set())
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
  const [boughtInfoTrack, setBoughtInfoTrack] = useState<any | null>(null)

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
      const [musicRes, r2AudioRes, imagesRes, r2ImagesRes, videosRes, r2VideosRes, releasesRes, likedRes, stemsRes, mixmasterRes, boughtRes, extractRes, loopsRes, effectsRes, autotuneRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/r2/list-audio'),
        fetch('/api/library/images'),
        fetch('/api/r2/list-images'),
        fetch('/api/library/videos'),
        fetch('/api/r2/list-videos'),
        fetch('/api/library/releases'),
        fetch('/api/library/liked'),
        fetch('/api/library/stems'),
        fetch('/api/library/mixmaster'),
        fetch('/api/library/bought'),
        fetch('/api/library/extract'),
        fetch('/api/library/loops'),
        fetch('/api/library/effects'),
        fetch('/api/library/autotune')
      ])

      const musicData = await musicRes.json()
      const r2AudioData = await r2AudioRes.json()
      const imagesData = await imagesRes.json()
      const r2ImagesData = await r2ImagesRes.json()
      const videosData = await videosRes.json()
      const r2VideosData = await r2VideosRes.json()
      const releasesData = await releasesRes.json()
      const likedData = await likedRes.json()
      const stemsData = await stemsRes.json()
      const mixmasterData = await mixmasterRes.json()
      const boughtData = await boughtRes.json()
      const extractData = await extractRes.json()
      const loopsData = await loopsRes.json()
      const effectsData = await effectsRes.json()
      const autotuneData = await autotuneRes.json()

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
        
        // Filter out stems, boosted tracks, AND purchased tracks from the music tab
        const boughtAudioUrls = new Set(
          (boughtData.success && Array.isArray(boughtData.bought) ? boughtData.bought : []).map((t: any) => t.audio_url).filter(Boolean)
        )
        const nonStemMusic = uniqueMusic.filter((track: any) =>
          track.genre !== 'stem' && track.genre !== 'boosted' && track.genre !== 'extract' && track.genre !== 'loop' && track.genre !== 'effects' && track.genre !== 'processed' &&
          !(track.prompt && typeof track.prompt === 'string' && track.prompt.toLowerCase().includes('purchased from earn')) &&
          !boughtAudioUrls.has(track.audio_url)
        )
        setMusicItems(nonStemMusic)
        console.log('✅ Loaded', nonStemMusic.length, 'music tracks from database (excluded', uniqueMusic.length - nonStemMusic.length, 'stems/boosted)')
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
        
        // Combine and deduplicate by video_url/audioUrl/media_url
        const allVideos = [...dbVideos, ...r2Videos]
        const uniqueVideos = Array.from(
          new Map(allVideos.map(item => [item.video_url || item.audioUrl || item.audio_url || item.media_url, item])).values()
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
      // Stem groups
      if (stemsData.success && Array.isArray(stemsData.groups)) {
        setStemGroups(stemsData.groups)
        console.log('🎛️ Loaded', stemsData.groups.length, 'stem groups')
      }
      // Mix & Master tracks
      if (mixmasterData.success && Array.isArray(mixmasterData.tracks)) {
        setMixmasterItems(mixmasterData.tracks)
        console.log('🔊 Loaded', mixmasterData.tracks.length, 'mix & master tracks')
      }
      if (boughtData.success && Array.isArray(boughtData.bought)) {
        setBoughtItems(boughtData.bought)
        console.log('🛒 Loaded', boughtData.bought.length, 'bought tracks')
      }
      if (extractData.success && Array.isArray(extractData.groups)) {
        setExtractGroups(extractData.groups)
        console.log('🎬 Loaded', extractData.groups.length, 'extract groups')
      }
      if (loopsData.success && Array.isArray(loopsData.loops)) {
        setLoopsItems(loopsData.loops)
        console.log('🔄 Loaded', loopsData.loops.length, 'loops')
      }
      if (effectsData.success && Array.isArray(effectsData.effects)) {
        setEffectsItems(effectsData.effects)
        console.log('🎵 Loaded', effectsData.effects.length, 'effects/SFX')
      }
      if (autotuneData.success && Array.isArray(autotuneData.tracks)) {
        setAutotuneItems(autotuneData.tracks)
        console.log('🎤 Loaded', autotuneData.tracks.length, 'autotune tracks')
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

  const getStemColor = (stemType: string) => {
    switch (stemType?.toLowerCase()) {
      case 'vocals': return 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
      case 'drums': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
      case 'bass': return 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
      case 'other': return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
      default: return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    }
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
    <div className="min-h-screen bg-black text-white md:pl-20 md:pr-28">
      {/* Holographic 3D Background - Lazy Loaded */}
      <Suspense fallback={null}>
        <HolographicBackgroundClient />
      </Suspense>
      
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
            <button
              onClick={() => setActiveTab('stems')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'stems'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-400 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/5 text-orange-400/60 hover:bg-orange-500/10 hover:text-orange-400'
              }`}
            >
              <Scissors size={18} />
              <span>Stems</span>
              <span className="ml-1 text-xs opacity-60">({stemGroups.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('mixmaster')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'mixmaster'
                  ? 'bg-gradient-to-r from-orange-600 to-red-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/5 text-orange-400/60 hover:bg-orange-500/10 hover:text-orange-400'
              }`}
            >
              <Volume2 size={18} />
              <span>Mix & Master</span>
              <span className="ml-1 text-xs opacity-60">({mixmasterItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('bought')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'bought'
                  ? 'bg-gradient-to-r from-yellow-600 to-amber-400 text-white shadow-lg shadow-yellow-500/30'
                  : 'bg-white/5 text-yellow-400/60 hover:bg-yellow-500/10 hover:text-yellow-400'
              }`}
            >
              <ShoppingBag size={18} />
              <span>Bought</span>
              <span className="ml-1 text-xs opacity-60">({boughtItems.length})</span>
            </button>

            {/* Extract Tab */}
            <button
              onClick={() => setActiveTab('extract')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'extract'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-400'
              }`}
            >
              <Layers size={18} />
              <span>Extract</span>
              <span className="ml-1 text-xs opacity-60">({extractGroups.length})</span>
            </button>

            {/* Loops Tab */}
            <button
              onClick={() => setActiveTab('loops')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'loops'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-400 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/5 text-indigo-400/60 hover:bg-indigo-500/10 hover:text-indigo-400'
              }`}
            >
              <Repeat size={18} />
              <span>Loops</span>
              <span className="ml-1 text-xs opacity-60">({loopsItems.length})</span>
            </button>

            {/* Effects Tab */}
            <button
              onClick={() => setActiveTab('effects')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'effects'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-400 text-white shadow-lg shadow-pink-500/30'
                  : 'bg-white/5 text-pink-400/60 hover:bg-pink-500/10 hover:text-pink-400'
              }`}
            >
              <Radio size={18} />
              <span>SFX</span>
              <span className="ml-1 text-xs opacity-60">({effectsItems.length})</span>
            </button>

            {/* Autotune Tab */}
            <button
              onClick={() => setActiveTab('autotune')}
              className={`flex-1 min-w-[100px] px-6 py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'autotune'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-400 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-white/5 text-violet-400/60 hover:bg-violet-500/10 hover:text-violet-400'
              }`}
            >
              <Mic size={18} />
              <span>Autotune</span>
              <span className="ml-1 text-xs opacity-60">({autotuneItems.length})</span>
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
                    <Image
                      src={item.image_url}
                      alt={item.title || item.prompt}
                      width={300}
                      height={300}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
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
                      const videoUrl = item.video_url || item.audioUrl || item.audio_url || item.media_url
                      window.open(videoUrl, '_blank')
                    }}
                  >
                    <video 
                      src={item.video_url || item.audioUrl || item.audio_url || item.media_url}
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
                        <Image src={item.image_url} alt={item.title || 'Release'} width={56} height={56} className="w-full h-full object-cover" loading="lazy" />
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

        {/* Stems Tab */}
        {!isLoading && activeTab === 'stems' && (
          <div>
            {stemGroups.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-400/10 border border-orange-500/30 flex items-center justify-center">
                  <Scissors size={32} className="text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No stems yet</h3>
                <p className="text-orange-400/50 mb-6 text-sm">Split a track into vocals, drums, bass & more</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-400 text-white rounded-xl font-bold hover:from-orange-700 hover:to-amber-500 transition-all shadow-lg shadow-orange-500/20">
                  <Scissors size={18} />
                  Split Stems
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {stemGroups.map((group: any, idx: number) => {
                  const isExpanded = expandedStems.has(idx)
                  return (
                    <div key={idx} className="bg-black/40 backdrop-blur-xl border border-orange-500/20 rounded-xl overflow-hidden hover:border-orange-400/40 transition-all">
                      {/* Parent track header — click to expand */}
                      <button
                        onClick={() => {
                          setExpandedStems(prev => {
                            const next = new Set(prev)
                            if (next.has(idx)) next.delete(idx)
                            else next.add(idx)
                            return next
                          })
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-orange-500/5 transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-amber-400/10 flex items-center justify-center">
                          {group.parentImage ? (
                            <Image src={group.parentImage} alt={group.parentTitle} width={56} height={56} className="w-full h-full object-cover" />
                          ) : (
                            <Music size={24} className="text-orange-400" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="text-white font-semibold text-sm truncate">{group.parentTitle}</h3>
                          <p className="text-orange-400/60 text-xs mt-0.5">{group.stems.length} stems</p>
                        </div>
                        {/* Play all stems button */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            const playlist = group.stems.map((s: any) => ({
                              id: s.id,
                              audioUrl: s.audioUrl,
                              title: s.title || s.stemType,
                              artist: user?.firstName || 'You'
                            }))
                            await setPlaylist(playlist)
                            await playTrack(playlist[0])
                          }}
                          className="p-2.5 bg-orange-500/20 rounded-lg hover:bg-orange-500/40 transition-all hover:scale-105 border border-orange-500/30 flex-shrink-0"
                          title="Play all stems"
                        >
                          <Play size={16} className="text-orange-400" />
                        </button>
                        {/* Expand chevron */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp size={18} className="text-orange-400/60" />
                          ) : (
                            <ChevronDown size={18} className="text-orange-400/60" />
                          )}
                        </div>
                      </button>

                      {/* Expanded stems list */}
                      {isExpanded && (
                        <div className="border-t border-orange-500/10">
                          {group.stems.map((stem: any) => {
                            const stemLabel = (stem.stemType || 'unknown').charAt(0).toUpperCase() + (stem.stemType || 'unknown').slice(1)
                            const stemColor = getStemColor(stem.stemType)
                            return (
                              <div key={stem.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                                {/* Stem type badge */}
                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${stemColor}`}>
                                  {stemLabel}
                                </span>
                                {/* Title */}
                                <span className="flex-1 text-white/80 text-sm truncate">{stem.title}</span>
                                {/* Play */}
                                <button
                                  onClick={async () => {
                                    const track = {
                                      id: stem.id,
                                      audioUrl: stem.audioUrl,
                                      title: stem.title || stemLabel,
                                      artist: user?.firstName || 'You'
                                    }
                                    await setPlaylist([track])
                                    await playTrack(track)
                                  }}
                                  className="p-2 rounded-lg hover:bg-orange-500/20 transition-colors"
                                  title={`Play ${stemLabel}`}
                                >
                                  {currentTrack?.id === stem.id && isPlaying ? (
                                    <Pause size={14} className="text-orange-400" />
                                  ) : (
                                    <Play size={14} className="text-orange-400" />
                                  )}
                                </button>
                                {/* Download */}
                                <button
                                  onClick={() => handleDownload(stem.audioUrl, `${stem.title || stemLabel}.mp3`)}
                                  className="p-2 rounded-lg hover:bg-cyan-500/20 transition-colors"
                                  title={`Download ${stemLabel}`}
                                >
                                  <Download size={14} className="text-cyan-400" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Mix & Master Tab */}
        {!isLoading && activeTab === 'mixmaster' && (
          <div>
            {mixmasterItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 flex items-center justify-center">
                  <Volume2 size={32} className="text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No mix & master tracks yet</h3>
                <p className="text-orange-400/50 mb-6 text-sm">Boost your audio — mix & master any track for 1 credit</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-500 text-white rounded-xl font-bold hover:from-orange-700 hover:to-red-600 transition-all shadow-lg shadow-orange-500/20">
                  <Volume2 size={18} />
                  Boost a Track
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {mixmasterItems.map((track: any) => {
                  const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying
                  return (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-3 bg-black/40 backdrop-blur-xl border border-orange-500/20 rounded-xl hover:border-orange-400/40 transition-all group"
                    >
                      {/* Play button */}
                      <button
                        onClick={async () => {
                          const t = {
                            id: track.id,
                            audioUrl: track.audioUrl || track.audio_url,
                            title: track.title || 'Boosted Audio',
                            artist: user?.firstName || 'You'
                          }
                          await setPlaylist([t])
                          if (isCurrentlyPlaying) {
                            togglePlayPause()
                          } else {
                            await playTrack(t)
                          }
                        }}
                        className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/10 border border-orange-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {isCurrentlyPlaying ? (
                          <Pause size={18} className="text-orange-400" />
                        ) : (
                          <Play size={18} className="text-orange-400 ml-0.5" />
                        )}
                      </button>

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{track.title || 'Boosted Audio'}</h3>
                        <p className="text-orange-400/50 text-xs mt-0.5 truncate">{track.prompt || 'Mix & Master'}</p>
                      </div>

                      {/* Date */}
                      <span className="text-[10px] text-gray-500 flex-shrink-0 hidden sm:block">
                        {new Date(track.created_at).toLocaleDateString()}
                      </span>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(track.audioUrl || track.audio_url, `${track.title || 'boosted'}.mp3`)}
                        className="p-2 rounded-lg hover:bg-cyan-500/20 transition-colors flex-shrink-0"
                        title="Download"
                      >
                        <Download size={16} className="text-cyan-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Bought / Downloaded Tab */}
        {!isLoading && activeTab === 'bought' && (
          <div>
            {boughtItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-amber-400/10 border border-yellow-500/30 flex items-center justify-center">
                  <ShoppingBag size={32} className="text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No purchased tracks yet</h3>
                <p className="text-yellow-400/50 mb-6 text-sm">Browse the Earn marketplace to discover tracks</p>
                <Link href="/earn" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-600 to-amber-400 text-white rounded-xl font-bold hover:from-yellow-700 hover:to-amber-500 transition-all shadow-lg shadow-yellow-500/20">
                  <ShoppingBag size={18} />
                  Browse Earn
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {boughtItems.map((item: any) => {
                  const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-black/40 backdrop-blur-xl border border-yellow-500/20 rounded-xl hover:border-yellow-400/40 transition-all group"
                    >
                      {/* Play button */}
                      <button
                        onClick={async () => {
                          if (!item.audio_url) return
                          const t = {
                            id: item.id,
                            audioUrl: item.audio_url,
                            title: item.title || 'Untitled',
                            artist: item.seller_username || item.username || user?.firstName || 'Artist',
                            imageUrl: item.image_url || undefined,
                          }
                          if (isCurrentlyPlaying) {
                            togglePlayPause()
                          } else {
                            const allTracks = boughtItems.filter((b: any) => b.audio_url).map((b: any) => ({
                              id: b.id,
                              audioUrl: b.audio_url,
                              title: b.title || 'Untitled',
                              artist: b.seller_username || b.username || user?.firstName || 'Artist',
                              imageUrl: b.image_url || undefined,
                            }))
                            await setPlaylist(allTracks, allTracks.findIndex((t: any) => t.id === item.id))
                          }
                        }}
                        className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {isCurrentlyPlaying ? (
                          <Pause size={18} className="text-yellow-400" />
                        ) : (
                          <Play size={18} className="text-yellow-400 ml-0.5" />
                        )}
                      </button>

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{item.title || 'Untitled'}</h3>
                        <p className="text-yellow-400/50 text-xs mt-0.5 truncate">
                          {item.seller_username ? `@${item.seller_username}` : 'Purchased'}{item.genre ? ` • ${item.genre}` : ''}{item.amount_paid ? ` • ${item.amount_paid} cr` : ''}{item.purchased_at ? ` • ${new Date(item.purchased_at).toLocaleDateString()}` : ''}
                        </p>
                      </div>

                      {/* Info button */}
                      <button
                        onClick={() => setBoughtInfoTrack(item)}
                        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-yellow-500/30 hover:border-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                        title="Track info"
                      >
                        <Info size={14} className="text-yellow-400" />
                      </button>

                      {/* Badge - Purchased, no release */}
                      <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-400 font-medium flex-shrink-0">
                        Purchased
                      </span>

                      {/* Download only - NO release button */}
                      {item.audio_url && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'mp3')}
                            className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-yellow-500/30 hover:border-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                            title="Download MP3"
                          >
                            <Download size={14} className="text-yellow-400" />
                            <span className="text-xs text-yellow-400 font-medium">MP3</span>
                          </button>
                          <button
                            onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'wav')}
                            className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-yellow-500/30 hover:border-yellow-400 hover:bg-yellow-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                            title="Download WAV"
                          >
                            <Download size={14} className="text-yellow-300" />
                            <span className="text-xs text-yellow-300 font-medium">WAV</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Extract Tab */}
        {!isLoading && activeTab === 'extract' && (
          <div>
            {extractGroups.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-400/10 border border-emerald-500/30 flex items-center justify-center">
                  <Layers size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No extractions yet</h3>
                <p className="text-emerald-400/50 mb-6 text-sm">Extract audio from video or isolate stems from audio</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-400 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20">
                  <Layers size={18} />
                  Extract Audio
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {extractGroups.map((group: any, idx: number) => {
                  const isExpanded = expandedExtracts.has(idx)
                  return (
                    <div key={idx} className="bg-black/40 backdrop-blur-xl border border-emerald-500/20 rounded-xl overflow-hidden hover:border-emerald-400/40 transition-all">
                      {/* Parent track header — click to expand */}
                      <button
                        onClick={() => {
                          setExpandedExtracts(prev => {
                            const next = new Set(prev)
                            if (next.has(idx)) next.delete(idx)
                            else next.add(idx)
                            return next
                          })
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-emerald-500/5 transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-teal-400/10 flex items-center justify-center">
                          {group.parentImage ? (
                            <Image src={group.parentImage} alt={group.parentTitle} width={56} height={56} className="w-full h-full object-cover" />
                          ) : (
                            <Layers size={24} className="text-emerald-400" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <h3 className="text-white font-semibold text-sm truncate">{group.parentTitle}</h3>
                          <p className="text-emerald-400/60 text-xs mt-0.5">
                            {group.extracts.length} extract{group.extracts.length !== 1 ? 's' : ''}
                            {group.extracts[0]?.source === 'video-to-audio' ? ' • from video' : ' • stems'}
                          </p>
                        </div>
                        {/* Play all extracts */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            const playlist = group.extracts.map((ex: any) => ({
                              id: ex.id,
                              audioUrl: ex.audioUrl,
                              title: ex.title || ex.stemType || 'Extract',
                              artist: user?.firstName || 'You'
                            }))
                            await setPlaylist(playlist)
                            await playTrack(playlist[0])
                          }}
                          className="p-2.5 bg-emerald-500/20 rounded-lg hover:bg-emerald-500/40 transition-all hover:scale-105 border border-emerald-500/30 flex-shrink-0"
                          title="Play all extracts"
                        >
                          <Play size={16} className="text-emerald-400" />
                        </button>
                        {/* Expand chevron */}
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp size={18} className="text-emerald-400/60" />
                          ) : (
                            <ChevronDown size={18} className="text-emerald-400/60" />
                          )}
                        </div>
                      </button>

                      {/* Expanded extracts list */}
                      {isExpanded && (
                        <div className="border-t border-emerald-500/10">
                          {group.extracts.map((extract: any) => {
                            const label = extract.stemType
                              ? extract.stemType.charAt(0).toUpperCase() + extract.stemType.slice(1)
                              : extract.source === 'video-to-audio' ? 'Full Audio' : 'Extract'
                            const badgeColor = extract.stemType
                              ? getStemColor(extract.stemType)
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            return (
                              <div key={extract.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                                {/* Type badge */}
                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${badgeColor}`}>
                                  {label}
                                </span>
                                {/* Title */}
                                <span className="flex-1 text-white/80 text-sm truncate">{extract.title}</span>
                                {/* Play */}
                                <button
                                  onClick={async () => {
                                    const track = {
                                      id: extract.id,
                                      audioUrl: extract.audioUrl,
                                      title: extract.title || label,
                                      artist: user?.firstName || 'You'
                                    }
                                    await setPlaylist([track])
                                    await playTrack(track)
                                  }}
                                  className="p-2 rounded-lg hover:bg-emerald-500/20 transition-colors"
                                  title={`Play ${label}`}
                                >
                                  {currentTrack?.id === extract.id && isPlaying ? (
                                    <Pause size={14} className="text-emerald-400" />
                                  ) : (
                                    <Play size={14} className="text-emerald-400" />
                                  )}
                                </button>
                                {/* Download */}
                                <button
                                  onClick={() => handleDownload(extract.audioUrl, `${extract.title || label}.mp3`)}
                                  className="p-2 rounded-lg hover:bg-cyan-500/20 transition-colors"
                                  title={`Download ${label}`}
                                >
                                  <Download size={14} className="text-cyan-400" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Loops Tab */}
        {!isLoading && activeTab === 'loops' && (
          <div>
            {loopsItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-400/10 border border-indigo-500/30 flex items-center justify-center">
                  <Repeat size={32} className="text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No loops yet</h3>
                <p className="text-indigo-400/50 mb-6 text-sm">Generate fixed BPM loops to build tracks</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-400 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-500 transition-all shadow-lg shadow-indigo-500/20">
                  <Repeat size={18} />
                  Generate Loops
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {loopsItems.map((loop: any) => {
                  const isCurrentlyPlaying = currentTrack?.id === loop.id && isPlaying
                  return (
                    <div
                      key={loop.id}
                      className="flex items-center gap-3 p-3 bg-black/40 backdrop-blur-xl border border-indigo-500/20 rounded-xl hover:border-indigo-400/40 transition-all group"
                    >
                      {/* Play button */}
                      <button
                        onClick={async () => {
                          if (!loop.audioUrl) return
                          const t = {
                            id: loop.id,
                            audioUrl: loop.audioUrl,
                            title: loop.title || 'Untitled Loop',
                            artist: user?.firstName || 'You'
                          }
                          if (isCurrentlyPlaying) {
                            togglePlayPause()
                          } else {
                            const allTracks = loopsItems.filter((l: any) => l.audioUrl).map((l: any) => ({
                              id: l.id,
                              audioUrl: l.audioUrl,
                              title: l.title || 'Untitled Loop',
                              artist: user?.firstName || 'You'
                            }))
                            await setPlaylist(allTracks, allTracks.findIndex((t: any) => t.id === loop.id))
                          }
                        }}
                        className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {isCurrentlyPlaying ? (
                          <Pause size={18} className="text-indigo-400" />
                        ) : (
                          <Play size={18} className="text-indigo-400 ml-0.5" />
                        )}
                      </button>

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{loop.title || 'Untitled Loop'}</h3>
                        <p className="text-indigo-400/50 text-xs mt-0.5">
                          {loop.prompt ? `${loop.prompt.substring(0, 50)}${loop.prompt.length > 50 ? '...' : ''}` : 'Fixed BPM Loop'}
                        </p>
                      </div>

                      {/* Download */}
                      {loop.audioUrl && (
                        <button
                          onClick={() => handleDownload(loop.audioUrl, `${loop.title || 'loop'}.mp3`, 'mp3')}
                          className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-indigo-500/30 hover:border-indigo-400 hover:bg-indigo-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          title="Download MP3"
                        >
                          <Download size={14} className="text-indigo-400" />
                          <span className="text-xs text-indigo-400 font-medium">MP3</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Effects/SFX Tab */}
        {!isLoading && activeTab === 'effects' && (
          <div>
            {effectsItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-400/10 border border-pink-500/30 flex items-center justify-center">
                  <Radio size={32} className="text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No sound effects yet</h3>
                <p className="text-pink-400/50 mb-6 text-sm">Generate custom audio effects and SFX</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-400 text-white rounded-xl font-bold hover:from-pink-700 hover:to-rose-500 transition-all shadow-lg shadow-pink-500/20">
                  <Radio size={18} />
                  Generate SFX
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {effectsItems.map((effect: any) => {
                  const isCurrentlyPlaying = currentTrack?.id === effect.id && isPlaying
                  return (
                    <div
                      key={effect.id}
                      className="flex items-center gap-3 p-3 bg-black/40 backdrop-blur-xl border border-pink-500/20 rounded-xl hover:border-pink-400/40 transition-all group"
                    >
                      {/* Play button */}
                      <button
                        onClick={async () => {
                          if (!effect.audioUrl) return
                          const t = {
                            id: effect.id,
                            audioUrl: effect.audioUrl,
                            title: effect.title || 'Untitled SFX',
                            artist: user?.firstName || 'You'
                          }
                          if (isCurrentlyPlaying) {
                            togglePlayPause()
                          } else {
                            const allTracks = effectsItems.filter((e: any) => e.audioUrl).map((e: any) => ({
                              id: e.id,
                              audioUrl: e.audioUrl,
                              title: e.title || 'Untitled SFX',
                              artist: user?.firstName || 'You'
                            }))
                            await setPlaylist(allTracks, allTracks.findIndex((t: any) => t.id === effect.id))
                          }
                        }}
                        className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/10 border border-pink-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {isCurrentlyPlaying ? (
                          <Pause size={18} className="text-pink-400" />
                        ) : (
                          <Play size={18} className="text-pink-400 ml-0.5" />
                        )}
                      </button>

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{effect.title || 'Untitled SFX'}</h3>
                        <p className="text-pink-400/50 text-xs mt-0.5">
                          {effect.prompt ? `${effect.prompt.substring(0, 50)}${effect.prompt.length > 50 ? '...' : ''}` : 'Sound Effect'}
                        </p>
                      </div>

                      {/* Download */}
                      {effect.audioUrl && (
                        <button
                          onClick={() => handleDownload(effect.audioUrl, `${effect.title || 'effect'}.mp3`, 'mp3')}
                          className="px-3 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-pink-500/30 hover:border-pink-400 hover:bg-pink-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          title="Download MP3"
                        >
                          <Download size={14} className="text-pink-400" />
                          <span className="text-xs text-pink-400 font-medium">MP3</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Autotune Tab */}
        {!isLoading && activeTab === 'autotune' && (
          <div>
            {autotuneItems.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-400/10 border border-violet-500/30 flex items-center justify-center">
                  <Mic size={32} className="text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-white/80 mb-2">No autotuned tracks yet</h3>
                <p className="text-violet-400/50 mb-6 text-sm">Pitch correct any audio to a musical key & scale</p>
                <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-400 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/20">
                  <Mic size={18} />
                  Autotune a Track
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {autotuneItems.map((track: any) => {
                  const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying
                  return (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-3 bg-black/40 backdrop-blur-xl border border-violet-500/20 rounded-xl hover:border-violet-400/40 transition-all group"
                    >
                      {/* Play button */}
                      <button
                        onClick={async () => {
                          const t = {
                            id: track.id,
                            audioUrl: track.audioUrl || track.audio_url,
                            title: track.title || 'Autotuned Audio',
                            artist: user?.firstName || 'You'
                          }
                          if (isCurrentlyPlaying) {
                            togglePlayPause()
                          } else {
                            const allTracks = autotuneItems.filter((a: any) => a.audioUrl || a.audio_url).map((a: any) => ({
                              id: a.id,
                              audioUrl: a.audioUrl || a.audio_url,
                              title: a.title || 'Autotuned Audio',
                              artist: user?.firstName || 'You'
                            }))
                            await setPlaylist(allTracks, allTracks.findIndex((t: any) => t.id === track.id))
                          }
                        }}
                        className="w-12 h-12 flex-shrink-0 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/30 flex items-center justify-center hover:scale-105 transition-transform"
                      >
                        {isCurrentlyPlaying ? (
                          <Pause size={18} className="text-violet-400" />
                        ) : (
                          <Play size={18} className="text-violet-400 ml-0.5" />
                        )}
                      </button>

                      {/* Track info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{track.title || 'Autotuned Audio'}</h3>
                        <p className="text-violet-400/50 text-xs mt-0.5 truncate">{track.prompt || 'Pitch Corrected'}</p>
                      </div>

                      {/* Date */}
                      <span className="text-[10px] text-gray-500 flex-shrink-0 hidden sm:block">
                        {new Date(track.created_at).toLocaleDateString()}
                      </span>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(track.audioUrl || track.audio_url, `${track.title || 'autotuned'}.wav`)}
                        className="p-2 rounded-lg hover:bg-violet-500/20 transition-colors flex-shrink-0"
                        title="Download"
                      >
                        <Download size={16} className="text-violet-400" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Release Modal - Full 3-Step Flow */}
      <Suspense fallback={null}>
        <TwoStepReleaseModal
          isOpen={showReleaseModal}
          onClose={() => {
            setShowReleaseModal(false)
            setSelectedReleaseTrack(null)
          }}
          preselectedMusic={selectedReleaseTrack?.id}
        />
      </Suspense>

      {/* Bought Track Info Modal */}
      {boughtInfoTrack && (
        <Suspense fallback={null}>
          <TrackInfoModal
            track={{
              ...boughtInfoTrack,
              imageUrl: boughtInfoTrack.image_url,
              audioUrl: boughtInfoTrack.audio_url,
              username: boughtInfoTrack.seller_username || boughtInfoTrack.username || 'Unknown',
            }}
            onClose={() => setBoughtInfoTrack(null)}
            onPlay={() => {
              if (boughtInfoTrack.audio_url) {
                const t = {
                  id: boughtInfoTrack.id,
                  audioUrl: boughtInfoTrack.audio_url,
                  title: boughtInfoTrack.title || 'Untitled',
                  artist: boughtInfoTrack.seller_username || 'Artist',
                }
                setPlaylist([t], 0)
              }
              setBoughtInfoTrack(null)
            }}
          />
        </Suspense>
      )}

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

