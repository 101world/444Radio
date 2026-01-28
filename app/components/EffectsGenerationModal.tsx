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
  onGenerationStart?: (prompt: string) => void
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
      onGenerationStart(prompt)
      onClose()
    }
    
    try {
      const res = await fetch('/api/generate/effects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      updateGeneration(generationId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      alert('Failed to generate effects')
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
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-black/95 border border-purple-500/20 rounded-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            Sound Effects
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            disabled={isGenerating}
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Prompt Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Describe the sound</label>
              <span className={`text-xs font-mono ${
                !isPromptValid ? 'text-red-400' : promptLength > 270 ? 'text-yellow-400' : 'text-gray-600'
              }`}>
                {promptLength}/300
              </span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Formula F1 cars driving by, ocean waves, thunder..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
              rows={2}
              disabled={isGenerating}
            />
          </div>

          {/* Duration Slider - Compact */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Duration</label>
              <span className="text-xs font-mono text-purple-400">{duration}s</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-1.5 accent-purple-500 rounded-full"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>1s</span>
              <span>10s</span>
            </div>
          </div>

          {/* Advanced Parameters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
            disabled={isGenerating}
          >
            <span>{showAdvanced ? '▼' : '▶'}</span>
            Advanced
          </button>

          {/* Advanced Parameters - Compact Grid */}
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 border border-white/5 rounded-lg">
              
              {/* Top K */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Top K</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={top_k}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs"
                  disabled={isGenerating}
                />
              </div>

              {/* Top P */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Top P</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={top_p}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs"
                  disabled={isGenerating}
                />
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Temp</label>
                <input
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs"
                  disabled={isGenerating}
                />
              </div>

              {/* Guidance */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Guidance</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={classifier_free_guidance}
                  onChange={(e) => setClassifierFreeGuidance(parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs"
                  disabled={isGenerating}
                />
              </div>

              {/* Output Format */}
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Format</label>
                <select
                  value={output_format}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-white text-xs"
                  disabled={isGenerating}
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </div>

            </div>
          )}

          {/* Info Box - Compact */}
          <div className="flex items-center justify-between px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <span className="text-xs text-purple-300">💰 2 credits</span>
            <span className="text-[10px] text-purple-400/60">Up to 10 seconds</span>
          </div>

          {/* Generated Audio Preview */}
          {generatedAudioUrl && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-300 mb-2">✅ Generated!</p>
              <audio src={generatedAudioUrl} controls className="w-full h-8" />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex gap-2">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-xs font-medium text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!isPromptValid || isGenerating}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-medium text-white shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
