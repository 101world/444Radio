'use client'

import { useState } from 'react'
import { X, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'

interface CoverArtModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits: number
}

export default function CoverArtGenerationModal({ isOpen, onClose, userCredits }: CoverArtModalProps) {
  const [prompt, setPrompt] = useState('')
  const [inferenceSteps, setInferenceSteps] = useState(4)
  const [outputQuality, setOutputQuality] = useState(90)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const handleGenerate = async () => {
    if (userCredits < 1) {
      alert('⚡ You need at least 1 credit to generate cover art!')
      return
    }

    if (!prompt.trim()) {
      alert('Please enter a cover art description')
      return
    }

    setIsGenerating(true)
    
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          params: {
            num_inference_steps: inferenceSteps,
            output_quality: outputQuality
          }
        })
      })

      const data = await res.json()
      
      if (data.success) {
        alert('🎨 Cover art generated successfully!')
        onClose()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate cover art. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-cyan-950/50 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
        
        {!isGenerating && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-cyan-500/20 rounded-full">
              <ImageIcon size={32} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-cyan-400">Generate Cover Art</h2>
              <p className="text-cyan-400/60 text-sm">Powered by Flux Schnell</p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-cyan-400 mb-2">
              Cover Art Description
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the album cover you want... e.g., 'vibrant neon cityscape at night with geometric patterns, cyberpunk aesthetic, professional album artwork'"
              className="w-full h-32 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 placeholder:text-cyan-400/40 focus:outline-none focus:border-cyan-500 resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* Parameters */}
          <div className="mb-8 p-6 rounded-xl border border-cyan-500/20 bg-black/40 space-y-6">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <Sparkles size={20} />
              Advanced Parameters
            </h3>
            
            {/* Inference Steps */}
            <div>
              <label className="block text-sm text-cyan-400/80 mb-2">
                Inference Steps: <span className="font-bold text-cyan-400">{inferenceSteps}</span>
              </label>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={inferenceSteps}
                onChange={(e) => setInferenceSteps(parseInt(e.target.value))}
                className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-cyan-400/60 mt-1">
                <span>1 (Fastest)</span>
                <span>2</span>
                <span>3</span>
                <span>4 (Best)</span>
              </div>
              <p className="text-xs text-cyan-400/60 mt-2">
                More steps = better quality but slower generation (~10-20 seconds)
              </p>
            </div>

            {/* Output Quality */}
            <div>
              <label className="block text-sm text-cyan-400/80 mb-2">
                Output Quality: <span className="font-bold text-cyan-400">{outputQuality}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={outputQuality}
                onChange={(e) => setOutputQuality(parseInt(e.target.value))}
                className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-cyan-400/60 mt-1">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <p className="text-xs text-cyan-400/60 mt-2">
                Higher quality = larger file size
              </p>
            </div>

            {/* Image Specs */}
            <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <p className="text-sm text-cyan-400/80 mb-2">
                <span className="font-semibold">📐 Image Specifications:</span>
              </p>
              <ul className="text-xs text-cyan-400/60 space-y-1">
                <li>• Aspect Ratio: 1:1 (Square)</li>
                <li>• Format: WebP (optimized)</li>
                <li>• Style: Album cover artwork</li>
              </ul>
            </div>

            {/* Tip */}
            <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <p className="text-sm text-cyan-400/80">
                <span className="font-semibold">💡 Tip:</span> Include style keywords like "professional", "vibrant", "minimalist", "artistic" for better results.
              </p>
            </div>
          </div>

          {/* Cost & Generate Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-full border border-cyan-500/30">
              <span className="text-xl">⚡</span>
              <span className="text-cyan-400 font-bold">1 credit</span>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || userCredits < 1 || !prompt.trim()}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImageIcon size={20} />
                  Generate Cover Art
                </>
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="mt-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <p className="text-sm text-cyan-400">
                ⏱️ Generating your cover art... This typically takes 10-20 seconds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
