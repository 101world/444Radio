'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'
import FloatingMenu from '../../components/FloatingMenu'
import { Edit2, Grid, List } from 'lucide-react'

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

  useEffect(() => {
    if (currentUser) {
      setIsOwnProfile(currentUser.id === resolvedParams.userId)
    }
    // TODO: Fetch profile data from API
    setLoading(false)
  }, [currentUser, resolvedParams.userId])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Profile Header */}
      <div className="relative pt-24">
        {/* Cover Banner */}
        <div className="h-64 bg-gradient-to-br from-[#2d4a6e]/20 to-[#3d5a7e]/20 border-b border-white/10"></div>
        
        {/* Profile Info */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-20">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* Avatar */}
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#2d4a6e] to-[#5a8fc7] border-4 border-black shadow-2xl flex items-center justify-center text-6xl">
              🎵
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-4xl font-black text-white">
                  {profile?.username || 'Loading...'}
                </h1>
                {isOwnProfile && (
                  <button className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white font-medium hover:bg-white/20 transition-all flex items-center gap-2">
                    <Edit2 size={16} />
                    Edit Profile
                  </button>
                )}
              </div>
              <p className="text-gray-400 mb-4">{profile?.email}</p>
              
              {/* Stats */}
              <div className="flex gap-8 mb-4">
                <div>
                  <div className="text-2xl font-bold text-white">{profile?.songCount || 0}</div>
                  <div className="text-sm text-gray-400">Tracks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#5a8fc7]">{profile?.totalLikes || 0}</div>
                  <div className="text-sm text-gray-400">Likes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{profile?.totalPlays || 0}</div>
                  <div className="text-sm text-gray-400">Plays</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User's Music Grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white">Music</h2>
          <div className="flex gap-2">
            <button className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all">
              <Grid size={20} className="mx-auto" />
            </button>
            <button className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg text-gray-400">
              <List size={20} className="mx-auto" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : profile?.songs && profile.songs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* REVERSED - Newest songs at bottom */}
            {[...profile.songs].reverse().map((song) => (
              <Link key={song.id} href={`/song/${song.id}`} className="group">
                <div className="relative aspect-square rounded-2xl overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 hover:border-[#2d4a6e]/50 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#2d4a6e]/20 to-[#5a8fc7]/20"></div>
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[#2d4a6e] hover:bg-[#3d5a7e] flex items-center justify-center mx-auto mb-4 transition-colors">
                        <span className="text-2xl text-white">▶</span>
                      </div>
                      <div className="text-white font-bold">{song.title}</div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between text-sm text-white">
                      <span className="font-semibold truncate">{song.genre}</span>
                      <div className="flex gap-3 text-gray-400">
                        <span>❤️ {song.likes}</span>
                        <span>▶️ {song.plays}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎵</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {isOwnProfile ? 'You haven\'t created any music yet' : 'No music yet'}
            </h3>
            <p className="text-gray-400 mb-8">
              {isOwnProfile ? 'Start creating your first track!' : 'Check back later'}
            </p>
            {isOwnProfile && (
              <Link href="/" className="inline-block px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all">
                Create Now
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
