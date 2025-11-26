/**
 * Studio Generation Hook
 * Client-side hook for AI generation in multi-track studio
 * Handles job creation, polling, and automatic track addition
 */

import { useState, useCallback, useRef } from 'react'

export type GenerationType = 'create-song' | 'create-beat' | 'stem-split' | 'auto-tune' | 'effects'

export interface GenerationJob {
  jobId: string
  type: GenerationType
  status: 'queued' | 'processing' | 'completed' | 'failed'
  output?: Record<string, string>
  error?: string
  progress?: number
}

export interface GenerationParams {
  // Song/Beat
  prompt?: string
  lyrics?: string
  duration?: number
  steps?: number
  
  // Stem split / Effects / Auto-tune
  audioUrl?: string
  scale?: string
  pitchShift?: number
  effects?: string[]
}

export function useStudioGeneration() {
  const [activeJobs, setActiveJobs] = useState<Map<string, GenerationJob>>(new Map())
  const pollIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Start generation
  const generate = useCallback(async (
    type: GenerationType,
    params: GenerationParams,
    onComplete?: (output: Record<string, string>) => void,
    onError?: (error: string) => void
  ): Promise<string | null> => {
    try {
      console.log(`🎵 Starting ${type} generation...`, params)

      const response = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.error || 'Generation failed'
        console.error('❌ Generation failed:', errorMsg)
        onError?.(errorMsg)
        return null
      }

      const { jobId, status, creditsCharged } = data

      console.log(`✅ Job created: ${jobId}`, { status, creditsCharged })

      // Add to active jobs
      const job: GenerationJob = {
        jobId,
        type,
        status,
        progress: 0
      }

      setActiveJobs(prev => new Map(prev).set(jobId, job))

      // Start polling for completion
      startPolling(jobId, onComplete, onError)

      return jobId

    } catch (error) {
      console.error('❌ Generation error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      onError?.(errorMsg)
      return null
    }
  }, [])

  // Poll job status
  const startPolling = useCallback((
    jobId: string,
    onComplete?: (output: Record<string, string>) => void,
    onError?: (error: string) => void
  ) => {
    // Clear existing interval if any
    const existingInterval = pollIntervalsRef.current.get(jobId)
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    let attempts = 0
    const maxAttempts = 120 // 4 minutes max (2 seconds * 120)

    const interval = setInterval(async () => {
      attempts++

      try {
        const response = await fetch(`/api/studio/jobs/${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch job status')
        }

        const { status, output, error } = data

        // Update job in state
        setActiveJobs(prev => {
          const updated = new Map(prev)
          const job = updated.get(jobId)
          if (job) {
            updated.set(jobId, {
              ...job,
              status,
              output,
              error,
              progress: Math.min(90, attempts * 2) // Fake progress
            })
          }
          return updated
        })

        // Check if completed
        if (status === 'completed') {
          console.log(`✅ Job completed: ${jobId}`, output)
          clearInterval(interval)
          pollIntervalsRef.current.delete(jobId)
          
          // Update final progress
          setActiveJobs(prev => {
            const updated = new Map(prev)
            const job = updated.get(jobId)
            if (job) {
              updated.set(jobId, { ...job, progress: 100 })
            }
            return updated
          })
          
          onComplete?.(output)
          
        } else if (status === 'failed') {
          console.error(`❌ Job failed: ${jobId}`, error)
          clearInterval(interval)
          pollIntervalsRef.current.delete(jobId)
          onError?.(error || 'Generation failed')
          
        } else if (attempts >= maxAttempts) {
          console.error(`⏱️ Job timeout: ${jobId}`)
          clearInterval(interval)
          pollIntervalsRef.current.delete(jobId)
          onError?.('Generation timed out. Please try again.')
        }

      } catch (err) {
        console.error('❌ Polling error:', err)
        attempts++ // Count errors toward timeout
        
        if (attempts >= maxAttempts) {
          clearInterval(interval)
          pollIntervalsRef.current.delete(jobId)
          onError?.('Failed to check generation status')
        }
      }
    }, 2000) // Poll every 2 seconds

    pollIntervalsRef.current.set(jobId, interval)
  }, [])

  // Cancel job (stop polling)
  const cancelJob = useCallback((jobId: string) => {
    const interval = pollIntervalsRef.current.get(jobId)
    if (interval) {
      clearInterval(interval)
      pollIntervalsRef.current.delete(jobId)
    }
    
    setActiveJobs(prev => {
      const updated = new Map(prev)
      updated.delete(jobId)
      return updated
    })
  }, [])

  // Clear completed jobs
  const clearCompletedJobs = useCallback(() => {
    setActiveJobs(prev => {
      const updated = new Map(prev)
      for (const [jobId, job] of updated.entries()) {
        if (job.status === 'completed' || job.status === 'failed') {
          updated.delete(jobId)
        }
      }
      return updated
    })
  }, [])

  return {
    generate,
    activeJobs: Array.from(activeJobs.values()),
    cancelJob,
    clearCompletedJobs
  }
}
