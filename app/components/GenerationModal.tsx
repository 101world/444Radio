'use client'

import { useEffect, useState } from 'react'
import { X, Music, Image as ImageIcon, Video, Check, Loader2 } from 'lucide-react'

interface GenerationStep {
  id: string
  name: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  icon: React.ComponentType<{ size?: number; className?: string }>
  preview?: string
  error?: string
}

interface GenerationModalProps {
  isOpen: boolean
  onClose: () => void
  songId: string
  prompt: string
  outputType: 'image' | 'video'
  onComplete?: (data: { audioUrl: string; coverUrl: string }) => void
}

export default function GenerationModal({ isOpen, onClose, songId, prompt, outputType, onComplete }: GenerationModalProps) {
  const [steps, setSteps] = useState<GenerationStep[]>([
    { id: 'music', name: 'Generating Music', status: 'processing', icon: Music },
    { id: 'cover', name: outputType === 'image' ? 'Creating Cover Art' : 'Creating Cover Video', status: 'pending', icon: outputType === 'image' ? ImageIcon : Video },
    { id: 'combine', name: 'Finalizing', status: 'pending', icon: Check },
  ])

  const [currentPreview, setCurrentPreview] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Prediction parameters for advanced options
  const [musicParams, setMusicParams] = useState({
    style_strength: 0.8, // 0.0 to 1.0 for MiniMax
  })
  
  const [imageParams, setImageParams] = useState({
    num_inference_steps: 4, // 1-4 for Flux Schnell
    output_quality: 90, // 1-100
  })
  
  const [videoParams, setVideoParams] = useState({
    duration: '5s', // '5s' or '10s'
    resolution: '720p', // '480p', '720p', '1080p'
  })

  useEffect(() => {
    if (isOpen && songId) {
      startGeneration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, songId])

  const startGeneration = async () => {
    try {
      // Step 1: Generate Music with MiniMax
      updateStep('music', 'processing')
      const musicRes = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          songId, 
          prompt,
          params: musicParams 
        }),
      })
      const musicData = await musicRes.json()
      
      if (musicData.success) {
        setAudioUrl(musicData.audioUrl)
        updateStep('music', 'complete', musicData.audioUrl)
        
        // Step 2: Generate Cover (Image or Video)
        updateStep('cover', 'processing')
        const coverRes = await fetch(`/api/generate/${outputType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            songId, 
            prompt: prompt,
            params: outputType === 'image' ? imageParams : videoParams
          }),
        })
        const coverData = await coverRes.json()
        
        if (coverData.success) {
          setCurrentPreview(coverData.coverUrl)
          updateStep('cover', 'complete', coverData.coverUrl)
          
          // Step 3: Combine (or just mark as complete for image)
          updateStep('combine', 'processing')
          
          // For image: Just update the song record
          // For video: Combine audio + video
          const finalRes = await fetch('/api/generate/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              songId, 
              audioUrl: musicData.audioUrl, 
              coverUrl: coverData.coverUrl,
              outputType 
            }),
          })
          const finalData = await finalRes.json()
          
          if (finalData.success) {
            updateStep('combine', 'complete')
            
            // Notify parent component
            if (onComplete && musicData.audioUrl && coverData.coverUrl) {
              onComplete({
                audioUrl: musicData.audioUrl,
                coverUrl: coverData.coverUrl
              })
            }
          } else {
            updateStep('combine', 'error', undefined, finalData.error)
          }
        } else {
          updateStep('cover', 'error', undefined, coverData.error)
        }
      } else {
        updateStep('music', 'error', undefined, musicData.error)
      }
    } catch (error) {
      console.error('Generation error:', error)
      const currentStep = steps.find(s => s.status === 'processing')
      if (currentStep) {
        updateStep(currentStep.id, 'error', undefined, 'Generation failed. Please try again.')
      }
    }
  }

  const updateStep = (id: string, status: GenerationStep['status'], preview?: string, error?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, status, preview, error } : step
    ))
  }

  const isComplete = steps.every(s => s.status === 'complete')
  const hasError = steps.some(s => s.status === 'error')
  const isGenerating = steps.some(s => s.status === 'processing')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-green-950/50 rounded-2xl border border-green-500/30 shadow-2xl shadow-green-500/20 max-h-[90vh] overflow-y-auto">
        {/* Close button - only show when complete or error */}
        {(isComplete || hasError) && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-green-400 hover:text-green-300 transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              {isComplete ? '🎉 Generation Complete!' : hasError ? '❌ Generation Failed' : '⚡ Generating Your Track...'}
            </h2>
            <p className="text-green-400/60 text-sm">{prompt}</p>
          </div>

          {/* Advanced Parameters - Show before generation starts */}
          {!isGenerating && !isComplete && !hasError && (
            <div className="mb-8 p-6 rounded-xl border border-green-500/30 bg-black/40 space-y-6">
              <h3 className="text-lg font-bold text-green-400 mb-4">🎛️ Advanced Parameters</h3>
              
              {/* Music Parameters */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-cyan-400">Music Generation (MiniMax)</h4>
                <div>
                  <label className="block text-sm text-green-400/80 mb-2">
                    Style Strength: {musicParams.style_strength}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={musicParams.style_strength}
                    onChange={(e) => setMusicParams({ ...musicParams, style_strength: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-green-500/20 rounded-lg appearance-none cursor-pointer accent-green-500"
                  />
                  <p className="text-xs text-green-400/60 mt-1">Higher values = more adherence to prompt style</p>
                </div>
              </div>

              {/* Image Parameters */}
              {outputType === 'image' && (
                <div className="space-y-3 pt-3 border-t border-green-500/20">
                  <h4 className="text-sm font-semibold text-cyan-400">Cover Art (Flux Schnell)</h4>
                  <div>
                    <label className="block text-sm text-green-400/80 mb-2">
                      Inference Steps: {imageParams.num_inference_steps}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="1"
                      value={imageParams.num_inference_steps}
                      onChange={(e) => setImageParams({ ...imageParams, num_inference_steps: parseInt(e.target.value) })}
                      className="w-full h-2 bg-green-500/20 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <p className="text-xs text-green-400/60 mt-1">1-4 steps (higher = better quality, slower)</p>
                  </div>
                  <div>
                    <label className="block text-sm text-green-400/80 mb-2">
                      Output Quality: {imageParams.output_quality}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      value={imageParams.output_quality}
                      onChange={(e) => setImageParams({ ...imageParams, output_quality: parseInt(e.target.value) })}
                      className="w-full h-2 bg-green-500/20 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                  </div>
                </div>
              )}

              {/* Video Parameters */}
              {outputType === 'video' && (
                <div className="space-y-3 pt-3 border-t border-green-500/20">
                  <h4 className="text-sm font-semibold text-cyan-400">Cover Video (Seedance)</h4>
                  <div>
                    <label className="block text-sm text-green-400/80 mb-2">Duration</label>
                    <select
                      value={videoParams.duration}
                      onChange={(e) => setVideoParams({ ...videoParams, duration: e.target.value })}
                      className="w-full px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 focus:outline-none focus:border-green-500"
                    >
                      <option value="5s">5 seconds</option>
                      <option value="10s">10 seconds</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-green-400/80 mb-2">Resolution</label>
                    <select
                      value={videoParams.resolution}
                      onChange={(e) => setVideoParams({ ...videoParams, resolution: e.target.value })}
                      className="w-full px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 focus:outline-none focus:border-green-500"
                    >
                      <option value="480p">480p (Fast)</option>
                      <option value="720p">720p (Balanced)</option>
                      <option value="1080p">1080p (Best Quality)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Area */}
          {(currentPreview || audioUrl) && (
            <div className="mb-8 rounded-xl overflow-hidden border border-green-500/30 bg-black/40">
              {/* Show cover (image or video) */}
              {currentPreview && (
                <div className="relative">
                  {outputType === 'image' ? (
                    <img src={currentPreview} alt="Cover Art" className="w-full h-80 object-cover" />
                  ) : (
                    <video src={currentPreview} className="w-full h-80 object-cover" controls autoPlay loop muted />
                  )}
                </div>
              )}
              
              {/* Show audio player */}
              {audioUrl && (
                <div className="p-6 bg-gradient-to-r from-green-500/10 to-cyan-500/10 border-t border-green-500/30">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-400 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🎵</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-green-400 font-bold truncate">{prompt}</p>
                      <p className="text-green-400/60 text-sm">Generated Track</p>
                    </div>
                  </div>
                  <audio src={audioUrl} controls className="w-full" />
                </div>
              )}
            </div>
          )}

          {/* Progress Steps */}
          <div className="space-y-4 mb-8">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={`step-${step.id}`}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    step.status === 'complete'
                      ? 'bg-green-500/10 border-green-500/50'
                      : step.status === 'processing'
                      ? 'bg-cyan-500/10 border-cyan-500/50 animate-pulse'
                      : step.status === 'error'
                      ? 'bg-red-500/10 border-red-500/50'
                      : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 ${
                    step.status === 'complete' 
                      ? 'text-green-400' 
                      : step.status === 'processing'
                      ? 'text-cyan-400'
                      : step.status === 'error'
                      ? 'text-red-400'
                      : 'text-slate-500'
                  }`}>
                    {step.status === 'processing' ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : step.status === 'complete' ? (
                      <Check size={24} />
                    ) : (
                      <Icon size={24} />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      step.status === 'complete' 
                        ? 'text-green-400' 
                        : step.status === 'processing'
                        ? 'text-cyan-400'
                        : step.status === 'error'
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}>
                      {step.name}
                    </p>
                    {step.error && (
                      <p className="text-red-400/80 text-sm mt-1">{step.error}</p>
                    )}
                  </div>

                  {/* Status Badge */}
                  {step.status === 'complete' && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                      Complete
                    </span>
                  )}
                  {step.status === 'processing' && (
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-medium rounded-full">
                      Processing...
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Action Buttons */}
          {isComplete && (
            <div className="flex gap-4">
              <button
                onClick={() => window.location.href = `/profile/${songId}`}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-xl font-bold hover:scale-105 transition-transform"
              >
                View on Profile
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-800 text-green-400 rounded-xl font-medium hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {hasError && (
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl font-medium hover:bg-red-500/30 transition-colors"
            >
              Close & Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
