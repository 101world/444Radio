'use client'

import { useEffect, useState } from 'react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'
import ToastNotification, { Toast } from './ToastNotification'

export default function GenerationMonitor() {
  const { generations, updateGeneration } = useGenerationQueue()
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Monitor for completed generations
    generations.forEach(gen => {
      if (gen.status === 'completed' && gen.completedAt) {
        // Check if we've already shown a toast for this completion
        const toastId = `gen-complete-${gen.id}`
        const existingToast = toasts.find(t => t.id === toastId)
        
        if (!existingToast && Date.now() - gen.completedAt < 5000) {
          // Show success toast
          addToast({
            id: toastId,
            type: 'success',
            message: `✅ ${gen.title || 'Generation'} completed! Check your library.`,
            duration: 5000
          })
        }
      }
      
      if (gen.status === 'failed' && gen.completedAt) {
        const toastId = `gen-failed-${gen.id}`
        const existingToast = toasts.find(t => t.id === toastId)
        
        if (!existingToast && Date.now() - gen.completedAt < 5000) {
          addToast({
            id: toastId,
            type: 'error',
            message: `❌ ${gen.title || 'Generation'} failed: ${gen.error || 'Unknown error'}`,
            duration: 7000
          })
        }
      }
    })
  }, [generations])

  const addToast = (toast: Toast) => {
    setToasts(prev => [...prev, toast])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return <ToastNotification toasts={toasts} onRemove={removeToast} />
}
