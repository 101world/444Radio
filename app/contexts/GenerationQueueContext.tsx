'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { safeLocalStorage } from '@/lib/safe-storage'

export interface GenerationItem {
  id: string
  type: 'music' | 'image' | 'video' | 'effects' | 'stem-split'
  prompt: string
  title?: string
  status: 'queued' | 'generating' | 'completed' | 'failed'
  progress?: number
  result?: {
    audioUrl?: string
    imageUrl?: string
    videoUrl?: string
    title?: string
    lyrics?: string
    prompt?: string
    stems?: Record<string, string>
    variations?: Array<{ url: string; variation: number }>
    creditsUsed?: number
    creditsRemaining?: number
  }
  error?: string
  startedAt: number
  completedAt?: number
}

interface GenerationQueueContextType {
  generations: GenerationItem[]
  addGeneration: (item: Omit<GenerationItem, 'id' | 'startedAt' | 'status'>) => string
  updateGeneration: (id: string, updates: Partial<GenerationItem>) => void
  removeGeneration: (id: string) => void
  clearCompleted: () => void
  getActiveCount: () => number
  recoverStuckGenerations: () => Promise<void>
}

const GenerationQueueContext = createContext<GenerationQueueContextType | undefined>(undefined)

const STORAGE_KEY = '444radio_generation_queue'
const MAX_STORAGE_AGE = 24 * 60 * 60 * 1000 // 24 hours

export function GenerationQueueProvider({ children }: { children: ReactNode }) {
  const [generations, setGenerations] = useState<GenerationItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = safeLocalStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as GenerationItem[]
        // Filter out old items
        const now = Date.now()
        const filtered = parsed.filter(item => 
          now - item.startedAt < MAX_STORAGE_AGE
        )
        setGenerations(filtered)
      }
    } catch (error) {
      console.error('Failed to load generation queue:', error)
    }
    setIsInitialized(true)
  }, [])

  // Save to localStorage whenever generations change
  useEffect(() => {
    if (!isInitialized) return
    try {
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(generations))
    } catch (error) {
      console.error('Failed to save generation queue:', error)
    }
  }, [generations, isInitialized])

  const addGeneration = (item: Omit<GenerationItem, 'id' | 'startedAt' | 'status'>) => {
    const id = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newItem: GenerationItem = {
      ...item,
      id,
      status: 'queued',
      startedAt: Date.now()
    }
    setGenerations(prev => [...prev, newItem])
    return id
  }

  const updateGeneration = (id: string, updates: Partial<GenerationItem>) => {
    setGenerations(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updates, completedAt: updates.status === 'completed' || updates.status === 'failed' ? Date.now() : item.completedAt }
          : item
      )
    )
  }

  const removeGeneration = (id: string) => {
    setGenerations(prev => prev.filter(item => item.id !== id))
  }

  const clearCompleted = () => {
    setGenerations(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'failed'))
  }

  const getActiveCount = () => {
    return generations.filter(item => item.status === 'queued' || item.status === 'generating').length
  }

  // Auto-recover stuck generations by checking if they completed server-side
  const recoveryRanRef = useRef(false)
  const recoverStuckGenerations = useCallback(async () => {
    const stuck = generations.filter(gen => {
      const age = Date.now() - gen.startedAt
      // Item is "stuck" if it's been generating for > 30 seconds
      // (real generations that are still connected manage their own state)
      return gen.status === 'generating' && age > 30_000
    })
    if (stuck.length === 0) return

    try {
      // Find the oldest stuck item to set the "since" parameter
      const oldestStart = Math.min(...stuck.map(s => s.startedAt))
      const since = new Date(oldestStart - 60_000).toISOString() // 1 min buffer

      const res = await fetch(`/api/generate/check-recent?since=${encodeURIComponent(since)}`)
      if (!res.ok) return
      const { results } = await res.json() as {
        results: Array<{ id: string; type: string; title: string; audioUrl?: string; imageUrl?: string; createdAt: string }>
      }
      if (!results || results.length === 0) return

      // Try to match stuck items with server-side completions
      for (const gen of stuck) {
        // Match by type and approximate time (completed after generation started)
        const match = results.find(r => {
          const typeMatch =
            (gen.type === 'music' && r.type === 'music') ||
            (gen.type === 'effects' && r.type === 'effects') ||
            (gen.type === 'image' && r.type === 'images') ||
            (gen.type === 'video' && r.type === 'images') // video cover art
          const timeMatch = new Date(r.createdAt).getTime() >= gen.startedAt - 5000
          // Also match by title if available
          const titleMatch = gen.title && r.title && gen.title.toLowerCase() === r.title.toLowerCase()
          return typeMatch && (timeMatch || titleMatch)
        })

        if (match) {
          console.log(`[GenerationQueue] Recovered stuck generation: ${gen.title || gen.id}`)
          setGenerations(prev =>
            prev.map(item =>
              item.id === gen.id
                ? {
                    ...item,
                    status: 'completed' as const,
                    completedAt: Date.now(),
                    result: {
                      ...item.result,
                      audioUrl: match.audioUrl,
                      imageUrl: match.imageUrl,
                      title: match.title
                    }
                  }
                : item
            )
          )
        } else {
          // If it's been generating for > 10 minutes with no server result, mark as failed
          const age = Date.now() - gen.startedAt
          if (age > 10 * 60 * 1000) {
            console.log(`[GenerationQueue] Marking old stuck generation as failed: ${gen.title || gen.id}`)
            setGenerations(prev =>
              prev.map(item =>
                item.id === gen.id
                  ? { ...item, status: 'failed' as const, completedAt: Date.now(), error: 'Generation timed out. Credits were refunded.' }
                  : item
              )
            )
          }
        }
      }
    } catch (error) {
      console.error('[GenerationQueue] Recovery check failed:', error)
    }
  }, [generations])

  // Auto-run recovery on mount and when page becomes visible
  useEffect(() => {
    if (!isInitialized) return

    // Run once on mount after a short delay
    if (!recoveryRanRef.current) {
      recoveryRanRef.current = true
      const timer = setTimeout(() => recoverStuckGenerations(), 2000)
      return () => clearTimeout(timer)
    }
  }, [isInitialized, recoverStuckGenerations])

  // Also recover when page regains focus (user switches back to tab)
  useEffect(() => {
    if (!isInitialized) return

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        recoverStuckGenerations()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isInitialized, recoverStuckGenerations])

  return (
    <GenerationQueueContext.Provider
      value={{
        generations,
        addGeneration,
        updateGeneration,
        removeGeneration,
        clearCompleted,
        getActiveCount,
        recoverStuckGenerations
      }}
    >
      {children}
    </GenerationQueueContext.Provider>
  )
}

export function useGenerationQueue() {
  const context = useContext(GenerationQueueContext)
  if (!context) {
    throw new Error('useGenerationQueue must be used within GenerationQueueProvider')
  }
  return context
}
