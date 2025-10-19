'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import { use } from 'react'

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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/40 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg">♪</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            444RADIO
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium transition-colors">
            Create
          </Link>
          <Link href="/explore" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium transition-colors">
            Explore
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Profile Header */}
      <div className="relative">
        {/* Cover Banner */}
        <div className="h-64 bg-gradient-to-br from-green-500/20 to-cyan-500/20 border-b border-green-500/20"></div>
        
        {/* Profile Info */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-20">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* Avatar */}
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-green-400 to-cyan-400 border-4 border-black shadow-2xl shadow-green-500/50 flex items-center justify-center text-6xl">
              🎵
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-4xl font-black bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                  {profile?.username || 'Loading...'}
                </h1>
                {isOwnProfile && (
                  <button className="px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 font-medium hover:bg-green-500/20 transition-all">
                    Edit Profile
                  </button>
                )}
              </div>
              <p className="text-green-100/60 mb-4">{profile?.email}</p>
              
              {/* Stats */}
              <div className="flex gap-8 mb-4">
                <div>
                  <div className="text-2xl font-bold text-green-400">{profile?.songCount || 0}</div>
                  <div className="text-sm text-green-100/60">Tracks</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{profile?.totalLikes || 0}</div>
                  <div className="text-sm text-green-100/60">Likes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{profile?.totalPlays || 0}</div>
                  <div className="text-sm text-green-100/60">Plays</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User's Music Grid */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-green-400">Music</h2>
          <div className="flex gap-2">
            <button className="w-10 h-10 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/20 transition-all">
              ⊞
            </button>
            <button className="w-10 h-10 bg-green-500/20 border border-green-500/40 rounded-lg text-green-400">
              ▤
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-green-500/10 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : profile?.songs && profile.songs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ display: 'flex', flexDirection: 'column-reverse', flexWrap: 'wrap' }}>
            {/* REVERSED - Newest songs at bottom */}
            {[...profile.songs].reverse().map((song) => (
              <Link key={song.id} href={`/song/${song.id}`} className="group">
                <div className="relative aspect-square rounded-2xl overflow-hidden backdrop-blur-xl bg-black/40 border border-green-500/20 hover:border-green-500/40 transition-all">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-cyan-500/20"></div>
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">▶</span>
                      </div>
                      <div className="text-green-100 font-bold">{song.title}</div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between text-sm text-green-100">
                      <span className="font-semibold truncate">{song.genre}</span>
                      <div className="flex gap-3">
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
            <h3 className="text-2xl font-bold text-green-400 mb-2">
              {isOwnProfile ? 'You haven\'t created any music yet' : 'No music yet'}
            </h3>
            <p className="text-green-100/60 mb-8">
              {isOwnProfile ? 'Start creating your first track!' : 'Check back later'}
            </p>
            {isOwnProfile && (
              <Link href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform">
                Create Now
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
