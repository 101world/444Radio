'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Radio, Mic, Users, Settings, Circle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StationsPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [isLive, setIsLive] = useState(false)
  const [isTogglingLive, setIsTogglingLive] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.replace('/sign-in')
      return
    }
    
    // Load live status
    loadLiveStatus()
  }, [user, isLoaded, router])

  const loadLiveStatus = async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('live_stations')
        .select('is_live, listener_count')
        .eq('user_id', user.id)
        .single()
      
      if (data) {
        setIsLive(data.is_live || false)
        setViewerCount(data.listener_count || 0)
      }
    } catch (error) {
      console.error('[Stations] Load status error:', error)
      // Station doesn't exist yet, user is not live
      setIsLive(false)
      setViewerCount(0)
    }
  }

  const toggleLive = async () => {
    if (!user?.id || isTogglingLive) return
    
    setIsTogglingLive(true)
    try {
      const newLiveStatus = !isLive
      
      // Use the station API endpoint
      const response = await fetch('/api/station', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isLive: newLiveStatus,
          username: user.username || user.firstName || 'Anonymous'
        })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to toggle live status')
      }
      
      setIsLive(newLiveStatus)
      console.log(`✅ [Stations] ${newLiveStatus ? 'Went' : 'Stopped'} live`)
      
      if (newLiveStatus) {
        // Redirect to live station page
        router.push(`/profile/${user.id}?tab=station`)
      }
    } catch (error) {
      console.error('❌ [Stations] Toggle live error:', error)
      alert(error instanceof Error ? error.message : 'Failed to toggle live status')
    } finally {
      setIsTogglingLive(false)
    }
  }

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Radio size={40} className="text-black" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Your Radio Station</h1>
          <p className="text-gray-400">Broadcast live to your followers</p>
        </div>

        {/* Live Status Card */}
        <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/20 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {isLive ? (
                <>
                  <Circle size={16} className="text-red-500 fill-red-500 animate-pulse" />
                  <span className="text-2xl font-bold text-red-500">LIVE</span>
                </>
              ) : (
                <>
                  <Circle size={16} className="text-gray-500" />
                  <span className="text-2xl font-bold text-gray-500">OFFLINE</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Users size={20} />
              <span className="font-mono">{viewerCount}</span>
            </div>
          </div>

          {/* Go Live Button */}
          <button
            onClick={toggleLive}
            disabled={isTogglingLive}
            className={`w-full py-6 rounded-xl font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isLive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black'
            }`}
          >
            {isTogglingLive ? (
              'Processing...'
            ) : isLive ? (
              <><Mic className="inline mr-2" size={24} /> Stop Broadcasting</>
            ) : (
              <><Radio className="inline mr-2" size={24} /> Go Live</>
            )}
          </button>
        </div>

        {/* Instructions */}
        {!isLive && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Settings size={20} className="text-cyan-400" />
              How to go live
            </h3>
            <ol className="space-y-3 text-gray-400">
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold">1.</span>
                <span>Click "Go Live" to start broadcasting</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold">2.</span>
                <span>You'll be redirected to your station page</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold">3.</span>
                <span>Your followers will see you're live and can tune in</span>
              </li>
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold">4.</span>
                <span>Click "Stop Broadcasting" when you're done</span>
              </li>
            </ol>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.push(`/profile/${user.id}`)}
            className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
          >
            View My Profile
          </button>
          <button
            onClick={() => router.push('/explore')}
            className="flex-1 px-6 py-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all"
          >
            Explore Live Stations
          </button>
        </div>
      </div>
    </div>
  )
}
