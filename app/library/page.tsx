'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Music, Music2, Image as ImageIcon, Trash2, Download, Play, Pause, Send, ArrowLeft, RefreshCw, FileText, ImageIcon as ImageViewIcon, Heart, Scissors, ChevronDown, ChevronUp, Volume2, ShoppingBag, Layers, Repeat, Radio, Info, Mic, Mic2 } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'images' | 'music' | 'videos' | 'releases' | 'liked' | 'stems' | 'mixmaster' | 'bought' | 'extract' | 'loops' | 'effects' | 'autotune' | 'chords' | 'remix' | 'voiceover' | 'beatmaker'>('music')
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
  const [chordsItems, setChordsItems] = useState<any[]>([])
  const [remixItems, setRemixItems] = useState<any[]>([])
  const [beatmakerItems, setBeatmakerItems] = useState<any[]>([])
  const [voiceoverItems, setVoiceoverItems] = useState<LibraryMusic[]>([])
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
      const [musicRes, r2AudioRes, imagesRes, r2ImagesRes, videosRes, r2VideosRes, releasesRes, likedRes, stemsRes, mixmasterRes, boughtRes, extractRes, loopsRes, effectsRes, autotuneRes, chordsRes, remixRes, beatmakerRes, voiceoverRes] = await Promise.all([
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
        fetch('/api/library/autotune'),
        fetch('/api/library/chords'),
        fetch('/api/library/remix'),
        fetch('/api/library/beatmaker'),
        fetch('/api/library/voiceover')
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
      const chordsData = await chordsRes.json()
      const remixData = await remixRes.json()
      const beatmakerData = await beatmakerRes.json()
      const voiceoverData = await voiceoverRes.json()

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
          console.warn(`âš ï¸ ${expiredWarningCount} tracks may have expired URLs (Replicate > 48h old)`)
        }
        
        // Filter out stems, boosted tracks, AND purchased tracks from the music tab
        const boughtAudioUrls = new Set(
          (boughtData.success && Array.isArray(boughtData.bought) ? boughtData.bought : []).map((t: any) => t.audio_url).filter(Boolean)
        )
        const nonStemMusic = uniqueMusic.filter((track: any) =>
          track.genre !== 'stem' && track.genre !== 'boosted' && track.genre !== 'extract' && track.genre !== 'loop' && track.genre !== 'effects' && track.genre !== 'processed' && track.genre !== 'chords' && track.genre !== 'voice-over' && track.genre !== 'beatmaker' &&
          !(track.prompt && typeof track.prompt === 'string' && track.prompt.toLowerCase().includes('purchased from earn')) &&
          !boughtAudioUrls.has(track.audio_url)
        )
        setMusicItems(nonStemMusic)
        
        console.log('âœ… Loaded', nonStemMusic.length, 'music tracks from database (excluded', uniqueMusic.length - nonStemMusic.length, 'stems/boosted/voice-over)')
      }

      // Voice Labs â€” use dedicated endpoint
      if (voiceoverData.success && Array.isArray(voiceoverData.tracks)) {
        setVoiceoverItems(voiceoverData.tracks)
        console.log('ðŸŽ™ï¸ Loaded', voiceoverData.tracks.length, 'voice-over items')
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
        console.log('âœ… Loaded', uniqueImages.length, 'images (DB:', dbImages.length, '+ R2:', r2Images.length, ')')
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
        console.log('âœ… Loaded', uniqueVideos.length, 'videos (DB:', dbVideos.length, '+ R2:', r2Videos.length, ')')
      }

      if (releasesData.success && Array.isArray(releasesData.releases)) {
        setReleaseItems(releasesData.releases)
        console.log('âœ… Loaded', releasesData.releases.length, 'releases')
      }
      if (likedData.success && Array.isArray(likedData.liked)) {
        setLikedItems(likedData.liked)
        console.log('ðŸ’š Loaded', likedData.liked.length, 'liked tracks')
      }
      // Stem groups
      if (stemsData.success && Array.isArray(stemsData.groups)) {
        setStemGroups(stemsData.groups)
        console.log('ðŸŽ›ï¸ Loaded', stemsData.groups.length, 'stem groups')
      }
      // Mix & Master tracks
      if (mixmasterData.success && Array.isArray(mixmasterData.tracks)) {
        setMixmasterItems(mixmasterData.tracks)
        console.log('ðŸ”Š Loaded', mixmasterData.tracks.length, 'mix & master tracks')
      }
      if (boughtData.success && Array.isArray(boughtData.bought)) {
        setBoughtItems(boughtData.bought)
        console.log('ðŸ›’ Loaded', boughtData.bought.length, 'bought tracks')
      }
      if (extractData.success && Array.isArray(extractData.groups)) {
        setExtractGroups(extractData.groups)
        console.log('ðŸŽ¬ Loaded', extractData.groups.length, 'extract groups')
      }
      if (loopsData.success && Array.isArray(loopsData.loops)) {
        setLoopsItems(loopsData.loops)
        console.log('ðŸ”„ Loaded', loopsData.loops.length, 'loops')
      }
      if (effectsData.success && Array.isArray(effectsData.effects)) {
        setEffectsItems(effectsData.effects)
        console.log('ðŸŽµ Loaded', effectsData.effects.length, 'effects/SFX')
      }
      if (autotuneData.success && Array.isArray(autotuneData.tracks)) {
        setAutotuneItems(autotuneData.tracks)
        console.log('ðŸŽ¤ Loaded', autotuneData.tracks.length, 'autotune tracks')
      }
      if (chordsData.success && Array.isArray(chordsData.chords)) {
        setChordsItems(chordsData.chords)
        console.log('ðŸŽ¹ Loaded', chordsData.chords.length, 'chords tracks')
      }
      if (remixData.success && Array.isArray(remixData.remixes)) {
        setRemixItems(remixData.remixes)
        console.log('ðŸ” Loaded', remixData.remixes.length, 'remixes')
      }
      if (beatmakerData.success && Array.isArray(beatmakerData.beats)) {
        setBeatmakerItems(beatmakerData.beats)
        console.log('ðŸ¥ Loaded', beatmakerData.beats.length, 'beat maker items')
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
        alert('âœ… Deleted successfully!')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('âŒ Failed to delete. Please try again.')
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


  // --- Procedural gradient for tracks without cover art ---
  const getTrackGradient = (str: string) => {
    let h = 0
    for (let i = 0; i < (str || 'x').length; i++) h = (str || 'x').charCodeAt(i) + ((h << 5) - h)
    const h1 = Math.abs(h % 360), h2 = (h1 + 40) % 360
    return `linear-gradient(135deg, hsl(${h1}, 60%, 18%), hsl(${h2}, 50%, 8%))`
  }

  // --- Tab Configuration ---
  const tabConfig: { key: typeof activeTab; label: string; icon: any; count: number; gradient: string }[] = [
    { key: 'music', label: 'Music', icon: Music, count: musicItems.length, gradient: 'from-cyan-500 to-teal-400' },
    { key: 'images', label: 'Images', icon: ImageIcon, count: imageItems.length, gradient: 'from-purple-500 to-fuchsia-400' },
    { key: 'videos', label: 'Videos', icon: ImageViewIcon, count: videoItems.length, gradient: 'from-violet-500 to-purple-400' },
    { key: 'releases', label: 'Releases', icon: Send, count: releaseItems.length, gradient: 'from-green-500 to-emerald-400' },
    { key: 'liked', label: 'Liked', icon: Heart, count: likedItems.length, gradient: 'from-pink-500 to-rose-400' },
    { key: 'stems', label: 'Stems', icon: Scissors, count: stemGroups.length, gradient: 'from-orange-500 to-amber-400' },
    { key: 'mixmaster', label: 'Mix & Master', icon: Volume2, count: mixmasterItems.length, gradient: 'from-red-500 to-orange-400' },
    { key: 'bought', label: 'Bought', icon: ShoppingBag, count: boughtItems.length, gradient: 'from-yellow-500 to-amber-400' },
    { key: 'extract', label: 'Extract', icon: Layers, count: extractGroups.length, gradient: 'from-emerald-500 to-teal-400' },
    { key: 'loops', label: 'Loops', icon: Repeat, count: loopsItems.length, gradient: 'from-indigo-500 to-blue-400' },
    { key: 'effects', label: 'SFX', icon: Radio, count: effectsItems.length, gradient: 'from-rose-500 to-pink-400' },
    { key: 'autotune', label: 'Autotune', icon: Mic, count: autotuneItems.length, gradient: 'from-violet-500 to-purple-400' },
    { key: 'chords', label: 'Chords', icon: Music, count: chordsItems.length, gradient: 'from-purple-500 to-indigo-400' },
    { key: 'remix', label: 'Remix', icon: Music2, count: remixItems.length, gradient: 'from-cyan-500 to-blue-400' },
    { key: 'voiceover', label: 'Voice Labs', icon: Mic2, count: voiceoverItems.length, gradient: 'from-amber-500 to-orange-400' },
    { key: 'beatmaker', label: 'Beat Maker', icon: Music, count: beatmakerItems.length, gradient: 'from-teal-500 to-cyan-400' },
  ]

  return (
    <div className="min-h-screen bg-[#060610] text-white overflow-x-hidden">
      {/* â•â•â• CINEMATIC BACKGROUND â•â•â• */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full bg-cyan-500/[0.025] blur-[160px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-15%] left-[-8%] w-[600px] h-[600px] rounded-full bg-purple-500/[0.02] blur-[140px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '3s' }} />
        <div className="absolute top-[30%] left-[40%] w-[500px] h-[500px] rounded-full bg-teal-500/[0.015] blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '5s' }} />
        <div className="absolute top-[60%] right-[15%] w-[400px] h-[400px] rounded-full bg-indigo-500/[0.015] blur-[100px] animate-pulse" style={{ animationDuration: '14s', animationDelay: '7s' }} />
      </div>
      <div className="fixed inset-0 pointer-events-none z-[1] mix-blend-overlay opacity-[0.012]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(200,200,220,0.06) 2px, rgba(200,200,220,0.06) 3px)' }} />
      <Suspense fallback={null}><HolographicBackgroundClient /></Suspense>
      <FloatingMenu />

      {/* Back / ESC */}
      {user?.id && (
        <button onClick={() => router.push(`/profile/${user.id}`)} className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all" title="Back to Profile">
          <ArrowLeft size={20} />
        </button>
      )}
      {user?.id && (
        <button onClick={() => router.push(`/profile/${user.id}`)} className="hidden md:flex fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/[0.08] items-center gap-2 text-white/50 hover:text-white hover:bg-white/[0.06] hover:border-white/15 transition-all text-sm font-medium" title="Press ESC to go back">
          <ArrowLeft size={16} /><span>ESC</span>
        </button>
      )}

      {/* â•â•â• MAIN LAYOUT â•â•â• */}
      <div className="relative z-10 md:pl-14 md:pr-28">

        {/* â•â•â• HEADER â•â•â• */}
        <div className="pt-20 md:pt-24 px-4 md:px-8 lg:px-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none">
                <span className="text-white">My </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-teal-300" style={{ filter: 'drop-shadow(0 0 20px rgba(6,182,212,0.4))' }}>Library</span>
              </h1>
              <p className="text-white/25 text-sm mt-3 font-medium tracking-wide">
                {musicItems.length + imageItems.length + videoItems.length + releaseItems.length} creations &middot; {likedItems.length} liked
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Link href="/library/release" className="hidden sm:flex px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black hover:shadow-lg hover:shadow-cyan-500/20 transition-all items-center gap-2 font-bold text-sm hover:scale-[1.03] duration-200">
                <Send size={14} /> Release Manager
              </Link>
              <button onClick={() => fetchLibrary(true)} disabled={isRefreshing} className={`p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.08] hover:border-white/10 transition-all ${isRefreshing ? 'opacity-50 pointer-events-none' : ''}`} title="Refresh">
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* â•â•â• TAB NAVIGATION â•â•â• */}
        <div className="sticky top-0 z-40 backdrop-blur-2xl bg-[#060610]/80 border-b border-white/[0.04]" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 md:px-8 lg:px-12 py-3">
            {tabConfig.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg scale-[1.02]`
                      : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  <TabIcon size={15} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${isActive ? 'bg-black/20 text-white' : 'bg-white/[0.06] text-white/30'}`}>
                      {tab.count}
                    </span>
                  )}
                  {isActive && <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r ${tab.gradient} blur-sm opacity-60`} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* â•â•â• CONTENT AREA â•â•â• */}
        <div className="px-4 md:px-8 lg:px-12 py-8 pb-32 min-h-[60vh]">
          {isLoading && <LibraryTabSkeleton />}

          {/* â”€â”€â”€ IMAGES TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'images' && (
            <div>
              {imageItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/10 border border-purple-500/20 flex items-center justify-center">
                    <ImageIcon size={40} className="text-purple-400/60" />
                    <div className="absolute inset-0 rounded-3xl bg-purple-500/10 blur-xl -z-10" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No images yet</h3>
                  <p className="text-white/30 text-sm mb-8">Create cover art to get started</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-purple-500/20">
                    <ImageIcon size={16} /> Create Cover Art
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {imageItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-purple-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/[0.06] animate-slide-in-up"
                      style={{ animationDelay: `${Math.min(idx * 30, 500)}ms` }}
                    >
                      <Image src={item.image_url} alt={item.title || item.prompt} width={300} height={300} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedCoverUrl(item.image_url); setSelectedCoverTitle(item.title || item.prompt); setShowCoverModal(true) }} className="w-full py-2 bg-purple-500/20 backdrop-blur-xl rounded-xl hover:bg-purple-500/40 transition-colors border border-purple-500/30 flex items-center justify-center gap-2">
                          <ImageViewIcon size={14} className="text-purple-300" /><span className="text-purple-300 text-xs font-semibold">View</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(item.image_url, `${item.title || 'image'}.webp`) }} className="w-full py-2 bg-cyan-500/20 backdrop-blur-xl rounded-xl hover:bg-cyan-500/40 transition-colors border border-cyan-500/30 flex items-center justify-center gap-2">
                          <Download size={14} className="text-cyan-300" /><span className="text-cyan-300 text-xs font-semibold">Download</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete('images', item.id) }} className="w-full py-2 bg-red-500/20 backdrop-blur-xl rounded-xl hover:bg-red-500/40 transition-colors border border-red-500/30 flex items-center justify-center gap-2">
                          <Trash2 size={14} className="text-red-300" /><span className="text-red-300 text-xs font-semibold">Delete</span>
                        </button>
                      </div>
                      {/* Bottom info bar */}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 to-transparent group-hover:opacity-0 transition-opacity">
                        <p className="text-xs text-white/80 truncate font-medium">{item.title || 'Untitled Image'}</p>
                        <p className="text-[10px] text-white/25 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ MUSIC TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'music' && (
            <div>
              {musicItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Music size={40} className="text-cyan-400/60" />
                    <div className="absolute inset-0 rounded-3xl bg-cyan-500/10 blur-xl -z-10" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No music yet</h3>
                  <p className="text-white/30 text-sm mb-8">Generate your first track to get started</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-cyan-500/20">
                    <Music size={16} /> Create Music
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {musicItems.map((item, idx) => {
                    const trackTitle = item.title && !item.title.startsWith('r2_') && !item.title.includes('user_')
                      ? item.title
                      : (item.prompt && item.prompt !== 'Legacy R2 file'
                        ? (item.prompt.length > 40 ? `${item.prompt.substring(0, 40)}...` : item.prompt)
                        : 'Untitled Track')
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying                    
                    return (
                      <div
                        key={item.id}
                        className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-cyan-500/15 transition-all duration-300 hover:-translate-y-[1px] animate-slide-in-up"
                        style={{ animationDelay: `${Math.min(idx * 25, 500)}ms` }}
                      >
                        {/* Track # */}
                        <span className="hidden sm:block w-6 text-right text-[11px] text-white/15 font-mono tabular-nums flex-shrink-0">{idx + 1}</span>
                        {/* Procedural gradient thumbnail */}
                        <div
                          className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer group/thumb"
                          style={{ background: getTrackGradient(trackTitle) }}
                          onClick={async () => {
                            if (currentTrack?.id === item.id) { togglePlayPause() } else {
                              const allTracks = musicItems.map(i => ({ id: i.id, audioUrl: i.audioUrl || i.audio_url, title: i.title || 'Untitled', artist: user?.firstName || 'You', userId: user?.id }))
                              await setPlaylist(allTracks, musicItems.findIndex(i => i.id === item.id))
                            }
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center"><Music size={16} className="text-white/15" /></div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/thumb:bg-black/40 transition-colors">
                            <div className="opacity-0 group-hover/thumb:opacity-100 scale-75 group-hover/thumb:scale-100 transition-all">
                              {isCurrentlyPlaying ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
                            </div>
                          </div>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{trackTitle}</h3>
                          <p className="text-white/20 text-xs mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              if (currentTrack?.id === item.id) { togglePlayPause() } else {
                                const allTracks = musicItems.map(i => ({ id: i.id, audioUrl: i.audioUrl || i.audio_url, title: i.title || 'Untitled', artist: user?.firstName || 'You', userId: user?.id }))
                                await setPlaylist(allTracks, musicItems.findIndex(i => i.id === item.id))
                              }
                            }}
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center text-black hover:scale-110 transition-transform shadow-lg shadow-cyan-500/20"
                          >
                            {isCurrentlyPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                          </button>
                          <div className="hidden sm:flex gap-1">
                            <button onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'mp3')} className="px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-cyan-500/10 hover:border-cyan-500/20 flex items-center gap-1 transition-all" title="Download MP3">
                              <Download size={12} className="text-cyan-400/60" /><span className="text-[10px] text-cyan-400/60 font-medium">MP3</span>
                            </button>
                            <button onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'wav')} className="px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-cyan-500/10 hover:border-cyan-500/20 flex items-center gap-1 transition-all" title="Download WAV">
                              <Download size={12} className="text-cyan-300/60" /><span className="text-[10px] text-cyan-300/60 font-medium">WAV</span>
                            </button>
                          </div>
                          <button onClick={() => { setSelectedLyricsId(item.id); setSelectedLyricsTitle(item.title || 'Untitled'); setShowLyricsModal(true) }} className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-purple-500/10 hover:border-purple-500/20 flex items-center justify-center transition-all" title="Lyrics">
                            <FileText size={13} className="text-purple-400/60" />
                          </button>
                          <button onClick={() => { setSelectedReleaseTrack(item); setShowReleaseModal(true) }} className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-green-500/10 hover:border-green-500/20 flex items-center justify-center transition-all" title="Release">
                            <Send size={13} className="text-green-400/60" />
                          </button>
                          <button onClick={() => handleDelete('music', item.id)} className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all" title="Delete">
                            <Trash2 size={13} className="text-red-400/60" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ VIDEOS TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'videos' && (
            <div>
              {videoItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
                    <ImageViewIcon size={40} className="text-violet-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No videos yet</h3>
                  <p className="text-white/30 text-sm mb-8">Upload a video to generate synced audio</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-violet-500/20">
                    <ImageViewIcon size={16} /> Create Video
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videoItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="group relative aspect-video rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-violet-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/[0.06] cursor-pointer animate-slide-in-up"
                      style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}
                      onClick={() => {
                        const videoUrl = item.video_url || item.audioUrl || item.audio_url || item.media_url
                        window.open(videoUrl, '_blank')
                      }}
                    >
                      <video src={item.video_url || item.audioUrl || item.audio_url || item.media_url} className="w-full h-full object-cover" muted playsInline onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <p className="text-white font-semibold text-sm truncate">{item.title || 'Video with Synced Audio'}</p>
                          <p className="text-violet-400/60 text-xs mt-1 truncate">{item.prompt && `"${item.prompt.substring(0, 40)}${item.prompt.length > 40 ? '...' : ''}"`}</p>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <div className="w-14 h-14 rounded-full bg-violet-500/80 backdrop-blur-sm flex items-center justify-center scale-75 group-hover:scale-100 transition-transform shadow-xl shadow-violet-500/30">
                          <Play size={22} className="text-white ml-1" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ RELEASES TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'releases' && (
            <div>
              {releaseItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center">
                    <Send size={40} className="text-green-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No releases yet</h3>
                  <p className="text-white/30 text-sm mb-8">Release your tracks from the Music tab</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {releaseItems.map((item, idx) => {
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-green-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/[0.06] animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}>
                        {/* Cover Art */}
                        <div className="relative aspect-square overflow-hidden">
                          {item.image_url && /\.(mp4|webm|mov)($|\?)/.test(item.image_url) ? (
                            <video src={item.image_url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                          ) : (
                            <img src={item.image_url} alt={item.title || 'Release'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          )}
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const track = { id: item.id, title: item.title || 'Untitled', artist: 'Unknown Artist', audioUrl: item.audioUrl || item.audio_url, imageUrl: item.imageUrl || item.image_url, userId: user?.id }
                                setPlaylist([track])
                                playTrack(track)
                              }}
                              className="w-12 h-12 rounded-full bg-green-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all shadow-xl shadow-green-500/30"
                            >
                              {isCurrentlyPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
                            </button>
                          </div>
                          {/* Live badge */}
                          {item.is_published && (
                            <div className="absolute top-2 right-2">
                              <span className="px-2 py-1 bg-green-500/90 backdrop-blur-sm rounded-lg text-[10px] font-bold text-white shadow-lg shadow-green-500/30">âœ¨ Live</span>
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Release'}</h3>
                          <p className="text-green-400/30 text-xs mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                          <div className="flex gap-1.5 mt-2.5">
                            <button onClick={() => handleDelete('releases', item.id)} className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 transition-all" title="Delete">
                              <Trash2 size={12} className="text-red-400/50" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ LIKED TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'liked' && (
            <div>
              {likedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-pink-500/20 to-rose-500/10 border border-pink-500/20 flex items-center justify-center">
                    <Heart size={40} className="text-pink-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No liked tracks yet</h3>
                  <p className="text-white/30 text-sm mb-8">Like tracks to see them here</p>
                  <Link href="/radio" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-pink-500/20">
                    Radio
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {likedItems.map((item: any, idx: number) => {
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group relative rounded-2xl overflow-hidden bg-white/[0.03] border border-white/[0.05] hover:border-pink-500/20 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/[0.06] animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}>
                        <div className="relative aspect-square overflow-hidden">
                          {item.image_url && /\.(mp4|webm|mov)($|\?)/.test(item.image_url) ? (
                            <video src={item.image_url} className="w-full h-full object-cover" muted loop playsInline autoPlay />
                          ) : (
                            <Image src={item.image_url} alt={item.title || 'Release'} width={300} height={300} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const track = { id: item.id, title: item.title || 'Untitled', artist: 'Unknown Artist', audioUrl: item.audioUrl || item.audio_url, imageUrl: item.imageUrl || item.image_url, userId: user?.id }
                                await setPlaylist([track])
                                await playTrack(track)
                              }}
                              className="w-12 h-12 rounded-full bg-pink-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all shadow-xl shadow-pink-500/30"
                            >
                              {isCurrentlyPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
                            </button>
                          </div>
                          {/* Heart icon */}
                          <div className="absolute top-2 right-2">
                            <Heart size={16} className="text-pink-400 fill-pink-400" />
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Release'}</h3>
                          <p className="text-pink-400/30 text-xs mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ STEMS TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'stems' && (
            <div>
              {stemGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center">
                    <Scissors size={40} className="text-orange-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No stems yet</h3>
                  <p className="text-white/30 text-sm mb-8">Split a track into vocals, drums, bass & more</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 text-black font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-orange-500/20">
                    <Scissors size={16} /> Split Stems
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {stemGroups.map((group: any, idx: number) => {
                    const isExpanded = expandedStems.has(idx)
                    return (
                      <div key={idx} className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.04] hover:border-orange-500/15 transition-all animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}>
                        <button
                          onClick={() => { setExpandedStems(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next }) }}
                          className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden border border-orange-500/20 bg-gradient-to-br from-orange-500/20 to-amber-400/10 flex items-center justify-center">
                            {group.parentImage ? <Image src={group.parentImage} alt={group.parentTitle} width={48} height={48} className="w-full h-full object-cover" /> : <Music size={20} className="text-orange-400/60" />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h3 className="text-white/90 font-medium text-sm truncate">{group.parentTitle}</h3>
                            <p className="text-orange-400/30 text-xs mt-0.5">{group.stems.length} stems</p>
                          </div>
                          <button onClick={async (e) => {
                            e.stopPropagation()
                            const playlist = group.stems.map((s: any) => ({ id: s.id, audioUrl: s.audioUrl, title: s.title || s.stemType, artist: user?.firstName || 'You' }))
                            await setPlaylist(playlist); await playTrack(playlist[0])
                          }} className="p-2.5 bg-orange-500/10 rounded-xl hover:bg-orange-500/20 transition-all border border-orange-500/20 flex-shrink-0" title="Play all">
                            <Play size={16} className="text-orange-400" />
                          </button>
                          <div className="flex-shrink-0">{isExpanded ? <ChevronUp size={16} className="text-white/20" /> : <ChevronDown size={16} className="text-white/20" />}</div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-white/[0.04]">
                            {group.stems.map((stem: any) => {
                              const stemLabel = (stem.stemType || 'unknown').charAt(0).toUpperCase() + (stem.stemType || 'unknown').slice(1)
                              const stemColor = getStemColor(stem.stemType)
                              return (
                                <div key={stem.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-b-0">
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${stemColor}`}>{stemLabel}</span>
                                  <span className="flex-1 text-white/70 text-sm truncate">{stem.title}</span>
                                  <button onClick={async () => { const track = { id: stem.id, audioUrl: stem.audioUrl, title: stem.title || stemLabel, artist: user?.firstName || 'You' }; await setPlaylist([track]); await playTrack(track) }} className="p-2 rounded-lg hover:bg-orange-500/10 transition-colors" title={`Play ${stemLabel}`}>
                                    {currentTrack?.id === stem.id && isPlaying ? <Pause size={14} className="text-orange-400" /> : <Play size={14} className="text-orange-400" />}
                                  </button>
                                  <button onClick={() => handleDownload(stem.audioUrl, `${stem.title || stemLabel}.wav`, 'wav')} className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors" title="Download">
                                    <Download size={14} className="text-cyan-400/50" />
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

          {/* â”€â”€â”€ MIX & MASTER TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'mixmaster' && (
            <div>
              {mixmasterItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center">
                    <Volume2 size={40} className="text-red-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No mix & master tracks yet</h3>
                  <p className="text-white/30 text-sm mb-8">Boost your audio for 1 credit</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-red-500/20">
                    <Volume2 size={16} /> Boost a Track
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {mixmasterItems.map((track: any, idx: number) => {
                    const isCurrentlyPlaying = currentTrack?.id === track.id && isPlaying
                    return (
                      <div key={track.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-red-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          const t = { id: track.id, audioUrl: track.audioUrl || track.audio_url, title: track.title || 'Boosted Audio', artist: user?.firstName || 'You' }
                          if (isCurrentlyPlaying) { togglePlayPause() } else { await setPlaylist([t]); await playTrack(t) }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-red-400" /> : <Play size={16} className="text-red-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{track.title || 'Boosted Audio'}</h3>
                          <p className="text-red-400/30 text-xs mt-0.5 truncate">{track.prompt || 'Mix & Master'}</p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(track.created_at).toLocaleDateString()}</span>
                        <button onClick={() => handleDownload(track.audioUrl || track.audio_url, `${track.title || 'boosted'}.mp3`)} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 transition-all" title="Download">
                          <Download size={14} className="text-red-400/50" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ BOUGHT TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'bought' && (
            <div>
              {boughtItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <ShoppingBag size={40} className="text-yellow-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No purchased tracks yet</h3>
                  <p className="text-white/30 text-sm mb-8">Browse the Earn marketplace to discover tracks</p>
                  <Link href="/earn" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-yellow-500/20">
                    <ShoppingBag size={16} /> Browse Earn
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {boughtItems.map((item: any, idx: number) => {
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-yellow-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!item.audio_url) return
                          const t = { id: item.id, audioUrl: item.audio_url, title: item.title || 'Untitled', artist: item.seller_username || item.username || user?.firstName || 'Artist', imageUrl: item.image_url || undefined }
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const allTracks = boughtItems.filter((b: any) => b.audio_url).map((b: any) => ({ id: b.id, audioUrl: b.audio_url, title: b.title || 'Untitled', artist: b.seller_username || b.username || user?.firstName || 'Artist', imageUrl: b.image_url || undefined }))
                            await setPlaylist(allTracks, allTracks.findIndex((t: any) => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border border-yellow-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-yellow-400" /> : <Play size={16} className="text-yellow-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Untitled'}</h3>
                          <p className="text-yellow-400/30 text-xs mt-0.5 truncate">
                            {item.seller_username ? `@${item.seller_username}` : 'Purchased'}{item.genre ? ` Â· ${item.genre}` : ''}{item.amount_paid ? ` Â· ${item.amount_paid} cr` : ''}
                          </p>
                        </div>
                        <button onClick={() => setBoughtInfoTrack(item)} className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-yellow-500/10 hover:border-yellow-500/20 flex items-center justify-center transition-all" title="Info">
                          <Info size={13} className="text-yellow-400/50" />
                        </button>
                        <span className="hidden sm:inline-flex px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/15 text-[10px] text-yellow-400/60 font-medium">Purchased</span>
                        {item.audio_url && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'mp3')} className="px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-yellow-500/10 hover:border-yellow-500/20 flex items-center gap-1 transition-all" title="MP3">
                              <Download size={12} className="text-yellow-400/50" /><span className="text-[10px] text-yellow-400/50 font-medium">MP3</span>
                            </button>
                            <button onClick={() => handleDownload(item.audio_url, `${item.title || 'track'}.mp3`, 'wav')} className="px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-yellow-500/10 hover:border-yellow-500/20 flex items-center gap-1 transition-all" title="WAV">
                              <Download size={12} className="text-yellow-300/50" /><span className="text-[10px] text-yellow-300/50 font-medium">WAV</span>
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

          {/* â”€â”€â”€ EXTRACT TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'extract' && (
            <div>
              {extractGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Layers size={40} className="text-emerald-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No extractions yet</h3>
                  <p className="text-white/30 text-sm mb-8">Extract audio from video or isolate stems</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-emerald-500/20">
                    <Layers size={16} /> Extract Audio
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {extractGroups.map((group: any, idx: number) => {
                    const isExpanded = expandedExtracts.has(idx)
                    return (
                      <div key={idx} className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/15 transition-all animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 50, 300)}ms` }}>
                        <button onClick={() => { setExpandedExtracts(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next }) }} className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                          <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-teal-400/10 flex items-center justify-center">
                            {group.parentImage ? <Image src={group.parentImage} alt={group.parentTitle} width={48} height={48} className="w-full h-full object-cover" /> : <Layers size={20} className="text-emerald-400/60" />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <h3 className="text-white/90 font-medium text-sm truncate">{group.parentTitle}</h3>
                            <p className="text-emerald-400/30 text-xs mt-0.5">
                              {group.extracts.length} extract{group.extracts.length !== 1 ? 's' : ''}
                              {group.extracts[0]?.source === 'video-to-audio' ? ' Â· from video' : ' Â· stems'}
                            </p>
                          </div>
                          <button onClick={async (e) => {
                            e.stopPropagation()
                            const playlist = group.extracts.map((ex: any) => ({ id: ex.id, audioUrl: ex.audioUrl, title: ex.title || ex.stemType || 'Extract', artist: user?.firstName || 'You' }))
                            await setPlaylist(playlist); await playTrack(playlist[0])
                          }} className="p-2.5 bg-emerald-500/10 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20 flex-shrink-0" title="Play all">
                            <Play size={16} className="text-emerald-400" />
                          </button>
                          <div className="flex-shrink-0">{isExpanded ? <ChevronUp size={16} className="text-white/20" /> : <ChevronDown size={16} className="text-white/20" />}</div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-white/[0.04]">
                            {group.extracts.map((extract: any) => {
                              const label = extract.stemType ? extract.stemType.charAt(0).toUpperCase() + extract.stemType.slice(1) : extract.source === 'video-to-audio' ? 'Full Audio' : 'Extract'
                              const badgeColor = extract.stemType ? getStemColor(extract.stemType) : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              return (
                                <div key={extract.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-b-0">
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>{label}</span>
                                  <span className="flex-1 text-white/70 text-sm truncate">{extract.title}</span>
                                  <button onClick={async () => { const track = { id: extract.id, audioUrl: extract.audioUrl, title: extract.title || label, artist: user?.firstName || 'You' }; await setPlaylist([track]); await playTrack(track) }} className="p-2 rounded-lg hover:bg-emerald-500/10 transition-colors" title={`Play ${label}`}>
                                    {currentTrack?.id === extract.id && isPlaying ? <Pause size={14} className="text-emerald-400" /> : <Play size={14} className="text-emerald-400" />}
                                  </button>
                                  <button onClick={() => handleDownload(extract.audioUrl, `${extract.title || label}.mp3`)} className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors" title="Download">
                                    <Download size={14} className="text-cyan-400/50" />
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

          {/* â”€â”€â”€ LOOPS TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'loops' && (
            <div>
              {loopsItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Repeat size={40} className="text-indigo-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No loops yet</h3>
                  <p className="text-white/30 text-sm mb-8">Generate fixed BPM loops to build tracks</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-indigo-500/20">
                    <Repeat size={16} /> Generate Loops
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {loopsItems.map((item: any, idx: number) => {
                    const audioUrl = item.audioUrl || item.audio_url
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-indigo-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!audioUrl) return
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const tracks = loopsItems.filter((l: any) => l.audioUrl || l.audio_url).map((l: any) => ({ id: l.id, audioUrl: l.audioUrl || l.audio_url, title: l.title || 'Loop', artist: user?.firstName || 'You' }))
                            await setPlaylist(tracks, tracks.findIndex(t => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/10 border border-indigo-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-indigo-400" /> : <Play size={16} className="text-indigo-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Untitled Loop'}</h3>
                          <p className="text-indigo-400/30 text-xs mt-0.5 truncate">{item.prompt ? `${item.prompt.substring(0, 50)}${item.prompt.length > 50 ? '...' : ''}` : 'Fixed BPM Loop'}</p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        {audioUrl && <button onClick={() => handleDownload(audioUrl, `${item.title || 'loop'}.mp3`, 'mp3')} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all" title="Download"><Download size={14} className="text-indigo-400/50" /></button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ SFX / EFFECTS TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'effects' && (
            <div>
              {effectsItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 border border-rose-500/20 flex items-center justify-center">
                    <Radio size={40} className="text-rose-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No sound effects yet</h3>
                  <p className="text-white/30 text-sm mb-8">Generate custom audio effects and SFX</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-rose-500/20">
                    <Radio size={16} /> Generate SFX
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {effectsItems.map((item: any, idx: number) => {
                    const audioUrl = item.audioUrl || item.audio_url
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-rose-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!audioUrl) return
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const tracks = effectsItems.filter((e: any) => e.audioUrl || e.audio_url).map((e: any) => ({ id: e.id, audioUrl: e.audioUrl || e.audio_url, title: e.title || 'SFX', artist: user?.firstName || 'You' }))
                            await setPlaylist(tracks, tracks.findIndex(t => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 border border-rose-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-rose-400" /> : <Play size={16} className="text-rose-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Untitled SFX'}</h3>
                          <p className="text-rose-400/30 text-xs mt-0.5 truncate">{item.prompt ? `${item.prompt.substring(0, 50)}${item.prompt.length > 50 ? '...' : ''}` : 'Sound Effect'}</p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        {audioUrl && <button onClick={() => handleDownload(audioUrl, `${item.title || 'sfx'}.mp3`, 'mp3')} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-rose-500/10 hover:border-rose-500/20 transition-all" title="Download"><Download size={14} className="text-rose-400/50" /></button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ AUTOTUNE TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'autotune' && (
            <div>
              {autotuneItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Mic size={40} className="text-violet-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No autotuned tracks yet</h3>
                  <p className="text-white/30 text-sm mb-8">Pitch correct any audio to a musical key</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-violet-500/20">
                    <Mic size={16} /> Autotune a Track
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {autotuneItems.map((item: any, idx: number) => {
                    const audioUrl = item.audioUrl || item.audio_url
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-violet-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!audioUrl) return
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const tracks = autotuneItems.filter((a: any) => a.audioUrl || a.audio_url).map((a: any) => ({ id: a.id, audioUrl: a.audioUrl || a.audio_url, title: a.title || 'Autotuned', artist: user?.firstName || 'You' }))
                            await setPlaylist(tracks, tracks.findIndex(t => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-violet-400" /> : <Play size={16} className="text-violet-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Autotuned Audio'}</h3>
                          <p className="text-violet-400/30 text-xs mt-0.5 truncate">{item.prompt || 'Pitch Corrected'}</p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        {audioUrl && <button onClick={() => handleDownload(audioUrl, `${item.title || 'autotuned'}.wav`)} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-violet-500/10 hover:border-violet-500/20 transition-all" title="Download"><Download size={14} className="text-violet-400/50" /></button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ CHORDS TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'chords' && (
            <div>
              {chordsItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Music size={40} className="text-purple-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No chords yet</h3>
                  <p className="text-white/30 text-sm mb-8">Generate chord progressions and rhythms</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-purple-500/20">
                    <Music size={16} /> Generate Chords
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {chordsItems.map((item: any, idx: number) => {
                    const audioUrl = item.audioUrl || item.audio_url
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-purple-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!audioUrl) return
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const tracks = chordsItems.filter((c: any) => c.audioUrl || c.audio_url).map((c: any) => ({ id: c.id, audioUrl: c.audioUrl || c.audio_url, title: c.title || 'Chords', artist: user?.firstName || 'You' }))
                            await setPlaylist(tracks, tracks.findIndex(t => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/10 border border-purple-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-purple-400" /> : <Play size={16} className="text-purple-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Untitled Chords'}</h3>
                          <p className="text-purple-400/30 text-xs mt-0.5 truncate">
                            {item.chord_progression || item.prompt || 'Chord Progression'}
                            {item.time_signature && <span className="ml-1 opacity-60">Â· {item.time_signature}</span>}
                          </p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        {audioUrl && <button onClick={() => handleDownload(audioUrl, `${item.title || 'chords'}.mp3`, 'mp3')} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-purple-500/10 hover:border-purple-500/20 transition-all" title="Download"><Download size={14} className="text-purple-400/50" /></button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ REMIX TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'remix' && (
            <div>
              {remixItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Music2 size={40} className="text-cyan-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No remixes yet</h3>
                  <p className="text-white/30 text-sm mb-8">Upload a beat and remix it with 444 Radio</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-400 text-white font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-cyan-500/20">
                    <Music2 size={16} /> Create Remix
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {remixItems.map((item: any, idx: number) => {
                    const audioUrl = item.audioUrl || item.audio_url
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-cyan-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!audioUrl) return
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const tracks = remixItems.filter((r: any) => r.audioUrl || r.audio_url).map((r: any) => ({ id: r.id, audioUrl: r.audioUrl || r.audio_url, title: r.title || 'Remix', artist: user?.firstName || 'You' }))
                            await setPlaylist(tracks, tracks.findIndex(t => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-cyan-400" /> : <Play size={16} className="text-cyan-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Untitled Remix'}</h3>
                          <p className="text-cyan-400/30 text-xs mt-0.5 truncate">
                            {item.prompt || 'Remix'}
                            {item.duration && <span className="ml-1 opacity-60">Â· {item.duration}s</span>}
                            {item.audio_format && <span className="ml-1 opacity-60">Â· {item.audio_format.toUpperCase()}</span>}
                          </p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        {audioUrl && <button onClick={() => handleDownload(audioUrl, `${item.title || 'remix'}.${item.audio_format || 'wav'}`, item.audio_format || 'wav')} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-cyan-500/10 hover:border-cyan-500/20 transition-all" title={`Download ${(item.audio_format || 'WAV').toUpperCase()}`}><Download size={14} className="text-cyan-400/50" /></button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ VOICE LABS TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'voiceover' && (
            <div>
              {voiceoverItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Mic2 size={40} className="text-amber-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No voice generations yet</h3>
                  <p className="text-white/30 text-sm mb-8">Generate speech and voiceovers in Voice Labs</p>
                  <Link href="/voice-labs" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-400 text-black font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-amber-500/20">
                    <Mic2 size={16} /> Open Voice Labs
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {voiceoverItems.map((item, idx) => {
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    const voTitle = item.title && !item.title.startsWith('r2_') && !item.title.includes('user_')
                      ? item.title
                      : (item.prompt && item.prompt !== 'Legacy R2 file'
                        ? (item.prompt.length > 40 ? `${item.prompt.substring(0, 40)}...` : item.prompt)
                        : 'Untitled Voice Over')
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-amber-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 25, 500)}ms` }}>
                        <div className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-amber-500/20 to-orange-400/10 border border-amber-500/20 flex items-center justify-center">
                          <Mic2 size={20} className="text-amber-400/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{voTitle}</h3>
                          <p className="text-amber-400/30 text-xs mt-0.5">Voice Labs Â· {new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={async () => {
                              if (currentTrack?.id === item.id) { togglePlayPause() } else {
                                const allTracks = voiceoverItems.map(i => ({ id: i.id, audioUrl: i.audioUrl || i.audio_url, title: i.title || 'Voice Over', artist: user?.firstName || 'You', userId: user?.id }))
                                await setPlaylist(allTracks, voiceoverItems.findIndex(i => i.id === item.id))
                              }
                            }}
                            className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center text-black hover:scale-110 transition-transform shadow-lg shadow-amber-500/20"
                          >
                            {isCurrentlyPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                          </button>
                          <div className="hidden sm:flex gap-1">
                            <button onClick={() => handleDownload(item.audio_url, `${item.title || 'voiceover'}.mp3`, 'mp3')} className="px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-amber-500/10 hover:border-amber-500/20 flex items-center gap-1 transition-all" title="MP3">
                              <Download size={12} className="text-amber-400/50" /><span className="text-[10px] text-amber-400/50 font-medium">MP3</span>
                            </button>
                            <button onClick={() => handleDownload(item.audio_url, `${item.title || 'voiceover'}.mp3`, 'wav')} className="px-2.5 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-amber-500/10 hover:border-amber-500/20 flex items-center gap-1 transition-all" title="WAV">
                              <Download size={12} className="text-amber-300/50" /><span className="text-[10px] text-amber-300/50 font-medium">WAV</span>
                            </button>
                          </div>
                          <button onClick={() => handleDelete('music', item.id)} className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all" title="Delete">
                            <Trash2 size={13} className="text-red-400/50" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€â”€ BEAT MAKER TAB â”€â”€â”€ */}
          {!isLoading && activeTab === 'beatmaker' && (
            <div>
              {beatmakerItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="relative w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center">
                    <Music size={40} className="text-teal-400/60" />
                  </div>
                  <h3 className="text-xl font-bold text-white/80 mb-2">No beats yet</h3>
                  <p className="text-white/30 text-sm mb-8">Generate instrumentals & samples with Beat Maker</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-400 text-black font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-teal-500/20">
                    <Music size={16} /> Open Beat Maker
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {beatmakerItems.map((item: any, idx: number) => {
                    const audioUrl = item.audioUrl || item.audio_url
                    const isCurrentlyPlaying = currentTrack?.id === item.id && isPlaying
                    return (
                      <div key={item.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-teal-500/15 transition-all duration-300 animate-slide-in-up" style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}>
                        <button onClick={async () => {
                          if (!audioUrl) return
                          if (isCurrentlyPlaying) { togglePlayPause() } else {
                            const tracks = beatmakerItems.filter((b: any) => b.audioUrl || b.audio_url).map((b: any) => ({ id: b.id, audioUrl: b.audioUrl || b.audio_url, title: b.title || 'Beat', artist: user?.firstName || 'You' }))
                            await setPlaylist(tracks, tracks.findIndex(t => t.id === item.id))
                          }
                        }} className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center hover:scale-110 transition-transform">
                          {isCurrentlyPlaying ? <Pause size={16} className="text-teal-400" /> : <Play size={16} className="text-teal-400 ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white/90 font-medium text-sm truncate">{item.title || 'Untitled Beat'}</h3>
                          <p className="text-teal-400/30 text-xs mt-0.5 truncate">
                            {item.prompt ? (item.prompt.length > 60 ? item.prompt.substring(0, 60) + 'â€¦' : item.prompt) : 'Beat'}
                            {item.duration && <span className="ml-1 opacity-60">Â· {item.duration}s</span>}
                            {item.audio_format && <span className="ml-1 opacity-60">Â· {item.audio_format.toUpperCase()}</span>}
                          </p>
                        </div>
                        <span className="text-[10px] text-white/15 hidden sm:block">{new Date(item.created_at).toLocaleDateString()}</span>
                        {audioUrl && <button onClick={() => handleDownload(audioUrl, `${item.title || 'beat'}.${item.audio_format || 'wav'}`, item.audio_format || 'wav')} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-teal-500/10 hover:border-teal-500/20 transition-all" title={`Download ${(item.audio_format || 'WAV').toUpperCase()}`}><Download size={14} className="text-teal-400/50" /></button>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>{/* END CONTENT AREA */}
      </div>{/* END MAIN LAYOUT */}

      {/* â•â•â• MODALS â•â•â• */}
      <Suspense fallback={null}>
        {selectedLyricsId && (
          <LyricsModal isOpen={showLyricsModal} onClose={() => { setShowLyricsModal(false); setSelectedLyricsId(null); setSelectedLyricsTitle(null) }} mediaId={selectedLyricsId} title={selectedLyricsTitle || undefined} />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {selectedCoverUrl && (
          <CoverArtModal isOpen={showCoverModal} onClose={() => { setShowCoverModal(false); setSelectedCoverUrl(null); setSelectedCoverTitle(null) }} imageUrl={selectedCoverUrl} title={selectedCoverTitle || undefined} />
        )}
      </Suspense>
      <Suspense fallback={null}>
        <TwoStepReleaseModal isOpen={showReleaseModal} onClose={() => { setShowReleaseModal(false); setSelectedReleaseTrack(null) }} preselectedMusic={selectedReleaseTrack?.id} />
      </Suspense>
      {boughtInfoTrack && (
        <Suspense fallback={null}>
          <TrackInfoModal
            track={{ ...boughtInfoTrack, imageUrl: boughtInfoTrack.image_url, audioUrl: boughtInfoTrack.audio_url, username: boughtInfoTrack.seller_username || boughtInfoTrack.username || 'Unknown' }}
            onClose={() => setBoughtInfoTrack(null)}
            onPlay={() => {
              if (boughtInfoTrack.audio_url) {
                const t = { id: boughtInfoTrack.id, audioUrl: boughtInfoTrack.audio_url, title: boughtInfoTrack.title || 'Untitled', artist: boughtInfoTrack.seller_username || 'Artist' }
                setPlaylist([t], 0)
              }
              setBoughtInfoTrack(null)
            }}
          />
        </Suspense>
      )}

      {/* Release Toast */}
      {showReleaseToast && (
        <div className="fixed bottom-6 right-6 z-[110] animate-slide-in-up">
          <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-green-500/30 border border-green-400/30 flex items-center gap-3">
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
