'use client'

import { useState } from 'react'
import { X, Music, Loader2, Sparkles } from 'lucide-react'

interface MusicModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits: number
}

export default function MusicGenerationModal({ isOpen, onClose, userCredits }: MusicModalProps) {
  const [prompt, setPrompt] = useState('')
  const [styleStrength, setStyleStrength] = useState(0.8)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const handleGenerate = async () => {
    if (userCredits < 1) {
      alert('⚡ You need at least 1 credit to generate music!')
      return
    }

    if (!prompt.trim()) {
      alert('Please enter a music description')
      return
    }

    setIsGenerating(true)
    
    try {
      // Call API to generate music
      const res = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          params: { style_strength: styleStrength }
        })
      })

      const data = await res.json()
      
      if (data.success) {
        alert('🎵 Music generated successfully!')
        onClose()
        // TODO: Show completion modal or redirect to profile
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate music. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-green-950/50 rounded-2xl border border-green-500/30 shadow-2xl shadow-green-500/20">
        
        {/* Close Button */}
        {!isGenerating && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-green-400 hover:text-green-300 transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-green-500/20 rounded-full">
              <Music size={32} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-green-400">Generate Music</h2>
              <p className="text-green-400/60 text-sm">Powered by MiniMax Music-1.5</p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-green-400 mb-2">
              Music Description <span className="text-green-400/60">(max 600 characters)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
              placeholder="Describe the music you want to create... e.g., 'upbeat electronic dance track with energetic drums and synthesizers'"
              className="w-full h-32 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 placeholder:text-green-400/40 focus:outline-none focus:border-green-500 resize-none"
              maxLength={600}
              disabled={isGenerating}
            />
            <div className="text-xs text-green-400/60 mt-1">
              {prompt.length}/600 characters
            </div>
          </div>

          {/* Parameters */}
          <div className="mb-8 p-6 rounded-xl border border-green-500/20 bg-black/40">
            <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
              <Sparkles size={20} />
              Advanced Parameters
            </h3>
            
            {/* Style Strength */}
            <div className="mb-4">
              <label className="block text-sm text-green-400/80 mb-2">
                Style Strength: <span className="font-bold text-green-400">{styleStrength.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={styleStrength}
                onChange={(e) => setStyleStrength(parseFloat(e.target.value))}
                className="w-full h-2 bg-green-500/20 rounded-lg appearance-none cursor-pointer accent-green-500"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-green-400/60 mt-1">
                <span>0.0 (Loose)</span>
                <span>0.5 (Balanced)</span>
                <span>1.0 (Strict)</span>
              </div>
              <p className="text-xs text-green-400/60 mt-2">
                Higher values = more adherence to your description
              </p>
            </div>

            {/* Info Box */}
            <div className="mt-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-sm text-green-400/80">
                <span className="font-semibold">💡 Tip:</span> Be specific about genre, instruments, tempo, and mood for best results.
              </p>
            </div>
          </div>

          {/* Cost & Generate Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30">
              <span className="text-xl">⚡</span>
              <span className="text-green-400 font-bold">1 credit</span>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || userCredits < 1 || !prompt.trim()}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Music size={20} />
                  Generate Music
                </>
              )}
            </button>
          </div>

          {/* Generation Info */}
          {isGenerating && (
            <div className="mt-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <p className="text-sm text-cyan-400">
                ⏱️ Generating your music... This typically takes 30-60 seconds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
