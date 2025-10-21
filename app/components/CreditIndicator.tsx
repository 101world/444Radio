'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Zap } from 'lucide-react'
import Link from 'next/link'

export default function CreditIndicator() {
  const { user } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch real credits from API
  useEffect(() => {
    if (user) {
      const fetchCredits = () => {
        fetch('/api/credits')
          .then(res => res.json())
          .then(data => {
            setCredits(data.credits || 0)
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

  return (
    <Link href="/decrypt">
      <div className="fixed top-6 left-6 z-50 flex items-center gap-2 px-4 py-3 bg-black/60 backdrop-blur-2xl border border-cyan-500/30 rounded-full shadow-lg shadow-cyan-500/20 hover:bg-black/70 hover:border-cyan-500/50 transition-all cursor-pointer group">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Zap className="text-black" size={16} fill="currentColor" />
        </div>
        <span className="text-white font-bold text-sm">
          {isLoading ? '...' : credits}
        </span>
      </div>
    </Link>
  )
}
