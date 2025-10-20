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
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Holographic 3D Background */}
      <HolographicBackground />
      
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Profile Header Section */}
      <div className="relative z-10 pt-24 px-4 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto">
          {/* Profile Info Card */}
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-start gap-6">
              {/* Profile Avatar & Info */}
              <div className="flex flex-col items-center md:items-start gap-4">
                <div className="relative">
                  {profile?.avatar || currentUser?.imageUrl ? (
                    <img 
                      src={profile?.avatar || currentUser?.imageUrl} 
                      alt="Profile"
                      className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-cyan-500 shadow-2xl shadow-cyan-500/50"
                    />
                  ) : (
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center text-5xl md:text-6xl font-black text-white shadow-2xl shadow-cyan-500/50">
                      {profile?.username?.[0]?.toUpperCase() || currentUser?.firstName?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  {isOwnProfile && (
                    <button className="absolute bottom-0 right-0 p-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-full hover:scale-110 transition-transform shadow-lg">
                      <Edit2 size={18} className="text-white" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Profile Details */}
              <div className="flex-1 w-full">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-2">
                      @{profile?.username && !profile.username.startsWith('user_') 
                        ? profile.username 
                        : (currentUser?.username || currentUser?.firstName || currentUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'user')}
                      <sup className="text-lg md:text-2xl font-bold text-cyan-400 ml-1">
                        {profile?.followerCount || 0}
                      </sup>
                    </h1>
                    <p className="text-lg md:text-xl text-cyan-400 font-semibold mb-3 italic">
                      "{profile?.tagline || "Creating the future of music"}"
                    </p>
                    <p className="text-gray-400 text-sm md:text-base mb-4 max-w-2xl">
                      {profile?.bio || "Music creator and innovator on 444 Radio. Exploring new sounds and pushing boundaries."}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {!isOwnProfile ? (
                      <button 
                        onClick={() => setIsFollowing(!isFollowing)}
                        className={`px-6 py-3 ${isFollowing ? 'bg-white/10 hover:bg-white/20' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'} rounded-xl transition-all shadow-lg hover:scale-105 font-bold text-sm`}
                      >
                        <div className="flex items-center gap-2">
                          <UserPlus size={18} />
                          <span>{isFollowing ? 'Following' : 'Follow'}</span>
                        </div>
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => setShowStationsModal(true)}
                          className="px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 rounded-xl transition-all shadow-lg hover:scale-105 font-bold text-sm"
                          title="My Stations"
                        >
                          <div className="flex items-center gap-2">
                            <Radio size={18} />
                            <span>STATIONS</span>
                          </div>
                        </button>
                        <button 
                          onClick={() => setShowUploadModal(true)}
                          className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all shadow-lg hover:scale-105 font-bold text-sm"
                          title="Upload Content"
                        >
                          <div className="flex items-center gap-2">
                            <Upload size={18} />
                            <span>UPLOAD</span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Stats Row */}
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Music size={20} className="text-cyan-400" />
                    <span className="text-2xl font-black text-white">{profile?.songCount || 0}</span>
                    <span className="text-sm text-gray-400">Tracks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">▶️</span>
                    <span className="text-2xl font-black text-white">{profile?.totalPlays || 0}</span>
                    <span className="text-sm text-gray-400">Plays</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="relative z-10 px-4 md:px-6 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex gap-2">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'feed'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Grid size={18} />
                <span>Feed</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('stations')}
              className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'stations'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Radio size={18} />
                <span>Stations</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Feed/Stations Content */}
      <main className="px-3 md:px-6 pb-32 relative z-10">
        <div className="max-w-7xl mx-auto">
          
          {activeTab === 'feed' ? (
            <>
              {/* Vertical Feed with Randomized Shapes */}
              {loading ? (
                <div className="space-y-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`h-96 bg-white/5 backdrop-blur-xl border border-white/10 ${getRandomShape(i)} animate-pulse`}></div>
                  ))}
                </div>
              ) : profile?.combinedMedia && profile.combinedMedia.length > 0 ? (
                <div className="space-y-6">
                  {profile.combinedMedia.map((media, index) => {
                    const mediaType = media.media_type || media.content_type || 'music-image'
                    const thumbnailUrl = media.image_url || media.video_url
                    const shapeClass = getRandomShape(index)
                    
                    return (
                      <div key={media.id} className="group relative">
                        {/* Vertical Feed Card with Random Shape */}
                        <div className={`relative h-96 bg-white/5 backdrop-blur-xl border border-white/10 ${shapeClass} overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/30 hover:border-cyan-500/50`}>
                          {/* Thumbnail Background */}
                          {thumbnailUrl ? (
                            mediaType === 'video' ? (
                              <video 
                                src={media.video_url} 
                                className="w-full h-full object-cover"
                                muted
                                loop
                                onMouseEnter={(e) => e.currentTarget.play()}
                                onMouseLeave={(e) => e.currentTarget.pause()}
                              />
                            ) : (
                              <img 
                                src={thumbnailUrl} 
                                alt={media.title}
                                className="w-full h-full object-cover"
                              />
                            )
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                              <Music size={64} className="text-cyan-400" />
                            </div>
                          )}
                          
                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                          
                          {/* Content */}
                          <div className="absolute inset-0 p-6 flex flex-col justify-between">
                            {/* Top Badges */}
                            <div className="flex items-start justify-between">
                              <div className="px-3 py-1.5 bg-black/80 backdrop-blur-xl border border-cyan-500/30 rounded-full text-sm font-bold text-white flex items-center gap-2">
                                {mediaType === 'music-image' && (
                                  <>
                                    <Music size={16} className="text-cyan-400" />
                                    <span>AI Generated Track</span>
                                  </>
                                )}
                                {mediaType === 'image' && (
                                  <>
                                    <ImageIcon size={16} className="text-cyan-400" />
                                    <span>AI Image</span>
                                  </>
                                )}
                                {mediaType === 'video' && (
                                  <>
                                    <Video size={16} className="text-cyan-400" />
                                    <span>AI Video</span>
                                  </>
                                )}
                              </div>
                              
                              {media.is_public && (
                                <div className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 backdrop-blur-xl rounded-full text-sm font-bold text-white shadow-lg">
                                  Published
                                </div>
                              )}
                            </div>
                            
                            {/* Bottom Info */}
                            <div>
                              <h3 className="text-2xl font-black text-white mb-2">{media.title}</h3>
                              <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                                {mediaType === 'music-image' && media.audio_prompt ? media.audio_prompt : 
                                 mediaType === 'image' && media.image_prompt ? media.image_prompt :
                                 'Created with AI'}
                              </p>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">▶️</span>
                                  <span className="text-white font-bold">{media.plays || media.views || 0}</span>
                                  <span className="text-gray-400">plays</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">❤️</span>
                                  <span className="text-white font-bold">{media.likes || 0}</span>
                                  <span className="text-gray-400">likes</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12">
                    <div className="text-6xl mb-6">🎵</div>
                    <h3 className="text-3xl font-black text-white mb-3">
                      {isOwnProfile ? 'No posts in your feed yet' : 'No posts yet'}
                    </h3>
                    <p className="text-gray-400 mb-8 text-lg">
                      {isOwnProfile ? 'Start creating and uploading your first masterpiece!' : 'Check back later for new content'}
                    </p>
                    {isOwnProfile && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-2xl transition-all shadow-lg hover:scale-105 font-bold text-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Upload size={20} />
                          <span>Upload Your First Track</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Stations Tab */
            <div className="text-center py-20">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12">
                <div className="text-6xl mb-6">📻</div>
                <h3 className="text-3xl font-black text-white mb-3">
                  {isOwnProfile ? 'No stations yet' : 'No stations'}
                </h3>
                <p className="text-gray-400 mb-8 text-lg">
                  {isOwnProfile ? 'Create your first station to curate your music!' : 'This user hasn\'t created any stations yet'}
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => setShowStationsModal(true)}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 rounded-2xl transition-all shadow-lg hover:scale-105 font-bold text-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Radio size={20} />
                      <span>Create Your First Station</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 max-w-2xl w-full">
            <h2 className="text-3xl font-black text-white mb-6">My Stations</h2>
            <p className="text-gray-400 mb-8">Feature coming soon! Create and manage your custom radio stations.</p>
            <button
              onClick={() => setShowStationsModal(false)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all shadow-lg hover:scale-105 font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
