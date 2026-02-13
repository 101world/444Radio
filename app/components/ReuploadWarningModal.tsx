'use client'

import { useState } from 'react'
import { AlertTriangle, Shield, Music, X, GitBranch, UserCheck } from 'lucide-react'

interface ReuploadWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadAsRemix: () => void
  onCreditOriginal: () => void
  onCancel: () => void
  originalCreator: {
    userId: string
    username?: string
    trackId444: string
    title: string
  }
  similarityScore: number
  detectionMethod: string
}

/**
 * Modal shown when upload validation detects a matching track.
 * 
 * "This track originates from @creator.
 *  Original Track ID: 444-2026-XXXX
 *  You can: Upload as remix | Credit original | Cancel"
 */
export default function ReuploadWarningModal({
  isOpen,
  onClose,
  onUploadAsRemix,
  onCreditOriginal,
  onCancel,
  originalCreator,
  similarityScore,
  detectionMethod,
}: ReuploadWarningModalProps) {
  if (!isOpen) return null

  const isBlocked = similarityScore >= 0.85
  const matchPct = Math.round(similarityScore * 100)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className={`p-6 ${isBlocked ? 'bg-red-500/10' : 'bg-yellow-500/10'}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isBlocked ? 'bg-red-500/20' : 'bg-yellow-500/20'
              }`}>
                {isBlocked ? (
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                ) : (
                  <Shield className="w-6 h-6 text-yellow-400" />
                )}
              </div>
              <div>
                <h2 className={`text-lg font-bold ${isBlocked ? 'text-red-400' : 'text-yellow-400'}`}>
                  {isBlocked ? 'Upload Blocked' : 'Similar Track Detected'}
                </h2>
                <p className="text-sm text-gray-400">
                  444Radio Content Protection
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Origin info */}
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-300">
              This track originates from:
            </p>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-white font-medium">
                  @{originalCreator.username || 'unknown'}
                </p>
                <p className="text-xs font-mono text-purple-400">
                  {originalCreator.trackId444}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <Music className="w-3.5 h-3.5" />
              <span>Original Track: {originalCreator.title}</span>
            </div>

            {/* Match details */}
            <div className="flex items-center gap-4 pt-2 border-t border-gray-700">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Match</p>
                <p className={`text-sm font-bold font-mono ${
                  matchPct >= 85 ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {matchPct}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Method</p>
                <p className="text-sm text-gray-300 capitalize">
                  {detectionMethod.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>

          {/* Warning message */}
          {isBlocked ? (
            <p className="text-sm text-red-300">
              This upload has been blocked because it closely matches an existing 444Radio track.
              You cannot publish this as an original release.
            </p>
          ) : (
            <p className="text-sm text-yellow-300">
              This upload has similarities with an existing 444Radio track.
              Consider crediting the original creator.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-2">
          <p className="text-xs text-gray-500 mb-3">You can:</p>

          <button
            onClick={onUploadAsRemix}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors text-left"
          >
            <GitBranch className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-sm text-purple-300 font-medium">Upload as Remix</p>
              <p className="text-xs text-gray-500">Links back to original track with proper attribution</p>
            </div>
          </button>

          {!isBlocked && (
            <button
              onClick={onCreditOriginal}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-left"
            >
              <UserCheck className="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm text-blue-300 font-medium">Credit Original Creator</p>
                <p className="text-xs text-gray-500">Publish with credit to @{originalCreator.username || 'original'}</p>
              </div>
            </button>
          )}

          <button
            onClick={onCancel}
            className="w-full p-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors text-center"
          >
            <p className="text-sm text-gray-400">Cancel Release</p>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-4">
          <p className="text-[10px] text-gray-600 font-mono text-center">
            Protected by 444Radio Content DNA Engine
          </p>
        </div>
      </div>
    </div>
  )
}
