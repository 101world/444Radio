'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import { Music, Heart, Play, Calendar, Layers } from 'lucide-react'
import CombinedMediaPlayer from '@/app/components/CombinedMediaPlayer'

interface UserProfile {
  clerk_user_id: string
  username: string
  email: string
  bio?: string
  avatar_url?: string
  credits: number
  total_generated: number
  follower_count: number
  following_count: number
  created_at: string
}

interface CombinedMedia {
  id: string
  title: string
  audio_url: string
  image_url: string
  audio_prompt: string
  image_prompt: string
  is_public: boolean
  likes: number
  plays: number
  created_at: string
}

export default function UsernameProfilePage() {
  const params = useParams()
  const username = params.username as string
  const { user: currentUser } = useUser()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [combinedMedia, setCombinedMedia] = useState<CombinedMedia[]>([])
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/profile/username/${username}`)
        const data = await res.json()
        
        if (data.success) {
          setProfile(data.profile)
          setCombinedMedia(data.combinedMedia || [])
          setIsOwnProfile(data.isOwnProfile)
        } else {
          console.error('Profile not found')
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error)
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      fetchProfile()
    }
  }, [username])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white flex items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">User Not Found</h1>
          <Link href="/" className="text-green-400 hover:text-green-300">
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/20 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg">🎵</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">444RADIO</span>
        </Link>
        <div className="flex items-center gap-4">
          <SignedIn>
            <Link href="/explore" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">Explore</Link>
            <Link href="/billboard" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">Charts</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="px-6 py-2 text-green-400 hover:text-green-300 font-medium">Sign In</Link>
            <Link href="/sign-up" className="px-6 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform">Join Free</Link>
          </SignedOut>
        </div>
      </nav>

      {/* Profile Header */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="backdrop-blur-xl bg-black/40 border border-green-500/20 rounded-3xl p-8 mb-8">
          <div className="flex items-start gap-8">
            {/* Avatar */}
            <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-cyan-400 rounded-full flex items-center justify-center text-5xl font-bold text-black">
              {profile.username?.charAt(0).toUpperCase() || '?'}
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <h1 className="text-4xl font-bold text-green-400">@{profile.username}</h1>
                {isOwnProfile && (
                  <Link 
                    href={`/profile/${profile.clerk_user_id}`}
                    className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
                  >
                    Edit Profile
                  </Link>
                )}
              </div>

              {profile.bio && (
                <p className="text-green-100/80 mb-6">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="flex gap-8 mb-6">
                <div>
                  <div className="text-2xl font-bold text-green-400">{profile.total_generated}</div>
                  <div className="text-sm text-green-100/60">Generations</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">{profile.follower_count}</div>
                  <div className="text-sm text-green-100/60">Followers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">{profile.following_count}</div>
                  <div className="text-sm text-green-100/60">Following</div>
                </div>
                {isOwnProfile && (
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">⚡{profile.credits}</div>
                    <div className="text-sm text-green-100/60">Credits</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-green-100/60">
                <Calendar size={16} />
                <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Combined Media / Releases */}
        <div>
          <h2 className="text-3xl font-bold mb-6 text-green-400 flex items-center gap-3">
            <Layers size={32} />
            {isOwnProfile ? 'Your Releases' : `${profile.username}'s Releases`}
          </h2>

          {combinedMedia.length === 0 ? (
            <div className="text-center py-16 backdrop-blur-xl bg-purple-500/5 border-2 border-dashed border-purple-500/30 rounded-3xl">
              <Layers size={64} className="mx-auto mb-4 text-purple-400/40" />
              <p className="text-purple-400/60 mb-2">No releases yet</p>
              {isOwnProfile && (
                <p className="text-sm text-purple-400/40">
                  Go to Library → Combine music with cover art → Publish to Explore
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {combinedMedia.map((media) => (
                <div
                  key={media.id}
                  className="backdrop-blur-xl bg-purple-500/5 border border-purple-500/20 rounded-2xl overflow-hidden hover:border-purple-500/40 transition-all hover:scale-105"
                >
                  <CombinedMediaPlayer
                    audioUrl={media.audio_url}
                    imageUrl={media.image_url}
                    audioPrompt={media.audio_prompt}
                    title={media.title || media.audio_prompt?.substring(0, 50) || 'Untitled'}
                  />
                  
                  {/* Stats */}
                  <div className="px-4 pb-4 flex items-center gap-4 text-sm text-purple-100/60">
                    <div className="flex items-center gap-1">
                      <Play size={16} />
                      <span>{media.plays || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart size={16} />
                      <span>{media.likes || 0}</span>
                    </div>
                    {!media.is_public && isOwnProfile && (
                      <div className="ml-auto px-2 py-1 bg-purple-500/80 rounded-lg text-xs font-bold">
                        🔒 Private
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
