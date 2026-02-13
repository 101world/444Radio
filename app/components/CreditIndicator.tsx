'use client'

import { useUser } from '@clerk/nextjs'
import { Zap, Crown } from 'lucide-react'
import Link from 'next/link'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import { useCredits } from '@/app/contexts/CreditsContext'
import NotificationBell from './NotificationBell'

export default function CreditIndicator() {
  const { user } = useUser()
  const { currentTrack } = useAudioPlayer()
  const { credits, subscriptionStatus, subscriptionPlan, isLoading } = useCredits()

  if (!user) return null

  const isSubscribed = subscriptionStatus === 'active'
  const playerActive = !!currentTrack

  return (
    <div className={`fixed z-50 flex items-center transition-all duration-300 ${
      playerActive ? 'top-3 right-3 gap-2' : 'top-6 right-6 gap-2.5'
    }`}>
      {/* Notification Bell */}
      <NotificationBell />

      {/* Credits Badge */}
      <Link href={isSubscribed ? '/pricing' : '/decrypt'}>
        <div className={`flex items-center backdrop-blur-2xl border rounded-full shadow-lg cursor-pointer group transition-all duration-300 ${
          playerActive
            ? 'gap-1.5 px-3 py-2 scale-90 origin-top-right'
            : 'gap-2 px-4 py-3'
        } ${
          isSubscribed 
            ? 'bg-gradient-to-r from-purple-900/60 to-cyan-900/60 border-purple-500/50 shadow-purple-500/30 hover:border-purple-400/70'
            : 'bg-black/60 border-cyan-500/30 shadow-cyan-500/20 hover:bg-black/70 hover:border-cyan-500/50'
        }`}>
          {isSubscribed && (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <Crown className="text-yellow-900" size={12} fill="currentColor" />
            </div>
          )}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${
            isSubscribed
              ? 'bg-gradient-to-br from-purple-500 to-cyan-500'
              : 'bg-gradient-to-br from-cyan-500 to-cyan-600'
          }`}>
            <Zap className="text-black" size={16} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight">
              {isLoading ? '...' : credits}
            </span>
            {isSubscribed && (
              <span className="text-yellow-300 text-[10px] font-bold leading-tight">
                {subscriptionPlan.toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}
