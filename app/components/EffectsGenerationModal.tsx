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
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal - Ultra Minimal */}
      <div className="relative w-full max-w-[420px] bg-gradient-to-b from-gray-900/90 to-black/90 border border-purple-500/[0.08] rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl">
        
        {/* Header - Minimal */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.03]">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-purple-400/80" />
            <h3 className="text-[13px] font-medium text-white/80">Sound Effects</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-0.5 rounded hover:bg-white/5 transition-colors"
            disabled={isGenerating}
          >
            <X size={13} className="text-gray-600" />
          </button>
        </div>

        {/* Content - Ultra Tight */}
        <div className="p-3 space-y-2.5">
          
          {/* Prompt - Minimal */}
          <div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="thunder, car engine, birds chirping..."
              className="w-full px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg text-white text-[13px] placeholder-gray-700 focus:outline-none focus:border-purple-500/20 focus:bg-white/[0.03] transition-all resize-none"
              rows={1}
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between px-0.5 mt-1">
              <span className="text-[9px] text-gray-700">up to 300 chars</span>
              <span className={`text-[9px] font-mono ${
                !isPromptValid ? 'text-red-400' : promptLength > 270 ? 'text-yellow-400' : 'text-gray-700'
              }`}>
                {promptLength}
              </span>
            </div>
          </div>

          {/* Duration - Minimal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600">Duration</span>
              <span className="text-[11px] font-medium text-purple-400">{duration}s</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="1"
                max="10"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-0.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-purple-500/40 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0"
                disabled={isGenerating}
              />
              <div className="absolute -bottom-2.5 left-0 right-0 flex justify-between">
                <span className="text-[8px] text-gray-700">1</span>
                <span className="text-[8px] text-gray-700">10</span>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[10px] text-purple-400/40 hover:text-purple-400/70 transition-colors flex items-center gap-0.5"
            disabled={isGenerating}
          >
            <span className="text-[8px]">{showAdvanced ? '▼' : '▶'}</span>
            Advanced
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <div>
                <label className="text-[8px] text-gray-700 uppercase tracking-wider mb-0.5 block">Top K</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={top_k}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full px-1.5 py-0.5 bg-white/[0.02] border border-white/[0.04] rounded text-white text-[11px] focus:outline-none focus:border-purple-500/20"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-[8px] text-gray-700 uppercase tracking-wider mb-0.5 block">Top P</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={top_p}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full px-1.5 py-0.5 bg-white/[0.02] border border-white/[0.04] rounded text-white text-[11px] focus:outline-none focus:border-purple-500/20"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-[8px] text-gray-700 uppercase tracking-wider mb-0.5 block">Temp</label>
                <input
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full px-1.5 py-0.5 bg-white/[0.02] border border-white/[0.04] rounded text-white text-[11px] focus:outline-none focus:border-purple-500/20"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-[8px] text-gray-700 uppercase tracking-wider mb-0.5 block">Guide</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={classifier_free_guidance}
                  onChange={(e) => setClassifierFreeGuidance(parseInt(e.target.value))}
                  className="w-full px-1.5 py-0.5 bg-white/[0.02] border border-white/[0.04] rounded text-white text-[11px] focus:outline-none focus:border-purple-500/20"
                  disabled={isGenerating}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[8px] text-gray-700 uppercase tracking-wider mb-0.5 block">Format</label>
                <select
                  value={output_format}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-1.5 py-0.5 bg-white/[0.02] border border-white/[0.04] rounded text-white text-[11px] focus:outline-none focus:border-purple-500/20"
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
            <div className="p-1.5 bg-green-500/[0.04] border border-green-500/10 rounded">
              <p className="text-[9px] text-green-400/70 mb-1">✓ Done</p>
              <audio src={generatedAudioUrl} controls className="w-full h-6" />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-white/[0.03] flex items-center gap-2 bg-black/30">
          <div className="flex-1 flex items-center gap-1 text-[9px]">
            <span className="text-purple-400/60">💰</span>
            <span className="text-purple-400/50">2</span>
            <span className="text-gray-800">•</span>
            <span className="text-gray-700">≤10s</span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!isPromptValid || isGenerating}
            className="px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded transition-all flex items-center justify-center gap-1 text-[10px] font-medium text-white shadow-lg shadow-purple-500/15 disabled:opacity-30 disabled:cursor-not-allowed min-w-[85px]"
          >
            {isGenerating ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>Gen...</span>
              </>
            ) : (
              <>
                <Sparkles size={11} />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
