'use client'

import { useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'

/**
 * Recovery UI for stuck generations
 * Shows a banner when generations are stuck in "generating" state for too long
 * Allows users to manually check their library
 */
export default function GenerationRecovery() {
  const { generations, removeGeneration } = useGenerationQueue()
  const [isChecking, setIsChecking] = useState(false)

  // Find generations stuck in "generating" state for >5 minutes
  const stuckGenerations = generations.filter(gen => {
    const age = Date.now() - gen.startedAt
    return gen.status === 'generating' && age > 5 * 60 * 1000 // 5 minutes
  })

  const handleCheckLibrary = async () => {
    setIsChecking(true)
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Navigate to library
    window.location.href = '/library'
  }

  const handleDismiss = (genId: string) => {
    if (confirm('⚠️ Are you sure you want to dismiss this generation?\n\nIf it completed, check your Library first.')) {
      removeGeneration(genId)
    }
  }

  if (stuckGenerations.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fadeIn">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-yellow-400 mb-1">
              Generation Stuck?
            </h4>
            <p className="text-xs text-gray-300 mb-3">
              {stuckGenerations.length} generation{stuckGenerations.length > 1 ? 's' : ''} taking longer than expected.
              They may have completed server-side.
            </p>
            <div className="space-y-2 mb-3">
              {stuckGenerations.map(gen => (
                <div key={gen.id} className="text-xs bg-black/30 rounded p-2 flex items-center justify-between">
                  <span className="text-gray-400 truncate flex-1">
                    {gen.title || gen.prompt?.substring(0, 30)}
                  </span>
                  <button
                    onClick={() => handleDismiss(gen.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCheckLibrary}
                disabled={isChecking}
                className="flex-1 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-xs font-medium text-cyan-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isChecking ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <span>Check Library</span>
                  </>
                )}
              </button>
              <button
                onClick={() => stuckGenerations.forEach(g => handleDismiss(g.id))}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-gray-400 transition-all"
              >
                Dismiss All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
