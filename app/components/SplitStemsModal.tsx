/**
 * Split Stems Modal — Select individual stems to isolate from audio
 * Uses ryan5453/demucs htdemucs_6s model for 6-stem separation
 * Each stem costs 1 credit; output is WAV for DAW import
 */
'use client'

import { useState } from 'react'
import { X, Loader2, Scissors, Download, Play, Pause, Music2, ArrowDownToLine } from 'lucide-react'

export type StemType = 'drums' | 'bass' | 'vocals' | 'guitar' | 'piano' | 'other'

interface StemOption {
  key: StemType
  label: string
  description: string
  emoji: string
  color: string
  gradient: string
  border: string
}

const STEM_OPTIONS: StemOption[] = [
  { key: 'vocals', label: 'Vocals', description: 'Isolated vocal track', emoji: '🎤', color: 'text-pink-400', gradient: 'from-pink-500/20 to-purple-500/20', border: 'border-pink-500/30 hover:border-pink-400/60' },
  { key: 'drums', label: 'Drums', description: 'Percussion & beats', emoji: '🥁', color: 'text-orange-400', gradient: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/30 hover:border-orange-400/60' },
  { key: 'bass', label: 'Bass', description: 'Low-end bassline', emoji: '🎸', color: 'text-purple-400', gradient: 'from-purple-500/20 to-indigo-500/20', border: 'border-purple-500/30 hover:border-purple-400/60' },
  { key: 'guitar', label: 'Guitar', description: 'Isolated guitar', emoji: '🎸', color: 'text-yellow-400', gradient: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30 hover:border-yellow-400/60' },
  { key: 'piano', label: 'Piano', description: 'Keys & piano', emoji: '🎹', color: 'text-blue-400', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30 hover:border-blue-400/60' },
  { key: 'other', label: 'Instrumental', description: 'Everything else', emoji: '🎶', color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-teal-500/20', border: 'border-cyan-500/30 hover:border-cyan-400/60' },
]

interface SplitStemsModalProps {
  isOpen: boolean
  onClose: () => void
  audioUrl: string
  trackTitle?: string
  /** Called when user picks a stem. Parent handles the API call. */
  onSplitStem: (stem: StemType) => void
  /** Currently processing stems (allows multiple in parallel) */
  processingStem?: StemType | null
  /** Results from completed splits: { vocals: url, drums: url, ... } */
  completedStems?: Record<string, string>
  /** For playback */
  onPlayStem?: (stemKey: string, url: string, label: string) => void
  playingId?: string | null
  /** For DAW import */
  onImportToDAW?: (url: string, title: string) => void
  isInDAW?: boolean
  userCredits?: number | null
}

export default function SplitStemsModal({
  isOpen,
  onClose,
  audioUrl,
  trackTitle,
  onSplitStem,
  processingStem,
  completedStems = {},
  onPlayStem,
  playingId,
  onImportToDAW,
  isInDAW,
  userCredits,
}: SplitStemsModalProps) {
  if (!isOpen) return null

  const completedCount = Object.keys(completedStems).length

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-gray-950 via-black to-gray-950 border border-purple-500/30 rounded-2xl max-w-lg w-full shadow-2xl shadow-purple-500/20 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/40">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Split Stems</h2>
              <p className="text-xs text-gray-400 truncate max-w-[250px]">
                {trackTitle || 'Audio Track'} — WAV output
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stem Buttons */}
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-400 mb-4">
            Choose a stem to isolate. Each extraction costs <span className="text-purple-400 font-bold">1 credit</span> and outputs a high-quality <span className="text-cyan-400 font-bold">WAV</span> file ready for DAW import.
          </p>

          {userCredits !== null && userCredits !== undefined && (
            <div className="text-xs text-gray-500 mb-2">
              You have <span className="text-white font-bold">{userCredits}</span> credits
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {STEM_OPTIONS.map(opt => {
              const isCompleted = !!completedStems[opt.key]
              const isProcessing = processingStem === opt.key
              const stemUrl = completedStems[opt.key]
              const isPlayingThis = playingId === `stem-modal-${opt.key}`

              return (
                <div key={opt.key} className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden ${opt.border} ${isCompleted ? 'bg-gradient-to-br ' + opt.gradient : 'bg-gray-900/50'}`}>
                  {/* Main stem button */}
                  <button
                    onClick={() => {
                      if (!isCompleted && !isProcessing) {
                        onSplitStem(opt.key)
                      }
                    }}
                    disabled={isProcessing || isCompleted || (userCredits !== null && userCredits !== undefined && userCredits < 1)}
                    className="w-full p-4 text-left transition-all disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${isCompleted ? 'text-white' : opt.color}`}>
                          {opt.label}
                        </div>
                        <div className="text-xs text-gray-400">{opt.description}</div>
                      </div>
                      {isProcessing && (
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin flex-shrink-0" />
                      )}
                      {isCompleted && (
                        <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-400 text-xs">✓</span>
                        </div>
                      )}
                      {!isProcessing && !isCompleted && (
                        <div className="text-[10px] text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                          1 credit
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Action row when stem is completed */}
                  {isCompleted && stemUrl && (
                    <div className="flex items-center gap-1 px-3 pb-3 pt-0">
                      {/* Play/Pause */}
                      {onPlayStem && (
                        <button
                          onClick={() => onPlayStem(`stem-modal-${opt.key}`, stemUrl, opt.label)}
                          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                          title={`Play ${opt.label}`}
                        >
                          {isPlayingThis ? <Pause size={12} className="text-white" /> : <Play size={12} className="text-white" />}
                        </button>
                      )}
                      {/* Download WAV */}
                      <a
                        href={stemUrl}
                        download={`${(trackTitle || 'track').replace(/[^a-zA-Z0-9 _-]/g, '')}-${opt.key}.wav`}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                        title={`Download ${opt.label} WAV`}
                      >
                        <Download size={12} className="text-white" />
                      </a>
                      {/* Import to DAW */}
                      {isInDAW && onImportToDAW && (
                        <button
                          onClick={() => onImportToDAW(stemUrl, `${trackTitle || 'track'}-${opt.key}`)}
                          className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors"
                          title={`Import ${opt.label} to DAW`}
                        >
                          <ArrowDownToLine size={10} className="text-cyan-400" />
                          <span className="text-[9px] text-cyan-400/80 font-medium">DAW</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Info Footer */}
        <div className="p-5 border-t border-purple-900/30">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
            <div className="flex items-start gap-3">
              <Music2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="text-gray-300">
                  Powered by <span className="text-purple-400 font-semibold">Demucs htdemucs_6s</span> — 6-stem AI separation.
                  Output is lossless <span className="text-cyan-400 font-semibold">WAV (int24)</span> for pro-quality DAW import.
                </p>
                {completedCount > 0 && (
                  <p className="text-purple-400 font-semibold">
                    {completedCount} stem{completedCount > 1 ? 's' : ''} completed — {completedCount} credit{completedCount > 1 ? 's' : ''} used
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-3 px-4 py-3 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 text-white font-semibold transition-all border border-gray-700/50 text-sm"
          >
            {completedCount > 0 ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
