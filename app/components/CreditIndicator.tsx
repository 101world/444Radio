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
  const { credits, isLoading } = useCredits()

  if (!user) return null

  const playerActive = !!currentTrack

  return (
    <div className={`fixed z-[60] flex items-center transition-all duration-300 ${
      playerActive ? 'top-3 right-[640px] gap-2' : 'top-6 right-6 gap-2.5'
    }`}>
      {/* Notification Bell */}
      <NotificationBell />

      {/* Credits Badge */}
      <Link href="/pricing">
        <div className={`flex items-center backdrop-blur-2xl border rounded-full shadow-lg cursor-pointer group transition-all duration-300 ${
          playerActive
            ? 'gap-1.5 px-3 py-2 scale-90 origin-top-right'
            : 'gap-2 px-4 py-3'
        } bg-black/60 border-cyan-500/30 shadow-cyan-500/20 hover:bg-black/70 hover:border-cyan-500/50`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform bg-gradient-to-br from-cyan-500 to-cyan-600`}>
            <Zap className="text-black" size={16} fill="currentColor" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight">
              {isLoading ? '...' : credits}
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}
