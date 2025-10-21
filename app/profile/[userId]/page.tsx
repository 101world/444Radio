'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'
import FloatingMenu from '../../components/FloatingMenu'
import HolographicBackground from '../../components/HolographicBackgroundClient'
import { Edit2, Grid, List, Upload, Music, Video, Image as ImageIcon, Users, Radio, UserPlus } from 'lucide-react'
import CombineMediaModal from '../../components/CombineMediaModal'
import ProfileUploadModal from '../../components/ProfileUploadModal'
import PrivateListModal from '../../components/PrivateListModal'
import { getDisplayUsername } from '../../../lib/username'

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
          combinedMedia: data.combinedMedia
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Holographic 3D Background */}
      <HolographicBackground />
      
      {/* 444 Radio Top Bar - Fixed */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-cyan-500/30">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <img 
              src="/radio-logo.svg" 
              alt="444 Radio" 
              className="w-8 h-8" 
              style={{ filter: 'drop-shadow(0 0 10px rgba(34, 211, 238, 0.8))' }}
            />
            <span className="text-xl font-black bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
              444 Radio
            </span>
          </Link>
          <FloatingMenu />
        </div>
      </div>

      {/* Profile Header - Compact & Modern */}
      <div className="relative z-10 pt-16">
        <div className="bg-gradient-to-b from-cyan-500/10 to-transparent border-b border-cyan-500/20 px-4 py-4">
          <div className="flex items-center gap-3">
            {/* Avatar - Compact */}
            <div className="relative">
              {profile?.avatar || currentUser?.imageUrl ? (
                <img 
                  src={profile?.avatar || currentUser?.imageUrl} 
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500 shadow-lg shadow-cyan-500/50"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center text-2xl font-black text-white">
                  {profile?.username?.[0]?.toUpperCase() || currentUser?.firstName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              {isOwnProfile && (
                <button className="absolute -bottom-1 -right-1 p-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full hover:scale-110 transition-transform">
                  <Edit2 size={12} className="text-white" />
                </button>
              )}
            </div>
            
            {/* Info - Compact */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white truncate">
                  @{getDisplayUsername(
                    profile?.username,
                    currentUser?.username,
                    currentUser?.firstName,
                    currentUser?.emailAddresses?.[0]?.emailAddress
                  )}
                </h1>
                <span className="text-xs font-bold text-cyan-400 flex-shrink-0">
                  {profile?.followerCount || 0} followers
                </span>
              </div>
              <p className="text-xs text-cyan-400 italic truncate">
                &quot;{profile?.tagline || "Creating the future of music"}&quot;
              </p>
              
              {/* Stats - Inline */}
              <div className="flex items-center gap-4 mt-1 text-xs">
                <div className="flex items-center gap-1">
                  <Music size={14} className="text-cyan-400" />
                  <span className="font-bold text-white">{profile?.songCount || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>▶️</span>
                  <span className="font-bold text-white">{profile?.totalPlays || 0}</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              {!isOwnProfile ? (
                <button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-4 py-2 ${isFollowing ? 'bg-white/10' : 'bg-gradient-to-r from-cyan-600 to-blue-600'} rounded-lg font-bold text-xs transition-all hover:scale-105`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setShowStationsModal(true)}
                    className="p-2 bg-cyan-600/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-600/30 transition-all"
                  >
                    <Radio size={16} className="text-cyan-400" />
                  </button>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg font-bold text-xs hover:scale-105 transition-all"
                  >
                    <Upload size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation - Minimal */}
      <div className="sticky top-16 z-40 bg-black/90 backdrop-blur-xl border-b border-cyan-500/20">
        <div className="flex">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 px-4 py-3 font-bold text-sm transition-all ${
              activeTab === 'feed'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab('stations')}
            className={`flex-1 px-4 py-3 font-bold text-sm transition-all ${
              activeTab === 'stations'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            Stations
          </button>
        </div>
      </div>

      {/* Feed/Stations Content - No padding, full bleed */}
      <main className="relative z-10 pb-20">
          
          {activeTab === 'feed' ? (
            <>
              {/* Photo/Video-Focused Masonry Grid */}
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="aspect-square bg-cyan-950/50 animate-pulse border-[0.5px] border-cyan-500/10"></div>
                  ))}
                </div>
              ) : profile?.combinedMedia && profile.combinedMedia.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {profile.combinedMedia.map((media, index) => {
                    const mediaType = media.media_type || media.content_type || 'music-image'
                    const thumbnailUrl = media.image_url || media.video_url
                    
                    return (
                      <div key={media.id} className="group relative aspect-square overflow-hidden border-[0.5px] border-cyan-500/10 hover:border-cyan-500/50 transition-all">
                        {/* Media Background */}
                        {thumbnailUrl ? (
                          mediaType === 'video' ? (
                            <video 
                              src={media.video_url} 
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                              onMouseEnter={(e) => e.currentTarget.play()}
                              onMouseLeave={(e) => e.currentTarget.pause()}
                            />
                          ) : (
                            <img 
                              src={thumbnailUrl} 
                              alt={media.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                          )
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-950 to-black flex items-center justify-center">
                            <Music size={40} className="text-cyan-500/30" />
                          </div>
                        )}
                        
                        {/* Hover Overlay with Info */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                          <h3 className="text-sm font-bold text-white mb-1 line-clamp-2">{media.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-cyan-400">
                            <span className="flex items-center gap-1">
                              ▶️ {media.plays || media.views || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              ❤️ {media.likes || 0}
                            </span>
                          </div>
                        </div>
                        
                        {/* Media Type Badge */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {mediaType === 'video' ? (
                            <div className="p-1.5 bg-cyan-500/90 rounded-full">
                              <Video size={12} className="text-white" />
                            </div>
                          ) : mediaType === 'image' ? (
                            <div className="p-1.5 bg-cyan-500/90 rounded-full">
                              <ImageIcon size={12} className="text-white" />
                            </div>
                          ) : (
                            <div className="p-1.5 bg-cyan-500/90 rounded-full">
                              <Music size={12} className="text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
    </div>
  )
}
