'use client'

import { useState } from 'react'
import { X, Music, Image as ImageIcon, Video, Loader2, Sparkles, Wand2 } from 'lucide-react'

interface UnifiedGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits: number
}

type GenerationType = 'music' | 'image' | 'video'

interface GenerationResult {
  type: GenerationType
  url: string
  status: 'generating' | 'complete' | 'error'
  error?: string
}

export default function UnifiedGenerationModal({ isOpen, onClose, userCredits }: UnifiedGenerationModalProps) {
  const [prompt, setPrompt] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<GenerationType>>(new Set(['music']))
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState<Map<GenerationType, GenerationResult>>(new Map())

  const generationOptions = [
    {
      type: 'music' as GenerationType,
      icon: Music,
      label: 'Music',
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      credits: 2,
      description: '8s AI track'
    },
    {
      type: 'image' as GenerationType,
      icon: ImageIcon,
      label: 'Cover Art',
      color: 'cyan',
      gradient: 'from-cyan-500 to-blue-500',
      credits: 1,
      description: 'Album artwork'
    },
    {
      type: 'video' as GenerationType,
      icon: Video,
      label: 'Video',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
      credits: 3,
      description: '5s visualizer'
    }
  ]

  const toggleType = (type: GenerationType) => {
    const newSelected = new Set(selectedTypes)
    if (newSelected.has(type)) {
      newSelected.delete(type)
    } else {
      newSelected.add(type)
    }
    setSelectedTypes(newSelected)
  }

  const getTotalCredits = () => {
    let total = 0
    selectedTypes.forEach(type => {
      const option = generationOptions.find(opt => opt.type === type)
      if (option) total += option.credits
    })
    return total
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a description')
      return
    }

    const totalCredits = getTotalCredits()
    if (userCredits < totalCredits) {
      alert(`⚡ You need ${totalCredits} credits. You have ${userCredits}.`)
      return
    }

    if (selectedTypes.size === 0) {
      alert('Please select at least one generation type')
      return
    }

    setIsGenerating(true)
    const newResults = new Map<GenerationType, GenerationResult>()

    // Initialize all selected types as generating
    selectedTypes.forEach(type => {
      newResults.set(type, { type, url: '', status: 'generating' })
    })
    setResults(newResults)

    // Generate each type in parallel
    const promises: Promise<void>[] = []

    if (selectedTypes.has('music')) {
      promises.push(generateMusic())
    }

    if (selectedTypes.has('image')) {
      promises.push(generateImage())
    }

    if (selectedTypes.has('video')) {
      promises.push(generateVideo())
    }

    await Promise.allSettled(promises)
    setIsGenerating(false)
  }

  const generateMusic = async () => {
    try {
      // Generate default lyrics if not provided
      const defaultLyrics = `[intro]
AI generated music
${prompt}

[verse]
Feel the rhythm
Let the beat flow

[chorus]
Music for the soul
Let it take control

[outro]
Generated with AI`

      const res = await fetch('/api/generate/music-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          lyrics: defaultLyrics, // Required by API
          bitrate: 256000,
          sample_rate: 44100,
          audio_format: 'mp3'
        })
      })

      const data = await res.json()

      if (data.success) {
        setResults(prev => new Map(prev).set('music', {
          type: 'music',
          url: data.audioUrl,
          status: 'complete'
        }))
      } else {
        throw new Error(data.error || 'Music generation failed')
      }
    } catch (error) {
      setResults(prev => new Map(prev).set('music', {
        type: 'music',
        url: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed'
      }))
    }
  }

  const generateImage = async () => {
    try {
      const res = await fetch('/api/generate/image-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          params: {
            aspect_ratio: '1:1',
            output_quality: 90,
            num_inference_steps: 4
          }
        })
      })

      const data = await res.json()

      if (data.success) {
        setResults(prev => new Map(prev).set('image', {
          type: 'image',
          url: data.imageUrl,
          status: 'complete'
        }))
      } else {
        throw new Error(data.error || 'Image generation failed')
      }
    } catch (error) {
      setResults(prev => new Map(prev).set('image', {
        type: 'image',
        url: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed'
      }))
    }
  }

  const generateVideo = async () => {
    try {
      // Video generation endpoint (to be implemented)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setResults(prev => new Map(prev).set('video', {
        type: 'video',
        url: '',
        status: 'error',
        error: 'Video generation coming soon'
      }))
    } catch (error) {
      setResults(prev => new Map(prev).set('video', {
        type: 'video',
        url: '',
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed'
      }))
    }
  }

  if (!isOpen) return null

  const totalCredits = getTotalCredits()
  const hasResults = results.size > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 rounded-3xl border border-purple-500/20 shadow-2xl shadow-purple-500/10">
        
        {/* Close Button */}
        {!isGenerating && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-purple-400 hover:text-purple-300 transition-colors z-10"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl">
              <Wand2 size={32} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI Content Generator
              </h2>
              <p className="text-purple-400/60 text-sm mt-1">Create music, art, and videos with AI</p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-purple-400 mb-3">
              <Sparkles size={16} className="inline mr-2" />
              Describe what you want to create
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
              placeholder="e.g., 'upbeat electronic dance track with energetic drums and neon synthwave vibes'"
              className="w-full h-32 px-6 py-4 bg-black/40 border border-purple-500/30 rounded-2xl text-purple-100 placeholder:text-purple-400/40 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all"
              maxLength={600}
              disabled={isGenerating}
            />
            <div className="text-xs text-purple-400/60 mt-2">
              {prompt.length}/600 characters
            </div>
          </div>

          {/* Generation Type Selector */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-purple-400 mb-4">
              Select what to generate:
            </label>
            <div className="grid grid-cols-3 gap-4">
              {generationOptions.map((option) => {
                const Icon = option.icon
                const isSelected = selectedTypes.has(option.type)
                const isDisabled = option.type === 'video' // Video not ready yet

                return (
                  <button
                    key={option.type}
                    onClick={() => !isDisabled && toggleType(option.type)}
                    disabled={isGenerating || isDisabled}
                    className={`
                      relative p-6 rounded-2xl border-2 transition-all duration-300
                      ${isSelected 
                        ? `border-${option.color}-500 bg-gradient-to-br ${option.gradient} bg-opacity-20 scale-105 shadow-lg shadow-${option.color}-500/30` 
                        : 'border-white/10 bg-black/20 hover:border-white/30'
                      }
                      ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      disabled:scale-100
                    `}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-black text-xs font-bold">✓</span>
                      </div>
                    )}
                    
                    <div className={`mb-3 text-${option.color}-400`}>
                      <Icon size={32} />
                    </div>
                    
                    <h3 className={`font-bold mb-1 ${isSelected ? `text-${option.color}-400` : 'text-white'}`}>
                      {option.label}
                    </h3>
                    
                    <p className="text-xs text-white/60 mb-2">{option.description}</p>
                    
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <span className="text-yellow-400">⚡</span>
                      <span className={isSelected ? `text-${option.color}-400` : 'text-white/60'}>
                        {option.credits} {option.credits === 1 ? 'credit' : 'credits'}
                      </span>
                    </div>

                    {isDisabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
                        <span className="text-xs text-white/80 font-semibold">Coming Soon</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Results Preview */}
          {hasResults && (
            <div className="mb-6 p-6 bg-black/40 rounded-2xl border border-purple-500/20">
              <h3 className="text-lg font-semibold text-purple-400 mb-4">Generated Content:</h3>
              <div className="space-y-4">
                {Array.from(results.entries()).map(([type, result]) => {
                  const option = generationOptions.find(opt => opt.type === type)!
                  const Icon = option.icon

                  return (
                    <div key={type} className="p-4 bg-black/40 rounded-xl border border-purple-500/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Icon size={20} className={`text-${option.color}-400`} />
                          <span className={`font-semibold text-${option.color}-400`}>{option.label}</span>
                        </div>
                        {result.status === 'generating' && (
                          <Loader2 size={20} className="animate-spin text-purple-400" />
                        )}
                        {result.status === 'complete' && (
                          <span className="text-green-400 text-sm">✓ Complete</span>
                        )}
                        {result.status === 'error' && (
                          <span className="text-red-400 text-sm">✗ {result.error}</span>
                        )}
                      </div>

                      {result.status === 'complete' && result.url && (
                        <>
                          {type === 'music' && (
                            <audio
                              controls
                              src={result.url}
                              className="w-full mt-2"
                              style={{
                                filter: 'hue-rotate(90deg) saturate(1.5)',
                                background: 'rgba(16, 185, 129, 0.1)',
                                borderRadius: '0.75rem',
                                padding: '0.5rem'
                              }}
                            />
                          )}
                          {type === 'image' && (
                            <div className="relative mt-2 rounded-xl overflow-hidden group">
                              <img 
                                src={result.url} 
                                alt="Generated cover art" 
                                className="w-full h-auto rounded-xl"
                              />
                              <a
                                href={result.url}
                                download={`444radio-${type}.${type === 'image' ? 'webp' : 'mp3'}`}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              >
                                <span className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-xl font-semibold">
                                  Download
                                </span>
                              </a>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-500/30">
                <span className="text-xl">⚡</span>
                <span className="text-purple-400 font-bold">{userCredits} credits</span>
              </div>
              {selectedTypes.size > 0 && (
                <div className="text-sm text-purple-400/80">
                  Cost: <span className="font-bold text-purple-400">{totalCredits} credits</span>
                </div>
              )}
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || userCredits < totalCredits || !prompt.trim() || selectedTypes.size === 0}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3 shadow-lg shadow-purple-500/30"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={24} />
                  Generate {selectedTypes.size > 1 ? 'All' : ''}
                </>
              )}
            </button>
          </div>

          {/* Info */}
          {isGenerating && (
            <div className="mt-6 p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
              <p className="text-sm text-purple-400">
                ⏱️ Generating your content... This may take 30-60 seconds per item.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

