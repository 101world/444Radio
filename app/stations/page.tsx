'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Radio, Users, Play, ArrowLeft, Music, Circle } from 'lucide-react'
import Image from 'next/image'
import FloatingMenu from '../components/FloatingMenu'

interface LiveStation {
  id: string
  user_id: string
  username: string
  is_live: boolean
  listener_count: number
  current_track_title: string | null
  current_track_image: string | null
  profile_image: string | null
  started_at: string
}

export default function StationsPage() {
  const router = useRouter()
  const { user } = useUser()
  const [liveStations, setLiveStations] = useState<LiveStation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLiveStations()
    // Refresh every 10 seconds
    const interval = setInterval(fetchLiveStations, 10000)
    return () => clearInterval(interval)
  }, [])

  // ESC key to go back
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/explore')
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [router])

  const fetchLiveStations = async () => {
    try {
      const res = await fetch('/api/station')
      const data = await res.json()
      if (data.success && data.stations) {
        setLiveStations(data.stations)
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinStation = (userId: string) => {
    router.push(`/profile/${userId}`)
  }

  const goToMyStation = () => {
    if (!user) {
      router.push('/sign-in')
      return
    }
    router.push(`/profile/${user.id}`)
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-black pointer-events-none"></div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <FloatingMenu />

      <div className="max-w-7xl mx-auto relative z-10 px-4 md:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 md:mb-12">
          {/* Back Button */}
          <button
            onClick={() => router.push('/explore')}
            className="flex items-center gap-2 text-red-400/60 hover:text-red-400 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Explore</span>
            <span className="hidden md:inline text-xs text-gray-600">(ESC)</span>
          </button>

          {/* Go to My Station Button */}
          <button
            onClick={goToMyStation}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/30"
          >
            <Radio className="w-5 h-5" />
            <span>{user ? 'My Station' : 'Sign In to Broadcast'}</span>
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg shadow-red-500/50">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-red-400 via-pink-400 to-red-300 bg-clip-text text-transparent">
              Live Stations
            </h1>
          </div>
          <p className="text-red-400/60 text-base md:text-lg max-w-2xl mx-auto">
            Tune in to live broadcasts • Real-time music sharing • Connect with artists
          </p>
        </div>

        {/* Live Stations Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 animate-pulse">
                <div className="w-full h-48 bg-white/10 rounded-xl mb-4"></div>
                <div className="h-6 bg-white/10 rounded mb-2"></div>
                <div className="h-4 bg-white/10 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : liveStations.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold text-red-400 uppercase tracking-wide">
                {liveStations.length} {liveStations.length === 1 ? 'Station' : 'Stations'} Live Now
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStations.map((station) => (
                <div
                  key={station.id}
                  onClick={() => joinStation(station.user_id)}
                  className="group bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-2xl p-6 border border-red-500/20 hover:border-red-500/50 transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-red-500/20"
                >
                  {/* Header: Live Badge + Listeners */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 backdrop-blur-sm rounded-full border border-red-500/50">
                      <Circle className="w-2 h-2 fill-red-400 text-red-400 animate-pulse" />
                      <span className="text-red-400 text-xs font-bold uppercase tracking-wide">LIVE</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
                      <Users className="w-3.5 h-3.5 text-red-400/80" />
                      <span className="text-sm font-semibold text-white">{station.listener_count || 0}</span>
                    </div>
                  </div>

                  {/* Cover Image */}
                  <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-red-900/30 to-pink-900/30 shadow-lg">
                    {station.current_track_image ? (
                      <Image
                        src={station.current_track_image}
                        alt={station.current_track_title || 'Now playing'}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Radio className="w-16 h-16 text-red-400/30" />
                      </div>
                    )}
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    
                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white ml-1" fill="white" />
                      </div>
                    </div>
                  </div>

                  {/* Station Info */}
                  <div className="space-y-3">
                    {/* DJ/Broadcaster */}
                    <div className="flex items-center gap-2">
                      {station.profile_image ? (
                        <Image
                          src={station.profile_image}
                          alt={station.username}
                          width={28}
                          height={28}
                          className="rounded-full border-2 border-red-500/30"
                          unoptimized
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center border-2 border-red-500/30">
                          <span className="text-white text-xs font-bold">
                            {station.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-black text-white truncate">
                          {station.username}&apos;s Station
                        </h3>
                      </div>
                    </div>
                    
                    {/* Now Playing */}
                    {station.current_track_title && (
                      <div className="flex items-start gap-2 bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-white/5">
                        <Music className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Now Playing</p>
                          <p className="text-sm font-semibold text-white truncate">
                            {station.current_track_title}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-900/20 to-pink-900/20 border border-red-500/20 mb-6">
              <Radio className="w-10 h-10 text-red-400/30" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white/60 mb-3">No Live Stations</h3>
            <p className="text-red-400/40 mb-8 max-w-md mx-auto">
              No one is broadcasting right now. Be the first to go live and share your music!
            </p>
            <button
              onClick={goToMyStation}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-red-500/30"
            >
              <Radio className="w-5 h-5" />
              <span>Start Broadcasting</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
