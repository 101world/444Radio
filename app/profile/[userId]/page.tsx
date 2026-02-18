'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { use } from 'react'
import { Play, Pause, Heart, MessageCircle, Radio, Grid, List as ListIcon, Upload, Edit2, Users, MapPin, Calendar, ExternalLink, Video, Mic, Send, Smile, Settings, Music, Circle, Plus, Trash2, Zap, Award, BarChart3, Clock, Disc3, Camera, ImageIcon, X as XIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAudioPlayer } from '../../contexts/AudioPlayerContext'
import FloatingMenu from '../../components/FloatingMenu'
import ProfileUploadModal from '../../components/ProfileUploadModal'
import { ProfileHeaderSkeleton, TrackListSkeleton, LoadingPage } from '../../components/LoadingComponents'
import { getPusherClient } from '@/lib/pusher-client'
import { validateProfileForm, validateChatMessage } from '@/lib/validation'

// Note: Cannot export metadata from 'use client' components
// Dynamic metadata is handled via next/head or generateMetadata in server component wrapper

interface ProfileData {
  userId: string
  username: string
  fullName: string
  bio: string
  avatar_url: string
  banner_url: string
  follower_count: number
  following_count: number
  location: string
  joined_date: string
  website: string
  social_links: {
    twitter?: string
    instagram?: string
    youtube?: string
  }
  is_live: boolean
}

interface Track {
  id: string
  title: string
  audio_url: string
  image_url: string
  video_url?: string
  duration: number
  plays: number
  likes: number
  created_at: string
  user_id: string
  genre: string
}

