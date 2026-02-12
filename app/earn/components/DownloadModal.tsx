'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Zap, Download, Scissors, AlertCircle } from 'lucide-react'

interface EarnTrack {
  id: string
  title: string
  image_url: string
  username: string
  earn_price: number
}

interface DownloadModalProps {
  track: EarnTrack
  userCredits: number
  onClose: () => void
  onConfirm: (splitStems: boolean) => void
}

export default function DownloadModal({ track, userCredits, onClose, onConfirm }: DownloadModalProps) {
  const [splitStems, setSplitStems] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  const baseCost = track.earn_price || 4
  const stemsCost = 5
  const totalCost = baseCost + (splitStems ? stemsCost : 0)
  const canAfford = userCredits >= totalCost

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    modalRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleConfirm = async () => {
    if (!canAfford || purchasing) return
    setPurchasing(true)
    await onConfirm(splitStems)
    setPurchasing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md bg-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        role="dialog"
        aria-label="Download track"
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                {track.image_url ? (
                  <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <Download size={20} />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{track.title}</h3>
                <p className="text-sm text-gray-400">by @{track.username}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Credit split explanation */}
        <div className="px-6 py-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Credit Split</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Artist (@{track.username})</span>
                <span className="text-emerald-400 font-medium">2 credits</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Platform (444 Radio)</span>
                <span className="text-cyan-400 font-medium">2 credits</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-300">Download Total</span>
                <span className="text-white">{baseCost} credits</span>
              </div>
            </div>
          </div>

          {/* Split stems option */}
          <label className="flex items-center gap-3 mt-4 p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.08] transition group">
            <div className="relative">
              <input
                type="checkbox"
                checked={splitStems}
                onChange={e => setSplitStems(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-md border-2 border-gray-600 peer-checked:border-purple-500 peer-checked:bg-purple-500 transition flex items-center justify-center">
                {splitStems && <Scissors size={12} className="text-white" />}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                Split Stems
                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded-full font-bold">+{stemsCost} cr</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Separate vocals, drums, bass, and melody — sent to your Create page</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          {/* Balance + total */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500">Your Balance</div>
              <div className="text-sm font-bold text-white flex items-center gap-1">
                <Zap size={14} className="text-cyan-400" />
                {userCredits} credits
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Cost</div>
              <div className={`text-sm font-bold flex items-center gap-1 ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalCost} credits
              </div>
            </div>
          </div>

          {/* Not enough credits warning */}
          {!canAfford && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4 text-sm text-red-300">
              <AlertCircle size={16} />
              <span>Not enough credits — <a href="/pricing" className="underline font-medium">get more</a></span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canAfford || purchasing}
              className={`flex-1 px-4 py-3 font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                canAfford && !purchasing
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.01]'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Download size={16} />
              {purchasing ? 'Processing...' : `Download • ${totalCost} cr`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
