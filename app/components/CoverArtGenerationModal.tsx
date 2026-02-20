'use client'

import { useState } from 'react'
import { X, Image as ImageIcon, Loader2, Sparkles, Download } from 'lucide-react'
import { validateGenerationPrompt } from '@/lib/validation'

interface CoverArtModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onGenerated?: (imageUrl: string) => void
  onSuccess?: (url: string, prompt: string) => void
}

const aspectRatios = [
  { value: '1:1', label: 'Square (1:1)', emoji: '⬜' },
  { value: '16:9', label: 'Landscape (16:9)', emoji: '📺' },
  { value: '9:16', label: 'Portrait (9:16)', emoji: '📱' },
  { value: '4:5', label: 'Instagram (4:5)', emoji: '📷' },
  { value: '5:4', label: 'Print (5:4)', emoji: '🖼️' },
]

const outputFormats = [
  { value: 'jpg', label: 'JPEG', desc: 'Universal' },
  { value: 'webp', label: 'WebP', desc: 'Best compression' },
  { value: 'png', label: 'PNG', desc: 'Lossless' },
]

export default function CoverArtGenerationModal({ isOpen, onClose, userCredits, onGenerated, onSuccess }: CoverArtModalProps) {
  const [prompt, setPrompt] = useState('')
  const [inferenceSteps, setInferenceSteps] = useState(8)
  const [outputQuality, setOutputQuality] = useState(100)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [outputFormat, setOutputFormat] = useState('jpg')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  
  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < 1) {
      alert('⚡ You need at least 1 credit to generate cover art!')
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
    setGeneratedImageUrl(null)
    
    try {
      // Convert aspect ratio to width/height for z-image-turbo
      const aspectToSize: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1024, height: 576 },
        '9:16': { width: 576, height: 1024 },
        '4:5': { width: 820, height: 1024 },
        '5:4': { width: 1024, height: 820 },
      }
      const dimensions = aspectToSize[aspectRatio] || { width: 1024, height: 1024 }
      
      // Generate image directly (no song record needed)
      const res = await fetch('/api/generate/image-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          params: {
            width: dimensions.width,
            height: dimensions.height,
            num_inference_steps: inferenceSteps,
            output_quality: outputQuality,
            output_format: outputFormat,
            guidance_scale: 0,
            go_fast: false
          }
        })
      })

      const data = await res.json()
      
      if (data.success) {
        setGeneratedImageUrl(data.imageUrl)
        onGenerated?.(data.imageUrl)
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.imageUrl, prompt)
        }
        
        alert(`🎨 Cover art generated! ${data.creditsRemaining} credits remaining`)
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

  const handleClose = () => {
    setPrompt('')
    setGeneratedImageUrl(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-900 to-cyan-950/50 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 max-h-[90vh] overflow-y-auto">
        
        {!isGenerating && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-cyan-400 hover:text-cyan-300 transition-colors z-10"
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
              <p className="text-cyan-400/60 text-sm">Powered by Flux Schnell (12B params)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Parameters */}
            <div>
              {/* Prompt Input */}
              <div className="mb-6">
                <label htmlFor="cover-art-prompt" className="block text-sm font-medium text-cyan-400 mb-2">
                  Image Description
                </label>
                <textarea
                  id="cover-art-prompt"
                  name="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Professional album cover art, vibrant colors, artistic composition, studio lighting..."
                  className="w-full h-32 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-100 placeholder:text-cyan-400/40 focus:outline-none focus:border-cyan-500 resize-none"
                  disabled={isGenerating}
                />
              </div>

              {/* Parameters */}
              <div className="mb-6 p-6 rounded-xl border border-cyan-500/20 bg-black/40 space-y-6">
                <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                  <Sparkles size={20} />
                  Parameters
                </h3>
                
                {/* Aspect Ratio */}
                <div>
                  <label className="block text-sm text-cyan-400/80 mb-3">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {aspectRatios.map((ar) => (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        disabled={isGenerating}
                        className={`p-3 rounded-lg border-2 transition-all text-sm ${
                          aspectRatio === ar.value
                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                            : 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400/60 hover:border-cyan-500/50'
                        } disabled:opacity-50`}
                      >
                        <div className="font-bold">{ar.emoji} {ar.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

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
                    <span>1 Fast</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4 Best</span>
                  </div>
                </div>

                {/* Output Quality */}
                <div>
                  <label className="block text-sm text-cyan-400/80 mb-2">
                    Quality: <span className="font-bold text-cyan-400">{outputQuality}%</span>
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="10"
                    value={outputQuality}
                    onChange={(e) => setOutputQuality(parseInt(e.target.value))}
                    className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={isGenerating}
                  />
                </div>

                {/* Output Format */}
                <div>
                  <label className="block text-sm text-cyan-400/80 mb-3">
                    Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {outputFormats.map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => setOutputFormat(fmt.value)}
                        disabled={isGenerating}
                        className={`p-2 rounded-lg border-2 transition-all text-xs ${
                          outputFormat === fmt.value
                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400'
                            : 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400/60 hover:border-cyan-500/50'
                        } disabled:opacity-50`}
                      >
                        <div className="font-bold">{fmt.label}</div>
                        <div className="text-cyan-400/60">{fmt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20 mb-6">
                <p className="text-sm text-cyan-400/80">
                  <span className="font-semibold">💡 Tips:</span> Use detailed descriptions, mention style (photorealistic, illustration, abstract), lighting, and colors for best results.
                </p>
              </div>

              {/* Generate Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-full border border-cyan-500/30">
                  <span className="text-xl">⚡</span>
                  <span className="text-cyan-400 font-bold">1 credit</span>
                </div>
                
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || (userCredits !== undefined && userCredits < 1) || !prompt.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={20} />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Preview */}
            <div>
              <div className="sticky top-0">
                <label className="block text-sm font-medium text-cyan-400 mb-2">
                  Preview
                </label>
                <div className="aspect-square bg-black/60 rounded-xl border-2 border-cyan-500/30 overflow-hidden flex items-center justify-center">
                  {generatedImageUrl ? (
                    <div className="relative w-full h-full group">
                      <img 
                        src={generatedImageUrl} 
                        alt="Generated cover art"
                        className="w-full h-full object-contain"
                      />
                      <a
                        href={generatedImageUrl}
                        download="cover-art.webp"
                        className="absolute top-4 right-4 p-3 bg-cyan-500/80 hover:bg-cyan-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download size={20} className="text-white" />
                      </a>
                    </div>
                  ) : isGenerating ? (
                    <div className="text-center">
                      <Loader2 size={48} className="animate-spin text-cyan-400 mb-4 mx-auto" />
                      <p className="text-cyan-400">Generating image...</p>
                      <p className="text-cyan-400/60 text-sm mt-2">10-20 seconds</p>
                    </div>
                  ) : (
                    <div className="text-center text-cyan-400/40">
                      <ImageIcon size={64} className="mb-2 mx-auto" />
                      <p>Your generated image will appear here</p>
                    </div>
                  )}
                </div>

                {generatedImageUrl && (
                  <div className="mt-4 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <p className="text-xs text-cyan-400/80">
                      ✅ Image generated successfully!<br/>
                      Aspect Ratio: {aspectRatio} | Format: {outputFormat.toUpperCase()} | Quality: {outputQuality}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

