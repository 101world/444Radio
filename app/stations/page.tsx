'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Radio, Users, Clock, Play, Plus } from 'lucide-react'
import Image from 'next/image'

interface Station {
  id: string
  title: string
  description: string
  coverUrl: string | null
  genre: string
  isLive: boolean
  listenerCount: number
  lastLiveAt: string | null
  owner: {
    userId: string
    username: string
    profileImage: string | null
  }
}

export default function StationsPage() {
  const router = useRouter()
  const { user } = useUser()
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    fetchStations()
  }, [])

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/station/list')
      const data = await response.json()
      
      if (data.success) {
        setStations(data.stations)
        setLiveCount(data.liveCount)
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinStation = (stationId: string) => {
    router.push(`/station/${stationId}`)
  }

  const formatLastLive = (lastLiveAt: string | null) => {
    if (!lastLiveAt) return 'Never'
    const date = new Date(lastLiveAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-cyan-400 flex items-center gap-2">
          <Radio className="animate-pulse" size={24} />
          <span>Loading stations...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Radio className="text-cyan-400" size={32} />
                Live Stations
              </h1>
              <p className="text-gray-400 mt-1">
                {liveCount > 0 ? (
                  <span className="text-cyan-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    {liveCount} station{liveCount > 1 ? 's' : ''} live now
                  </span>
                ) : (
                  'No stations live right now'
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/create-station')}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 rounded-lg flex items-center gap-2 transition-all"
            >
              <Plus size={20} />
              Create Station
            </button>
          </div>
        </div>
      </div>

      {/* Stations Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {stations.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="mx-auto text-gray-600 mb-4" size={64} />
            <h3 className="text-xl text-gray-400 mb-2">No stations yet</h3>
            <p className="text-gray-500">Be the first to create a station!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {stations.map(station => (
              <div
                key={station.id}
                className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all group"
              >
                {/* Cover Image */}
                <div className="relative aspect-square bg-gradient-to-br from-cyan-900/20 to-purple-900/20">
                  {station.coverUrl ? (
                    <Image
                      src={station.coverUrl}
                      alt={station.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Radio className="text-cyan-400/30" size={64} />
                    </div>
                  )}
                  
                  {/* Live Badge */}
                  {station.isLive && (
                    <div className="absolute top-3 right-3 px-3 py-1 bg-red-500 rounded-full flex items-center gap-2 text-xs font-bold animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full" />
                      LIVE
                    </div>
                  )}

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleJoinStation(station.id)}
                      className="w-16 h-16 bg-cyan-500 hover:bg-cyan-400 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
                    >
                      <Play className="text-black ml-1" size={28} fill="black" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 truncate">{station.title}</h3>
                  {station.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{station.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-3">
                    {station.owner.profileImage ? (
                      <Image
                        src={station.owner.profileImage}
                        alt={station.owner.username}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gray-700 rounded-full" />
                    )}
                    <span className="text-sm text-gray-400">{station.owner.username}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      {station.listenerCount}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatLastLive(station.lastLiveAt)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinStation(station.id)}
                    className={`w-full py-2 rounded-lg font-medium transition-all ${
                      station.isLive
                        ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {station.isLive ? 'Join Live' : 'View Station'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
