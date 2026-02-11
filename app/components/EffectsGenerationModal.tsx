'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'
import { validateGenerationPrompt } from '@/lib/validation'

interface EffectsModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (url: string, prompt: string) => void
  onGenerationStart?: (prompt: string, generationId: string) => void
  initialPrompt?: string
}

export default function EffectsGenerationModal({ 
  isOpen, 
  onClose, 
  userCredits, 
  onSuccess, 
  onGenerationStart, 
  initialPrompt = '' 
}: EffectsModalProps) {
  const { addGeneration, updateGeneration } = useGenerationQueue()
  const [prompt, setPrompt] = useState(initialPrompt)
  
  // Update prompt when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt)
    }
  }, [initialPrompt])
  const [duration, setDuration] = useState(5)
  const [top_k, setTopK] = useState(250)
  const [top_p, setTopP] = useState(0)
  const [temperature, setTemperature] = useState(1)
  const [classifier_free_guidance, setClassifierFreeGuidance] = useState(3)
  const [output_format, setOutputFormat] = useState('mp3')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < 2) {
      alert('⚡ You need at least 2 credits to generate sound effects!')
      return
    }

    // Use validation library for prompt
    const validation = validateGenerationPrompt(prompt)
    if (!validation.isValid) {
      const errorMessage = Object.values(validation.errors).join('. ')
      alert(`❌ ${errorMessage}`)
      return
    }

    setIsGenerating(true)
    setGeneratedAudioUrl(null)
    
    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'effects',
      prompt: prompt,
      title: `SFX: ${prompt.substring(0, 30)}`
    })
    
    // Update status to generating
    updateGeneration(generationId, { status: 'generating', progress: 10 })
    
    // Call onGenerationStart to close modal and show chat immediately
    if (onGenerationStart) {
      onGenerationStart(prompt, generationId)
      onClose()
    }
    
    try {
      // Create timeout controller (220s - longer than server's 180s max)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 220000) // 220 seconds
      
      const res = await fetch('/api/generate/effects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          duration,
          top_k,
          top_p,
          temperature,
          classifier_free_guidance,
          output_format
        })
      })

      clearTimeout(timeoutId)
      const data = await res.json()
      
      if (data.success) {
        setGeneratedAudioUrl(data.audioUrl)
        
        // Update generation queue with success
        updateGeneration(generationId, {
          status: 'completed',
          result: {
            audioUrl: data.audioUrl,
            title: `SFX: ${prompt.substring(0, 30)}`,
            prompt: prompt
          }
        })
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.audioUrl, prompt)
        }
        
        alert(`🎨 Sound effects generated! ${data.creditsRemaining} credits remaining`)
      } else {
        // Update generation queue with failure
        updateGeneration(generationId, {
          status: 'failed',
          error: data.error || 'Unknown error'
        })
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      
      // Check if it's a timeout/abort error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⏱️ Effects generation request timed out')
        updateGeneration(generationId, {
          status: 'failed',
          error: 'Request timed out. Check your Library - effects may have generated. Credits were deducted.'
        })
        alert(`⏱️ Request timed out.\n\n✅ Check your Library - effects may have generated server-side.\n💰 Credits were likely deducted.`)
      } else {
        updateGeneration(generationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        alert('Failed to generate effects')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      setPrompt('')
      setGeneratedAudioUrl(null)
      setShowAdvanced(false)
      onClose()
    }
  }

  if (!isOpen) return null

  const promptLength = prompt.length
  const isPromptValid = promptLength >= 10 && promptLength <= 300

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal - Readable & Clean */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900/95 to-black/95 border border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Sparkles size={20} className="text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Sound Effects</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            disabled={isGenerating}
          >
            <X size={20} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 block">
              Describe the sound effect
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="thunder, car engine, birds chirping, dog barking..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all resize-none"
              rows={2}
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-500">Min 10, max 300 characters</span>
              <span className={`text-xs font-mono font-medium ${
                !isPromptValid ? 'text-red-400' : promptLength > 270 ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {promptLength}/300
              </span>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Duration</span>
              <span className="text-base font-semibold text-purple-400 px-3 py-1 bg-purple-500/10 rounded-lg">{duration}s</span>
            </div>
            <div className="relative pb-6">
              <input
                type="range"
                min="1"
                max="10"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-purple-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/50 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-purple-500/50"
                disabled={isGenerating}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                <span className="text-xs text-gray-500 font-medium">1s</span>
                <span className="text-xs text-gray-500 font-medium">10s</span>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-purple-400/60 hover:text-purple-400 transition-colors flex items-center gap-2 font-medium"
            disabled={isGenerating}
          >
            <span className="text-sm">{showAdvanced ? '▼' : '▶'}</span>
            Advanced Parameters
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Top K</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={top_k}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Top P</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={top_p}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Temperature</label>
                <input
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Guidance</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={classifier_free_guidance}
                  onChange={(e) => setClassifierFreeGuidance(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Output Format</label>
                <select
                  value={output_format}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent"
                  disabled={isGenerating}
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </div>
            </div>
          )}

          {/* Generated */}
          {generatedAudioUrl && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                <span>✓</span> Generated Successfully
              </p>
              <audio src={generatedAudioUrl} controls className="w-full" />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3 bg-black/40">
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="text-purple-400">💰</span>
            <span className="font-semibold text-purple-400">2 credits</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">Up to 10 seconds</span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!isPromptValid || isGenerating}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px]"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
