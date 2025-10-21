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
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Holographic 3D Background */}
      <HolographicBackground />
      
      {/* Floating Menu */}
      <FloatingMenu />

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

      {/* Bottom-Docked Badge with Username and Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-3 shadow-2xl">
            <div className="flex items-center justify-between px-4">
              {/* Left: Username + PRVTLST + Upload (if own) */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white">
                  @{profile?.username || getDisplayUsername(
                    profile?.username,
                    currentUser?.username,
                    currentUser?.firstName,
                    currentUser?.emailAddresses?.[0]?.emailAddress
                  )}
                </span>
                
                {/* PRVTLST Button */}
                <div className="w-px h-4 bg-white/20"></div>
                <button 
                  onClick={() => setShowStationsModal(true)}
                  className="px-3 py-1 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 rounded-full transition-all shadow-lg hover:scale-105"
                  title="Private Lists"
                >
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-white" />
                    <span className="text-xs font-black text-white">PRVTLST</span>
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
    </div>
  )
}
