'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Film, Loader2, Camera, CameraOff, Volume2, VolumeX, Upload, Image as ImageIcon, Wand2 } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'

interface VisualizerModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (videoUrl: string, prompt: string, mediaId: string | null) => void
  onGenerationStart?: (prompt: string, generationId: string) => void
  initialPrompt?: string
}

/** Calculate credits: ceil(duration * 0.75) */
function calcCredits(duration: number): number {
  return Math.ceil(duration * 0.75)
}

export default function VisualizerModal({
  isOpen,
  onClose,
  userCredits,
  onSuccess,
  onGenerationStart,
  initialPrompt = '',
}: VisualizerModalProps) {
  const { addGeneration, updateGeneration } = useGenerationQueue()

  // ── Form state ──
  const [prompt, setPrompt] = useState(initialPrompt)
  const [duration, setDuration] = useState(5)
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9')
  const [cameraFixed, setCameraFixed] = useState(false)
  const [generateAudio, setGenerateAudio] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt)
  }, [initialPrompt])

  // ── Image handling ──
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10 MB')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const clearImage = useCallback(() => {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
  }, [imagePreview])

  // ── Generate ──
  const creditCost = calcCredits(duration)
  const canGenerate = prompt.trim().length >= 3 && !isGenerating && (userCredits === undefined || userCredits >= creditCost)

  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    setStatusMsg('Preparing...')

    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'video',
      prompt,
      title: `Video: ${prompt.substring(0, 30)}`,
    })
    updateGeneration(generationId, { status: 'generating', progress: 5 })

    // Notify parent to show progress bar in chat
    if (onGenerationStart) {
      onGenerationStart(prompt, generationId)
      onClose()
    }

    try {
      // If user uploaded an image, we need to first upload it to get a URL
      let imageUrl: string | undefined
      if (imageFile) {
        setStatusMsg('Uploading reference image...')
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('type', 'image')
        const uploadRes = await fetch('/api/storage/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          imageUrl = uploadData.url
        }
      }

      // Start generation via NDJSON stream
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 360000) // 6 min timeout

      const res = await fetch('/api/generate/visualizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: prompt.trim(),
          imageUrl,
          duration,
          resolution,
          aspectRatio,
          cameraFixed,
          generateAudio,
        }),
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      // Read NDJSON stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line)

            if (data.status === 'processing') {
              const progress = Math.min(80, 10 + (data.predictionStatus === 'processing' ? 40 : 20))
              updateGeneration(generationId, { status: 'generating', progress })
              setStatusMsg(data.message || 'Generating video...')
            } else if (data.status === 'uploading') {
              updateGeneration(generationId, { status: 'generating', progress: 85 })
              setStatusMsg('Saving to library...')
            } else if (data.status === 'complete') {
              updateGeneration(generationId, {
                status: 'completed',
                progress: 100,
                result: {
                  videoUrl: data.videoUrl,
                  title: `Visualizer: ${prompt.substring(0, 30)}`,
                },
              })
              setStatusMsg('')
              setIsGenerating(false)
              if (onSuccess) onSuccess(data.videoUrl, prompt, data.mediaId)
              return
            } else if (data.status === 'error') {
              throw new Error(data.message || 'Generation failed')
            }
          } catch (parseErr) {
            // Ignore JSON parse errors for incomplete lines
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }

      // If we got here without a complete status, something went wrong
      throw new Error('Stream ended without completion')

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Generation failed'
      console.error('Visualizer generation error:', errMsg)
      updateGeneration(generationId, { status: 'failed', error: errMsg })
      setStatusMsg('')
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && !isGenerating && onClose()}>
      <div className="w-full max-w-lg bg-gradient-to-b from-gray-900 via-gray-950 to-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10">

        {/* ── Header ── */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
          {/* Film grain overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)' }}
          />
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 border border-purple-500/30 rounded-xl">
                <Film size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Visualizer</h2>
                <p className="text-xs text-gray-500">
                  {imageFile ? 'Image → Video' : 'Text → Video'} &middot; Seedance 1.5 Pro
                </p>
              </div>
            </div>
            <button onClick={onClose} disabled={isGenerating}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin">

          {/* Prompt input */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Scene Description</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="A young astronaut in a worn spacesuit sits in the dim cockpit of a spacecraft..."
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
              rows={3}
              maxLength={1000}
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between mt-1">
              <span className={`text-[10px] ${prompt.length > 900 ? 'text-red-400' : prompt.length > 700 ? 'text-yellow-400' : 'text-gray-600'}`}>
                {prompt.length}/1000
              </span>
            </div>
          </div>

          {/* Image Upload (for image-to-video) */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
              Reference Image <span className="text-gray-600 font-normal">(optional — enables image-to-video)</span>
            </label>
            {imagePreview ? (
              <div className="relative group">
                <img src={imagePreview} alt="Reference" className="w-full h-40 object-cover rounded-xl border border-white/10" />
                <button onClick={clearImage}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} className="text-white" />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded-lg">
                  <span className="text-[10px] text-purple-300 font-semibold">IMAGE → VIDEO MODE</span>
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={isGenerating}
                className="w-full h-24 border-2 border-dashed border-white/10 hover:border-purple-500/40 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-30">
                <ImageIcon size={20} className="text-gray-600" />
                <span className="text-xs text-gray-600">Click to upload an image</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>

          {/* Duration Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Duration</label>
              <span className="text-sm font-bold text-white">{duration}s</span>
            </div>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              disabled={isGenerating}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>2s</span>
              <span>5s</span>
              <span>8s</span>
              <span>12s</span>
            </div>
          </div>

          {/* Controls Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Resolution */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Resolution</label>
              <div className="flex gap-1">
                {(['480p', '720p', '1080p'] as const).map(r => (
                  <button key={r} onClick={() => setResolution(r)} disabled={isGenerating}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                      resolution === r
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Aspect Ratio</label>
              <div className="flex gap-1">
                {(['16:9', '9:16', '1:1'] as const).map(ar => (
                  <button key={ar} onClick={() => setAspectRatio(ar)} disabled={isGenerating}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                      aspectRatio === ar
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                    }`}>
                    {ar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex gap-3">
            {/* Camera Fixed */}
            <button onClick={() => setCameraFixed(!cameraFixed)} disabled={isGenerating}
              className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                cameraFixed
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/8'
              }`}>
              {cameraFixed ? <CameraOff size={16} /> : <Camera size={16} />}
              <div className="text-left">
                <div className="text-xs font-semibold">{cameraFixed ? 'Camera Locked' : 'Camera Free'}</div>
                <div className="text-[10px] text-gray-500">{cameraFixed ? 'Static shot' : 'Dynamic motion'}</div>
              </div>
            </button>

            {/* Generate Audio */}
            <button onClick={() => setGenerateAudio(!generateAudio)} disabled={isGenerating}
              className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all ${
                generateAudio
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/8'
              }`}>
              {generateAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <div className="text-left">
                <div className="text-xs font-semibold">{generateAudio ? 'With Audio' : 'No Audio'}</div>
                <div className="text-[10px] text-gray-500">{generateAudio ? 'Synced sound' : 'Video only'}</div>
              </div>
            </button>
          </div>

          {/* Warning note about cost */}
          {resolution === '1080p' && generateAudio && (
            <div className="px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
              <p className="text-[10px] text-orange-300">
                1080p with audio uses the highest quality tier — generation may take 2-4 minutes.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/50">
          {/* Status message */}
          {statusMsg && (
            <div className="flex items-center gap-2 mb-3">
              <Loader2 size={14} className="text-purple-400 animate-spin" />
              <span className="text-xs text-gray-400">{statusMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Credit cost display */}
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                userCredits !== undefined && userCredits < creditCost
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              }`}>
                {creditCost} {creditCost === 1 ? 'credit' : 'credits'}
              </div>
              <span className="text-[10px] text-gray-600">{duration}s &middot; {resolution}</span>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-400 rounded-xl text-white text-sm font-bold
                hover:from-purple-500 hover:to-purple-300 transition-all shadow-lg shadow-purple-500/30
                disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Generate Video
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
