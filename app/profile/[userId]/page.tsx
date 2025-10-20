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

interface ProfileData {
  username: string
  email: string
  bio?: string
  totalLikes: number
  totalPlays: number
  songCount: number
  songs: Song[]
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
    // TODO: Fetch profile data from API
    setLoading(false)
  }, [currentUser, resolvedParams.userId])

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Modern Floating Header - Spotify/Apple Music Style */}
      <div className="pt-20 px-4 md:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Floating Profile Card */}
          <div className="relative">
            {/* Blur Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#2d4a6e]/30 via-[#3d5a7e]/20 to-[#5a8fc7]/30 blur-3xl -z-10"></div>
            
            {/* Main Profile Card */}
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
                {/* Avatar with Glow */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#5a8fc7] to-[#2d4a6e] blur-2xl opacity-50 group-hover:opacity-70 transition-opacity rounded-full"></div>
                  <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-[#5a8fc7] to-[#2d4a6e] border-4 border-white/20 flex items-center justify-center text-6xl md:text-7xl shadow-2xl">
                    {currentUser?.imageUrl ? (
                      <img 
                        src={currentUser.imageUrl} 
                        alt={currentUser?.username || 'User'} 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      '🎵'
                    )}
                  </div>
                </div>

                {/* Profile Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center md:items-center gap-3 mb-3">
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                      @{profile?.username || currentUser?.username || 'username'}
                    </h1>
                    {isOwnProfile && (
                      <button className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-full text-sm text-white font-semibold transition-all flex items-center gap-2">
                        <Edit2 size={14} />
                        Edit
                      </button>
                    )}
                  </div>
                  
                  {/* Stats - Modern Pills */}
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-6">
                    <div className="px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full">
                      <span className="text-2xl font-black text-white">{profile?.songCount || 0}</span>
                      <span className="text-sm text-gray-400 ml-2">Tracks</span>
                    </div>
                    <div className="px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full">
                      <span className="text-2xl font-black text-white">{profile?.totalPlays || 0}</span>
                      <span className="text-sm text-gray-400 ml-2">Plays</span>
                    </div>
                  </div>

                  {/* Publish Release Button */}
                  {isOwnProfile && (
                    <button 
                      onClick={() => setShowPublishModal(true)}
                      className="group px-8 py-4 bg-gradient-to-r from-[#2d4a6e] to-[#3d5a7e] hover:from-[#3d5a7e] hover:to-[#5a8fc7] rounded-full text-white font-bold transition-all flex items-center gap-3 mx-auto md:mx-0 shadow-lg shadow-[#2d4a6e]/50 hover:shadow-[#5a8fc7]/50 hover:scale-[1.02]"
                    >
                      <Upload size={20} />
                      <span>Publish Release</span>
                      <div className="w-2 h-2 rounded-full bg-white/60 group-hover:bg-white animate-pulse"></div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Combined Media Grid - Compact with minimal padding */}
      <main className="px-3 md:px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : profile?.songs && profile.songs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
              {profile.songs.map((song) => (
                <div key={song.id} className="group relative">
                  {/* 3D Glassmorphism Card */}
                  <div className="relative aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#5a8fc7]/20 hover:border-[#5a8fc7]/30">
                    <img 
                      src={song.coverUrl} 
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Info Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                      <p className="text-xs font-bold text-white truncate">{song.title}</p>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>{song.genre}</span>
                        <div className="flex gap-2">
                          <span>▶️ {song.plays}</span>
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
