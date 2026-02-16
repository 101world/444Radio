/**
 * Stem Split Modal - Select output format before splitting stems
 */
'use client'

import { useState } from 'react'
import { X, Music2, Download } from 'lucide-react'

interface StemSplitModalProps {
  isOpen: boolean
  onClose: () => void
  onSplit: (format: 'mp3' | 'wav') => void
  clipName: string
  isProcessing?: boolean
}

export default function StemSplitModal({ 
  isOpen, 
  onClose, 
  onSplit, 
  clipName,
  isProcessing = false 
}: StemSplitModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'mp3' | 'wav'>('mp3')

  if (!isOpen) return null

  const handleSplit = () => {
    onSplit(selectedFormat)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-950 via-black to-gray-950 border border-teal-500/30 rounded-2xl max-w-md w-full shadow-2xl shadow-teal-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-teal-900/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/40">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Split into Stems</h2>
              <p className="text-sm text-gray-400 mt-0.5 truncate max-w-[250px]">{clipName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800/50 text-gray-400 hover:text-white transition-all"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-white mb-3">
              Output Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* MP3 Option */}
              <button
                onClick={() => setSelectedFormat('mp3')}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedFormat === 'mp3'
                    ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-teal-400 shadow-lg shadow-teal-500/30'
                    : 'bg-gray-900/50 border-gray-800 hover:border-teal-700/50'
                }`}
                disabled={isProcessing}
              >
                <div className="text-center">
                  <div className="text-lg font-bold text-white mb-1">MP3</div>
                  <div className="text-xs text-gray-400">Smaller files</div>
                  <div className="text-xs text-teal-400 mt-1">Recommended</div>
                </div>
              </button>

              {/* WAV Option */}
              <button
                onClick={() => setSelectedFormat('wav')}
                className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedFormat === 'wav'
                    ? 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-teal-400 shadow-lg shadow-teal-500/30'
                    : 'bg-gray-900/50 border-gray-800 hover:border-teal-700/50'
                }`}
                disabled={isProcessing}
              >
                <div className="text-center">
                  <div className="text-lg font-bold text-white mb-1">WAV</div>
                  <div className="text-xs text-gray-400">Lossless quality</div>
                  <div className="text-xs text-cyan-400 mt-1">Pro quality</div>
                </div>
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="text-white font-semibold">What you'll get:</p>
                <ul className="text-gray-300 space-y-1 text-xs">
                  <li>• Vocals track (isolated vocals)</li>
                  <li>• Drums track (percussion)</li>
                  <li>• Bass track (bass instruments)</li>
                  <li>• Other track (remaining instruments)</li>
                </ul>
                <p className="text-teal-400 font-semibold mt-2">Cost: 1 credit per stem</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 p-6 border-t border-teal-900/30">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-900/80 hover:bg-gray-800/80 text-white font-semibold transition-all border border-gray-700/50"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleSplit}
            className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-bold transition-all shadow-lg shadow-teal-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Split Stems'}
          </button>
        </div>
      </div>
    </div>
  )
}
