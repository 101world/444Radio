'use client'

import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'
import FloatingMenu from '../../components/FloatingMenu'
import FloatingNavButton from '../../components/FloatingNavButton'
import { useAudioPlayer } from '../../contexts/AudioPlayerContext'
import { Edit2, Grid, List as ListIcon, Upload, Music, Video, Image as ImageIcon, Users, Radio as RadioIcon, UserPlus, Play, Pause, ChevronLeft, ChevronRight, Send, Circle, ArrowLeft, Heart, MessageCircle, Share2, MoreVertical, Trash2, Plus, User } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import LikeButton from '../../components/LikeButton'

// Lazy load heavy components
const HolographicBackground = lazy(() => import('../../components/HolographicBackgroundClient'))
const StarryBackground = lazy(() => import('../../components/StarryBackground'))
const CombineMediaModal = lazy(() => import('../../components/CombineMediaModal'))
const ProfileUploadModal = lazy(() => import('../../components/ProfileUploadModal'))
const PrivateListModal = lazy(() => import('../../components/PrivateListModal'))
const CreatePostModal = lazy(() => import('../../components/CreatePostModal'))
const BannerUploadModal = lazy(() => import('../../components/BannerUploadModal'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const THUMBNAIL_SHAPES = [
  'rounded-2xl', // square
  'rounded-full', // circle
  'rounded-tl-[3rem] rounded-br-[3rem]', // diagonal corners
  'rounded-tr-[3rem] rounded-bl-[3rem]', // opposite diagonal
  'rounded-t-[3rem]', // rounded top
  'rounded-b-[3rem]', // rounded bottom
]

const getRandomShape = (index: number) => {
  return THUMBNAIL_SHAPES[index % THUMBNAIL_SHAPES.length]
}

interface Song {
  id: string
  title: string
  coverUrl: string
  audioUrl: string
  likes: number
  plays: number
  genre: string
  createdAt: string
}

interface CombinedMedia {
  id: string
  title: string
  audio_url?: string
  image_url?: string
  video_url?: string
  audio_prompt?: string
  image_prompt?: string
  user_id: string
  likes: number
  plays?: number
  views?: number
  is_public: boolean
  created_at: string
  media_type: 'music-image' | 'image' | 'video'
  content_type?: string
  duration?: number
}

interface Upload {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnail_url?: string
  title?: string
  created_at: string
  file_size?: number
}

interface Post {
  id: string
  user_id: string
  content: string
  media_type: 'photo' | 'video' | 'ai-art' | null
  media_url: string | null
  thumbnail_url: string | null
  attached_song_id: string | null
  likes_count: number
  comments_count: number
  shares_count: number
  created_at: string
  users?: { username: string; avatar_url: string }
  media?: { id: string; title: string; audio_url: string; image_url: string }
  isLiked?: boolean
}

interface Comment {
  id: string
  post_id: string
  user_id: string
  comment: string
  created_at: string
  users?: { username: string; avatar_url: string }
}

interface ProfileData {
  username: string
  email: string
  bio?: string
  tagline?: string
  avatar?: string
  banner_url?: string | null
  banner_type?: 'image' | 'video' | null
  totalLikes: number
  totalPlays: number
  songCount: number
  followerCount: number
  followingCount: number
  songs: Song[]
  combinedMedia: CombinedMedia[]
  uploads?: Upload[]
}

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter()
  const resolvedParams = use(params)
  const { user: currentUser } = useUser()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showBannerModal, setShowBannerModal] = useState(false)
  const [showStationsModal, setShowStationsModal] = useState(false)
  const [showViewSwitcher, setShowViewSwitcher] = useState(false)
  const [activeTab, setActiveTab] = useState<'feed' | 'stations'>('feed')
  const [isFollowing, setIsFollowing] = useState(false)
  
  // Use global audio player context
  const { currentTrack, isPlaying, playTrack, togglePlayPause, setPlaylist, pause, addToQueue } = useAudioPlayer()
  const playingId = currentTrack?.id || null
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [activeSection, setActiveSection] = useState<'tracks' | 'uploads'>('tracks')
  const [activeSubTab, setActiveSubTab] = useState<'tracks' | 'station'>('tracks')
  const [contentTab, setContentTab] = useState<'tracks' | 'posts'>('tracks')
  const [isLive, setIsLive] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{id: string, username: string, message: string, timestamp: Date, type: 'chat' | 'track'}>>([])
  const [chatInput, setChatInput] = useState('')
  const [liveListeners, setLiveListeners] = useState(0)
  const [stationId, setStationId] = useState<string | null>(null)
  const [stationTitle, setStationTitle] = useState<string>('')
  const [userHasManuallySelectedTrack, setUserHasManuallySelectedTrack] = useState(false)
  const [editingStationTitle, setEditingStationTitle] = useState(false)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [editingTrackTitle, setEditingTrackTitle] = useState<string>('')
  const [showVideo, setShowVideo] = useState(false)
  const [broadcasterVideoUrl, setBroadcasterVideoUrl] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const broadcasterVideoRef = useRef<HTMLVideoElement>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [showCreatePostModal, setShowCreatePostModal] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({})
  const [comments, setComments] = useState<{[key: string]: Comment[]}>({})
  const [commentInput, setCommentInput] = useState<{[key: string]: string}>({})
  const [isMobile, setIsMobile] = useState(false)
  const [queueToast, setQueueToast] = useState<string | null>(null)

  // Detect mobile device
  useEffect(() => {
    setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
  }, [])

  // ESC key handler for desktop navigation to explore
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/explore')
      }
    }
    
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  // Auto-hide queue toast
  useEffect(() => {
    if (queueToast) {
      const timer = setTimeout(() => setQueueToast(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [queueToast])

  useEffect(() => {
    if (currentUser) {
      setIsOwnProfile(currentUser.id === resolvedParams.userId)
    }
    fetchProfileData()
    fetchStationStatus()
  }, [currentUser, resolvedParams.userId])
  
  // Refresh profile data when page regains focus (catches username changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchProfileData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', fetchProfileData)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', fetchProfileData)
    }
  }, [resolvedParams.userId])

  // Fetch station status
  const fetchStationStatus = async () => {
    try {
      const res = await fetch(`/api/station?userId=${resolvedParams.userId}`)
      const data = await res.json()
      if (data.success && data.station) {
        setStationId(data.station.id)
        setIsLive(data.station.is_live)
        setLiveListeners(data.station.listener_count || 0)
        if (data.station.is_live) {
          loadMessages(data.station.id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch station status:', error)
    }
  }

  // Load chat messages
  const loadMessages = async (stId: string) => {
    try {
      const res = await fetch(`/api/station/messages?stationId=${stId}`)
      const data = await res.json()
      if (data.success && data.messages) {
        setChatMessages(data.messages.map((msg: {
          id: string
          username: string
          message: string
          created_at: string
          message_type: 'chat' | 'track'
        }) => ({
          id: msg.id,
          username: msg.username,
          message: msg.message,
          timestamp: new Date(msg.created_at),
          type: msg.message_type
        })))
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

  // Setup realtime subscriptions
  useEffect(() => {
    if (!stationId) return

    console.log('Setting up realtime subscriptions for station:', stationId)

    // Subscribe to messages with better error handling
    const messagesChannel = supabase
      .channel(`station_messages:${stationId}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'station_messages',
        filter: `station_id=eq.${stationId}`
      }, (payload) => {
        console.log('New message received:', payload)
        const msg = payload.new as {
          id: string
          username: string
          message: string
          created_at: string
          message_type: 'chat' | 'track'
        }
        setChatMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, {
            id: msg.id,
            username: msg.username,
            message: msg.message,
            timestamp: new Date(msg.created_at),
            type: msg.message_type
          }]
        })
      })
      .subscribe((status) => {
        console.log('Messages channel status:', status)
      })

    // Subscribe to station updates (including video state and titles)
    const stationChannel = supabase
      .channel(`live_stations:${stationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stations',
        filter: `id=eq.${stationId}`
      }, (payload) => {
        console.log('Station update received:', payload)
        const station = payload.new as {
          is_live: boolean
          listener_count: number
          title?: string
          video_enabled?: boolean
          current_track_title?: string
        }
        setIsLive(station.is_live)
        setLiveListeners(station.listener_count || 0)
        if (station.title) {
          setStationTitle(station.title)
        }
        if (station.video_enabled !== undefined && !isOwnProfile) {
          setShowVideo(station.video_enabled)
        }
      })
      .subscribe((status) => {
        console.log('Station channel status:', status)
      })

    // Subscribe to listener changes
    const listenersChannel = supabase
      .channel(`station_listeners:${stationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'station_listeners',
        filter: `station_id=eq.${stationId}`
      }, async (payload) => {
        // Refresh listener count
        const res = await fetch(`/api/station?userId=${resolvedParams.userId}`)
        const data = await res.json()
        if (data.success && data.station) {
          setLiveListeners(data.station.listener_count || 0)
        }
        
        // Send join/leave notification
        if (payload.eventType === 'INSERT') {
          const listener = payload.new as { username: string }
          setChatMessages(prev => [...prev, {
            id: `join-${Date.now()}`,
            username: 'System',
            message: `${listener.username} joined the station 🎧`,
            timestamp: new Date(),
            type: 'chat' as const
          }])
        } else if (payload.eventType === 'DELETE') {
          const listener = payload.old as { username: string }
          setChatMessages(prev => [...prev, {
            id: `leave-${Date.now()}`,
            username: 'System',
            message: `${listener.username} left the station 👋`,
            timestamp: new Date(),
            type: 'chat' as const
          }])
        }
      })
      .subscribe((status) => {
        console.log('Listeners channel status:', status)
      })

    // Subscribe to combined_media updates for realtime title changes
    const mediaChannel = supabase
      .channel(`combined_media_updates:${resolvedParams.userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'combined_media',
        filter: `user_id=eq.${resolvedParams.userId}`
      }, (payload) => {
        console.log('Media update received:', payload)
        const updatedMedia = payload.new as any
        setProfile(prev => {
          if (!prev) return prev
          return {
            ...prev,
            combinedMedia: prev.combinedMedia.map(m => 
              m.id === updatedMedia.id ? { ...m, title: updatedMedia.title } : m
            )
          }
        })
      })
      .subscribe((status) => {
        console.log('Media channel status:', status)
      })

    return () => {
      messagesChannel.unsubscribe()
      stationChannel.unsubscribe()
      listenersChannel.unsubscribe()
      mediaChannel.unsubscribe()
    }
  }, [stationId, resolvedParams.userId, isOwnProfile])

  // Join station as listener when viewing
  useEffect(() => {
    if (!stationId || !isLive || !currentUser || isOwnProfile) return

    const joinStation = async () => {
      try {
        // Join as listener
        await fetch('/api/station/listeners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId,
            username: currentUser.username || 'Anonymous'
          })
        })

        // DISABLED: Station auto-play completely removed
        // Causes issues with manual track selection
      } catch (error) {
        console.error('Failed to join station:', error)
      }
    }

    joinStation()

    return () => {
      // Leave station on unmount
      fetch(`/api/station/listeners?stationId=${stationId}`, {
        method: 'DELETE'
      }).catch(console.error)
    }
  }, [stationId, isLive, currentUser, isOwnProfile, resolvedParams.userId, profile, currentTrack, playTrack])

  // Toggle live status - Memoized with useCallback
  const toggleLive = useCallback(async () => {
    try {
      console.log('🔴 Toggling live status...', { 
        currentIsLive: isLive, 
        newStatus: !isLive,
        username: profile?.username,
        currentTrack: currentTrack?.id
      })
      
      const newLiveStatus = !isLive
      const res = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive: newLiveStatus,
          currentTrack: newLiveStatus && currentTrack ? {
            id: currentTrack.id,
            title: currentTrack.title,
            image_url: currentTrack.imageUrl
          } : null,
          username: profile?.username
        })
      })
      
      const data = await res.json()
      console.log('📡 Station API response:', data)
      
      if (data.success) {
        setIsLive(newLiveStatus)
        if (data.station.id) {
          setStationId(data.station.id)
        }
        if (!newLiveStatus) {
          // Clear messages and listener count when going offline
          setChatMessages([])
          setLiveListeners(0)
        }
        console.log('✅ Successfully went', newLiveStatus ? 'LIVE' : 'OFFLINE')
      } else {
        console.error('❌ Failed to toggle live:', data.error)
        alert(`Failed to ${newLiveStatus ? 'go live' : 'stop broadcast'}: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('❌ Failed to toggle live:', error)
      alert('Failed to toggle live status. Please check console for details.')
    }
  }, [isLive, currentTrack, profile?.username])

  // Send chat message - Memoized with useCallback
  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || !stationId) return

    try {
      await fetch('/api/station/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId,
          message: chatInput,
          messageType: 'chat',
          username: currentUser?.username || 'Anonymous'
        })
      })
      setChatInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }, [chatInput, stationId, currentUser?.username])

  // Save station title
  const saveStationTitle = useCallback(async () => {
    if (!stationId || !stationTitle.trim()) return
    
    try {
      const res = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId,
          title: stationTitle,
          username: profile?.username
        })
      })
      const data = await res.json()
      if (data.success) {
        setEditingStationTitle(false)
      }
    } catch (error) {
      console.error('Failed to save station title:', error)
    }
  }, [stationId, stationTitle, profile?.username])

  // Save track title
  const saveTrackTitle = useCallback(async (trackId: string, newTitle: string) => {
    if (!newTitle.trim()) return
    
    try {
      const res = await fetch('/api/media/update-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: trackId,
          title: newTitle
        })
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setProfile(prev => {
          if (!prev) return prev
          return {
            ...prev,
            combinedMedia: prev.combinedMedia.map(m => 
              m.id === trackId ? { ...m, title: newTitle } : m
            )
          }
        })
        setEditingTrackId(null)
        setEditingTrackTitle('')
      }
    } catch (error) {
      console.error('Failed to save track title:', error)
    }
  }, [])

  // Start/Stop video stream
  const toggleVideo = useCallback(async () => {
    if (stream) {
      // Stop existing stream
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
      setShowVideo(false)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    } else {
      // Start new stream
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false // Audio is handled separately by the station
        })
        setStream(mediaStream)
        setShowVideo(true)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (error) {
        console.error('Failed to start video:', error)
        alert('Camera access denied or not available')
      }
    }
  }, [stream])

  // Cleanup video on unmount or when going offline
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  useEffect(() => {
    if (!isLive && stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
      setShowVideo(false)
    }
  }, [isLive, stream])

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/media/profile/${resolvedParams.userId}`)
      const data = await res.json()
      if (data.success) {
        setProfile({
          username: data.username,
          email: '',
          bio: data.bio || undefined,
          tagline: data.tagline || "Creating the future of music",
          avatar: data.avatar || undefined,
          banner_url: data.banner_url || null,
          banner_type: data.banner_type || null,
          totalPlays: data.totalPlays,
          songCount: data.trackCount,
          totalLikes: data.totalLikes || 0,
          followerCount: data.followerCount || 0,
          followingCount: data.followingCount || 0,
          songs: [],
          combinedMedia: data.combinedMedia,
          uploads: data.uploads || []
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPosts = async () => {
    try {
      const res = await fetch(`/api/posts?userId=${resolvedParams.userId}&limit=50`)
      const data = await res.json()
      if (data.posts) {
        setPosts(data.posts)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    }
  }

  const toggleLike = async (postId: string) => {
    if (!currentUser) return
    
    try {
      const res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId: currentUser.id })
      })
      const data = await res.json()
      
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? {
              ...post,
              likes_count: data.liked ? post.likes_count + 1 : post.likes_count - 1,
              isLiked: data.liked
            }
          : post
      ))
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  const fetchComments = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/comments?postId=${postId}`)
      const data = await res.json()
      if (data.comments) {
        setComments(prev => ({ ...prev, [postId]: data.comments }))
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error)
    }
  }

  const addComment = async (postId: string) => {
    if (!currentUser || !commentInput[postId]?.trim()) return
    
    try {
      const res = await fetch('/api/posts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          userId: currentUser.id,
          comment: commentInput[postId]
        })
      })
      const data = await res.json()
      
      if (data.comment) {
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment]
        }))
        setCommentInput(prev => ({ ...prev, [postId]: '' }))
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, comments_count: post.comments_count + 1 }
            : post
        ))
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  const deletePost = async (postId: string) => {
    if (!currentUser || !confirm('Delete this post?')) return
    
    try {
      const res = await fetch(`/api/posts?postId=${postId}&userId=${currentUser.id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        setPosts(prev => prev.filter(post => post.id !== postId))
      }
    } catch (error) {
      console.error('Failed to delete post:', error)
    }
  }

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }))
    
    if (!showComments[postId] && !comments[postId]) {
      fetchComments(postId)
    }
  }

  useEffect(() => {
    if (contentTab === 'posts') {
      fetchPosts()
    }
  }, [contentTab, resolvedParams.userId])

  const handlePlay = async (media: CombinedMedia) => {
    console.log('[handlePlay] Called with media:', {
      id: media.id,
      title: media.title,
      audioUrl: media.audio_url,
      imageUrl: media.image_url,
      currentlyPlaying: playingId === media.id
    })
    
    if (!media.audio_url) {
      console.log('[handlePlay] No audio URL, skipping')
      return
    }
    
    // If clicking the same track that's already playing, toggle play/pause
    if (playingId === media.id && isPlaying) {
      console.log('[handlePlay] Pausing current track')
      togglePlayPause()
      return
    }
    
    // If clicking the same track that's paused, resume it
    if (playingId === media.id && !isPlaying) {
      console.log('[handlePlay] Resuming current track')
      togglePlayPause()
      return
    }
    
    // Mark that user has manually selected a track (prevents station auto-play override)
    setUserHasManuallySelectedTrack(true)
    
    // Play new track - set playlist with all profile tracks
    console.log('[handlePlay] Playing new track with playlist')
    const allTracks = profile?.combinedMedia.filter(m => m.audio_url).map(m => ({
      id: m.id,
      audioUrl: m.audio_url!,
      title: m.title,
      artist: profile?.username,
      imageUrl: m.image_url
    })) || []
    
    setPlaylist(allTracks)
    playTrack({
      id: media.id,
      audioUrl: media.audio_url,
      title: media.title,
      artist: profile?.username,
      imageUrl: media.image_url
    })
    
    // If station is live, send track notification to database
      if (isLive && profile && stationId) {
        try {
          await fetch('/api/station/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stationId,
              message: media.title,
              messageType: 'track',
              username: profile.username
            })
          })
          
          // Update station with current track
          await fetch('/api/station', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isLive: true,
              currentTrack: media,
              username: profile.username
            })
          })
        } catch (error) {
          console.error('Failed to send track notification:', error)
        }
      }
  }

  // Memoized computed values for performance
  const audioTracks = useMemo(() => {
    return profile?.combinedMedia.filter(m => m.audio_url) || []
  }, [profile?.combinedMedia])

  const trackCount = useMemo(() => audioTracks.length, [audioTracks])

  // Debounced chat typing indicator (optional)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Optimize chat messages with pagination (show last 50)
  const displayedMessages = useMemo(() => {
    return chatMessages.slice(-50)
  }, [chatMessages])

  // Debounced scroll to bottom for chat
  const chatContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (chatContainerRef.current && displayedMessages.length > 0) {
      const scrollTimeout = setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        })
      }, 100)
      return () => clearTimeout(scrollTimeout)
    }
  }, [displayedMessages.length])

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Holographic 3D Background - Lazy Loaded */}
      <Suspense fallback={null}>
        {!isMobile && <HolographicBackground />}
      </Suspense>
      
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Back Button - Mobile (Top Left) */}
      <button
        onClick={() => router.push('/explore')}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg"
        title="Back to Explore"
      >
        <ArrowLeft size={20} />
      </button>

      {/* ESC Button - Desktop (Top Left) */}
      <button
        onClick={() => router.push('/explore')}
        className="hidden md:flex fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 items-center gap-2 text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg text-sm font-medium"
        title="Press ESC to go back"
      >
        <ArrowLeft size={16} />
        <span>ESC</span>
      </button>

      {/* View Switcher Icon Buttons - Top Right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {/* Feed Icon Button */}
        <button
          onClick={() => {
            setActiveTab('feed')
            setShowViewSwitcher(false)
          }}
          className={`w-10 h-10 md:w-12 md:h-12 rounded-full backdrop-blur-md border transition-all shadow-lg flex items-center justify-center ${
            activeTab === 'feed'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 scale-110'
              : 'bg-black/60 border-white/20 hover:bg-black/80 hover:border-cyan-400'
          }`}
          title="Feed View"
        >
          <Music size={18} className={activeTab === 'feed' ? 'text-white' : 'text-gray-400'} />
        </button>

        {/* Station Icon Button */}
        <button
          onClick={() => {
            setActiveTab('stations')
            if (!stationId) {
              fetchStationStatus()
            }
            setShowViewSwitcher(false)
          }}
          className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full backdrop-blur-md border transition-all shadow-lg flex items-center justify-center ${
            activeTab === 'stations'
              ? 'bg-gradient-to-r from-red-600 to-pink-600 border-red-400 scale-110'
              : 'bg-black/60 border-white/20 hover:bg-black/80 hover:border-red-400'
          }`}
          title="Station View"
        >
          <RadioIcon size={18} className={activeTab === 'stations' ? 'text-white' : 'text-gray-400'} />
          {isLive && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-black"></div>
          )}
        </button>
      </div>

      {/* Feed/Stations Content - Full bleed with new layout */}
      <main className="relative z-10 overflow-y-auto pb-32 pt-0">
          
          {activeTab === 'feed' ? (
            <>
              {loading ? (
                <div className="space-y-0">
                  {/* Banner skeleton */}
                  <div className="h-64 bg-white/5 animate-pulse"></div>
                  {/* Horizontal scroll skeleton */}
                  <div className="px-6 py-6">
                    <div className="h-6 w-32 bg-white/5 rounded mb-4 animate-pulse"></div>
                    <div className="flex gap-2 overflow-x-auto">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="w-32 h-32 bg-white/5 rounded-lg flex-shrink-0 animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                  {/* Grid skeleton */}
                  <div className="px-6 py-6">
                    <div className="h-6 w-32 bg-white/5 rounded mb-4 animate-pulse"></div>
                    <div className="grid grid-cols-4 gap-4">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="bg-white/5 rounded-lg h-48 animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : profile?.combinedMedia && profile.combinedMedia.length > 0 ? (
                <div className="space-y-0">
                  {/* Mobile Layout - Original Design */}
                  <div className="md:hidden space-y-0">
                  {/* SECTION 1: TOP BANNER - Banner or Cover Art Carousel */}
                  <div className="relative h-64 overflow-hidden group">
                    {profile.banner_url ? (
                      <div className="absolute inset-0">
                        {profile.banner_type === 'video' ? (
                          <video src={profile.banner_url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                        ) : (
                          <Image src={profile.banner_url} alt="Profile banner" fill className="object-cover" unoptimized />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                      </div>
                    ) : profile && profile.combinedMedia && profile.combinedMedia.length > 0 ? (
                      <>
                        {/* Carousel Images */}
                        <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                          <div className="flex h-full">
                            {profile.combinedMedia.slice(0, 10).map((media) => (
                              <div key={media.id} className="relative w-full h-full flex-shrink-0">
                                <div className="absolute inset-0">
                                  <Image
                                    src={media.image_url || '/radio-logo.svg'}
                                    alt={media.title || 'Cover art'}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Carousel Navigation - Left */}
                        {carouselIndex > 0 && (
                          <button
                            onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 border border-white/10 z-10"
                          >
                            <ChevronLeft size={20} className="text-white" />
                          </button>
                        )}
                        {/* Carousel Navigation - Right */}
                        {carouselIndex < Math.min(profile.combinedMedia.length, 10) - 1 && (
                          <button
                            onClick={() => setCarouselIndex(prev => Math.min(Math.min(profile.combinedMedia.length, 10) - 1, prev + 1))}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 border border-white/10 z-10"
                          >
                            <ChevronRight size={20} className="text-white" />
                          </button>
                        )}
                        {/* Carousel Indicators */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                          {profile.combinedMedia.slice(0, 10).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCarouselIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all ${
                                index === carouselIndex 
                                  ? 'bg-cyan-400 w-8' 
                                  : 'bg-white/30 hover:bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-black"></div>
                    )}
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowBannerModal(true)}
                        className="absolute right-4 bottom-4 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-xl border border-white/10 text-sm text-white hover:bg-black/60"
                      >
                        Edit banner
                      </button>
                    )}
                  </div>

                  {/* SECTION 3: LIST VIEW - All Content with Tabs */}
                  <div className="px-6 py-4 relative z-10 bg-black">
                    {/* Tab Buttons */}
                    <div className="flex items-center gap-4 mb-4 relative z-10 pointer-events-auto">
                      <button
                        onClick={() => setContentTab('tracks')}
                        className={`text-xl font-bold transition-all relative pb-2 ${
                          contentTab === 'tracks'
                            ? 'text-cyan-400'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        📀 All Tracks
                        {contentTab === 'tracks' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                        )}
                      </button>
                      <button
                        onClick={() => setContentTab('posts')}
                        className={`text-xl font-bold transition-all relative pb-2 ${
                          contentTab === 'posts'
                            ? 'text-cyan-400'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        📝 All Posts
                        {contentTab === 'posts' && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
                        )}
                      </button>
                    </div>
                    
                    {/* All Tracks Tab Content */}
                    {contentTab === 'tracks' && profile && profile.combinedMedia && (
                      <>
                        {console.log('[Profile Tracks]', {
                          totalTracks: profile.combinedMedia.length,
                          firstTrack: profile.combinedMedia[0]?.title,
                          viewingUserId: resolvedParams.userId
                        })}
                        {/* Desktop: 4 Column List View */}
                        <div className="hidden md:block">
                          <div className="grid grid-cols-4 gap-x-6 gap-y-1">
                            {profile.combinedMedia.map((media) => {
                              const isCurrentlyPlaying = playingId === media.id
                              const hasAudio = !!media.audio_url
                              
                              return (
                                <div 
                                  key={`desktop-${media.id}`} 
                                  className={`group flex items-center gap-3 p-2 rounded-lg transition-all ${
                                    hasAudio ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                  } ${
                                    isCurrentlyPlaying 
                                      ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                                      : hasAudio ? 'hover:bg-white/5' : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('[Desktop Click]', media.title, 'ID:', media.id)
                                    hasAudio && handlePlay(media)
                                  }}
                                >
                                  {/* Thumbnail */}
                                  <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden">
                                    <img 
                                      src={media.image_url} 
                                      alt={media.title}
                                      className="w-full h-full object-cover"
                                    />
                                    {hasAudio && (
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                          {isCurrentlyPlaying && isPlaying ? (
                                            <Pause className="text-black" size={12} />
                                          ) : (
                                            <Play className="text-black ml-0.5" size={12} />
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {isCurrentlyPlaying && isPlaying && (
                                      <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                                    )}
                                  </div>
                                  
                                  {/* Track Info */}
                                  <div className="flex-1 min-w-0 relative z-10">
                                    <h3 className="font-semibold text-white truncate text-sm leading-tight">
                                      {media.title}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-0.5">
                                      <p className="text-xs text-gray-400 truncate leading-tight">
                                        {profile.username}
                                      </p>
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <div className="flex items-center gap-1">
                                          <Play size={10} />
                                          <span>{media.plays || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Heart size={10} />
                                          <span>{media.likes || 0}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Add to Queue Button */}
                                  {hasAudio && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const added = addToQueue({
                                          id: media.id,
                                          audioUrl: media.audio_url!,
                                          title: media.title,
                                          artist: profile.username,
                                          imageUrl: media.image_url,
                                          userId: media.user_id
                                        })
                                        if (added) {
                                          setQueueToast(`Added "${media.title}" to queue`)
                                        } else {
                                          setQueueToast(`"${media.title}" already in queue`)
                                        }
                                      }}
                                      className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 hover:text-cyan-300 transition-all"
                                      title="Add to Queue"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                    {/* Mobile: Single Column List View - All Tracks */}
                    <div className="md:hidden space-y-1">
                      {profile.combinedMedia.map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        const hasAudio = !!media.audio_url
                        
                        return (
                          <div 
                            key={`mobile-${media.id}`} 
                            className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                              hasAudio ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            } ${
                              isCurrentlyPlaying 
                                ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                                : hasAudio ? 'hover:bg-white/5' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              console.log('[Mobile Click]', media.title, 'ID:', media.id)
                              hasAudio && handlePlay(media)
                            }}
                          >
                            {/* Thumbnail */}
                            <div className="relative w-14 h-14 flex-shrink-0 rounded overflow-hidden">
                              <img 
                                src={media.image_url} 
                                alt={media.title}
                                className="w-full h-full object-cover"
                              />
                              {hasAudio && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                                    {isCurrentlyPlaying && isPlaying ? (
                                      <Pause className="text-black" size={14} />
                                    ) : (
                                      <Play className="text-black ml-0.5" size={14} />
                                    )}
                                  </div>
                                </div>
                              )}
                              {isCurrentlyPlaying && isPlaying && (
                                <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse"></div>
                              )}
                            </div>
                            
                            {/* Track Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white truncate leading-tight">
                                {media.title}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-gray-400 truncate leading-tight">
                                  {profile.username}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <div className="flex items-center gap-1">
                                    <Play size={12} />
                                    <span>{media.plays || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Like Button */}
                            <div onClick={(e) => e.stopPropagation()}>
                              <LikeButton
                                releaseId={media.id}
                                initialLikesCount={media.likes || 0}
                                size="sm"
                                showCount={true}
                              />
                            </div>

                            {/* Add to Queue Button */}
                            {hasAudio && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  addToQueue({
                                    id: media.id,
                                    audioUrl: media.audio_url!,
                                    title: media.title,
                                    artist: profile.username,
                                    imageUrl: media.image_url,
                                    userId: media.user_id
                                  })
                                  setQueueToast(`Added "${media.title}" to queue`)
                                }}
                                className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 hover:text-cyan-300 transition-all"
                                title="Add to Queue"
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                      </>
                    )}

                    {/* All Posts Tab Content */}
                    {contentTab === 'posts' && (
                      <div className="space-y-6">
                        {/* Create Post Button (Own Profile Only) */}
                        {isOwnProfile && (
                          <button
                            onClick={() => setShowCreatePostModal(true)}
                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl p-4 font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30"
                          >
                            <ImageIcon size={20} />
                            <span>Create Post</span>
                          </button>
                        )}

                        {/* Posts Feed */}
                        {posts.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-gray-400 text-lg">No posts yet</p>
                            <p className="text-gray-500 text-sm mt-2">
                              {isOwnProfile ? 'Share photos, videos, and music with the world' : 'Check back later'}
                            </p>
                          </div>
                        ) : (
                          posts.map((post) => (
                            <div key={post.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-cyan-400/30 transition-all">
                              {/* Post Header */}
                              <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full overflow-hidden border border-cyan-400/30">
                                    <Image
                                      src={profile?.avatar || '/radio-logo.svg'}
                                      alt={profile?.username || 'avatar'}
                                      width={40}
                                      height={40}
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </div>
                                  <div>
                                    <p className="text-white font-bold text-sm">@{profile?.username}</p>
                                    <p className="text-gray-400 text-xs">
                                      {new Date(post.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                </div>
                                
                                {isOwnProfile && (
                                  <button
                                    onClick={() => deletePost(post.id)}
                                    className="p-2 hover:bg-white/10 rounded-full transition-all"
                                  >
                                    <Trash2 size={16} className="text-gray-400 hover:text-red-400" />
                                  </button>
                                )}
                              </div>

                              {/* Post Content Text */}
                              {post.content && (
                                <div className="px-4 pb-3">
                                  <p className="text-white">{post.content}</p>
                                </div>
                              )}

                              {/* Post Media */}
                              {post.media_url && (
                                <div className="relative bg-black">
                                  {post.media_type === 'video' ? (
                                    <video
                                      src={post.media_url}
                                      controls
                                      className="w-full max-h-[500px] object-contain"
                                    />
                                  ) : (
                                    <img
                                      src={post.media_url}
                                      alt="Post media"
                                      className="w-full max-h-[500px] object-contain"
                                    />
                                  )}
                                </div>
                              )}

                              {/* Attached Song */}
                              {post.media && (
                                <div className="mx-4 my-3 bg-black/40 border border-cyan-400/30 rounded-xl p-3 flex items-center gap-3 hover:bg-black/60 transition-all cursor-pointer"
                                  onClick={() => {
                                    if (post.media) {
                                      handlePlay({
                                        id: post.media.id,
                                        title: post.media.title,
                                        audio_url: post.media.audio_url,
                                        image_url: post.media.image_url,
                                        user_id: post.user_id,
                                        likes: 0,
                                        is_public: true,
                                        created_at: post.created_at,
                                        media_type: 'music-image'
                                      })
                                    }
                                  }}
                                >
                                  <img
                                    src={post.media.image_url}
                                    alt={post.media.title}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                  <div className="flex-1">
                                    <p className="text-white font-semibold text-sm">{post.media.title}</p>
                                    <p className="text-cyan-400 text-xs">🎵 Play track</p>
                                  </div>
                                  <Play size={20} className="text-cyan-400" />
                                </div>
                              )}

                              {/* Engagement Bar */}
                              <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <button
                                    onClick={() => toggleLike(post.id)}
                                    className="flex items-center gap-1.5 hover:scale-110 transition-all"
                                  >
                                    <Heart
                                      size={20}
                                      className={post.isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400 hover:text-red-400'}
                                    />
                                    <span className={`text-sm font-medium ${post.isLiked ? 'text-red-400' : 'text-gray-400'}`}>
                                      {post.likes_count}
                                    </span>
                                  </button>

                                  <button
                                    onClick={() => toggleComments(post.id)}
                                    className="flex items-center gap-1.5 hover:scale-110 transition-all"
                                  >
                                    <MessageCircle size={20} className="text-gray-400 hover:text-cyan-400" />
                                    <span className="text-sm font-medium text-gray-400">{post.comments_count}</span>
                                  </button>

                                  <button className="flex items-center gap-1.5 hover:scale-110 transition-all">
                                    <Share2 size={20} className="text-gray-400 hover:text-green-400" />
                                    <span className="text-sm font-medium text-gray-400">{post.shares_count}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Comments Section */}
                              {showComments[post.id] && (
                                <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                                  {/* Comment Input */}
                                  {currentUser && (
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={commentInput[post.id] || ''}
                                        onChange={(e) => setCommentInput(prev => ({ ...prev, [post.id]: e.target.value }))}
                                        onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                                        placeholder="Write a comment..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none"
                                      />
                                      <button
                                        onClick={() => addComment(post.id)}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm font-bold transition-all"
                                      >
                                        Post
                                      </button>
                                    </div>
                                  )}

                                  {/* Comments List */}
                                  {comments[post.id]?.map((comment) => (
                                    <div key={comment.id} className="flex gap-2">
                                      <img
                                        src={comment.users?.avatar_url || '/radio-logo.svg'}
                                        alt={comment.users?.username}
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                      <div className="flex-1 bg-white/5 rounded-lg p-2">
                                        <p className="text-cyan-400 font-semibold text-xs">@{comment.users?.username}</p>
                                        <p className="text-white text-sm mt-1">{comment.comment}</p>
                                        <p className="text-gray-500 text-xs mt-1">
                                          {new Date(comment.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          })}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* SECTION 4: UPLOADS - Images & Videos by Month */}
                  {profile.uploads && profile.uploads.length > 0 && (
                    <div className="px-6 py-4 border-t border-white/5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold relative z-10">📸 Uploads</h2>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveSection('tracks')}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                              activeSection === 'tracks'
                                ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                                : 'bg-white/5 text-cyan-400 hover:bg-white/10'
                            }`}
                          >
                            All Tracks
                          </button>
                          <button
                            onClick={() => setActiveSection('uploads')}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                              activeSection === 'uploads'
                                ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                                : 'bg-white/5 text-cyan-400 hover:bg-white/10'
                            }`}
                          >
                            Uploads
                          </button>
                        </div>
                      </div>

                      {activeSection === 'uploads' && (
                        <div className="space-y-6">
                          {/* Group uploads by month */}
                          {Object.entries(
                            profile.uploads.reduce((acc, upload) => {
                              const date = new Date(upload.created_at)
                              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                              const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
                              if (!acc[monthKey]) {
                                acc[monthKey] = { label: monthLabel, items: [] }
                              }
                              acc[monthKey].items.push(upload)
                              return acc
                            }, {} as Record<string, { label: string; items: Upload[] }>)
                          ).sort(([a], [b]) => b.localeCompare(a)).map(([monthKey, { label, items }]) => (
                            <div key={monthKey} className="space-y-3">
                              <h3 className="text-sm font-bold text-cyan-400/80 uppercase tracking-wider">{label}</h3>
                              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
                                {items.map((upload) => (
                                  <div
                                    key={upload.id}
                                    className="flex-shrink-0 group cursor-pointer"
                                  >
                                    <div className="relative w-40 h-40 rounded-xl overflow-hidden bg-black/40 border border-cyan-500/20 hover:border-cyan-400/60 transition-all hover:scale-105">
                                      {upload.type === 'image' ? (
                                        <img
                                          src={upload.url}
                                          alt={upload.title || 'Upload'}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <>
                                          <video
                                            src={upload.url}
                                            className="w-full h-full object-cover"
                                            muted
                                            loop
                                            onMouseEnter={(e) => e.currentTarget.play()}
                                            onMouseLeave={(e) => e.currentTarget.pause()}
                                          />
                                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-full text-[10px] font-bold text-white">
                                            VIDEO
                                          </div>
                                        </>
                                      )}
                                      
                                      {/* Hover Overlay */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        {upload.title && (
                                          <p className="text-xs text-white font-semibold truncate">{upload.title}</p>
                                        )}
                                        <p className="text-[10px] text-cyan-400/60 mt-0.5">
                                          {new Date(upload.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                  {/* End Mobile Layout */}

                  {/* Desktop Layout - Full Width Banner + Horizontal Tracks + Vertical List */}
                  <div className="hidden md:block">
                    <div className="space-y-6">
                      {/* FULL-WIDTH BANNER */}
                      <div className="relative h-80 rounded-2xl overflow-hidden group border border-cyan-500/20 shadow-2xl">
                        {profile.banner_url ? (
                          <div className="absolute inset-0">
                            {profile.banner_type === 'video' ? (
                              <video src={profile.banner_url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                            ) : (
                              <Image src={profile.banner_url} alt="Profile banner" fill className="object-cover" unoptimized />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                          </div>
                        ) : (
                          <>
                            {/* Carousel Images */}
                            <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                              <div className="flex h-full">
                                {profile.combinedMedia.slice(0, 10).map((media) => (
                                  <div key={media.id} className="relative w-full h-full flex-shrink-0">
                                    <div className="absolute inset-0">
                                      <Image
                                        src={media.image_url || '/radio-logo.svg'}
                                        alt={media.title || 'Cover art'}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                      />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Carousel Navigation - Left */}
                            {carouselIndex > 0 && (
                              <button
                                onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 border border-white/10 z-10"
                              >
                                <ChevronLeft size={20} className="text-white" />
                              </button>
                            )}
                            {/* Carousel Navigation - Right */}
                            {carouselIndex < Math.min(profile.combinedMedia.length, 10) - 1 && (
                              <button
                                onClick={() => setCarouselIndex(prev => Math.min(Math.min(profile.combinedMedia.length, 10) - 1, prev + 1))}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 border border-white/10 z-10"
                              >
                                <ChevronRight size={20} className="text-white" />
                              </button>
                            )}
                            {/* Carousel Indicators */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                              {profile.combinedMedia.slice(0, 10).map((_, index) => (
                                <button
                                  key={index}
                                  onClick={() => setCarouselIndex(index)}
                                  className={`w-2 h-2 rounded-full transition-all ${
                                    index === carouselIndex 
                                      ? 'bg-cyan-400 w-8' 
                                      : 'bg-white/30 hover:bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        {/* Edit Banner Button */}
                        {isOwnProfile && (
                          <button
                            onClick={() => setShowBannerModal(true)}
                            className="absolute right-4 bottom-4 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-xl border border-white/10 text-sm text-white hover:bg-black/60 transition-colors"
                          >
                            Edit banner
                          </button>
                        )}
                      </div>

                      {/* HORIZONTAL SCROLLING RECENT TRACKS */}
                      <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white">Recent Tracks</h3>
                          <div className="text-xs text-gray-400">{profile.combinedMedia.length} total</div>
                        </div>
                        <div className="relative">
                          <div className="overflow-x-auto custom-scrollbar pb-2">
                            <div className="flex gap-4 w-max">
                              {profile.combinedMedia.slice(0, 20).map((media) => (
                                <div 
                                  key={media.id}
                                  className="group relative w-40 flex-shrink-0"
                                >
                                  <div 
                                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-cyan-500/20 hover:border-cyan-400/60 transition-all hover:scale-105 shadow-lg"
                                    onClick={() => handlePlay(media)}
                                  >
                                    <img 
                                      src={media.image_url || '/radio-logo.svg'}
                                      alt={media.title || 'Cover'}
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Play overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                                        <Play className="text-black ml-0.5" size={20} fill="currentColor" />
                                      </div>
                                    </div>
                                    {/* Playing indicator */}
                                    {playingId === media.id && isPlaying && (
                                      <div className="absolute top-2 right-2">
                                        <div className="flex gap-0.5">
                                          <div className="w-1 h-3 bg-cyan-400 animate-pulse"></div>
                                          <div className="w-1 h-4 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                          <div className="w-1 h-3 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2">
                                    <p className="text-sm text-white font-semibold truncate">{media.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <LikeButton
                                        releaseId={media.id}
                                        initialLikesCount={media.likes || 0}
                                        size="sm"
                                        showCount={true}
                                      />
                                      <span className="text-xs text-gray-400">• {media.plays || 0} plays</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* VERTICAL TRACK LIST */}
                      <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-cyan-500/20 shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="border-b border-cyan-500/20 p-4">
                          <h3 className="text-lg font-bold text-white">All Tracks</h3>
                        </div>

                        {/* Content Area */}
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                          {/* Track List View */}
                          <div className="space-y-2 p-3">
                            {profile.combinedMedia.map((media, index) => {
                                const isCurrentlyPlaying = playingId === media.id
                                const hasAudio = !!media.audio_url
                                
                                return (
                                  <div 
                                    key={media.id} 
                                    className={`group flex items-center gap-4 p-3 rounded-xl transition-all ${
                                      hasAudio ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                                    } ${
                                      isCurrentlyPlaying 
                                        ? 'bg-cyan-500/10 ring-2 ring-cyan-400/40 shadow-lg shadow-cyan-500/20' 
                                        : hasAudio ? 'hover:bg-white/5 bg-black/20 border border-white/5' : 'bg-black/10 border border-white/5'
                                    }`}
                                    onClick={() => hasAudio && handlePlay(media)}
                                  >
                                    {/* Track Number */}
                                    <div className="w-8 text-center flex-shrink-0">
                                      {isCurrentlyPlaying && isPlaying ? (
                                        <div className="flex justify-center">
                                          <div className="w-1 h-4 bg-cyan-400 animate-pulse mx-0.5"></div>
                                          <div className="w-1 h-4 bg-cyan-400 animate-pulse mx-0.5" style={{ animationDelay: '0.2s' }}></div>
                                          <div className="w-1 h-4 bg-cyan-400 animate-pulse mx-0.5" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{index + 1}</span>
                                      )}
                                    </div>

                              {/* Thumbnail */}
                              <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden">
                                <img 
                                  src={media.image_url || '/radio-logo.svg'} 
                                  alt={media.title}
                                  className="w-full h-full object-cover"
                                />
                                {hasAudio && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                                      {isCurrentlyPlaying && isPlaying ? (
                                        <Pause className="text-black" size={14} />
                                      ) : (
                                        <Play className="text-black ml-0.5" size={14} />
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Track Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white truncate leading-tight">
                                  {media.title}
                                </h3>
                                <p className="text-sm text-gray-400 truncate leading-tight mt-1">
                                  {profile.username}
                                </p>
                              </div>

                              {/* Like Button */}
                              <div onClick={(e) => e.stopPropagation()}>
                                <LikeButton
                                  releaseId={media.id}
                                  initialLikesCount={media.likes || 0}
                                  size="sm"
                                  showCount={true}
                                />
                              </div>

                              {/* Add to Queue Button */}
                              {hasAudio && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    addToQueue({
                                      id: media.id,
                                      audioUrl: media.audio_url!,
                                      title: media.title,
                                      artist: profile.username,
                                      imageUrl: media.image_url,
                                      userId: media.user_id
                                    })
                                    setQueueToast(`Added "${media.title}" to queue`)
                                  }}
                                  className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 hover:text-cyan-300 transition-all"
                                  title="Add to Queue"
                                >
                                  <Plus size={16} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* End Desktop Layout */}

                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center px-6">
                    <div className="text-6xl mb-4">🎵</div>
                    <h3 className="text-2xl font-black text-white mb-2">
                      {isOwnProfile ? 'No content yet' : 'No content'}
                    </h3>
                    <p className="text-gray-500 mb-6 text-sm">
                      {isOwnProfile ? 'Upload your first creation!' : 'Check back later'}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg transition-all hover:scale-105 font-bold text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Upload size={16} />
                          <span>Upload</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ========== STATION TAB - LIVE STREAMING INTERFACE ========== */
            <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
              {/* Desktop & Mobile Station Layout */}
              <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
                
                {/* Station Header - Live Status & Controls */}
                <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 mb-6 shadow-2xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Station Info */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${
                          isLive ? 'from-red-500 to-pink-600 animate-pulse' : 'from-gray-700 to-gray-800'
                        } p-1 shadow-lg`}>
                          <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <RadioIcon size={32} className={isLive ? 'text-red-400' : 'text-gray-500'} />
                          </div>
                        </div>
                        {isLive && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-red-500/50">
                            <Circle size={10} className="fill-white text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        {editingStationTitle && isOwnProfile ? (
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="text"
                              value={stationTitle}
                              onChange={(e) => setStationTitle(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  saveStationTitle()
                                }
                              }}
                              placeholder="Enter station title..."
                              className="bg-white/10 border border-cyan-500/50 rounded-lg px-3 py-1 text-lg font-black text-white focus:outline-none focus:border-cyan-400"
                              autoFocus
                            />
                            <button
                              onClick={saveStationTitle}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingStationTitle(false)
                                setStationTitle('')
                              }}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-bold transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl md:text-2xl font-black text-white">
                              {stationTitle || (isOwnProfile ? '🎙️ My Station' : `🎙️ ${profile?.username}'s Station`)}
                            </h2>
                            {isOwnProfile && (
                              <button
                                onClick={() => {
                                  setStationTitle(stationTitle || `${profile?.username}'s Live Radio`)
                                  setEditingStationTitle(true)
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                                title="Edit station title"
                              >
                                <Edit2 size={14} className="text-gray-400 hover:text-cyan-400" />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                            isLive 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                              : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                          }`}>
                            <Circle size={6} className={`${isLive ? 'fill-red-400 text-red-400 animate-pulse' : 'fill-gray-500 text-gray-500'}`} />
                            {isLive ? 'LIVE NOW' : 'OFFLINE'}
                          </div>
                          {isLive && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold">
                              <Users size={12} />
                              {liveListeners} {liveListeners === 1 ? 'listener' : 'listeners'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Go Live / Stop Broadcast + Video Button (Own Profile Only) */}
                    {isOwnProfile && (
                      <div className="flex items-center gap-2">
                        {isLive && (
                          <button
                            onClick={toggleVideo}
                            className={`px-4 py-3 rounded-xl font-bold text-sm transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                              showVideo
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white'
                                : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white border border-white/20'
                            }`}
                            title={showVideo ? 'Stop Video' : 'Start Video'}
                          >
                            <div className="flex items-center gap-2">
                              <Video size={16} />
                              <span className="hidden md:inline">{showVideo ? 'Stop Video' : 'Start Video'}</span>
                            </div>
                          </button>
                        )}
                        <button
                          onClick={toggleLive}
                          className={`px-6 py-3 rounded-xl font-bold text-sm transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
                            isLive
                              ? 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white border border-white/20'
                              : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isLive ? (
                              <>
                                <Circle size={16} className="fill-white text-white" />
                                <span>Stop Broadcast</span>
                              </>
                            ) : (
                              <>
                                <RadioIcon size={16} />
                                <span>Go Live</span>
                              </>
                            )}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Live Video Stream - Visible to all when active */}
                  {isLive && showVideo && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-red-500/30">
                        <video
                          ref={isOwnProfile ? videoRef : broadcasterVideoRef}
                          autoPlay
                          playsInline
                          muted={isOwnProfile}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-4 left-4 bg-red-500/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          <span className="text-white font-bold text-xs">LIVE VIDEO</span>
                        </div>
                        {!isOwnProfile && (
                          <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
                            <span className="text-white font-bold text-xs flex items-center gap-1.5">
                              <Video size={12} />
                              Broadcaster's Stream
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Currently Playing Track */}
                  {isLive && currentTrack && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-3 bg-black/40 rounded-xl p-3">
                        <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={currentTrack.imageUrl || '/radio-logo.svg'}
                            alt={currentTrack.title}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 mb-1">Now Playing</div>
                          <div className="text-sm md:text-base font-bold text-white truncate">{currentTrack.title}</div>
                          {currentTrack.artist && (
                            <div className="text-xs text-gray-500 truncate mt-1">{currentTrack.artist}</div>
                          )}
                        </div>
                        {isPlaying && (
                          <div className="flex gap-1">
                            <div className="w-1 h-6 bg-cyan-400 rounded-full animate-pulse"></div>
                            <div className="w-1 h-6 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1 h-6 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Content Grid - Chat & Track Queue */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* LEFT: Live Chat */}
                  <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 px-4 md:px-6 py-4 border-b border-white/10">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <MessageCircle size={20} className="text-cyan-400" />
                        Live Chat
                        {isLive && (
                          <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/30">
                            Active
                          </span>
                        )}
                      </h3>
                    </div>

                    {/* Chat Messages - Optimized with ref and pagination */}
                    <div 
                      ref={chatContainerRef}
                      className="h-[400px] md:h-[500px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                    >
                      {!isLive ? (
                        <div className="flex items-center justify-center h-full text-center">
                          <div>
                            <MessageCircle size={48} className="text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">Chat is disabled when station is offline</p>
                          </div>
                        </div>
                      ) : displayedMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-center">
                          <div>
                            <MessageCircle size={48} className="text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                          </div>
                        </div>
                      ) : (
                        displayedMessages.map((msg) => (
                          <div key={msg.id} className="group">
                            {msg.type === 'track' ? (
                              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
                                  <Music size={12} />
                                  <span>Track Changed</span>
                                </div>
                                <div className="text-white text-sm font-medium">{msg.message}</div>
                              </div>
                            ) : msg.username === 'System' ? (
                              <div className="text-center">
                                <span className="text-gray-500 text-xs italic">{msg.message}</span>
                              </div>
                            ) : (
                              <div className="bg-white/5 hover:bg-white/10 rounded-lg p-3 transition-all">
                                <div className="flex items-start gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                    {msg.username[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                      <span className="text-cyan-400 text-xs font-bold truncate">{msg.username}</span>
                                      <span className="text-gray-600 text-[10px]">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-white text-sm break-words">{msg.message}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Chat Input */}
                    {isLive && (
                      <div className="border-t border-white/10 p-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter' && chatInput.trim()) {
                                sendMessage()
                              }
                            }}
                            placeholder={isOwnProfile ? "Chat with your listeners..." : "Send a message..."}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-gray-500"
                            disabled={!isLive}
                          />
                          <button
                            onClick={() => {
                              if (chatInput.trim()) {
                                sendMessage()
                              }
                            }}
                            disabled={!chatInput.trim() || !isLive}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed rounded-xl px-5 py-3 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
                          >
                            <Send size={18} className="text-white" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Track Queue / Playlist */}
                  <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 px-4 md:px-6 py-4 border-b border-white/10">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Music size={20} className="text-purple-400" />
                        Track Queue
                        <span className="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full border border-purple-500/30">
                          {trackCount} tracks
                        </span>
                      </h3>
                    </div>

                    {/* Track List */}
                    <div className="h-[400px] md:h-[500px] overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {trackCount === 0 ? (
                        <div className="flex items-center justify-center h-full text-center">
                          <div>
                            <Music size={48} className="text-gray-700 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm">No tracks available</p>
                            {isOwnProfile && (
                              <button
                                onClick={() => setShowUploadModal(true)}
                                className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-bold transition-all"
                              >
                                Upload Your First Track
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        audioTracks.map((media, index) => {
                            const isCurrentlyPlaying = playingId === media.id
                            
                          function formatDuration(duration: number): import("react").ReactNode {
                            throw new Error('Function not implemented.')
                          }

                            return (
                              <div
                                key={media.id}
                                onClick={() => handlePlay(media)}
                                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/10 ${
                                  isCurrentlyPlaying 
                                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 shadow-lg' 
                                    : 'bg-white/5 hover:scale-[1.02]'
                                }`}
                              >
                                {/* Track Number / Play Button */}
                                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                                  {isCurrentlyPlaying && isPlaying ? (
                                    <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
                                      <Pause size={18} className="text-black" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 bg-white/10 group-hover:bg-cyan-500 rounded-lg flex items-center justify-center transition-all">
                                      <span className="text-gray-400 group-hover:hidden font-bold text-sm">{index + 1}</span>
                                      <Play size={18} className="text-white hidden group-hover:block ml-0.5" />
                                    </div>
                                  )}
                                </div>

                                {/* Album Art */}
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                                  <Image
                                    src={media.image_url || '/radio-logo.svg'}
                                    alt={media.title}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                  {isCurrentlyPlaying && isPlaying && (
                                    <div className="absolute inset-0 bg-cyan-500/30 flex items-center justify-center">
                                      <div className="flex gap-0.5">
                                        <div className="w-0.5 h-3 bg-white rounded-full animate-pulse"></div>
                                        <div className="w-0.5 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-0.5 h-3 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Track Info */}
                                <div className="flex-1 min-w-0">
                                  {editingTrackId === media.id && isOwnProfile ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={editingTrackTitle}
                                        onChange={(e) => setEditingTrackTitle(e.target.value)}
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            saveTrackTitle(media.id, editingTrackTitle)
                                          }
                                          if (e.key === 'Escape') {
                                            setEditingTrackId(null)
                                            setEditingTrackTitle('')
                                          }
                                        }}
                                        className="flex-1 bg-white/10 border border-cyan-500/50 rounded px-2 py-1 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => saveTrackTitle(media.id, editingTrackTitle)}
                                        className="p-1 bg-cyan-600 hover:bg-cyan-500 rounded transition-all"
                                        title="Save"
                                      >
                                        <Circle size={12} className="text-white fill-white" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group/title">
                                      <div className={`font-bold text-sm truncate ${isCurrentlyPlaying ? 'text-cyan-400' : 'text-white'}`}>
                                        {media.title}
                                      </div>
                                      {isOwnProfile && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingTrackId(media.id)
                                            setEditingTrackTitle(media.title)
                                          }}
                                          className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                          title="Edit title"
                                        >
                                          <Edit2 size={10} className="text-gray-400 hover:text-cyan-400" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {media.audio_prompt && (
                                    <div className="text-xs text-gray-500 truncate">{media.audio_prompt}</div>
                                  )}
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                      <Play size={10} />
                                      {media.plays || 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                      )}
                    </div>
                  </div>

                </div>

                {/* Station Stats - Bottom Section */}
                {isOwnProfile && (
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl md:text-3xl font-black text-cyan-400 mb-1">
                        {trackCount}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">Total Tracks</div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl md:text-3xl font-black text-purple-400 mb-1">
                        {profile?.totalPlays || 0}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">Total Plays</div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl md:text-3xl font-black text-pink-400 mb-1">
                        {liveListeners}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">Live Listeners</div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl md:text-3xl font-black text-red-400 mb-1">
                        {isLive ? 'ON AIR' : 'OFFLINE'}
                      </div>
                      <div className="text-xs text-gray-500 uppercase">Status</div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
      </main>

      {/* Bottom-Docked Badge with Username and Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-2 md:p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-2 md:p-3 shadow-2xl">
            <div className="flex items-center justify-between px-2 md:px-4">
              {/* Left: Profile Picture + Username + Upload (if own) */}
              <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1">
                {/* Profile Picture */}
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 flex-shrink-0 border-2 border-white/30">
                  {profile?.avatar ? (
                    <img 
                      src={profile.avatar} 
                      alt={profile.username} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={16} className="text-white w-full h-full p-1.5" />
                  )}
                </div>
                
                <span className="text-xs md:text-sm font-black text-white truncate">
                  @{profile?.username || 'Loading...'}
                </span>
                
                {/* Upload Icon (Only for own profile) */}
                {isOwnProfile && (
                  <>
                    <div className="hidden md:block w-px h-4 bg-white/20"></div>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="p-1.5 md:p-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-full transition-all shadow-lg hover:scale-110 flex-shrink-0"
                      title="Upload Content"
                    >
                      <Upload size={12} className="text-white md:w-[14px] md:h-[14px]" />
                    </button>
                  </>
                )}
              </div>
              
              {/* Right: Stats */}
              <div className="flex items-center gap-2 md:gap-6 flex-shrink-0">
                {/* Tracks Count */}
                <div className="flex flex-col md:flex-row items-center md:gap-2">
                  <span className="text-xs md:text-sm font-black text-white leading-none">{profile?.songCount || 0}</span>
                  <span className="text-[9px] md:text-xs text-gray-400 leading-none">Tracks</span>
                </div>
                
                {/* Divider */}
                <div className="w-px h-4 md:h-4 bg-white/20"></div>
                
                {/* Plays Count */}
                <div className="flex flex-col md:flex-row items-center md:gap-2">
                  <span className="text-xs md:text-sm font-black text-white leading-none">{profile?.totalPlays || 0}</span>
                  <span className="text-[9px] md:text-xs text-gray-400 leading-none">Plays</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Publish Release Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        {showPublishModal && (
          <CombineMediaModal
            isOpen={showPublishModal}
            onClose={() => {
              setShowPublishModal(false)
              // Refresh profile data
            }}
          />
        )}
      </Suspense>

      {/* Upload Content Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        {showUploadModal && (
          <ProfileUploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onUploadComplete={() => {
              fetchProfileData()
            }}
          />
        )}
      </Suspense>

      {/* Banner Upload Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        {showBannerModal && (
          <BannerUploadModal
            isOpen={showBannerModal}
            onClose={() => setShowBannerModal(false)}
            onSuccess={() => {
              fetchProfileData()
            }}
          />
        )}
      </Suspense>

      {/* Create Post Modal - Lazy Loaded */}
      <Suspense fallback={null}>
        <CreatePostModal
          isOpen={showCreatePostModal}
          onClose={() => setShowCreatePostModal(false)}
          userSongs={profile?.combinedMedia.filter(m => m.audio_url).map(m => ({
            id: m.id,
            title: m.title,
            image_url: m.image_url || '/radio-logo.svg',
            audio_url: m.audio_url || ''
          })) || []}
          onPostCreated={() => {
            fetchPosts()
          }}
        />
      </Suspense>

      {/* Floating Navigation Button - Desktop hidden on profile */}
      <FloatingNavButton hideOnDesktop={true} />

      {/* Queue Toast Notification */}
      {queueToast && (
        <div className="fixed bottom-24 right-6 z-50 bg-cyan-500/90 backdrop-blur-md text-white px-4 py-3 rounded-lg shadow-xl shadow-cyan-500/30 animate-fade-in max-w-xs">
          <p className="text-sm font-medium">{queueToast}</p>
        </div>
      )}
    </div>
  )
}
