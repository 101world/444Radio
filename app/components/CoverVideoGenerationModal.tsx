'use client'

import { useState } from 'react'
import { X, Video, Loader2, Sparkles } from 'lucide-react'

interface CoverVideoModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits: number
}

export default function CoverVideoGenerationModal({ isOpen, onClose, userCredits }: CoverVideoModalProps) {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<'5s' | '10s'>('5s')
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p')
  const [isGenerating, setIsGenerating] = useState(false)
  
  const handleGenerate = async () => {
    if (userCredits < 1) {
      alert('⚡ You need at least 1 credit to generate a cover video!')
      return
    }

    if (!prompt.trim()) {
      alert('Please enter a video description')
      return
    }

    setIsGenerating(true)
    
    try {
      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          params: {
            duration,
            resolution
          }
        })
      })

      const data = await res.json()
      
      if (data.success) {
        alert('🎬 Cover video generated successfully!')
        onClose()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate cover video. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-purple-950/50 rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/20">
        
        {!isGenerating && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-purple-500/20 rounded-full">
              <Video size={32} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-purple-400">Generate Cover Video</h2>
              <p className="text-purple-400/60 text-sm">Powered by Seedance-1-lite</p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-purple-400 mb-2">
              Video Description
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the music video visuals you want... e.g., 'abstract colorful particles flowing in space, dynamic motion, psychedelic patterns, music video aesthetic'"
              className="w-full h-32 px-4 py-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400 placeholder:text-purple-400/40 focus:outline-none focus:border-purple-500 resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* Parameters */}
          <div className="mb-8 p-6 rounded-xl border border-purple-500/20 bg-black/40 space-y-6">
            <h3 className="text-lg font-semibold text-purple-400 mb-4 flex items-center gap-2">
              <Sparkles size={20} />
              Advanced Parameters
            </h3>
            
            {/* Duration */}
            <div>
              <label className="block text-sm text-purple-400/80 mb-3">
                Video Duration
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setDuration('5s')}
                  disabled={isGenerating}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    duration === '5s'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="text-lg font-bold text-purple-400">5 Seconds</div>
                  <div className="text-xs text-purple-400/60 mt-1">Faster generation</div>
                </button>
                <button
                  onClick={() => setDuration('10s')}
                  disabled={isGenerating}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    duration === '10s'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="text-lg font-bold text-purple-400">10 Seconds</div>
                  <div className="text-xs text-purple-400/60 mt-1">Longer video</div>
                </button>
              </div>
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-sm text-purple-400/80 mb-3">
                Video Resolution
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setResolution('480p')}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    resolution === '480p'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="font-bold text-purple-400">480p</div>
                  <div className="text-xs text-purple-400/60">Fast</div>
                </button>
                <button
                  onClick={() => setResolution('720p')}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    resolution === '720p'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="font-bold text-purple-400">720p</div>
                  <div className="text-xs text-purple-400/60">HD</div>
                </button>
                <button
                  onClick={() => setResolution('1080p')}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    resolution === '1080p'
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                  } disabled:opacity-50`}
                >
                  <div className="font-bold text-purple-400">1080p</div>
                  <div className="text-xs text-purple-400/60">Full HD</div>
                </button>
              </div>
              <p className="text-xs text-purple-400/60 mt-2">
                Higher resolution = better quality but longer generation time
              </p>
            </div>

            {/* Generation Time Estimate */}
            <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <p className="text-sm text-purple-400/80 mb-2">
                <span className="font-semibold">⏱️ Estimated Generation Time:</span>
              </p>
              <div className="text-xs text-purple-400/60 space-y-1">
                <div>• 5s @ 480p: ~60 seconds</div>
                <div>• 5s @ 720p: ~90 seconds</div>
                <div>• 10s @ 1080p: ~120 seconds</div>
              </div>
            </div>

            {/* Tip */}
            <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <p className="text-sm text-purple-400/80">
                <span className="font-semibold">💡 Tip:</span> Use descriptive words like &ldquo;flowing&rdquo;, &ldquo;pulsating&rdquo;, &ldquo;swirling&rdquo; to create dynamic motion.
              </p>
            </div>
          </div>

          {/* Cost & Generate Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-500/30">
              <span className="text-xl">⚡</span>
              <span className="text-purple-400 font-bold">1 credit</span>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || userCredits < 1 || !prompt.trim()}
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Video size={20} />
                  Generate Video
                </>
              )}
            </button>
          </div>

          {isGenerating && (
            <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <p className="text-sm text-purple-400">
                ⏱️ Generating your video... This typically takes 60-120 seconds depending on settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
