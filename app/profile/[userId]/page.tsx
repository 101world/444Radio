'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'
import FloatingMenu from '../../components/FloatingMenu'
import HolographicBackground from '../../components/HolographicBackgroundClient'
import FloatingNavButton from '../../components/FloatingNavButton'
import { Edit2, Grid, List, Upload, Music, Video, Image as ImageIcon, Users, Radio, UserPlus, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react'
import CombineMediaModal from '../../components/CombineMediaModal'
import ProfileUploadModal from '../../components/ProfileUploadModal'
import PrivateListModal from '../../components/PrivateListModal'
import { getDisplayUsername, formatUsername } from '../../../lib/username'

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
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (currentUser) {
      setIsOwnProfile(currentUser.id === resolvedParams.userId)
    }
    fetchProfileData()
  }, [currentUser, resolvedParams.userId])

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

  const handlePlay = (media: CombinedMedia) => {
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
      <HolographicBackground />
      
      {/* Floating Menu */}
      <FloatingMenu />

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

                  {/* SECTION 3: LIST VIEW - All Tracks */}
                  <div className="px-6 py-4">
                    <h2 className="text-2xl font-bold mb-3 relative z-10">📀 All Tracks</h2>
                    
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
                      {/* LEFT SIDE: Full Track List with Duration */}
                      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-150px)] pr-4 custom-scrollbar">
                        <h2 className="text-2xl font-bold mb-4 sticky top-0 bg-black/90 backdrop-blur-xl py-3 z-10 border-b border-cyan-500/20">📀 All Tracks</h2>
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
                                  src={media.image_url} 
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

                      {/* RIGHT SIDE: Carousel + Recent Tracks Grid */}
                      <div className="space-y-6 sticky top-6 self-start">
                        {/* 1:1 Carousel */}
                        <div className="relative aspect-square overflow-hidden group rounded-2xl shadow-2xl border border-cyan-500/20">
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
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                                  {/* Track Title Overlay */}
                                  <div className="absolute bottom-0 left-0 right-0 p-6">
                                    <h3 className="text-xl font-bold text-white truncate">{media.title}</h3>
                                    <p className="text-sm text-cyan-400 mt-1">@{profile.username}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Carousel Navigation - Left */}
                          {carouselIndex > 0 && (
                            <button
                              onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 border border-white/10 z-10"
                            >
                              <ChevronLeft size={24} className="text-white" />
                            </button>
                          )}

                          {/* Carousel Navigation - Right */}
                          {carouselIndex < Math.min(profile.combinedMedia.length, 10) - 1 && (
                            <button
                              onClick={() => setCarouselIndex(prev => Math.min(Math.min(profile.combinedMedia.length, 10) - 1, prev + 1))}
                              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 border border-white/10 z-10"
                            >
                              <ChevronRight size={24} className="text-white" />
                            </button>
                          )}

                          {/* Carousel Indicators */}
                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                            {profile.combinedMedia.slice(0, 10).map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setCarouselIndex(index)}
                                className={`h-2 rounded-full transition-all ${
                                  index === carouselIndex 
                                    ? 'bg-cyan-400 w-8' 
                                    : 'bg-white/30 hover:bg-white/50 w-2'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Recent Tracks Grid - 1:1 Thumbnails */}
                        <div>
                          <h3 className="text-lg font-bold mb-3 text-gray-300">🎵 Recent Tracks</h3>
                          <div className="grid grid-cols-3 gap-3">
                            {profile.combinedMedia.slice(0, 9).map((media) => {
                              const isCurrentlyPlaying = playingId === media.id
                              const hasAudio = !!media.audio_url
                              
                              return (
                                <div 
                                  key={media.id} 
                                  className={`group cursor-pointer rounded-lg overflow-hidden transition-all aspect-square ${
                                    isCurrentlyPlaying ? 'ring-2 ring-cyan-400 scale-105' : 'hover:scale-105'
                                  } ${!hasAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onClick={() => hasAudio && handlePlay(media)}
                                >
                                  <div className="relative w-full h-full">
                                    <img 
                                      src={media.image_url} 
                                      alt={media.title}
                                      className="w-full h-full object-cover"
                                    />
                                    {hasAudio && (
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                                          {isCurrentlyPlaying && isPlaying ? (
                                            <Pause className="text-black" size={16} />
                                          ) : (
                                            <Play className="text-black ml-0.5" size={16} />
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {isCurrentlyPlaying && isPlaying && (
                                      <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-lg shadow-cyan-400/50"></div>
                                    )}
                                  </div>
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
                      <Radio size={16} />
                      <span>Create Station</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
      </main>

      {/* Bottom-Docked Badge with Username and Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-3 shadow-2xl">
            <div className="flex items-center justify-between px-4">
              {/* Left: Username + Stations + Upload (if own) */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white">
                  @{profile?.username || 'Loading...'}
                </span>
                
                {/* Stations Button */}
                <div className="w-px h-4 bg-white/20"></div>
                <button 
                  onClick={() => setShowStationsModal(true)}
                  className="px-3 py-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 rounded-full transition-all shadow-lg hover:scale-105"
                  title="Stations"
                >
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-white" />
                    <span className="text-xs font-black text-white">Stations</span>
                  </div>
                </button>
                
                {/* Upload Icon (Only for own profile) */}
                {isOwnProfile && (
                  <>
                    <div className="w-px h-4 bg-white/20"></div>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      className="p-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-full transition-all shadow-lg hover:scale-110"
                      title="Upload Content"
                    >
                      <Upload size={14} className="text-white" />
                    </button>
                  </>
                )}
              </div>
              
              {/* Right: Stats */}
              <div className="flex items-center gap-6">
                {/* Tracks Count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{profile?.songCount || 0}</span>
                  <span className="text-xs text-gray-400">Tracks</span>
                </div>
                
                {/* Divider */}
                <div className="w-px h-4 bg-white/20"></div>
                
                {/* Plays Count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{profile?.totalPlays || 0}</span>
                  <span className="text-xs text-gray-400">Plays</span>
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
