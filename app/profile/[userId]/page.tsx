'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'
import FloatingMenu from '../../components/FloatingMenu'
import HolographicBackground from '../../components/HolographicBackgroundClient'
import StarryBackground from '../../components/StarryBackground'
import FloatingNavButton from '../../components/FloatingNavButton'
import { Edit2, Grid, List, Upload, Music, Video, Image as ImageIcon, Users, Radio as RadioIcon, UserPlus, Play, Pause, ChevronLeft, ChevronRight, Send, Circle, ArrowLeft, Heart, MessageCircle, Share2, MoreVertical, Trash2 } from 'lucide-react'
import CombineMediaModal from '../../components/CombineMediaModal'
import ProfileUploadModal from '../../components/ProfileUploadModal'
import PrivateListModal from '../../components/PrivateListModal'
import CreatePostModal from '../../components/CreatePostModal'
import { getDisplayUsername, formatUsername } from '../../../lib/username'
import { createClient } from '@supabase/supabase-js'

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
  const [showStationsModal, setShowStationsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'feed' | 'stations'>('feed')
  const [isFollowing, setIsFollowing] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [currentTrack, setCurrentTrack] = useState<CombinedMedia | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [activeSection, setActiveSection] = useState<'tracks' | 'uploads'>('tracks')
  const [activeSubTab, setActiveSubTab] = useState<'tracks' | 'station'>('tracks')
  const [contentTab, setContentTab] = useState<'tracks' | 'posts'>('tracks')
  const [isLive, setIsLive] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{id: string, username: string, message: string, timestamp: Date, type: 'chat' | 'track'}>>([])
  const [chatInput, setChatInput] = useState('')
  const [liveListeners, setLiveListeners] = useState(0)
  const [stationId, setStationId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [showCreatePostModal, setShowCreatePostModal] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({})
  const [comments, setComments] = useState<{[key: string]: Comment[]}>({})
  const [commentInput, setCommentInput] = useState<{[key: string]: string}>({})
  const [isMobile, setIsMobile] = useState(false)

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

  useEffect(() => {
    if (currentUser) {
      setIsOwnProfile(currentUser.id === resolvedParams.userId)
    }
    fetchProfileData()
    fetchStationStatus()
  }, [currentUser, resolvedParams.userId])

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

    // Subscribe to messages
    const messagesChannel = supabase
      .channel(`station_messages:${stationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'station_messages',
        filter: `station_id=eq.${stationId}`
      }, (payload) => {
        const msg = payload.new as {
          id: string
          username: string
          message: string
          created_at: string
          message_type: 'chat' | 'track'
        }
        setChatMessages(prev => [...prev, {
          id: msg.id,
          username: msg.username,
          message: msg.message,
          timestamp: new Date(msg.created_at),
          type: msg.message_type
        }])
      })
      .subscribe()

    // Subscribe to station updates
    const stationChannel = supabase
      .channel(`live_stations:${stationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_stations',
        filter: `id=eq.${stationId}`
      }, (payload) => {
        const station = payload.new as {
          is_live: boolean
          listener_count: number
        }
        setIsLive(station.is_live)
        setLiveListeners(station.listener_count || 0)
      })
      .subscribe()

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
        const res = await fetch(`/api/station?userId=${profile?.username}`)
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
      .subscribe()

    return () => {
      messagesChannel.unsubscribe()
      stationChannel.unsubscribe()
      listenersChannel.unsubscribe()
    }
  }, [stationId, profile?.username])

  // Join station as listener when viewing
  useEffect(() => {
    if (!stationId || !isLive || !currentUser || isOwnProfile) return

    const joinStation = async () => {
      try {
        await fetch('/api/station/listeners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId,
            username: currentUser.username || 'Anonymous'
          })
        })
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
  }, [stationId, isLive, currentUser, isOwnProfile])

  // Toggle live status
  const toggleLive = async () => {
    try {
      const newLiveStatus = !isLive
      const res = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive: newLiveStatus,
          currentTrack: newLiveStatus ? currentTrack : null,
          username: profile?.username
        })
      })
      const data = await res.json()
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
      }
    } catch (error) {
      console.error('Failed to toggle live:', error)
    }
  }

  // Send chat message
  const sendMessage = async () => {
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
  }

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
    if (!media.audio_url) return
    
    if (playingId === media.id && isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      setCurrentTrack(media)
      setPlayingId(media.id)
      setIsPlaying(true)
      if (audioRef.current) {
        audioRef.current.src = media.audio_url
        audioRef.current.play()
      }
      
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
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Holographic 3D Background */}
      {!isMobile && <HolographicBackground />}
      
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

      {/* Feed/Stations Content - Full bleed with new layout */}
      <main className="relative z-10 overflow-y-auto pb-32">
          
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
                  {/* Mobile Station View - Full Screen */}
                  {activeSubTab === 'station' && (
                    <div className="md:hidden fixed inset-0 bg-black z-50 flex flex-col safe-area-inset">
                      {/* Starry Background for Chat */}
                      <StarryBackground />
                      
                      {/* Header */}
                      <div className="flex-shrink-0 bg-gradient-to-b from-black to-transparent p-3 border-b border-white/10 relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            onClick={() => setActiveSubTab('tracks')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-all active:scale-95"
                          >
                            <ChevronLeft size={24} className="text-white" />
                          </button>
                          <h1 className="text-lg font-bold">
                            {isOwnProfile ? 'My Station' : `${profile.username}'s Station`}
                          </h1>
                          <div className="w-10"></div>
                        </div>

                        {/* Live Status Bar */}
                        <div className="bg-gradient-to-r from-red-900/30 to-red-950/30 rounded-xl p-3 border border-red-500/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Circle size={10} className={`fill-red-500 text-red-500 ${isLive ? 'animate-pulse' : ''}`} />
                              <span className="text-white font-bold text-sm">{isLive ? 'LIVE NOW' : 'OFFLINE'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <Users size={12} />
                              <span>{liveListeners} listening</span>
                            </div>
                          </div>
                          {isOwnProfile && (
                            <button
                              onClick={toggleLive}
                              className={`w-full p-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 active:scale-95 ${
                                isLive
                                  ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30'
                                  : 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30'
                              }`}
                              title={isLive ? 'End Broadcast' : 'Go Live'}
                            >
                              {isLive ? (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                  <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor"/>
                                </svg>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                  <circle cx="8" cy="8" r="6" fill="currentColor"/>
                                </svg>
                              )}
                              <span className="text-xs">{isLive ? 'End Broadcast' : 'Go Live'}</span>
                            </button>
                          )}
                        </div>

                        {/* Currently Playing */}
                        {isLive && currentTrack && (
                          <div className="bg-cyan-500/10 rounded-xl p-3 border border-cyan-500/30 mt-3">
                            <div className="text-[10px] text-cyan-400 uppercase mb-1">Now Playing</div>
                            <div className="flex items-center gap-2">
                              <img 
                                src={currentTrack.image_url} 
                                alt={currentTrack.title}
                                className="w-10 h-10 rounded-lg"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white font-bold text-sm truncate">{currentTrack.title}</h4>
                                <p className="text-xs text-gray-400 truncate">@{profile.username}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar relative z-10">
                        {chatMessages.length === 0 ? (
                          <div className="text-center text-gray-500 mt-8">
                            <RadioIcon size={28} className="mx-auto mb-2 opacity-50" />
                            <p className="text-xs">{isLive ? 'Start the conversation!' : 'Station is offline'}</p>
                          </div>
                        ) : (
                          chatMessages.map((msg) => (
                            <div key={msg.id} className={`${
                              msg.type === 'track' ? 'bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-2' : ''
                            } ${msg.username === 'System' ? 'text-center' : ''}`}>
                              {msg.username === 'System' ? (
                                <p className="text-xs text-gray-500 italic">{msg.message}</p>
                              ) : msg.type === 'track' ? (
                                <div className="flex items-center gap-2 text-xs">
                                  <Play size={12} className="text-cyan-400 flex-shrink-0" />
                                  <span className="text-cyan-400 font-bold">{msg.username}</span>
                                  <span className="text-gray-400">played</span>
                                  <span className="text-white truncate">{msg.message}</span>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className="font-bold text-white text-xs">{msg.username}</span>
                                    <span className="text-[10px] text-gray-500">
                                      {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                                        hour: 'numeric', 
                                        minute: '2-digit',
                                        hour12: true 
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-gray-300 text-xs">{msg.message}</p>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Chat Input */}
                      {isLive && (
                        <div className="flex-shrink-0 p-3 border-t border-white/10 bg-black safe-area-bottom">
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
                              placeholder="Type a message..."
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                            />
                            <button
                              onClick={() => {
                                if (chatInput.trim()) {
                                  sendMessage()
                                }
                              }}
                              className="bg-cyan-600 hover:bg-cyan-500 active:scale-95 rounded-lg px-3 py-2.5 transition-all"
                            >
                              <Send size={16} className="text-white" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mobile Layout - Original Design */}
                  <div className="md:hidden space-y-0">
                  {/* SECTION 1: TOP BANNER - Cover Art Carousel */}
                  <div className="relative h-64 overflow-hidden group">
                    {/* Carousel Images */}
                    <div className="absolute inset-0 transition-transform duration-500 ease-out" style={{ transform: `translateX(-${carouselIndex * 100}%)` }}>
                      <div className="flex h-full">
                        {profile.combinedMedia.slice(0, 10).map((media, index) => (
                          <div key={media.id} className="relative w-full h-full flex-shrink-0">
                            <img 
                              src={media.image_url} 
                              alt={media.title || 'Cover art'}
                              className="w-full h-full object-cover"
                            />
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
                  </div>

                  {/* Mobile Station Access Button */}
                  {(isLive || isOwnProfile) && (
                    <div className="px-6 py-4 border-b border-white/5">
                      <button
                        onClick={async () => {
                          if (isOwnProfile && !isLive) {
                            // Auto go live when owner clicks
                            await toggleLive()
                          }
                          setActiveSubTab('station')
                        }}
                        className={`w-full p-4 rounded-xl border transition-all ${
                          isLive 
                            ? 'bg-gradient-to-r from-red-900/30 to-red-950/30 border-red-500/30 hover:from-red-900/40 hover:to-red-950/40' 
                            : 'bg-gradient-to-r from-gray-900/30 to-gray-950/30 border-gray-500/30 hover:from-gray-900/40 hover:to-gray-950/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isLive ? 'bg-red-500/20' : 'bg-gray-500/20'}`}>
                              <RadioIcon size={20} className={isLive ? 'text-red-400' : 'text-gray-400'} />
                            </div>
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-bold">
                                  {isOwnProfile ? 'My Station' : `${profile.username}'s Station`}
                                </span>
                                {isLive && (
                                  <div className="flex items-center gap-1">
                                    <Circle size={8} className="fill-red-500 text-red-500 animate-pulse" />
                                    <span className="text-xs text-red-400 font-bold">LIVE</span>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-gray-400">
                                {isLive 
                                  ? `${liveListeners} listening now` 
                                  : isOwnProfile 
                                    ? 'Start broadcasting' 
                                    : 'Station offline'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-gray-400" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* SECTION 2: HORIZONTAL SCROLL - Recent Tracks */}
                  <div className="py-4 px-6 border-b border-white/5">
                    <h2 className="text-2xl font-bold mb-3 relative z-10">🎵 Recent Tracks</h2>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" style={{ scrollbarWidth: 'none' }}>
                      {profile.combinedMedia.slice(0, 20).map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        const hasAudio = !!media.audio_url
                        
                        return (
                          <div 
                            key={media.id} 
                            className={`flex-shrink-0 group cursor-pointer rounded-lg overflow-hidden transition-all ${
                              isCurrentlyPlaying ? 'ring-2 ring-cyan-400 scale-105' : 'hover:scale-105'
                            } ${!hasAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => hasAudio && handlePlay(media)}
                          >
                            <div className="relative w-32 h-32">
                              <img 
                                src={media.image_url} 
                                alt={media.title}
                                className="w-full h-full object-cover"
                              />
                              {hasAudio && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                                    {isCurrentlyPlaying && isPlaying ? (
                                      <Pause className="text-black" size={20} />
                                    ) : (
                                      <Play className="text-black ml-1" size={20} />
                                    )}
                                  </div>
                                </div>
                              )}
                              {isCurrentlyPlaying && isPlaying && (
                                <div className="absolute top-2 right-2 w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* SECTION 3: LIST VIEW - All Content with Tabs */}
                  <div className="px-6 py-4">
                    {/* Tab Buttons */}
                    <div className="flex items-center gap-4 mb-4">
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
                    {contentTab === 'tracks' && (
                      <>
                        {/* Desktop: 4 Column List View */}
                        <div className="hidden md:grid md:grid-cols-4 gap-x-6 gap-y-1">
                          {profile.combinedMedia.map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        const hasAudio = !!media.audio_url
                        
                        return (
                          <div 
                            key={media.id} 
                            className={`group flex items-center gap-3 p-2 rounded-lg transition-all ${
                              hasAudio ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            } ${
                              isCurrentlyPlaying 
                                ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                                : hasAudio ? 'hover:bg-white/5' : ''
                            }`}
                            onClick={() => hasAudio && handlePlay(media)}
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
                              <p className="text-xs text-gray-300 truncate leading-tight mt-0.5">
                                {formatUsername(profile.username)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Mobile: Single Column List View */}
                    <div className="md:hidden space-y-1">
                      {profile.combinedMedia.map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        const hasAudio = !!media.audio_url
                        
                        return (
                          <div 
                            key={media.id} 
                            className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                              hasAudio ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            } ${
                              isCurrentlyPlaying 
                                ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                                : hasAudio ? 'hover:bg-white/5' : ''
                            }`}
                            onClick={() => hasAudio && handlePlay(media)}
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
                            <div className="flex-1 min-w-0 relative z-10">
                              <h3 className="font-semibold text-white truncate leading-tight">
                                {media.title}
                              </h3>
                              <p className="text-sm text-gray-300 truncate leading-tight mt-0.5">
                                {formatUsername(profile.username)}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Mobile: Single Column List View */}
                    <div className="md:hidden space-y-1">
                      {profile.combinedMedia.map((media) => {
                        const isCurrentlyPlaying = playingId === media.id
                        const hasAudio = !!media.audio_url
                        
                        return (
                          <div 
                            key={media.id} 
                            className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
                              hasAudio ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            } ${
                              isCurrentlyPlaying 
                                ? 'bg-cyan-500/10 ring-1 ring-cyan-400/30' 
                                : hasAudio ? 'hover:bg-white/5' : ''
                            }`}
                            onClick={() => hasAudio && handlePlay(media)}
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
                            <div className="flex-1 min-w-0 relative z-10">
                              <h3 className="font-semibold text-white truncate leading-tight">
                                {media.title}
                              </h3>
                              <p className="text-sm text-gray-300 truncate leading-tight mt-0.5">
                                {formatUsername(profile.username)}
                              </p>
                            </div>
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
                                  <img
                                    src={profile?.avatar || '/radio-logo.svg'}
                                    alt={profile?.username}
                                    className="w-10 h-10 rounded-full object-cover border border-cyan-400/30"
                                  />
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

                  {/* Desktop Layout - Split View */}
                  <div className="hidden md:block">
                    <div className="grid grid-cols-2 gap-6 p-6">
                      {/* LEFT SIDE: Track List / Station Feed */}
                      <div className="flex flex-col h-[calc(100vh-200px)]">
                        {/* Sub Tabs */}
                        <div className="bg-black/90 backdrop-blur-xl border-b border-cyan-500/20 flex-shrink-0">
                          <div className="flex gap-2 p-3">
                            <button
                              onClick={() => setActiveSubTab('tracks')}
                              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                activeSubTab === 'tracks'
                                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              All Tracks
                            </button>
                            <button
                              onClick={() => setActiveSubTab('station')}
                              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                activeSubTab === 'station'
                                  ? 'bg-gradient-to-r from-red-600 to-red-400 text-white shadow-lg shadow-red-500/30'
                                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <RadioIcon size={16} />
                              Station
                              {isLive && <Circle size={8} className="fill-red-500 text-red-500 animate-pulse" />}
                            </button>
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                          {activeSubTab === 'tracks' ? (
                            // Track List View
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
                                  {formatUsername(profile.username)}
                                </p>
                              </div>

                              {/* Duration */}
                              <div className="text-sm text-gray-400 flex-shrink-0 font-mono">
                                {formatDuration(media.duration || 180)}
                              </div>
                            </div>
                          )
                        })}
                            </div>
                          ) : (
                            // Station Feed View
                            <div className="space-y-4 p-3">
                              {/* Live Station Header */}
                              <div className="bg-gradient-to-r from-red-900/30 to-red-950/30 rounded-xl p-4 border border-red-500/30">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Circle size={12} className={`fill-red-500 text-red-500 ${isLive ? 'animate-pulse' : ''}`} />
                                    <span className="text-white font-bold">{isLive ? 'LIVE NOW' : 'OFFLINE'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <Users size={14} />
                                    <span>{liveListeners} listening</span>
                                  </div>
                                </div>
                                {isOwnProfile && (
                                  <button
                                    onClick={toggleLive}
                                    className={`p-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                                      isLive
                                        ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30'
                                        : 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30'
                                    }`}
                                    title={isLive ? 'End Broadcast' : 'Go Live'}
                                  >
                                    {isLive ? (
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                        <rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor"/>
                                      </svg>
                                    ) : (
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                                        <circle cx="8" cy="8" r="6" fill="currentColor"/>
                                      </svg>
                                    )}
                                    <span className="text-xs">{isLive ? 'End' : 'Go Live'}</span>
                                  </button>
                                )}
                              </div>

                              {/* Currently Playing in Station */}
                              {isLive && currentTrack && (
                                <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
                                  <div className="text-xs text-cyan-400 uppercase mb-2">Now Playing on Station</div>
                                  <div className="flex items-center gap-3">
                                    <img 
                                      src={currentTrack.image_url} 
                                      alt={currentTrack.title}
                                      className="w-12 h-12 rounded-lg"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-white font-bold truncate">{currentTrack.title}</h4>
                                      <p className="text-sm text-gray-400 truncate">@{profile.username}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Chat/Feed Messages */}
                              <div className="bg-black/40 rounded-xl border border-white/10 flex flex-col h-[400px]">
                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                  {chatMessages.length === 0 ? (
                                    <div className="text-center text-gray-500 mt-8">
                                      <RadioIcon size={32} className="mx-auto mb-2 opacity-50" />
                                      <p className="text-sm">{isLive ? 'Start the conversation!' : 'Station is offline'}</p>
                                    </div>
                                  ) : (
                                    chatMessages.map((msg) => (
                                      <div key={msg.id} className={`${
                                        msg.type === 'track' ? 'bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3' : ''
                                      }`}>
                                        {msg.type === 'track' ? (
                                          <div className="flex items-center gap-2 text-sm">
                                            <Music size={14} className="text-cyan-400" />
                                            <span className="text-cyan-400 font-bold">{msg.username}</span>
                                            <span className="text-gray-400">played</span>
                                            <span className="text-white font-semibold">{msg.message}</span>
                                          </div>
                                        ) : (
                                          <div>
                                            <span className="text-cyan-400 font-bold text-sm">{msg.username}: </span>
                                            <span className="text-white text-sm">{msg.message}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>

                                {/* Chat Input */}
                                {isLive && (
                                  <div className="border-t border-white/10 p-3">
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
                                        placeholder="Type a message..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                      />
                                      <button
                                        onClick={() => {
                                          if (chatInput.trim()) {
                                            sendMessage()
                                          }
                                        }}
                                        className="bg-cyan-600 hover:bg-cyan-500 rounded-lg px-4 py-2 transition-all"
                                      >
                                        <Send size={16} className="text-white" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* RIGHT SIDE: Vinyl-Style Digital Player */}
                      <div className="sticky top-6 self-start space-y-4">
                        {/* Compact Vinyl Player with Amber Display */}
                        <div className="relative bg-gradient-to-br from-black via-gray-900 to-black rounded-2xl border border-cyan-500/20 shadow-2xl p-6">
                          
                          {/* Amber Display - Retro Style */}
                          <div className="mb-4 bg-black/60 rounded-xl border-2 border-amber-600/40 p-4">
                            <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/50 rounded-lg p-4 border border-amber-700/30">
                              <div className="text-amber-400 font-mono text-center space-y-1">
                                <div className="text-[10px] text-amber-600/60 uppercase tracking-widest">Now Playing</div>
                                <div className="text-base font-bold truncate">
                                  {currentTrack?.title || profile.combinedMedia[0]?.title || 'No track selected'}
                                </div>
                                <div className="text-sm text-amber-500/80 truncate">
                                  @{profile.username}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Compact Vinyl Record */}
                          <div className="relative w-48 h-48 mx-auto mb-4">
                            {/* Outer Vinyl Disc */}
                            <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-gray-900 via-black to-gray-900 shadow-2xl transition-transform ${
                              isPlaying ? 'animate-spin-slow' : ''
                            }`} style={{ animationDuration: '3s' }}>
                              {/* Vinyl Grooves Effect */}
                              <div className="absolute inset-0 rounded-full" style={{
                                background: 'repeating-radial-gradient(circle at center, transparent 0px, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
                              }}></div>
                              {/* Center Label */}
                              <div className="absolute inset-[20%] rounded-full bg-gradient-to-br from-cyan-950 to-cyan-900 border-2 border-cyan-500/30 shadow-inner"></div>
                            </div>

                            {/* Album Cover - Centered on Vinyl */}
                            <div className={`relative w-[60%] h-[60%] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden shadow-2xl border-4 border-black/50 transition-transform ${
                              isPlaying ? 'animate-spin-slow' : ''
                            }`} style={{ animationDuration: '3s' }}>
                              <img 
                                src={currentTrack?.image_url || profile.combinedMedia[0]?.image_url || '/radio-logo.svg'} 
                                alt={currentTrack?.title || 'Album'}
                                className="w-full h-full object-cover"
                              />
                              {/* Vinyl Shine Effect */}
                              <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/40"></div>
                            </div>

                            {/* Center Spindle */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-gray-700 shadow-2xl z-10">
                              <div className="absolute inset-1 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-inner"></div>
                            </div>
                          </div>

                          {/* Play/Pause Button */}
                          <button
                            onClick={() => {
                              if (currentTrack) {
                                handlePlay(currentTrack)
                              } else if (profile.combinedMedia[0]) {
                                handlePlay(profile.combinedMedia[0])
                              }
                            }}
                            className="w-12 h-12 mx-auto bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/50 hover:from-cyan-500 hover:to-cyan-300 transition-all hover:scale-110"
                          >
                            {isPlaying ? (
                              <Pause className="text-black" size={20} />
                            ) : (
                              <Play className="text-black ml-0.5" size={20} />
                            )}
                          </button>
                        </div>

                        {/* Hoverable Cover Art Grid */}
                        <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-cyan-500/20 p-6 shadow-2xl">
                          <h3 className="text-lg font-bold text-white mb-4">Recent Tracks</h3>
                          <div className="grid grid-cols-3 gap-3">
                            {profile.combinedMedia.slice(0, 12).map((media) => (
                              <div 
                                key={media.id}
                                className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-cyan-500/20 hover:border-cyan-400/60 transition-all hover:scale-105"
                                onClick={() => handlePlay(media)}
                              >
                                <img 
                                  src={media.image_url || '/radio-logo.svg'}
                                  alt={media.title || 'Cover'}
                                  className="w-full h-full object-cover"
                                />
                                {/* Play overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                                    <Play className="text-black ml-0.5" size={16} fill="currentColor" />
                                  </div>
                                </div>
                                {/* Playing indicator */}
                                {playingId === media.id && isPlaying && (
                                  <div className="absolute top-2 right-2">
                                    <div className="flex gap-0.5">
                                      <div className="w-1 h-2 bg-cyan-400 animate-pulse"></div>
                                      <div className="w-1 h-3 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                      <div className="w-1 h-2 bg-cyan-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
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
            /* Stations Tab */
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center px-6">
                <div className="text-6xl mb-4">📻</div>
                <h3 className="text-2xl font-black text-white mb-2">
                  {isOwnProfile ? 'No stations yet' : 'No stations'}
                </h3>
                <p className="text-gray-500 mb-6 text-sm">
                  {isOwnProfile ? 'Create your first station!' : 'This user hasn\'t created any stations'}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => setShowStationsModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 rounded-lg transition-all hover:scale-105 font-bold text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <RadioIcon size={16} />
                      <span>Create Station</span>
                    </div>
                  </button>
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
              {/* Left: Username + Stations + Upload (if own) */}
              <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1">
                <span className="text-xs md:text-sm font-black text-white truncate">
                  @{profile?.username || 'Loading...'}
                </span>
                
                {/* Stations Button - Hide text on mobile */}
                <div className="hidden md:block w-px h-4 bg-white/20"></div>
                <button 
                  onClick={() => setShowStationsModal(true)}
                  className="px-2 md:px-3 py-1 bg-gradient-to-r from-cyan-600 to-cyan-800 hover:from-cyan-700 hover:to-cyan-900 rounded-full transition-all shadow-lg hover:scale-105 flex-shrink-0"
                  title="Stations"
                >
                  <div className="flex items-center gap-1 md:gap-1.5">
                    <Users size={12} className="text-white" />
                    <span className="hidden md:inline text-xs font-black text-white">Stations</span>
                  </div>
                </button>
                
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

      {/* Publish Release Modal */}
      {showPublishModal && (
        <CombineMediaModal
          isOpen={showPublishModal}
          onClose={() => {
            setShowPublishModal(false)
            // Refresh profile data
          }}
        />
      )}

      {/* Upload Content Modal */}
      {showUploadModal && (
        <ProfileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={() => {
            fetchProfileData()
          }}
        />
      )}

      {/* Stations Modal */}
      {showStationsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-cyan-950/30 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-3">My Stations</h2>
            <p className="text-gray-400 mb-6 text-sm">Feature coming soon! Create and manage your custom radio stations.</p>
            <button
              onClick={() => setShowStationsModal(false)}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg transition-all hover:scale-105 font-bold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
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

      {/* Floating Navigation Button */}
      <FloatingNavButton />

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  )
}
