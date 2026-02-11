'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Repeat } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'
import { validateGenerationPrompt } from '@/lib/validation'

interface LoopersModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (variations: Array<{ url: string; variation: number }>, prompt: string) => void
  onGenerationStart?: (prompt: string, generationId: string) => void
  initialPrompt?: string
}

export default function LoopersGenerationModal({ 
  isOpen, 
  onClose, 
  userCredits, 
  onSuccess, 
  onGenerationStart, 
  initialPrompt = '' 
}: LoopersModalProps) {
  const { addGeneration, updateGeneration } = useGenerationQueue()
  const [prompt, setPrompt] = useState(initialPrompt)
  
  // Update prompt when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt)
    }
  }, [initialPrompt])
  
  const [bpm, setBpm] = useState(120)
  const [max_duration, setMaxDuration] = useState(8)
  const [variations, setVariations] = useState(2)
  const [model_version, setModelVersion] = useState('large')
  const [output_format, setOutputFormat] = useState('wav')
  const [classifier_free_guidance, setClassifierFreeGuidance] = useState(3)
  const [temperature, setTemperature] = useState(1)
  const [top_k, setTopK] = useState(250)
  const [top_p, setTopP] = useState(0)
  const [seed, setSeed] = useState(-1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedVariations, setGeneratedVariations] = useState<Array<{ url: string; variation: number }>>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Calculate credit cost based on duration
  const creditCost = max_duration <= 8 ? 6 : 7

  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < creditCost) {
      alert(`⚡ You need at least ${creditCost} credits to generate loops!`)
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
    setGeneratedVariations([])
    
    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'music', // Use 'music' type since it's audio content
      prompt: prompt,
      title: `Loop: ${prompt.substring(0, 30)}`
    })
    
    // Update status to generating
    updateGeneration(generationId, { status: 'generating', progress: 10 })
    
    // Call onGenerationStart to close modal and show chat immediately
    if (onGenerationStart) {
      onGenerationStart(prompt, generationId)
      onClose()
    }
    
    try {
      const res = await fetch('/api/generate/loopers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          bpm,
          max_duration,
          variations,
          model_version,
          output_format,
          classifier_free_guidance,
          temperature,
          top_k,
          top_p,
          seed
        })
      })

      const data = await res.json()
      
      if (data.success) {
        setGeneratedVariations(data.variations)
        
        // Update generation queue with success
        updateGeneration(generationId, {
          status: 'completed',
          result: {
            audioUrl: data.variations[0]?.url, // Primary variation
            title: `Loop: ${prompt.substring(0, 30)}`,
            prompt: prompt
          }
        })
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.variations, prompt)
        }
        
        alert(`🔄 ${data.variations.length} loop variations generated! ${data.creditsRemaining} credits remaining`)
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
      alert('Failed to generate loops')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      setPrompt('')
      setGeneratedVariations([])
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
      <div className="relative w-full max-w-lg bg-gradient-to-b from-gray-900/95 to-black/95 border border-cyan-500/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-gray-900/95 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Repeat size={20} className="text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Loop Generator</h3>
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
              Describe the loop
            </label>
            
            {/* Loop Prompt Suggestion Tags */}
            <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg">
              <p className="text-xs text-gray-400 mb-2 font-medium">💡 Quick Tags:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'techno kick', 'deep bass', 'ambient pad', 'melodic trance',
                  'drum and bass', 'house beat', 'synth lead', 'acid bass',
                  'trap hi-hats', '808 drums', 'reverb', 'distorted'
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const newPrompt = prompt ? `${prompt}, ${tag}` : tag
                      setPrompt(newPrompt.slice(0, 300))
                    }}
                    disabled={isGenerating}
                    className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded text-xs text-cyan-300 hover:text-cyan-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Melodic euro trance, drum and bass, techno kick, ambient pad..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all resize-none"
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

          {/* BPM */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">BPM</span>
              <span className="text-base font-semibold text-cyan-400 px-3 py-1 bg-cyan-500/10 rounded-lg">{bpm}</span>
            </div>
            <div className="relative pb-6">
              <input
                type="range"
                min="60"
                max="180"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-cyan-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-500/50 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-cyan-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-cyan-500/50"
                disabled={isGenerating}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                <span className="text-xs text-gray-500 font-medium">60</span>
                <span className="text-xs text-gray-500 font-medium">180</span>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Duration</span>
              <span className="text-base font-semibold text-cyan-400 px-3 py-1 bg-cyan-500/10 rounded-lg">{max_duration}s</span>
            </div>
            <div className="relative pb-6">
              <input
                type="range"
                min="1"
                max="20"
                value={max_duration}
                onChange={(e) => setMaxDuration(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-cyan-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-500/50 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-cyan-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-cyan-500/50"
                disabled={isGenerating}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                <span className="text-xs text-gray-500 font-medium">1s</span>
                <span className="text-xs text-gray-500 font-medium">20s</span>
              </div>
            </div>
          </div>

          {/* Variations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Variations</span>
              <span className="text-base font-semibold text-cyan-400 px-3 py-1 bg-cyan-500/10 rounded-lg">{variations}</span>
            </div>
            <div className="relative pb-6">
              <input
                type="range"
                min="1"
                max="2"
                value={variations}
                onChange={(e) => setVariations(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-cyan-500 [&::-webkit-slider-thumb]:to-cyan-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-500/50 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-cyan-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:shadow-cyan-500/50"
                disabled={isGenerating}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                <span className="text-xs text-gray-500 font-medium">1</span>
                <span className="text-xs text-gray-500 font-medium">2</span>
              </div>
            </div>
          </div>

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-cyan-400/60 hover:text-cyan-400 transition-colors flex items-center gap-2 font-medium"
            disabled={isGenerating}
          >
            <span className="text-sm">{showAdvanced ? '▼' : '▶'}</span>
            Advanced Parameters
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Model Version</label>
                <select
                  value={model_version}
                  onChange={(e) => setModelVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
                  disabled={isGenerating}
                >
                  <option value="large">Large (Best Quality)</option>
                  <option value="medium">Medium</option>
                  <option value="small">Small (Faster)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Top K</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={top_k}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
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
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Seed</label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value))}
                  placeholder="-1 (random)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">Output Format</label>
                <select
                  value={output_format}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
                  disabled={isGenerating}
                >
                  <option value="wav">WAV (Best Quality)</option>
                  <option value="mp3">MP3 (Smaller Size)</option>
                </select>
              </div>
            </div>
          )}

          {/* Generated */}
          {generatedVariations.length > 0 && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3">
              <p className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                <span>✓</span> {generatedVariations.length} Variations Generated
              </p>
              {generatedVariations.map((variation) => (
                <div key={variation.variation} className="space-y-1">
                  <p className="text-xs text-gray-400">Variation {variation.variation}</p>
                  <audio src={variation.url} controls className="w-full" />
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3 bg-black/40 sticky bottom-0">
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="text-cyan-400">💰</span>
            <span className="font-semibold text-cyan-400">{creditCost} credits</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">{variations} variations</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">Up to {max_duration}s</span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!isPromptValid || isGenerating}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px]"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Repeat size={16} />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
