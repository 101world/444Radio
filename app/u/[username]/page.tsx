'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Music, Video, Image as ImageIcon, Users, Upload } from 'lucide-react'
import FloatingMenu from '@/app/components/FloatingMenu'
import HolographicBackgroundClient from '@/app/components/HolographicBackgroundClient'
import ProfileUploadModal from '@/app/components/ProfileUploadModal'
import PrivateListModal from '@/app/components/PrivateListModal'

interface ProfileData {
  clerk_user_id: string
  username: string
  email?: string
  bio?: string
  avatar_url?: string
  credits?: number
  total_generated?: number
  follower_count?: number
  following_count?: number
  created_at?: string
  totalPlays: number
  songCount: number
  combinedMedia: CombinedMedia[]
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
  is_public: boolean
  created_at: string
  media_type: 'music-image' | 'image' | 'video'
  content_type?: string
}

interface ProfileData {
  clerk_user_id: string
  username: string
  totalPlays: number
  songCount: number
  combinedMedia: CombinedMedia[]
}

export default function UsernameProfilePage() {
  const params = useParams()
  const username = params.username as string
  const { user: currentUser } = useUser()
  
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPrivateListModal, setShowPrivateListModal] = useState(false)

  useEffect(() => {
    fetchProfileData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, currentUser])

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      // First get user ID from username
      const usernameRes = await fetch(`/api/profile/username/${username}`)
      const usernameData = await usernameRes.json()
      
      if (!usernameData.success || !usernameData.profile) {
        console.error('Profile not found')
        setLoading(false)
        return
      }

      const userId = usernameData.profile.clerk_user_id
      
      // Check if own profile
      if (currentUser) {
        setIsOwnProfile(currentUser.id === userId)
      }

      // Fetch media using same API as profile page
      const res = await fetch(`/api/media/profile/${userId}`)
      const data = await res.json()
      
      if (data.success) {
        setProfile({
          clerk_user_id: userId,
          username: data.username,
          totalPlays: data.totalPlays,
          songCount: data.trackCount,
          combinedMedia: data.combinedMedia
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center md:pl-20 md:pr-28">
        <div className="text-2xl">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center md:pl-20 md:pr-28">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">User Not Found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-32 md:pl-20 md:pr-28">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Combined Media Grid - Desktop layout for all screen sizes */}
      <main className="pt-20 px-3 md:px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Grid Layout - Same 6 columns on all devices (desktop layout everywhere) */}
          <div className="grid grid-cols-6 gap-3 md:gap-4">
            
            {profile.combinedMedia.length === 0 ? (
              <div className="col-span-full text-center py-20">
                <Music size={64} className="mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400 text-lg">No content yet</p>
              </div>
            ) : (
              profile.combinedMedia.map((media) => {
                const mediaType = media.media_type || media.content_type
                const thumbnailUrl = media.image_url || media.video_url
                
                return (
                <div key={media.id} className="group relative">
                  {/* 3D Glassmorphism Card */}
                  <div className="relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#5a8fc7]/20 hover:border-[#5a8fc7]/30">
                    {/* Thumbnail */}
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
                      <div className="w-full h-full bg-gradient-to-br from-[#4f46e5]/20 to-[#818cf8]/20 flex items-center justify-center">
                        <Music size={48} className="text-[#818cf8]" />
                      </div>
                    )}
                    
                    {/* Media Type Badge */}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 backdrop-blur-xl border border-[#6366f1]/30 rounded-full text-xs font-bold text-white flex items-center gap-1">
                      {mediaType === 'music-image' && (
                        <>
                          <Music size={12} />
                          <span>Track</span>
                        </>
                      )}
                      {mediaType === 'image' && (
                        <>
                          <ImageIcon size={12} />
                          <span>Image</span>
                        </>
                      )}
                      {mediaType === 'video' && (
                        <>
                          <Video size={12} />
                          <span>Video</span>
                        </>
                      )}
                    </div>
                    
                    {/* Published Badge */}
                    {media.is_public && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-green-600/80 backdrop-blur-xl border border-green-500/30 rounded-full text-xs font-bold text-white">
                        Published
                      </div>
                    )}
                    
                    {/* Title Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <p className="text-white text-sm font-bold line-clamp-2">{media.title}</p>
                    </div>
                  </div>
                </div>
                )
              })
            )}
            
          </div>
        </div>
      </main>

      {/* Bottom-Docked Badge with Username and Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-3 shadow-2xl">
            <div className="flex items-center justify-between px-4">
              {/* Left: Username + PRVTLST + Upload (if own) */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white">
                  @{profile.username}
                </span>
                
                {/* PRVTLST Button */}
                <div className="w-px h-4 bg-white/20"></div>
                <button 
                  onClick={() => setShowPrivateListModal(true)}
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
                      className="p-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#5558e3] hover:to-[#7078ef] rounded-full transition-all shadow-lg hover:scale-110"
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
                  <span className="text-sm font-black text-white">{profile.songCount || 0}</span>
                  <span className="text-xs text-gray-400">Tracks</span>
                </div>
                
                {/* Divider */}
                <div className="w-px h-4 bg-white/20"></div>
                
                {/* Plays Count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{profile.totalPlays || 0}</span>
                  <span className="text-xs text-gray-400">Plays</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Private List Modal */}
      {showPrivateListModal && (
        <PrivateListModal
          isOpen={showPrivateListModal}
          onClose={() => setShowPrivateListModal(false)}
          artistId={profile.clerk_user_id}
          isOwnProfile={isOwnProfile}
        />
      )}
    </div>
  )
}
