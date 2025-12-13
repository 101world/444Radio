'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Radio, Users, Play, ArrowLeft, Plus, X } from 'lucide-react'
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
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchLiveStations()
    const interval = setInterval(fetchLiveStations, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])

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
    router.push(`/profile/${userId}?tab=stations`)
  }

  const goLive = () => {
    if (!user) return
    router.push(`/profile/${user.id}?tab=stations&action=golive`)
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-black pointer-events-none"></div>

      <FloatingMenu />

      <div className="max-w-7xl mx-auto relative z-10 px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={() => router.push('/explore')}
            className="group flex items-center gap-2 text-red-400/60 hover:text-red-400 transition-colors duration-300"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-sm font-medium">Back to Explore</span>
          </button>

          {user && (
            <button
              onClick={goLive}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-red-500/40 transition-all duration-300 hover:scale-105"
            >
              <Radio className="w-5 h-5" />
              Go Live
            </button>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-red-400 via-pink-400 to-red-300 bg-clip-text text-transparent">
            Live Stations
          </h1>
          <p className="text-red-400/60 text-lg max-w-2xl mx-auto">
            Tune in to live broadcasts • Real-time music sharing • Join the vibe
          </p>
        </div>

        {/* Live Stations Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white/5 rounded-2xl p-6 animate-pulse">
                <div className="w-full h-48 bg-white/10 rounded-xl mb-4"></div>
                <div className="h-6 bg-white/10 rounded mb-2"></div>
                <div className="h-4 bg-white/10 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : liveStations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveStations.map((station) => (
              <div
                key={station.id}
                className="group bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-2xl p-6 border border-red-500/20 hover:border-red-500/50 transition-all duration-300 hover:scale-105 cursor-pointer"
                onClick={() => joinStation(station.user_id)}
              >
                {/* Live Indicator */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/50">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-400 text-xs font-semibold uppercase">LIVE</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400/60">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">{station.listener_count || 0}</span>
                  </div>
                </div>

                {/* Cover Image */}
                <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden bg-gradient-to-br from-red-900/30 to-pink-900/30">
                  {station.current_track_image ? (
                    <Image
                      src={station.current_track_image}
                      alt={station.current_track_title || 'Now playing'}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Radio className="w-16 h-16 text-red-400/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                </div>

                {/* Station Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {station.profile_image && (
                      <Image
                        src={station.profile_image}
                        alt={station.username}
                        width={24}
                        height={24}
                        className="rounded-full"
                        unoptimized
                      />
                    )}
                    <h3 className="text-xl font-bold text-white">{station.username}&apos;s Station</h3>
                  </div>
                  
                  {station.current_track_title && (
                    <div className="flex items-center gap-2 text-red-400/80">
                      <Play className="w-3 h-3" fill="currentColor" />
                      <p className="text-sm truncate">{station.current_track_title}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Radio className="w-20 h-20 text-red-400/20 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white/60 mb-2">No Live Stations</h3>
            <p className="text-red-400/40 mb-6">Be the first to go live!</p>
            {user && (
              <button
                onClick={goLive}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-red-500/40 transition-all duration-300 hover:scale-105"
              >
                <Radio className="w-5 h-5" />
                Start Broadcasting
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
