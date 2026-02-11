'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

  return (
    <GenerationQueueContext.Provider
      value={{
        generations,
        addGeneration,
        updateGeneration,
        removeGeneration,
        clearCompleted,
        getActiveCount
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
