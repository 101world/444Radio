'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Crown, Zap, Check, XCircle, Loader2, Swords, X } from 'lucide-react'

/**
 * Global Chess Challenge Modal
 * Polls for unread chess_challenge notifications and shows a full-screen modal
 * on ALL pages until the user accepts, declines, or dismisses it.
 * Injected in the root layout so it's always active.
 */

interface PendingChallenge {
  notificationId: string
  gameId: string
  challengerUsername: string
  wager: number
  createdAt?: string
}

export default function ChessChallengeModal() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null)
  const [actionStatus, setActionStatus] = useState<'idle' | 'accepting' | 'declining' | 'done'>('idle')
  const [resultMsg, setResultMsg] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckRef = useRef(0)

  // Poll for pending chess challenges
  const checkForChallenges = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json()
      const notifications = json?.notifications ?? json ?? []

      // Find the most recent unread chess_challenge that hasn't been dismissed
      const pending = notifications.find((n: any) => {
        const gameId = n.data?.gameId || n.metadata?.gameId
        return (
          n.type === 'chess_challenge' &&
          (n.unread !== false) &&
          gameId &&
          !dismissed.has(gameId)
        )
      })

      if (pending) {
        const gameId = pending.data?.gameId || pending.metadata?.gameId
        setChallenge({
          notificationId: pending.id,
          gameId,
          challengerUsername: pending.data?.challengerUsername || pending.metadata?.challengerUsername || 'Someone',
          wager: pending.data?.wager ?? pending.metadata?.wager ?? 0,
          createdAt: pending.created_at,
        })
      } else {
        // No pending challenges — clear if showing
        if (challenge && actionStatus === 'idle') {
          setChallenge(null)
        }
      }
    } catch (err) {
      console.error('[chess-modal] Poll error:', err)
    }
  }, [user?.id, dismissed, challenge, actionStatus])

  // Start polling on mount
  useEffect(() => {
    if (!isLoaded || !user?.id) return

    // Initial check
    checkForChallenges()

    // Poll every 5s
    pollRef.current = setInterval(checkForChallenges, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isLoaded, user?.id, checkForChallenges])

  // Handle accept
  const handleAccept = async () => {
    if (!challenge) return
    setActionStatus('accepting')
    try {
      const res = await fetch('/api/chess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', gameId: challenge.gameId }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setActionStatus('done')
        setResultMsg('Challenge accepted! Joining game...')
        // Navigate to chess game after brief moment
        setTimeout(() => {
          setChallenge(null)
          setActionStatus('idle')
          router.push(`/assistant?chess=${challenge.gameId}`)
        }, 1200)
      } else {
        setActionStatus('idle')
        setResultMsg(result.error || 'Failed to accept challenge')
        setTimeout(() => setResultMsg(''), 4000)
      }
    } catch {
      setActionStatus('idle')
      setResultMsg('Network error. Try again.')
      setTimeout(() => setResultMsg(''), 4000)
    }
  }

  // Handle decline
  const handleDecline = async () => {
    if (!challenge) return
    setActionStatus('declining')
    try {
      const res = await fetch('/api/chess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', gameId: challenge.gameId }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setActionStatus('done')
        setResultMsg('Challenge declined.')
        setTimeout(() => {
          setDismissed(prev => new Set(prev).add(challenge.gameId))
          setChallenge(null)
          setActionStatus('idle')
          setResultMsg('')
        }, 1500)
      } else {
        setActionStatus('idle')
        setResultMsg(result.error || 'Failed to decline')
        setTimeout(() => setResultMsg(''), 4000)
      }
    } catch {
      setActionStatus('idle')
      setResultMsg('Network error. Try again.')
      setTimeout(() => setResultMsg(''), 4000)
    }
  }

  // Dismiss (close without accepting/declining — modal will reappear on next poll)
  const handleDismiss = () => {
    if (!challenge) return
    setDismissed(prev => new Set(prev).add(challenge.gameId))
    setChallenge(null)
    setActionStatus('idle')
    setResultMsg('')
  }

  // Don't render if no challenge or not loaded
  if (!isLoaded || !user?.id || !challenge) return null

  const isLoading = actionStatus === 'accepting' || actionStatus === 'declining'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[80px]" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        {/* Close / Dismiss */}
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-gray-900 border border-white/10 hover:border-white/30 text-white/40 hover:text-white transition-all shadow-lg"
          title="Dismiss (you can find this in notifications)"
        >
          <X size={16} />
        </button>

        {/* Card */}
        <div className="bg-gradient-to-b from-gray-900 via-gray-950 to-black border border-purple-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10">
          {/* Header accent */}
          <div className="h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500" />

          {/* Content */}
          <div className="px-6 py-8 text-center">
            {/* Chess icon */}
            <div className="relative mx-auto mb-5 w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 animate-pulse" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center shadow-xl shadow-purple-500/20">
                <span className="text-4xl" style={{ textShadow: '0 0 20px rgba(168,85,247,0.5)' }}>♟️</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-black text-white mb-1 tracking-tight">
              Chess Challenge!
            </h2>
            <p className="text-white/50 text-sm mb-5">
              <span className="text-purple-400 font-bold">@{challenge.challengerUsername}</span> wants to battle
            </p>

            {/* Wager display */}
            {challenge.wager > 0 ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-xl mb-6">
                <Zap size={16} className="text-amber-400" />
                <span className="text-amber-300 font-black text-lg">{challenge.wager}</span>
                <span className="text-amber-400/60 text-xs font-medium">credits wagered</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl mb-6">
                <Crown size={14} className="text-cyan-400" />
                <span className="text-white/40 text-xs font-medium">Free match — no credits at stake</span>
              </div>
            )}

            {/* Prize pool */}
            {challenge.wager > 0 && (
              <p className="text-xs text-white/30 mb-6">
                Winner takes <span className="text-emerald-400 font-bold">{challenge.wager * 2} credits</span> • 
                You need <span className="text-amber-400 font-bold">{challenge.wager} credits</span> to accept
              </p>
            )}

            {/* Action buttons */}
            {actionStatus !== 'done' && (
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={handleAccept}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                >
                  {actionStatus === 'accepting' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Swords size={16} />
                  )}
                  Accept Challenge
                </button>
                <button
                  onClick={handleDecline}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-gray-400 hover:text-red-300 transition-all"
                >
                  {actionStatus === 'declining' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <XCircle size={16} />
                  )}
                  Decline
                </button>
              </div>
            )}

            {/* Result message */}
            {actionStatus === 'done' && (
              <div className={`flex items-center justify-center gap-2 py-3 rounded-xl ${
                resultMsg.includes('accepted') || resultMsg.includes('Joining')
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}>
                {resultMsg.includes('accepted') || resultMsg.includes('Joining') ? (
                  <Swords size={16} />
                ) : (
                  <Check size={16} />
                )}
                <span className="text-sm font-medium">{resultMsg}</span>
              </div>
            )}

            {/* Error message */}
            {resultMsg && actionStatus === 'idle' && (
              <p className="mt-3 text-xs text-red-400/80">{resultMsg}</p>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-6 py-3 bg-white/[0.01] border-t border-white/5 text-center">
            <p className="text-[10px] text-white/20">
              Dismiss to close temporarily • Challenge stays in your notifications
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
