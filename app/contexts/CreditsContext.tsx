'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

interface CreditsContextType {
  credits: number | null
  freeCredits: number | null
  totalCredits: number | null
  totalGenerated: number
  walletBalance: number | null
  isLoading: boolean
  refreshCredits: () => Promise<void>
}

const CreditsContext = createContext<CreditsContextType>({
  credits: null,
  freeCredits: null,
  totalCredits: null,
  totalGenerated: 0,
  walletBalance: null,
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
  const [freeCredits, setFreeCredits] = useState<number | null>(null)
  const [totalCredits, setTotalCredits] = useState<number | null>(null)
  const [totalGenerated, setTotalGenerated] = useState(0)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetchingRef = useRef(false)

  const refreshCredits = useCallback(async () => {
    if (!user?.id || fetchingRef.current) return
    fetchingRef.current = true
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setCredits(data.credits ?? 0)
      setFreeCredits(data.freeCredits ?? 0)
      setTotalCredits(data.totalCredits ?? 0)
      setTotalGenerated(data.totalGenerated ?? 0)
      setWalletBalance(data.walletBalance ?? 0)
      setIsLoading(false)
    } catch {
      setIsLoading(false)
    } finally {
      fetchingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Initial fetch + event-driven refresh (no polling)
  // Listen for 'credits:refresh' events dispatched after generation/purchase/etc.
  useEffect(() => {
    if (!user?.id) return
    refreshCredits()

    const handler = () => refreshCredits()
    window.addEventListener('credits:refresh', handler)
    // Also refresh when tab comes back to foreground (covers long-away sessions)
    const visHandler = () => { if (document.visibilityState === 'visible') refreshCredits() }
    document.addEventListener('visibilitychange', visHandler)

    return () => {
      window.removeEventListener('credits:refresh', handler)
      document.removeEventListener('visibilitychange', visHandler)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return (
    <CreditsContext.Provider value={{ credits, freeCredits, totalCredits, totalGenerated, walletBalance, isLoading, refreshCredits }}>
      {children}
    </CreditsContext.Provider>
  )
}
