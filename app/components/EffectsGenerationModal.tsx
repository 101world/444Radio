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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-purple-400" />
            Generate Sound Effects
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            disabled={isGenerating}
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Describe the sound *</span>
              <span className={`text-xs ${
                !isPromptValid ? 'text-red-400' : promptLength > 270 ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {promptLength}/300
              </span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Formula F1 cars driving by, ocean waves crashing, footsteps on gravel..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {/* Duration Slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
              <span>Duration</span>
              <span className="text-purple-400 font-bold">{duration}s</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full accent-purple-500"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1s</span>
              <span>10s</span>
            </div>
          </div>

          {/* Advanced Parameters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            disabled={isGenerating}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Parameters
          </button>

          {/* Advanced Parameters */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-lg">
              
              {/* Top K */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                  <span>Top K</span>
                  <span className="text-purple-400 font-mono text-xs">{top_k}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={top_k}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-500">Reduces sampling to the k most likely tokens</p>
              </div>

              {/* Top P */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                  <span>Top P</span>
                  <span className="text-purple-400 font-mono text-xs">{top_p}</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={top_p}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-500">When 0, uses top_k sampling</p>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                  <span>Temperature</span>
                  <span className="text-purple-400 font-mono text-xs">{temperature}</span>
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-500">Higher = more diversity</p>
              </div>

              {/* Classifier Free Guidance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                  <span>Guidance Scale</span>
                  <span className="text-purple-400 font-mono text-xs">{classifier_free_guidance}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={classifier_free_guidance}
                  onChange={(e) => setClassifierFreeGuidance(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  disabled={isGenerating}
                />
                <p className="text-xs text-gray-500">Higher = more adherence to prompt</p>
              </div>

              {/* Output Format */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Output Format</label>
                <select
                  value={output_format}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  disabled={isGenerating}
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </div>

            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <p className="text-sm text-purple-300">
              💰 <span className="font-bold">2 credits</span> • Generate realistic sound effects up to 10 seconds
            </p>
          </div>

          {/* Generated Audio Preview */}
          {generatedAudioUrl && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-300 mb-2">✅ Generated successfully!</p>
              <audio src={generatedAudioUrl} controls className="w-full" />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-sm font-semibold text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!isPromptValid || isGenerating}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Effects
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
