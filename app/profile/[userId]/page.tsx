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
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Compact Top Section */}
      <div className="pt-24 px-4 md:px-8 pb-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-black text-white mb-2">
            {profile?.username || currentUser?.username || 'Loading...'}
          </h1>
          {isOwnProfile && (
            <button 
              onClick={() => setShowPublishModal(true)}
              className="mt-4 px-6 py-3 bg-[#2d4a6e] hover:bg-[#3d5a7e] rounded-full text-white font-bold transition-all flex items-center gap-2 mx-auto shadow-lg shadow-[#2d4a6e]/50"
            >
              <Upload size={18} />
              Publish Release
            </button>
          )}
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

      {/* Bottom-Docked Profile Badge with Banner */}
      <div className="fixed bottom-0 left-0 right-0 p-3 z-40">
        <div className="max-w-7xl mx-auto">
          {/* Glassmorphism Banner */}
          <div className="bg-gradient-to-r from-[#2d4a6e]/80 via-[#3d5a7e]/80 to-[#2d4a6e]/80 backdrop-blur-2xl border border-[#5a8fc7]/30 rounded-2xl p-4 shadow-2xl shadow-[#2d4a6e]/50">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#5a8fc7] to-[#2d4a6e] border-2 border-white/20 flex items-center justify-center text-3xl shadow-lg">
                🎵
              </div>
              
              {/* Stats */}
              <div className="flex-1 flex gap-6">
                <div>
                  <div className="text-2xl font-black text-white">{profile?.songCount || 0}</div>
                  <div className="text-xs text-gray-300">Tracks</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{profile?.totalPlays || 0}</div>
                  <div className="text-xs text-gray-300">Plays</div>
                </div>
              </div>

              {/* Edit Profile Button (if own profile) */}
              {isOwnProfile && (
                <button className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 rounded-full text-white font-semibold transition-all flex items-center gap-2">
                  <Edit2 size={14} />
                  Edit
                </button>
              )}
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
