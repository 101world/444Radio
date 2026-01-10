'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Zap, Crown } from 'lucide-react'
import Link from 'next/link'

export default function CreditIndicator() {
  const { user } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none')

  // Fetch real credits and subscription status from API
  useEffect(() => {
    if (user) {
      const fetchCredits = () => {
        fetch('/api/credits')
          .then(res => res.json())
          .then(data => {
            setCredits(data.credits || 0)
            setSubscriptionStatus(data.subscription_status || 'none')
            setIsLoading(false)
          })
          .catch(err => {
            console.error('Failed to fetch credits:', err)
            setCredits(0)
            setIsLoading(false)
          })
      }

      fetchCredits()

      // Refresh credits every 30 seconds
      const interval = setInterval(fetchCredits, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  if (!user) return null

  const isSubscribed = subscriptionStatus === 'active'

  return (
    <Link href={isSubscribed ? '/pricing' : '/decrypt'}>
      <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 backdrop-blur-2xl border rounded-full shadow-lg transition-all cursor-pointer group ${
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
            <span className="text-yellow-300 text-[10px] font-bold leading-tight">CREATOR</span>
          )}
        </div>
      </div>
    </Link>
  )
}
