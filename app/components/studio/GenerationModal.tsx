'use client'

import React, { useState } from 'react'
import { X, Loader2, Sparkles } from 'lucide-react'

interface GenerationModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: () => Promise<void>
  generating: boolean
  progress: string
  step: number
  prompt: string
  setPrompt: React.Dispatch<React.SetStateAction<string>>
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  genre: string
  setGenre: React.Dispatch<React.SetStateAction<string>>
  bpm: string
  setBpm: React.Dispatch<React.SetStateAction<string>>
  isInstrumental: boolean
  setIsInstrumental: React.Dispatch<React.SetStateAction<boolean>>
  lyrics: string
  setLyrics: React.Dispatch<React.SetStateAction<string>>
}

export default function GenerationModal({
  isOpen,
  onClose,
  onGenerate,
  generating,
  progress,
  step,
  prompt,
  setPrompt,
  title,
  setTitle,
  genre,
  setGenre,
  bpm,
  setBpm,
  isInstrumental,
  setIsInstrumental,
  lyrics,
  setLyrics
}: GenerationModalProps) {
  const handleGenerate = () => {
    onGenerate()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              AI Music Generation
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Describe your track *
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-4 text-white resize-none focus:border-cyan-500 focus:outline-none"
                rows={4}
                placeholder="e.g., Uplifting electronic dance track with synths and heavy bass..."
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <input
                type="checkbox"
                checked={isInstrumental}
                onChange={(e) => setIsInstrumental(e.target.checked)}
                className="w-5 h-5 accent-purple-500"
              />
              <label className="text-sm font-medium text-purple-400">
                Instrumental Mode (no lyrics)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title (auto-generated if empty)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="e.g., Neon Dreams"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Genre (auto-detected if empty)
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="e.g., Electronic"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                BPM (auto-detected if empty)
              </label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                placeholder="e.g., 128"
                min="60"
                max="200"
              />
            </div>

            {!isInstrumental && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Lyrics (auto-generated if empty)
                </label>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-4 text-white resize-none focus:border-cyan-500 focus:outline-none font-mono text-sm"
                  rows={8}
                  placeholder="Leave empty for AI-generated lyrics or paste your own..."
                />
              </div>
            )}

            <div className="flex flex-col gap-4 pt-4">
              {generating && progress && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-cyan-300 font-medium">{progress}</span>
                    <span className="text-cyan-400 text-sm">Step {step}/5</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-500"
                      style={{ width: `${(step / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleGenerate}
                  disabled={generating || !prompt.trim()}
                  className="flex-1 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg shadow-xl shadow-purple-500/30"
                >
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={24} />
                      Generate Track
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={generating}
                  className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
