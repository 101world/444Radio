'use client'

import React from 'react'
import { X, Loader2, Scissors, Download } from 'lucide-react'

interface StemSplitterModalProps {
  isOpen: boolean
  onClose: () => void
  isSplitting: boolean
  selectedAudio: string | null
  stemResults: any
  onSplit: () => void
}

export default function StemSplitterModal({
  isOpen,
  onClose,
  isSplitting,
  selectedAudio,
  stemResults,
  onSplit
}: StemSplitterModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/20 max-w-2xl w-full">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Stem Splitter
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            <p className="text-gray-400 text-sm">
              Separate audio into individual stems: vocals, instrumental, drums, bass, and more.
            </p>

            {!stemResults ? (
              <>
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="text-sm font-medium text-purple-400 mb-2">
                    Selected Track:
                  </div>
                  <div className="text-white">
                    {selectedAudio ? 'Audio track selected' : 'No track selected'}
                  </div>
                </div>

                <button
                  onClick={onSplit}
                  disabled={isSplitting || !selectedAudio}
                  className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg shadow-xl shadow-purple-500/30"
                >
                  {isSplitting ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Splitting Stems (1-2 min)...
                    </>
                  ) : (
                    <>
                      <Scissors size={24} />
                      Split Stems
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="text-sm font-medium text-green-400 mb-4">
                    ✅ Stems separated successfully!
                  </div>
                  {Object.entries(stemResults).map(([key, url]: [string, any]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Scissors size={20} className="text-purple-400" />
                        <span className="text-white font-medium capitalize">{key}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.open(url, '_blank')}
                          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <Download size={16} />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    onClose()
                    // Reset logic would be handled by parent
                  }}
                  className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
