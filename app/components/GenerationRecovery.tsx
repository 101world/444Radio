'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, CheckCircle } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'

/**
 * Recovery UI for stuck generations
 * Auto-checks if generations completed server-side when the user navigated away.
 * Falls back to a manual "Check Library" button.
 */
export default function GenerationRecovery() {
  const { generations, removeGeneration, recoverStuckGenerations } = useGenerationQueue()
  const [isChecking, setIsChecking] = useState(false)
  const [recovered, setRecovered] = useState<string[]>([])

  // Find generations stuck in "generating" state for >30 seconds
  const stuckGenerations = generations.filter(gen => {
    const age = Date.now() - gen.startedAt
    return gen.status === 'generating' && age > 30 * 1000
  })

  // Auto-check on mount and when stuck items appear
  useEffect(() => {
    if (stuckGenerations.length > 0 && !isChecking) {
      handleAutoCheck()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stuckGenerations.length])

  const handleAutoCheck = async () => {
    setIsChecking(true)
    try {
      await recoverStuckGenerations()
      // After recovery, check which ones were recovered
      const nowCompleted = generations
        .filter(g => g.status === 'completed' && g.completedAt && Date.now() - g.completedAt < 5000)
        .map(g => g.id)
      setRecovered(nowCompleted)
    } catch {
      // silent
    }
    setIsChecking(false)
  }

  const handleCheckLibrary = () => {
    window.location.href = '/library'
  }

  const handleDismiss = (genId: string) => {
    removeGeneration(genId)
  }

  if (stuckGenerations.length === 0 && recovered.length === 0) {
    return null
  }

  // Show brief "recovered!" toast if items were recovered
  if (stuckGenerations.length === 0 && recovered.length > 0) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fadeIn">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm text-green-300 font-medium">
                {recovered.length} generation{recovered.length > 1 ? 's' : ''} recovered! Check your Library.
              </p>
            </div>
            <button onClick={() => setRecovered([])} className="text-gray-500 hover:text-white">x</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-fadeIn">
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 backdrop-blur-xl shadow-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-yellow-400 mb-1">
              {isChecking ? 'Checking server...' : 'Generation in progress'}
            </h4>
            <p className="text-xs text-gray-300 mb-3">
              {stuckGenerations.length} generation{stuckGenerations.length > 1 ? 's' : ''} running in the background.
              {isChecking ? ' Checking if they completed...' : ' They may have finished — check your Library.'}
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
                onClick={handleAutoCheck}
                disabled={isChecking}
                className="flex-1 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-xs font-medium text-cyan-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isChecking ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <span>Re-check</span>
                )}
              </button>
              <button
                onClick={handleCheckLibrary}
                className="flex-1 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-xs font-medium text-cyan-300 transition-all"
              >
                Check Library
              </button>
              <button
                onClick={() => stuckGenerations.forEach(g => handleDismiss(g.id))}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-gray-400 transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
