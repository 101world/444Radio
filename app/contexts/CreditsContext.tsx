'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

interface CreditsContextType {
  credits: number | null
  totalGenerated: number
  subscriptionStatus: string
  subscriptionPlan: string
  isLoading: boolean
  refreshCredits: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType>({
  credits: null,
  totalGenerated: 0,
  subscriptionStatus: 'none',
  subscriptionPlan: 'creator',
  isLoading: true,
  refreshCredits: async () => {},
})

export function useCredits() {
  return useContext(CreditsContext)
}

/**
 * Single source of truth for user credits.
 * Fetches once on mount, refreshes every 30s, and exposes refreshCredits() for manual refresh.
 * Deduplicates concurrent requests.
 */
export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [totalGenerated, setTotalGenerated] = useState(0)
  const [subscriptionStatus, setSubscriptionStatus] = useState('none')
  const [subscriptionPlan, setSubscriptionPlan] = useState('creator')
  const [isLoading, setIsLoading] = useState(true)
  const fetchingRef = useRef(false)

  const refreshCredits = useCallback(async () => {
    if (!user?.id || fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setCredits(data.credits ?? 0)
      setTotalGenerated(data.totalGenerated ?? 0)
      setSubscriptionStatus(data.subscription_status ?? 'none')
      setSubscriptionPlan(data.subscription_plan ?? 'creator')
      setIsLoading(false)
    } catch {
      setIsLoading(false)
    } finally {
      fetchingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Initial fetch + 30s polling
  useEffect(() => {
    if (!user?.id) return
    refreshCredits()
    const interval = setInterval(refreshCredits, 30_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return (
    <CreditsContext.Provider value={{ credits, totalGenerated, subscriptionStatus, subscriptionPlan, isLoading, refreshCredits }}>
      {children}
    </CreditsContext.Provider>
  )
}
