'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, Loader2, Zap, Crown } from 'lucide-react'
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
  const [isProMode, setIsProMode] = useState(false)

  // Standard mode state
  const [duration, setDuration] = useState(5)
  const [top_k, setTopK] = useState(250)
  const [top_p, setTopP] = useState(0)
  const [temperature, setTemperature] = useState(1)
  const [classifier_free_guidance, setClassifierFreeGuidance] = useState(3)
  const [output_format, setOutputFormat] = useState('mp3')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Pro mode state
  const [proDuration, setProDuration] = useState(10)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)

  // Update prompt when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt)
    }
  }, [initialPrompt])

  const creditCost = isProMode ? 3 : 2
  const maxDurationValue = isProMode ? 30 : 10

  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < creditCost) {
      alert(`⚡ You need at least ${creditCost} credits to generate ${isProMode ? 'HQ ' : ''}sound effects!`)
      return
    }

    const validation = validateGenerationPrompt(prompt)
    if (!validation.isValid) {
      const errorMessage = Object.values(validation.errors).join('. ')
      alert(`❌ ${errorMessage}`)
      return
    }

    setIsGenerating(true)
    setGeneratedAudioUrl(null)

    const genType = isProMode ? 'effects-hq' : 'effects'
    const titlePrefix = isProMode ? '[HQ] SFX' : 'SFX'

    const generationId = addGeneration({
      type: genType as 'effects',
      prompt: prompt,
      title: `${titlePrefix}: ${prompt.substring(0, 30)}`
    })

    updateGeneration(generationId, { status: 'generating', progress: 10 })

    if (onGenerationStart) {
      onGenerationStart(prompt, generationId)
      onClose()
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), isProMode ? 320000 : 220000)

      const endpoint = isProMode ? '/api/generate/effects-hq' : '/api/generate/effects'
      const payload = isProMode
        ? { prompt, duration: proDuration }
        : { prompt, duration, top_k, top_p, temperature, classifier_free_guidance, output_format }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      })

      clearTimeout(timeoutId)
      const data = await res.json()

      if (data.success) {
        setGeneratedAudioUrl(data.audioUrl)

        updateGeneration(generationId, {
          status: 'completed',
          result: {
            audioUrl: data.audioUrl,
            title: `${titlePrefix}: ${prompt.substring(0, 30)}`,
            prompt: prompt
          }
        })

        if (onSuccess) {
          onSuccess(data.audioUrl, prompt)
        }

        window.dispatchEvent(new Event('credits:refresh'))
        alert(`🎨 ${isProMode ? 'HQ ' : ''}Sound effects generated! ${data.creditsRemaining} credits remaining`)
      } else {
        updateGeneration(generationId, {
          status: 'failed',
          error: data.error || 'Unknown error'
        })
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)

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
      setIsProMode(false)
      onClose()
    }
  }

  if (!isOpen) return null

  const promptLength = prompt.length
  const isPromptValid = promptLength >= 10 && promptLength <= 300

  // Dynamic colors based on mode
  const borderGlow = isProMode
    ? 'border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.15)]'
    : 'border-purple-500/20'
  const headerIconBg = isProMode ? 'bg-red-500/10' : 'bg-purple-500/10'
  const headerIconColor = isProMode ? 'text-red-400' : 'text-purple-400'
  const ringColor = isProMode ? 'focus:ring-red-500/50' : 'focus:ring-purple-500/50'
  const sliderThumbGradient = isProMode
    ? '[&::-webkit-slider-thumb]:from-red-500 [&::-webkit-slider-thumb]:to-red-600 [&::-webkit-slider-thumb]:shadow-red-500/50 [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:shadow-red-500/50'
    : '[&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-purple-600 [&::-webkit-slider-thumb]:shadow-purple-500/50 [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:shadow-purple-500/50'
  const accentText = isProMode ? 'text-red-400' : 'text-purple-400'
  const accentBadgeBg = isProMode ? 'bg-red-500/10' : 'bg-purple-500/10'
  const buttonGradient = isProMode
    ? 'from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/30'
    : 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-purple-500/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md bg-gradient-to-b from-gray-900/95 to-black/95 border rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl transition-all duration-500 ${borderGlow}`}>

        {/* Pro mode ambient glow overlay */}
        {isProMode && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-red-500/[0.08] rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        )}

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg transition-colors duration-300 ${headerIconBg}`}>
              {isProMode ? (
                <Crown size={20} className={`${headerIconColor} transition-colors duration-300`} />
              ) : (
                <Sparkles size={20} className={`${headerIconColor} transition-colors duration-300`} />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Sound Effects</h3>
              {isProMode && (
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">PRO Mode</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* PRO Toggle Button */}
            <button
              onClick={() => setIsProMode(!isProMode)}
              disabled={isGenerating}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                isProMode
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Zap size={12} className={isProMode ? 'text-red-400' : 'text-gray-500'} />
                PRO
              </span>
              {isProMode && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              disabled={isGenerating}
            >
              <X size={20} className="text-gray-400 hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-6 space-y-5">

          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 block">
              Describe the sound effect
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="thunder, car engine, birds chirping, dog barking..."
              className={`w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 ${ringColor} focus:border-transparent transition-all resize-none`}
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

          {/* Duration Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Duration</span>
              <span className={`text-base font-semibold px-3 py-1 rounded-lg transition-colors duration-300 ${accentText} ${accentBadgeBg}`}>
                {isProMode ? proDuration : duration}s
              </span>
            </div>
            <div className="relative pb-6">
              <input
                type="range"
                min="1"
                max={maxDurationValue}
                value={isProMode ? proDuration : duration}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (isProMode) setProDuration(val)
                  else setDuration(val)
                }}
                className={`w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r ${sliderThumbGradient} [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-lg`}
                disabled={isGenerating}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                <span className="text-xs text-gray-500 font-medium">1s</span>
                <span className="text-xs text-gray-500 font-medium">{maxDurationValue}s</span>
              </div>
            </div>
          </div>

          {/* Advanced Parameters — Standard mode only */}
          {!isProMode && (
            <>
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
            </>
          )}

          {/* Pro mode info badge */}
          {isProMode && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-xl">
              <Crown size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-xs text-red-300/80">
                HQ mode uses CassetteAI for studio-quality sound effects up to 30 seconds
              </span>
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
        <div className="relative px-6 py-4 border-t border-white/10 flex items-center gap-3 bg-black/40">
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className={accentText}>💰</span>
            <span className={`font-semibold ${accentText}`}>{creditCost} credits</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400">Up to {maxDurationValue} seconds</span>
            {isProMode && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-red-400/70 text-xs font-medium">WAV</span>
              </>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={!isPromptValid || isGenerating}
            className={`px-6 py-2.5 bg-gradient-to-r ${buttonGradient} rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px]`}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                {isProMode ? <Crown size={16} /> : <Sparkles size={16} />}
                <span>{isProMode ? 'Generate HQ' : 'Generate'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
