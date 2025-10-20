'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'
import FloatingMenu from '../../components/FloatingMenu'
import { Edit2, Grid, List, Upload } from 'lucide-react'
import CombineMediaModal from '../../components/CombineMediaModal'

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
  audio_url: string
  image_url: string
  audio_prompt: string
  image_prompt: string
  user_id: string
  likes: number
  plays: number
  is_public: boolean
  created_at: string
}

interface ProfileData {
  username: string
  email: string
  bio?: string
  totalLikes: number
  totalPlays: number
  songCount: number
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
          totalPlays: data.totalPlays,
          songCount: data.trackCount,
          totalLikes: 0,
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
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Combined Media Grid - More Space */}
      <main className="pt-20 px-3 md:px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : profile?.combinedMedia && profile.combinedMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {profile.combinedMedia.map((media) => (
                <div key={media.id} className="group relative">
                  {/* 3D Glassmorphism Card */}
                  <div className="relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#5a8fc7]/20 hover:border-[#5a8fc7]/30">
                    <img 
                      src={media.image_url} 
                      alt={media.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Published Badge */}
                    {media.is_public && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-[#2d4a6e]/90 backdrop-blur-xl border border-[#5a8fc7]/30 rounded-full text-xs font-bold text-white">
                        Published
                      </div>
                    )}
                    
                    {/* Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                      <p className="text-xs font-bold text-white truncate">{media.title}</p>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span className="truncate">{media.audio_prompt?.slice(0, 20)}...</span>
                        <div className="flex gap-2">
                          <span>▶️ {media.plays}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎵</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {isOwnProfile ? 'No releases yet' : 'No music yet'}
              </h3>
              <p className="text-gray-400 mb-8">
                {isOwnProfile ? 'Publish your first release!' : 'Check back later'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Bottom-Docked Stats with Username and Publish Icon */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full p-3 shadow-2xl">
            <div className="flex items-center justify-between px-4">
              {/* Left: Username */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-white">
                  @{profile?.username || currentUser?.username || 'username'}
                </span>
                
                {/* Publish Icon (Only for own profile) */}
                {isOwnProfile && (
                  <>
                    <div className="w-px h-4 bg-white/20"></div>
                    <button 
                      onClick={() => setShowPublishModal(true)}
                      className="p-2 bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#5558e3] hover:to-[#7078ef] rounded-full transition-all shadow-lg hover:scale-110"
                      title="Publish Release"
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
    </div>
  )
}