interface ChatMessage {
  id: string
  user_id: string
  username: string
  avatar: string
  message: string
  timestamp: Date
}

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setPlaylist, currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()

  // Profile State
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set())

  // View State
  const [activeView, setActiveView] = useState<'profile' | 'station'>('profile')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Station State
  const [isLive, setIsLive] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [viewerCount, setViewerCount] = useState(0)

  // Modals
  const [showAvatarUpload, setShowAvatarUpload] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showBannerUpload, setShowBannerUpload] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const bannerFileRef = useRef<HTMLInputElement>(null)
  
  // Edit profile form state
  const [editFullName, setEditFullName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editTwitter, setEditTwitter] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})
  const [chatError, setChatError] = useState<string>('')

  // Check URL params for tab
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'station') {
      setActiveView('station')
    }
  }, [searchParams])

  // Real-time chat with Pusher
  useEffect(() => {
    if (!userId) return

    const pusher = getPusherClient()
    if (!pusher) {
      console.log('📡 Pusher not configured - chat will use manual refresh')
      return
    }

    // Subscribe to station channel for chat messages
    const stationChannel = pusher.subscribe(`station-${userId}`)

    stationChannel.bind('pusher:subscription_succeeded', () => {
      console.log('✅ Connected to station chat:', `station-${userId}`)
    })

    stationChannel.bind('new-message', (data: any) => {
      console.log('📩 New chat message:', data)
      const newMessage: ChatMessage = {
        id: data.id || Date.now().toString(),
        user_id: data.user_id,
        username: data.username,
        avatar: data.avatar || '/default-avatar.png',
        message: data.message,
        timestamp: new Date(data.timestamp || Date.now())
      }
      setChatMessages(prev => [...prev, newMessage])
    })

    stationChannel.bind('pusher:subscription_error', (error: any) => {
      console.error('❌ Station channel subscription error:', error)
    })

    return () => {
      stationChannel.unbind_all()
      pusher.unsubscribe(`station-${userId}`)
    }
  }, [userId])

  // Sanitize URLs to remove control characters that break selectors
  const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url) return ''
    return url.replace(/[\r\n\t\a\b\f\v]/g, '')
  }

  // Load Profile Data
  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('clerk_user_id', userId)
          .single()

        if (userError) throw userError

        // Check if own profile
        const isOwn = user?.id === userId
        setIsOwnProfile(isOwn)

        // Check following status
        if (!isOwn && user?.id) {
          const { data: followData, error: followError } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', user.id)
            .eq('following_id', userId)
            .maybeSingle() // Use maybeSingle() instead of single() to handle "no rows" gracefully
          
          // Only set following if we got data (not an error and not null)
          if (!followError && followData) {
            setIsFollowing(true)
          } else {
            setIsFollowing(false)
          }
        }

        // Fetch tracks
        const { data: tracksData, error: tracksError } = await supabase
          .from('combined_media')
          .select('*')
          .eq('user_id', userId)
          .eq('is_public', true)
          .not('audio_url', 'is', null)
          .order('created_at', { ascending: false })

        if (tracksError) throw tracksError

        // Set profile data
        setProfile({
          userId: userData.clerk_user_id,
          username: userData.username || 'Anonymous',
          fullName: userData.username || 'User',
          bio: userData.bio || 'No bio yet',
          avatar_url: userData.avatar_url || '/default-avatar.png',
          banner_url: userData.banner_url || '',
          follower_count: userData.follower_count || 0,
          following_count: userData.following_count || 0,
          location: userData.location || '',
          joined_date: userData.created_at,
          website: userData.website || '',
          social_links: userData.social_links || {},
          is_live: false
        })

        // Station features disabled
        setIsLive(false)
        setViewerCount(0)

        setTracks(tracksData.map((t: any) => ({
          id: t.id,
          title: t.title || 'Untitled',
          audio_url: t.audio_url,
          image_url: t.image_url || '',
          duration: t.duration || 0,
          plays: t.plays || 0,
          likes: t.likes || 0,
          created_at: t.created_at,
          user_id: t.user_id,
          genre: t.genre || 'Unknown',
          video_url: t.video_url
        })))

      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      loadProfile()
    }
  }, [userId, user?.id])

  // Chat/station features temporarily disabled
  // useEffect(() => {
  //   // Station functionality will be re-implemented later
  // }, [activeView, userId])

  // Populate edit form when modal opens
  useEffect(() => {
    if (showEditProfile && profile) {
      setEditFullName(profile.fullName || '')
      setEditBio(profile.bio || '')
      setEditLocation(profile.location || '')
      setEditWebsite(profile.website || '')
      setEditTwitter(profile.social_links?.twitter || '')
      setEditInstagram(profile.social_links?.instagram || '')
    }
  }, [showEditProfile, profile])

  // Handle Follow/Unfollow via API
  const handleFollowToggle = async () => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/profile/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userId,
          action: isFollowing ? 'unfollow' : 'follow'
        })
      })

      if (!response.ok) throw new Error('Failed to update follow status')

      const data = await response.json()
      setIsFollowing(data.isFollowing)
      setProfile(prev => prev ? { 
        ...prev, 
        follower_count: data.isFollowing 
          ? prev.follower_count + 1 
          : prev.follower_count - 1 
      } : null)
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  // Handle Avatar Upload Success  
  const handleAvatarSuccess = async (url?: string) => {
    console.log('[Avatar] Upload success:', url)
    setShowAvatarUpload(false)
    // Refresh profile data
    const { data } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('clerk_user_id', userId)
      .single()
    if (data) {
      setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null)
    }
  }

  // Handle Banner Upload
  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) { alert('Please select an image or video file'); return }
    if (file.size > 50 * 1024 * 1024) { alert('File must be under 50MB'); return }

    setBannerUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', isVideo ? 'video' : 'image')
      const res = await fetch('/api/profile/banner', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success && data.banner_url) {
        setProfile(prev => prev ? { ...prev, banner_url: data.banner_url } : null)
        setShowBannerUpload(false)
      } else {
        alert(data.error || 'Banner upload failed')
      }
    } catch (err) {
      console.error('Banner upload error:', err)
      alert('Failed to upload banner')
    } finally {
      setBannerUploading(false)
      if (bannerFileRef.current) bannerFileRef.current.value = ''
    }
  }

  // Use latest cover art as banner
  const handleUseLatestCover = async () => {
    setBannerUploading(true)
    try {
      const res = await fetch('/api/profile/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useLatestCover: true })
      })
      const data = await res.json()
      if (data.success && data.banner_url) {
        setProfile(prev => prev ? { ...prev, banner_url: data.banner_url } : null)
        setShowBannerUpload(false)
      } else {
        alert(data.error || 'Could not use latest cover')
      }
    } catch (err) {
      console.error('Banner cover error:', err)
    } finally {
      setBannerUploading(false)
    }
  }

  // Handle Edit Profile Submit via API
  const handleEditProfileSubmit = async () => {
    if (!user?.id) return
    
    setIsUpdatingProfile(true)
    try {
      const response = await fetch('/api/profile/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editFullName,
          bio: editBio
        })
      })

      if (!response.ok) throw new Error('Failed to update profile')

      const data = await response.json()
      
      // Update local state with server response
      setProfile(prev => prev ? {
        ...prev,
        username: data.user?.username || prev.username,
        fullName: data.user?.username || prev.fullName,
        bio: data.user?.bio || prev.bio
      } : null)
      
      setShowEditProfile(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  // Handle Track Play
  const handlePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause()
      return
    }

    const audioPlayerTracks = tracks.map(t => ({
      id: t.id,
      title: t.title,
      audioUrl: t.audio_url,
      imageUrl: t.image_url,
      videoUrl: t.video_url,
      artist: profile?.username,
      userId: t.user_id
    }))
    
    const startIndex = tracks.findIndex(t => t.id === track.id)
    setPlaylist(audioPlayerTracks, Math.max(startIndex, 0))
  }

  // Handle Delete Track (own profile only)
  const handleDeleteTrack = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isOwnProfile) return
    if (!confirm('Are you sure you want to delete this release? This cannot be undone.')) return

    try {
      const res = await fetch('/api/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId })
      })
      const data = await res.json()
      if (data.success) {
        setTracks(prev => prev.filter(t => t.id !== trackId))
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete release')
    }
  }

  // Handle Like/Unlike Track
  const handleLikeTrack = async (trackId: string) => {
    if (!user) {
      alert('Please sign in to like tracks')
      return
    }

    try {
      const isLiked = likedTracks.has(trackId)
      
      // Optimistically update UI
      const newLikedTracks = new Set(likedTracks)
      if (isLiked) {
        newLikedTracks.delete(trackId)
      } else {
        newLikedTracks.add(trackId)
      }
      setLikedTracks(newLikedTracks)

      // Update track like count
      setTracks(tracks.map(t => 
        t.id === trackId 
          ? { ...t, likes: isLiked ? Math.max(0, t.likes - 1) : t.likes + 1 }
          : t
      ))

      // Call API in background
      const response = await fetch('/api/media/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: trackId })
      })

      if (!response.ok) {
        // Revert on error
        setLikedTracks(likedTracks)
        setTracks(tracks.map(t => 
          t.id === trackId 
            ? { ...t, likes: isLiked ? t.likes + 1 : Math.max(0, t.likes - 1) }
            : t
        ))
        console.error('Failed to update like')
      }
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  // Load liked tracks on mount
  useEffect(() => {
    async function loadLikedTracks() {
      if (!user?.id) return

      try {
        // Try to load from user_likes table
        const { data, error } = await supabase
          .from('user_likes')
          .select('release_id')
          .eq('user_id', user.id)

        if (!error && data) {
          const liked = new Set(data.map(l => l.release_id))
          setLikedTracks(liked)
        }
      } catch (error) {
        // Silently fail - likes table may not exist yet
        console.log('Likes table not available')
      }
    }

    loadLikedTracks()
  }, [user?.id])

  // Send Chat Message
  const handleSendMessage = async () => {
    if (!user) return

    // Validate message
    const validation = validateChatMessage(chatInput)
    if (!validation.isValid) {
      setChatError(validation.errors.message || 'Invalid message')
      return
    }

    const message = chatInput.trim()
    setChatInput('') // Clear input immediately for better UX
    setChatError('') // Clear error

    try {
      // Get or create station ID
      const { data: stationData } = await supabase
        .from('live_stations')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!stationData) {
        console.error('❌ Station not found')
        return
      }

      // Send message to API (which will broadcast via Pusher)
      const response = await fetch('/api/station/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: stationData.id,
          message: message,
          username: user.username || user.firstName || 'Anonymous'
        })
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message')
      }

      console.log('✅ Message sent successfully')
    } catch (error) {
      console.error('❌ Send message error:', error)
      // Re-add message to input if failed
      setChatInput(message)
      alert('Failed to send message')
    }
  }

  // Helper: format number
  const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()
  // Helper: total plays
  const totalPlays = tracks.reduce((s, t) => s + t.plays, 0)
  const totalLikes = tracks.reduce((s, t) => s + t.likes, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060a12] text-white md:pl-20 md:pr-28">
        <ProfileHeaderSkeleton />
        <div className="px-8 pb-32">
          <TrackListSkeleton count={8} />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center md:pl-20 md:pr-28">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-red-400" />
          </div>
          <p className="text-red-400 font-mono text-sm">SIGNAL NOT FOUND</p>
          <p className="text-gray-700 font-mono text-xs mt-1">Profile does not exist</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060a12] text-white md:pl-20 md:pr-28">
      <FloatingMenu />

      {/* ═══ BACKGROUND GRID TEXTURE ═══ */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.4) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ═══ HERO BANNER ═══ */}
      <div className="relative h-56 md:h-64 overflow-hidden group/banner">
        {/* Banner image/video or gradient fallback */}
        {profile.banner_url ? (
          profile.banner_url.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? (
            <video src={profile.banner_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <Image src={profile.banner_url} alt="Banner" fill className="object-cover" priority />
          )
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d1a2d] to-[#060a12]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,214,0.08),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(139,92,246,0.06),transparent_60%)]" />
          </>
        )}
        {/* Overlay gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060a12] via-[#060a12]/40 to-transparent" />
        {/* Scan lines */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,255,0.15) 3px, rgba(0,255,255,0.15) 4px)' }} />
        {/* Bottom edge accent */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        {/* Corner decorations */}
        <div className="absolute top-4 left-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />
          <span className="text-[9px] font-mono text-cyan-600/60 tracking-[0.3em]">444RADIO.PROFILE</span>
        </div>
        <div className="absolute top-4 right-6 text-[9px] font-mono text-cyan-700/40">
          ID: {userId.slice(-8).toUpperCase()}
        </div>
        {/* Banner upload button — own profile only */}
        {isOwnProfile && (
          <button
            onClick={() => setShowBannerUpload(true)}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-medium transition-all opacity-0 group-hover/banner:opacity-100 z-10"
            style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(0,255,255,0.2)', color: 'rgba(0,255,255,0.8)', backdropFilter: 'blur(8px)' }}
          >
            <Camera size={12} /> {profile.banner_url ? 'CHANGE BANNER' : 'ADD BANNER'}
          </button>
        )}
        {/* Hidden file input for banner */}
        <input ref={bannerFileRef} type="file" accept="image/*,video/mp4,video/webm" onChange={handleBannerFileChange} className="hidden" />
      </div>

      {/* ═══ PROFILE CONTENT ═══ */}
      <div className="relative z-10 -mt-28 px-4 md:px-8 pb-32">
        {/* ─── TOP SECTION: Avatar + Info Card ─── */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* ── LEFT COLUMN: Blade Runner ID Card ── */}
          <div className="w-full lg:w-[340px] flex-shrink-0 space-y-4">
            {/* ═══ ID CARD ═══ */}
            <div className="relative bg-[#0b1120]/95 border border-cyan-500/15 rounded-xl overflow-hidden backdrop-blur-md shadow-[0_0_40px_rgba(0,255,255,0.04)]">
              {/* Scan line overlay on entire card */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-20"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.3) 2px, rgba(0,255,255,0.3) 3px)' }} />
              
              {/* ── CARD HEADER ── */}
              <div className="relative px-4 py-2.5 border-b border-cyan-500/15 bg-gradient-to-r from-cyan-500/[0.06] to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-cyan-400/90 tracking-wider">🎵 444RADIO</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-cyan-500/50 tracking-wider">SIGNAL</span>
                    <div className="flex items-center gap-[3px]">
                      <div className="w-[3px] h-2 bg-cyan-400/60 rounded-sm" />
                      <div className="w-[3px] h-3 bg-cyan-400/60 rounded-sm" />
                      <div className="w-[3px] h-4 bg-cyan-400/70 rounded-sm" />
                      <div className="w-[3px] h-3.5 bg-cyan-400/40 rounded-sm" />
                      <div className="w-[3px] h-2.5 bg-cyan-500/20 rounded-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── DESIGNATION ROW ── */}
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[9px] font-mono text-cyan-500/50 tracking-[0.15em] mb-0.5">ARTIST</p>
                    <h1 className="text-2xl font-bold font-mono text-white tracking-wide uppercase truncate">
                      {profile.fullName}
                    </h1>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-mono text-cyan-500/40 tracking-wider">ACCESS</p>
                    <p className="text-[10px] font-mono text-cyan-500/30">{'★'.repeat(Math.min(5, Math.max(1, Math.ceil(tracks.length / 5))))}</p>
                  </div>
                </div>
              </div>

              {/* ── PHOTO + STATS PANEL ── */}
              <div className="px-4 py-3">
                <div className="flex gap-4">
                  {/* Photo */}
                  <div className="relative group flex-shrink-0">
                    <div className="w-[110px] h-[130px] rounded-lg overflow-hidden border border-cyan-500/20"
                      style={{ boxShadow: '0 0 20px rgba(0,255,255,0.06), inset 0 0 30px rgba(0,0,0,0.3)' }}>
                      <Image
                        src={profile.avatar_url}
                        alt={profile.username}
                        width={110}
                        height={130}
                        className="w-full h-full object-cover"
                        style={{ filter: 'saturate(0.7) contrast(1.1)' }}
                      />
                      {/* Blue tint overlay like the card */}
                      <div className="absolute inset-0 bg-cyan-500/[0.08] mix-blend-overlay" />
                    </div>
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0b1120] rounded-full flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                    </div>
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowAvatarUpload(true)}
                        className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit2 size={14} className="text-cyan-400" />
                      </button>
                    )}
                  </div>

                  {/* Right side info panel */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    {/* Classification */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-400/80 tracking-wider">TRACKS</span>
                        <span className="text-xs font-bold font-mono text-white">{tracks.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-400/80 tracking-wider">SEC CODE</span>
                        <span className="text-[10px] font-mono text-cyan-300/60">{userId.slice(-10).toUpperCase()}</span>
                      </div>
                    </div>

                    {/* Separator */}
                    <div className="h-[1px] bg-cyan-500/10 my-1.5" />

                    {/* Stats grid */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-500 tracking-wider">FOLLOWERS</span>
                        <span className="text-xs font-bold font-mono text-cyan-400">{fmtNum(profile.follower_count)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-500 tracking-wider">FOLLOWING</span>
                        <span className="text-xs font-bold font-mono text-cyan-400">{fmtNum(profile.following_count)}</span>
                      </div>
                    </div>

                    {/* Location / handle */}
                    <div className="mt-auto pt-1">
                      <p className="text-[10px] font-mono text-cyan-500/60">@{profile.username}</p>
                      {profile.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={8} className="text-gray-600" />
                          <span className="text-[9px] font-mono text-gray-600">{profile.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── DIVIDER ── */}
              <div className="mx-4 h-[1px] bg-gradient-to-r from-cyan-500/30 via-cyan-500/15 to-transparent" />

              {/* ── STATS STRIP ── */}
              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'PLAYS', value: fmtNum(totalPlays), icon: BarChart3 },
                  { label: 'LIKES', value: fmtNum(totalLikes), icon: Heart },
                  { label: 'RELEASES', value: tracks.length.toString(), icon: Disc3 },
                ].map((stat) => (
                  <div key={stat.label} className="text-center py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <stat.icon size={11} className="text-cyan-500/40 mx-auto mb-1" />
                    <p className="text-sm font-bold font-mono text-white">{stat.value}</p>
                    <p className="text-[8px] font-mono text-gray-600 tracking-wider mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* ── BIO / AUTHORIZATION BLOCK ── */}
              <div className="mx-4 h-[1px] bg-gradient-to-r from-cyan-500/30 via-cyan-500/15 to-transparent" />
              <div className="px-4 py-3">
                <p className="text-[11px] font-mono text-gray-400 leading-[1.6] uppercase tracking-wide" style={{ fontVariantLigatures: 'none' }}>
                  {profile.bio || 'NO BIO CONFIGURED. USER HAS NOT PROVIDED ADDITIONAL INFORMATION.'}
                </p>
              </div>

              {/* ── JOINED DATE ── */}
              <div className="px-4 pb-2">
                <div className="flex items-center gap-1.5">
                  <Calendar size={9} className="text-gray-700" />
                  <span className="text-[8px] font-mono text-gray-700 tracking-wider">
                    REGISTERED {new Date(profile.joined_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* ── CARD FOOTER ── */}
              <div className="relative px-4 py-2.5 border-t border-cyan-500/15 bg-gradient-to-r from-cyan-500/[0.04] to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-[2px]">
                      {/* Barcode-style lines */}
                      {Array.from({ length: 16 }, (_, i) => (
                        <div key={i} className="h-3 rounded-sm bg-cyan-500/20" style={{ width: i % 3 === 0 ? '2px' : '1px' }} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-cyan-600/40 tracking-[0.15em]">
                    PROPERTY OF 444RADIO<br />
                    ARTIST / CREATOR UNIT
                  </span>
                </div>
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div className="px-4 pb-4 pt-2">
                {isOwnProfile ? (
                  <button
                    onClick={() => {
                      setEditFullName(profile?.username || '')
                      setEditBio(profile?.bio || '')
                      setShowEditProfile(true)
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500/[0.06] border border-cyan-500/15 hover:border-cyan-500/35 rounded-lg transition-all text-xs font-mono text-cyan-500/70 hover:text-cyan-400"
                  >
                    <Settings size={12} /> EDIT PROFILE
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleFollowToggle}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-bold transition-all ${
                        isFollowing
                          ? 'bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20'
                          : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(0,255,255,0.15)]'
                      }`}
                    >
                      <Users size={12} />
                      {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                    <button
                      onClick={() => router.push(`/station?dj=${profile.username || user?.username}`)}
                      className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/25 rounded-lg transition-all"
                      title="Go to Station"
                    >
                      <Radio size={12} className="text-gray-500 hover:text-purple-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Social Links */}
            {(profile.website || Object.keys(profile.social_links).length > 0) && (
              <div className="bg-[#0b1120]/95 border border-cyan-500/15 rounded-xl overflow-hidden backdrop-blur-md">
                <div className="h-[1px] bg-gradient-to-r from-cyan-500/50 via-cyan-400/20 to-transparent" />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                    <span className="text-[9px] font-mono font-bold text-cyan-500/70 tracking-[0.2em]">LINKS</span>
                  </div>
                  <div className="space-y-2">
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] font-mono text-gray-500 hover:text-cyan-400 transition-colors">
                        <ExternalLink size={11} /> {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {profile.social_links.twitter && (
                      <a href={profile.social_links.twitter} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] font-mono text-gray-500 hover:text-cyan-400 transition-colors">
                        <ExternalLink size={11} /> Twitter
                      </a>
                    )}
                    {profile.social_links.instagram && (
                      <a href={profile.social_links.instagram} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] font-mono text-gray-500 hover:text-cyan-400 transition-colors">
                        <ExternalLink size={11} /> Instagram
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN: Content ── */}
          <div className="flex-1 min-w-0">
            {/* Content Header Bar */}
            <div className="bg-[#0a0f1a]/90 border border-cyan-500/10 rounded-xl overflow-hidden backdrop-blur-sm mb-4">
              <div className="h-[1px] bg-gradient-to-r from-cyan-500/50 via-cyan-400/20 to-transparent" />
              <div className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                  <span className="text-[9px] font-mono font-bold text-cyan-500/70 tracking-[0.2em]">RELEASES</span>
                  <span className="ml-1 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/15 rounded text-[9px] font-mono font-bold text-cyan-500">{tracks.length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-700 hover:text-gray-400'}`}
                  >
                    <Grid size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-700 hover:text-gray-400'}`}
                  >
                    <ListIcon size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Track Grid / List */}
            {tracks.length === 0 ? (
              <div className="bg-[#0a0f1a]/90 border border-cyan-500/10 rounded-xl p-16 text-center backdrop-blur-sm">
                <div className="w-16 h-16 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mx-auto mb-4">
                  <Disc3 size={24} className="text-gray-800" />
                </div>
                <p className="text-xs font-mono text-gray-700">NO RELEASES YET</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {tracks.map((track) => {
                  const isCurrent = currentTrack?.id === track.id
                  return (
                    <div
                      key={track.id}
                      className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all ${
                        isCurrent
                          ? 'ring-1 ring-cyan-500/40 shadow-[0_0_20px_rgba(0,255,255,0.08)]'
                          : 'ring-1 ring-white/[0.04] hover:ring-white/[0.08]'
                      }`}
                      onClick={() => handlePlayTrack(track)}
                    >
                      {/* Cover Art / Visualizer Video */}
                      <div className="relative aspect-square bg-[#0a0f1a]">
                        {track.video_url ? (
                          <video
                            src={track.video_url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : track.image_url ? (
                          <Image
                            src={track.image_url}
                            alt={track.title}
                            fill
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                            <Music size={24} className="text-gray-700" />
                          </div>
                        )}
                        {/* Scan line effect on cover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 3px, rgba(0,0,0,0.15) 4px)' }} />
                        {/* Darken overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all" />
                        {/* Hover controls */}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLikeTrack(track.id)
                            }}
                            className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all"
                          >
                            <Heart size={14} className={likedTracks.has(track.id) ? 'text-red-400 fill-red-400' : 'text-gray-400'} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (currentTrack?.id === track.id) togglePlayPause()
                              else handlePlayTrack(track)
                            }}
                            className="w-11 h-11 rounded-xl bg-cyan-500/90 hover:bg-cyan-400 flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,255,255,0.3)]"
                          >
                            {isCurrent && isPlaying ? (
                              <Pause size={16} className="text-black" />
                            ) : (
                              <Play size={16} className="text-black ml-0.5" />
                            )}
                          </button>
                          {isOwnProfile && (
                            <button
                              onClick={(e) => handleDeleteTrack(track.id, e)}
                              className="w-8 h-8 rounded-lg bg-black/60 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} className="text-red-400/70" />
                            </button>
                          )}
                        </div>
                        {/* Now playing indicator */}
                        {isCurrent && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/70 border border-cyan-500/30 rounded">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-[8px] font-mono font-bold text-cyan-400">PLAYING</span>
                          </div>
                        )}
                      </div>
                      {/* Track info */}
                      <div className="p-2.5 bg-[#0a0f1a]/95">
                        <h3 className="text-[11px] font-bold text-white truncate">{track.title}</h3>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] font-mono text-gray-600">{fmtNum(track.plays)} plays</span>
                          <div className="flex items-center gap-1">
                            <Heart size={8} className={likedTracks.has(track.id) ? 'text-red-400 fill-red-400' : 'text-gray-700'} />
                            <span className="text-[9px] font-mono text-gray-600">{track.likes}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ─── LIST VIEW ─── */
              <div className="bg-[#0a0f1a]/90 border border-cyan-500/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="h-[1px] bg-gradient-to-r from-cyan-500/50 via-cyan-400/20 to-transparent" />
                {/* Table header */}
                <div className="grid grid-cols-[32px_48px_1fr_80px_60px_80px] md:grid-cols-[32px_48px_1fr_100px_80px_80px_100px] gap-3 px-4 py-2 border-b border-white/[0.04]">
                  <span className="text-[9px] font-mono text-gray-700">#</span>
                  <span></span>
                  <span className="text-[9px] font-mono text-gray-700 tracking-widest">TITLE</span>
                  <span className="text-[9px] font-mono text-gray-700 tracking-widest hidden md:block">GENRE</span>
                  <span className="text-[9px] font-mono text-gray-700 tracking-widest">PLAYS</span>
                  <span className="text-[9px] font-mono text-gray-700 tracking-widest">LIKES</span>
                  <span className="text-[9px] font-mono text-gray-700 tracking-widest text-right hidden md:block">TIME</span>
                </div>
                {tracks.map((track, index) => {
                  const isCurrent = currentTrack?.id === track.id
                  return (
                    <div
                      key={track.id}
                      className={`grid grid-cols-[32px_48px_1fr_80px_60px_80px] md:grid-cols-[32px_48px_1fr_100px_80px_80px_100px] gap-3 items-center px-4 py-2.5 cursor-pointer transition-all group ${
                        isCurrent
                          ? 'bg-cyan-500/[0.04] border-l-2 border-l-cyan-500'
                          : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                      } ${index > 0 ? 'border-t border-white/[0.03]' : ''}`}
                      onClick={() => handlePlayTrack(track)}
                    >
                      {/* Number / Play button */}
                      <div className="flex items-center">
                        <span className={`text-xs font-mono group-hover:hidden ${isCurrent ? 'text-cyan-400' : 'text-gray-700'}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <button
                          className="hidden group-hover:flex w-6 h-6 items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isCurrent) togglePlayPause()
                            else handlePlayTrack(track)
                          }}
                        >
                          {isCurrent && isPlaying ? (
                            <Pause size={12} className="text-cyan-400" />
                          ) : (
                            <Play size={12} className="text-cyan-400 ml-0.5" />
                          )}
                        </button>
                      </div>

                      {/* Cover */}
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/[0.05]">
                        {track.video_url ? (
                          <video src={track.video_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                        ) : track.image_url ? (
                          <Image src={track.image_url} alt={track.title} fill className="object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                            <Music size={8} className="text-gray-700" />
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div className="min-w-0">
                        <h3 className={`text-xs font-bold truncate ${isCurrent ? 'text-cyan-300' : 'text-white'}`}>{track.title}</h3>
                      </div>

                      {/* Genre */}
                      <span className="text-[10px] font-mono text-gray-600 truncate hidden md:block">{track.genre}</span>

                      {/* Plays */}
                      <span className="text-[10px] font-mono text-gray-500">{fmtNum(track.plays)}</span>

                      {/* Likes + action */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleLikeTrack(track.id) }}
                          className="hover:scale-110 transition-transform"
                        >
                          <Heart size={10} className={likedTracks.has(track.id) ? 'text-red-400 fill-red-400' : 'text-gray-700'} />
                        </button>
                        <span className="text-[10px] font-mono text-gray-500">{track.likes}</span>
                      </div>

                      {/* Duration + delete */}
                      <div className="flex items-center justify-end gap-2 hidden md:flex">
                        <span className="text-[10px] font-mono text-gray-600">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </span>
                        {isOwnProfile && (
                          <button
                            onClick={(e) => handleDeleteTrack(track.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                            title="Delete"
                          >
                            <Trash2 size={11} className="text-red-400/50 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Avatar Upload Modal */}
      <ProfileUploadModal
        isOpen={showAvatarUpload}
        onClose={() => setShowAvatarUpload(false)}
        onUploadComplete={handleAvatarSuccess}
      />

      {/* Edit Profile Modal — Cyber styled */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowEditProfile(false)}>
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative w-full max-w-md">
            {/* Neon edge */}
            <div className="absolute -inset-[1px] bg-gradient-to-b from-cyan-500/40 via-cyan-500/10 to-transparent rounded-2xl blur-[1px]" />
            <div className="relative bg-[#080c14] border border-cyan-500/20 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                    <span className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-[0.2em]">EDIT PROFILE</span>
                  </div>
                  <button onClick={() => setShowEditProfile(false)}
                    className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                    <Edit2 size={14} className="text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="px-5 pb-5 space-y-4">
                <div>
                  <label className="text-[9px] font-mono font-bold text-cyan-500/60 tracking-[0.2em] mb-1.5 block">USERNAME</label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-black/60 border border-white/[0.07] rounded-xl text-sm text-white font-light focus:outline-none focus:border-cyan-500/30 transition-colors"
                    placeholder="Username"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold text-cyan-500/60 tracking-[0.2em] mb-1.5 block">BIO</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-black/60 border border-white/[0.07] rounded-xl text-sm text-white font-light resize-none focus:outline-none focus:border-cyan-500/30 transition-colors"
                    placeholder="Tell the world about yourself..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex gap-2">
                <button
                  onClick={() => setShowEditProfile(false)}
                  disabled={isUpdatingProfile}
                  className="flex-1 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs font-mono text-gray-500 hover:text-gray-300 transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleEditProfileSubmit}
                  disabled={isUpdatingProfile}
                  className="flex-1 py-2.5 bg-cyan-500/90 hover:bg-cyan-400 text-black rounded-xl text-xs font-mono font-bold shadow-[0_0_15px_rgba(0,255,255,0.15)] transition-all disabled:opacity-40"
                >
                  {isUpdatingProfile ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
              <div className="h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
            </div>
          </div>
        </div>
      )}

      {/* Banner Upload Modal */}
      {showBannerUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowBannerUpload(false)}>
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
          <div className="relative w-full max-w-sm">
            <div className="absolute -inset-[1px] bg-gradient-to-b from-cyan-500/40 via-cyan-500/10 to-transparent rounded-2xl blur-[1px]" />
            <div className="relative bg-[#080c14] border border-cyan-500/20 rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-cyan-500 rounded-full" />
                  <span className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-[0.2em]">BANNER</span>
                </div>
                <button onClick={() => setShowBannerUpload(false)} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
                  <XIcon size={14} className="text-gray-600" />
                </button>
              </div>

              <div className="px-5 pb-5 space-y-3">
                {/* Upload file */}
                <button
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={bannerUploading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                  style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.12)' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,255,255,0.08)' }}>
                    <Upload size={14} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-white/70">Upload Image or Video</p>
                    <p className="text-[9px] font-mono text-gray-600 mt-0.5">JPG, PNG, MP4, WebM — max 50 MB</p>
                  </div>
                </button>

                {/* Use latest cover art */}
                <button
                  onClick={handleUseLatestCover}
                  disabled={bannerUploading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                  style={{ background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                    <Music size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-white/70">Use Latest Cover Art</p>
                    <p className="text-[9px] font-mono text-gray-600 mt-0.5">Auto-pick from your recent releases</p>
                  </div>
                </button>

                {/* Remove banner */}
                {profile?.banner_url && (
                  <button
                    onClick={async () => {
                      setBannerUploading(true)
                      try {
                        const res = await fetch('/api/profile/banner', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ coverUrl: '' })
                        })
                        const data = await res.json()
                        if (data.success) {
                          setProfile(prev => prev ? { ...prev, banner_url: '' } : null)
                          setShowBannerUpload(false)
                        }
                      } catch {} finally { setBannerUploading(false) }
                    }}
                    disabled={bannerUploading}
                    className="w-full py-2.5 text-center text-[10px] font-mono text-red-400/50 hover:text-red-400/80 transition-colors"
                  >
                    REMOVE BANNER
                  </button>
                )}

                {bannerUploading && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-mono text-cyan-500/60">Uploading...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
