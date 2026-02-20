'use client'

import { useRouter } from 'next/navigation'
import { Zap, ArrowRight, X } from 'lucide-react'

interface OutOfCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  errorMessage?: string
  freeCreditsRemaining?: number
}

export default function OutOfCreditsModal({ 
  isOpen, 
  onClose, 
  errorMessage,
  freeCreditsRemaining = 0
}: OutOfCreditsModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  // Determine message type based on error
  const isFreeCreditsExhausted = errorMessage?.includes('$1 access') || errorMessage?.includes('Free credits exhausted')
  const needsWalletDeposit = errorMessage?.includes('$1') || errorMessage?.includes('wallet')

  const handleGoToPricing = () => {
    onClose()
    router.push('/pricing')
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gradient-to-b from-gray-900 to-black border-2 border-cyan-500/30 rounded-2xl max-w-md w-full p-8 relative shadow-2xl shadow-cyan-500/20 animate-in fade-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500/50 flex items-center justify-center animate-pulse">
            <Zap className="text-cyan-400" size={40} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center text-white mb-3">
          {isFreeCreditsExhausted ? "Free Credits Used Up! 🎵" : "Out of Credits"}
        </h2>

        {/* Message */}
        <div className="space-y-3 mb-6">
          {isFreeCreditsExhausted ? (
            <>
              <p className="text-gray-300 text-center text-sm leading-relaxed">
                You've successfully generated music for free! Ready for more?
              </p>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 space-y-2">
                <p className="text-cyan-400 font-semibold text-sm">
                  💰 $1 Access + Pay Per Usage
                </p>
                <ul className="text-gray-300 text-xs space-y-1 ml-4 list-disc">
                  <li>One-time $1 deposit unlocks the app forever</li>
                  <li>Pay only for what you generate (2-5 credits per track)</li>
                  <li>Credits never expire</li>
                  <li>Full access to all features</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-gray-300 text-center text-sm leading-relaxed">
              {errorMessage || "You don't have enough credits to continue. Add more to keep creating!"}
            </p>
          )}
          
          {freeCreditsRemaining > 0 && (
            <p className="text-sm text-gray-400 text-center">
              {freeCreditsRemaining} free credits remaining
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGoToPricing}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>{needsWalletDeposit ? "Get $1 Access" : "Get More Credits"}</span>
            <ArrowRight size={20} />
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-all"
          >
            Maybe Later
          </button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Supporting independent AI music creators 🎶
        </p>
      </div>
    </div>
  )
}
