'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { use } from 'react'
import { Play, Pause, Heart, MessageCircle, Radio, Grid, List as ListIcon, Upload, Edit2, Users, MapPin, Calendar, ExternalLink, Video, Mic, Send, Smile, Settings, Music, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAudioPlayer } from '../../contexts/AudioPlayerContext'
import FloatingMenu from '../../components/FloatingMenu'
import BannerUploadModal from '../../components/BannerUploadModal'
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
  const { playTrack, setPlaylist, currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()

  // Profile State
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)

  // View State
  const [activeView, setActiveView] = useState<'profile' | 'station'>('profile')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Station State
  const [isLive, setIsLive] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [viewerCount, setViewerCount] = useState(0)

  // Modals
  const [showBannerUpload, setShowBannerUpload] = useState(false)
  const [showAvatarUpload, setShowAvatarUpload] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  
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
            .from('follows')
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

        // Check live status from live_stations table
        const { data: liveData } = await supabase
          .from('live_stations')
          .select('is_live, listener_count')
          .eq('user_id', userId)
          .single()

        // Set profile data
        setProfile({
          userId: userData.clerk_user_id,
          username: userData.username || 'Anonymous',
          fullName: userData.username || 'User',
          bio: userData.bio || 'No bio yet',
          avatar_url: userData.avatar_url || '/default-avatar.png',
          banner_url: sanitizeUrl(userData.banner_url) || '/default-banner.jpg',
          follower_count: userData.follower_count || 0,
          following_count: userData.following_count || 0,
          location: userData.location || '',
          joined_date: userData.created_at,
          website: userData.website || '',
          social_links: userData.social_links || {},
          is_live: liveData?.is_live || false
        })

        console.log('🖼️ Banner URL loaded:', userData.banner_url, '→ sanitized:', sanitizeUrl(userData.banner_url))

        // Update station state
        setIsLive(liveData?.is_live || false)
        setViewerCount(liveData?.listener_count || 0)

        setTracks(tracksData.map((t: any) => ({
          id: t.id,
          title: t.title || 'Untitled',
          audio_url: t.audio_url,
          image_url: t.image_url || '/default-cover.jpg',
          duration: t.duration || 0,
          plays: t.plays || 0,
          likes: t.likes || 0,
          created_at: t.created_at,
          user_id: t.user_id,
          genre: t.genre || 'Unknown'
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

  // Load chat messages when viewing station tab
  useEffect(() => {
    async function loadChatMessages() {
      if (activeView !== 'station') return

      try {
        const { data: stationData } = await supabase
          .from('live_stations')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (!stationData) return

        const response = await fetch(`/api/station/messages?stationId=${stationData.id}&limit=50`)
        const data = await response.json()

        if (data.success && data.messages) {
          const messages: ChatMessage[] = data.messages.map((m: any) => ({
            id: m.id,
            user_id: m.user_id,
            username: m.username,
            avatar: '/default-avatar.png',
            message: m.message,
            timestamp: new Date(m.created_at)
          }))
          setChatMessages(messages)
          console.log(`✅ Loaded ${messages.length} chat messages`)
        }
      } catch (error) {
        console.error('❌ Load chat messages error:', error)
      }
    }

    loadChatMessages()
  }, [activeView, userId])

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

  // Handle Banner Upload Success
  const handleBannerSuccess = async (url: string, type?: 'image' | 'video') => {
    console.log('[Banner] Upload success:', url, type)
    const cleanUrl = sanitizeUrl(url)
    setProfile(prev => prev ? { ...prev, banner_url: cleanUrl } : null)
    setShowBannerUpload(false)
    // Refresh profile data to confirm
    const { data } = await supabase
      .from('users')
      .select('banner_url')
      .eq('clerk_user_id', userId)
      .single()
    if (data) {
      setProfile(prev => prev ? { ...prev, banner_url: sanitizeUrl(data.banner_url) } : null)
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
    // Map track properties to AudioPlayerContext format
    const audioPlayerTrack = {
      id: track.id,
      title: track.title,
      audioUrl: track.audio_url,
      imageUrl: track.image_url,
      artist: profile?.username,
      userId: track.user_id
    }
    
    const audioPlayerTracks = tracks.map(t => ({
      id: t.id,
      title: t.title,
      audioUrl: t.audio_url,
      imageUrl: t.image_url,
      artist: profile?.username,
      userId: t.user_id
    }))
    
    setPlaylist(audioPlayerTracks)
    playTrack(audioPlayerTrack)
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <ProfileHeaderSkeleton />
        <div className="px-8 pb-32">
          <TrackListSkeleton count={8} />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-400 text-xl">Profile not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <FloatingMenu />

      {/* Banner Section */}
      <div className="relative h-80 bg-gradient-to-br from-cyan-900/20 to-black overflow-hidden group">
        {profile.banner_url && profile.banner_url.trim() && profile.banner_url !== '/default-banner.jpg' ? (
          <img
            src={profile.banner_url}
            alt="Profile Banner"
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            onError={(e) => {
              console.error('Banner load error:', profile.banner_url)
              // Hide broken image and show gradient fallback
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-purple-900/10 to-black" />
        )}
        {isOwnProfile && (
          <button
            onClick={() => setShowBannerUpload(true)}
            className="absolute top-4 right-4 px-4 py-2 bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
          >
            <Upload size={16} className="inline mr-2" />
            Change Banner
          </button>
        )}
      </div>

      {/* Profile Status Bar */}
      <div className="relative -mt-24 px-8 pb-8">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-40 h-40 rounded-full border-4 border-black overflow-hidden bg-gradient-to-br from-cyan-500 to-cyan-600">
              <Image
                src={profile.avatar_url}
                alt={profile.username}
                width={160}
                height={160}
                className="w-full h-full object-cover"
              />
            </div>
            {isOwnProfile && (
              <button
                onClick={() => setShowAvatarUpload(true)}
                className="absolute bottom-0 right-0 w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center text-black hover:bg-cyan-400 transition-all opacity-0 group-hover:opacity-100"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            <div className="bg-black/60 backdrop-blur-md border border-cyan-500/20 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Name & Username */}
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">{profile.fullName}</h1>
                  <p className="text-cyan-400">@{profile.username}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  {isOwnProfile ? (
                    <button
                      onClick={() => {
                        // Initialize form with current values
                        setEditFullName(profile?.username || '')
                        setEditBio(profile?.bio || '')
                        setShowEditProfile(true)
                      }}
                      className="px-6 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all"
                    >
                      <Edit2 size={16} className="inline mr-2" />
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={handleFollowToggle}
                      className={`px-6 py-2 rounded-lg font-bold transition-all ${
                        isFollowing
                          ? 'bg-white/10 border border-white/20 hover:bg-white/20'
                          : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500'
                      }`}
                    >
                      {isFollowing ? 'Following' : '+ Follow'}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/station?dj=${profile.username || user?.username}`)}
                    className={`px-6 py-2 rounded-lg font-bold transition-all ${
                      profile.is_live
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse'
                        : 'bg-white/10 border border-white/20 hover:bg-white/20'
                    }`}
                  >
                    <Radio size={16} className="inline mr-2" />
                    {profile.is_live ? 'LIVE NOW' : 'Go to Station'}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10">
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{tracks.length}</div>
                  <div className="text-sm text-gray-400">Tracks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{profile.follower_count}</div>
                  <div className="text-sm text-gray-400">Followers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{profile.following_count}</div>
                  <div className="text-sm text-gray-400">Following</div>
                </div>
              </div>

              {/* Bio */}
              <p className="mt-4 text-gray-300">
                {profile.bio || 'No bio yet'}
              </p>

              {/* Location & Joined */}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                {profile.location && (
                  <span>
                    <MapPin size={14} className="inline mr-1" />
                    {profile.location}
                  </span>
                )}
                <span>
                  <Calendar size={14} className="inline mr-1" />
                  Joined {new Date(profile.joined_date).toLocaleDateString()}
                </span>
              </div>

              {/* Social Links */}
              {Object.keys(profile.social_links).length > 0 && (
                <div className="flex items-center gap-3 mt-3">
                  {profile.social_links.twitter && (
                    <a href={profile.social_links.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-cyan-400">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {activeView === 'profile' ? (
        <div className="px-8 pb-32">
          {/* View Toggle */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Releases</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-cyan-500 text-black' : 'bg-white/10'}`}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-cyan-500 text-black' : 'bg-white/10'}`}
              >
                <ListIcon size={20} />
              </button>
            </div>
          </div>

          {/* Track Grid/List */}
          {tracks.length === 0 ? (
            <div className="text-center py-20">
              <Music size={64} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No tracks yet</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="group relative bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => handlePlayTrack(track)}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={track.image_url}
                      alt={track.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {currentTrack?.id === track.id && isPlaying ? (
                        <Pause size={48} className="text-white" />
                      ) : (
                        <Play size={48} className="text-white" />
                      )}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm truncate">{track.title}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                      <span>{track.plays} plays</span>
                      <span>{track.likes} likes</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
                  onClick={() => handlePlayTrack(track)}
                >
                  <div className="text-gray-400 w-8">{index + 1}</div>
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={track.image_url}
                      alt={track.title}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{track.title}</h3>
                    <p className="text-sm text-gray-400">{track.genre}</p>
                  </div>
                  <div className="text-sm text-gray-400">{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</div>
                  <div className="text-sm text-gray-400">{track.plays} plays</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePlayTrack(track)
                    }}
                    className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {currentTrack?.id === track.id && isPlaying ? (
                      <Pause size={16} className="text-black" />
                    ) : (
                      <Play size={16} className="text-black ml-0.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Station View - Redirect to comprehensive station page */
        <div className="px-8 pb-32">
          <div className="max-w-4xl mx-auto text-center py-20">
            <div className="w-32 h-32 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mb-8 mx-auto animate-pulse">
              <Radio size={64} />
            </div>
            <h2 className="text-4xl font-bold mb-4">Visit the Station Page</h2>
            <p className="text-gray-400 mb-8 text-lg">
              All streaming features are now on the dedicated station page with live chat, reactions, analytics, and more!
            </p>
            <button
              onClick={() => router.push(`/station?dj=${profile.username || user?.username}`)}
              className="px-12 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-xl font-bold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all shadow-2xl shadow-cyan-500/50 inline-flex items-center gap-3"
            >
              <Radio size={24} />
              Go to Station Page
            </button>
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="p-6 bg-white/5 rounded-xl">
                <div className="text-3xl mb-2">🎥</div>
                <h3 className="font-bold mb-1">Live Streaming</h3>
                <p className="text-sm text-gray-400">WebRTC video & audio</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl">
                <div className="text-3xl mb-2">💬</div>
                <h3 className="font-bold mb-1">Live Chat</h3>
                <p className="text-sm text-gray-400">Real-time messages</p>
              </div>
              <div className="p-6 bg-white/5 rounded-xl">
                <div className="text-3xl mb-2">❤️</div>
                <h3 className="font-bold mb-1">Reactions</h3>
                <p className="text-sm text-gray-400">Floating emojis</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner Upload Modal */}
      <BannerUploadModal
        isOpen={showBannerUpload}
        onClose={() => setShowBannerUpload(false)}
        onSuccess={handleBannerSuccess}
      />

      {/* Avatar Upload Modal */}
      <ProfileUploadModal
        isOpen={showAvatarUpload}
        onClose={() => setShowAvatarUpload(false)}
        onUploadComplete={handleAvatarSuccess}
      />

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full shadow-2xl shadow-cyan-500/20 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-cyan-400">Edit Profile</h3>
              <button
                onClick={() => setShowEditProfile(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <Edit2 size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Username */}
              <div>
                <label htmlFor="edit-username" className="block text-sm text-gray-400 mb-2">Username</label>
                <input
                  type="text"
                  id="edit-username"
                  name="username"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-white"
                  placeholder="Your username"
                />
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="edit-bio" className="block text-sm text-gray-400 mb-2">Bio</label>
                <textarea
                  id="edit-bio"
                  name="bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-white resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-all font-semibold"
                disabled={isUpdatingProfile}
              >
                Cancel
              </button>
              <button
                onClick={handleEditProfileSubmit}
                disabled={isUpdatingProfile}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all font-bold shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner Upload Modal */}
      {showBannerUpload && (
        <BannerUploadModal
          isOpen={showBannerUpload}
          onClose={() => setShowBannerUpload(false)}
          onSuccess={handleBannerSuccess}
        />
      )}

      {/* Avatar Upload Modal */}
      {showAvatarUpload && (
        <ProfileUploadModal
          isOpen={showAvatarUpload}
          onClose={() => setShowAvatarUpload(false)}
          onUploadComplete={handleAvatarSuccess}
        />
      )}
    </div>
  )
}
