'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Film, Loader2, Camera, CameraOff, Volume2, VolumeX, Upload, Image as ImageIcon, Wand2, Sparkles, Shuffle, Zap, Eye, Clock, Maximize, Monitor } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'

// ─── 20 Curated Visualizer Prompts ───
const SUGGESTED_PROMPTS = [
  'A lone figure walks through golden hour light on an empty desert highway, cinematic lens flare, 35mm film grain',
  'Rain-soaked neon streets of Tokyo at midnight, reflections on wet asphalt, slow camera drift, hyper-realistic',
  'Aerial shot of ocean waves crashing against volcanic black sand, drone footage, 4K cinematic color grading',
  'Close-up of hands playing a grand piano in a dimly lit jazz club, shallow depth of field, warm amber lighting',
  'A vintage muscle car drives through a tunnel of cherry blossom trees, sunlight filtering through petals, cinematic slow motion',
  'Ethereal fog rolling through a bioluminescent forest at twilight, soft cyan and purple glow, dreamlike atmosphere',
  'A floating island city above the clouds at sunrise, volumetric lighting, Studio Ghibli meets photorealism',
  'Underwater ballet of jellyfish illuminated by deep sea light, slow graceful movement, dark teal ocean',
  'Northern lights dancing over a frozen lake reflecting infinite stars, time-lapse feel, surreal colors',
  'A field of lavender swaying in warm wind under a pastel sunset sky, gentle camera pan, nostalgic film look',
  'An anime girl with headphones standing on a rooftop overlooking a cyberpunk cityscape, neon rain, lo-fi aesthetic',
  'Samurai standing in a field of red spider lilies during a storm, dramatic wind, anime cinematic style',
  'Futuristic DJ booth made of holographic light panels, anime sci-fi concert scene, electric blue energy',
  'A cozy anime study room at night with a cat sleeping by the window, rain outside, warm lamp light, lo-fi vibes',
  'Watercolor animation style: koi fish swimming through floating cherry blossoms in an enchanted stream',
  'Liquid chrome morphing into abstract geometric shapes, reflecting neon colors, smooth metallic motion',
  'Sound waves materializing as golden particles that ripple through dark space, abstract music visualization',
  'Ink drops exploding in slow motion underwater, spreading into organic fractal patterns, high contrast',
  'A vinyl record spinning in macro view, needle catching grooves, dust particles floating in sunlight beam',
  'Geometric crystal structures growing and refracting prismatic light, hypnotic rotation, dark background',
]

interface VisualizerModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (videoUrl: string, prompt: string, mediaId: string | null) => void
  onGenerationStart?: (prompt: string, generationId: string) => void
  initialPrompt?: string
  /** Plugin Bearer token — when provided, all API calls include Authorization header */
  authToken?: string
}

/**
 * Credit cost for 444 Engine video generation.
 * 1 credit = $0.035 | 50% profit margin (charge = cost × 1.5)
 *
 * Replicate per-second cost by variant:
 *   Resolution │ With Audio │ No Audio
 *   ───────────┼────────────┼──────────
 *     480p     │  $0.025/s  │ $0.013/s
 *     720p     │  $0.052/s  │ $0.026/s
 *    1080p     │  $0.120/s  │ $0.060/s
 *
 * Credits per variant (50% margin → ceil(dur × cost×1.5 / 0.035)):
 *   Variant        │  2s │  5s │  8s │ 12s
 *   ───────────────┼─────┼─────┼─────┼─────
 *   480p  + audio  │   3 │   6 │   9 │  13
 *   480p  silent   │   2 │   3 │   5 │   7
 *   720p  + audio  │   5 │  12 │  18 │  27
 *   720p  silent   │   3 │   6 │   9 │  14
 *   1080p + audio  │  11 │  26 │  42 │  62
 *   1080p silent   │   6 │  13 │  21 │  31
 */
const REPLICATE_COST_PER_SECOND: Record<string, { audio: number; silent: number }> = {
  '480p':  { audio: 0.025, silent: 0.013 },
  '720p':  { audio: 0.052, silent: 0.026 },
  '1080p': { audio: 0.120, silent: 0.060 },
}
const PROFIT_MARGIN = 1.5
const CREDIT_VALUE = 0.035

function calcCredits(duration: number, resolution: string, withAudio: boolean): number {
  const tier = REPLICATE_COST_PER_SECOND[resolution] || REPLICATE_COST_PER_SECOND['720p']
  const costPerSec = withAudio ? tier.audio : tier.silent
  const chargePerSec = costPerSec * PROFIT_MARGIN
  return Math.ceil(duration * chargePerSec / CREDIT_VALUE)
}

export default function VisualizerModal({
  isOpen,
  onClose,
  userCredits,
  onSuccess,
  onGenerationStart,
  initialPrompt = '',
  authToken,
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
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
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

  // ── Suggested Prompts ──
  const shufflePrompt = useCallback(() => {
    const random = SUGGESTED_PROMPTS[Math.floor(Math.random() * SUGGESTED_PROMPTS.length)]
    setPrompt(random)
  }, [])

  const generateAIPrompt = useCallback(async () => {
    setIsGeneratingPrompt(true)
    try {
      const res = await fetch('/api/generate/prompt-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ promptType: 'visualizer' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.prompt || data.idea) {
          setPrompt(data.prompt || data.idea)
        }
      }
    } catch {
      // Fallback to a random suggested prompt
      shufflePrompt()
    } finally {
      setIsGeneratingPrompt(false)
    }
  }, [shufflePrompt])

  // ── Generate ──
  const creditCost = calcCredits(duration, resolution, generateAudio)
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
        formData.append('title', `Visualizer Reference Image`)
        const uploadRes = await fetch('/api/profile/upload', { method: 'POST', body: formData, headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {} })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          imageUrl = uploadData.data?.image_url || uploadData.url
          console.log('✅ Reference image uploaded:', imageUrl)
        } else {
          console.error('❌ Image upload failed:', uploadRes.status)
          throw new Error('Failed to upload reference image')
        }
      }

      // Start generation via NDJSON stream
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 360000) // 6 min timeout

      const res = await fetch('/api/generate/visualizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
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

  const mode = imageFile ? 'IMG → VID' : 'TXT → VID'
  const promptLen = prompt.length
  const promptColor = promptLen > 900 ? 'text-red-400' : promptLen > 700 ? 'text-amber-400' : 'text-cyan-500/60'
  const hasEnoughCredits = userCredits === undefined || userCredits >= creditCost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !isGenerating && onClose()}>
      {/* Backdrop with animated grid */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Modal container */}
      <div className="relative w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Outer neon glow */}
        <div className="absolute -inset-[1px] bg-gradient-to-b from-cyan-500/50 via-purple-500/30 to-cyan-500/10 rounded-2xl blur-[1px]" />
        {/* Scan line animation overlay */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-10">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.2) 2px, rgba(0,255,255,0.2) 4px)',
              animation: 'scanlines 8s linear infinite',
            }}
          />
        </div>

        <div className="relative bg-[#080c14] border border-cyan-500/20 rounded-2xl overflow-hidden">

          {/* ═══ HEADER — HUD style ═══ */}
          <div className="relative px-5 pt-4 pb-3">
            {/* Top edge accent line */}
            <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Glowing icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400/20 rounded-lg blur-md" />
                  <div className="relative p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <Film size={18} className="text-cyan-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white tracking-wide">VISUALIZER</h2>
                    <span className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/25 rounded text-[9px] font-mono font-bold text-cyan-400 tracking-widest">
                      {mode}
                    </span>
                  </div>
                  <p className="text-[10px] text-cyan-600 font-mono tracking-wider mt-0.5">444 ENGINE // VIDEO SYNTHESIS</p>
                </div>
              </div>

              {/* Close + status indicator */}
              <div className="flex items-center gap-2">
                {isGenerating && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-purple-400">ACTIVE</span>
                  </div>
                )}
                <button onClick={onClose} disabled={isGenerating}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-20 group">
                  <X size={16} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
                </button>
              </div>
            </div>
          </div>

          {/* ═══ BODY ═══ */}
          <div className="px-5 pb-4 space-y-4 max-h-[68vh] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/10">

            {/* ─── PROMPT INPUT ─── */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-widest">SCENE.PROMPT</label>
                <span className={`text-[10px] font-mono ${promptColor}`}>{promptLen}/1000</span>
              </div>
              <div className="relative group">
                {/* Neon border glow on focus */}
                <div className="absolute -inset-[0.5px] bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-purple-500/0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-[0.5px]" />
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe your vision — camera angles, lighting, atmosphere, style..."
                  className="relative w-full bg-black/60 border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 resize-none focus:outline-none focus:border-cyan-500/30 transition-colors font-light leading-relaxed"
                  rows={3}
                  maxLength={1000}
                  disabled={isGenerating}
                />
              </div>
              {/* Prompt actions */}
              <div className="flex items-center gap-1.5 mt-2">
                <button
                  onClick={shufflePrompt}
                  disabled={isGenerating}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.03] hover:bg-cyan-500/10 border border-white/[0.06] hover:border-cyan-500/25 rounded-lg text-[10px] font-mono text-gray-500 hover:text-cyan-400 transition-all disabled:opacity-20"
                >
                  <Shuffle size={10} /> SHUFFLE
                </button>
                <button
                  onClick={generateAIPrompt}
                  disabled={isGenerating || isGeneratingPrompt}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-500/[0.06] hover:bg-purple-500/15 border border-purple-500/15 hover:border-purple-500/35 rounded-lg text-[10px] font-mono text-purple-400/80 hover:text-purple-300 transition-all disabled:opacity-20"
                >
                  {isGeneratingPrompt ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  AI GENERATE
                </button>
              </div>
            </div>

            {/* ─── IMAGE UPLOAD ─── */}
            <div>
              <label className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-widest mb-1.5 block">
                REF.IMAGE <span className="text-gray-700 font-normal">// OPTIONAL</span>
              </label>
              {imagePreview ? (
                <div className="relative group rounded-xl overflow-hidden border border-cyan-500/20">
                  <img src={imagePreview} alt="Reference" className="w-full h-36 object-cover" />
                  {/* Scan line effect over image */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)' }} />
                  <button onClick={clearImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/80 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:border-red-500/40">
                    <X size={12} className="text-gray-400 hover:text-red-400" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/90 to-transparent">
                    <div className="flex items-center gap-1.5">
                      <Eye size={10} className="text-cyan-400" />
                      <span className="text-[9px] font-mono font-bold text-cyan-400 tracking-wider">IMAGE-TO-VIDEO MODE ENABLED</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={isGenerating}
                  className="w-full h-20 border border-dashed border-white/[0.06] hover:border-cyan-500/25 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-20 group hover:bg-cyan-500/[0.02]">
                  <div className="p-2 bg-white/[0.03] rounded-lg group-hover:bg-cyan-500/10 transition-colors">
                    <ImageIcon size={16} className="text-gray-700 group-hover:text-cyan-500 transition-colors" />
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] text-gray-600 group-hover:text-gray-400 transition-colors">Drop an image or click to upload</div>
                    <div className="text-[9px] text-gray-800 font-mono">PNG, JPG, WEBP &middot; MAX 10MB</div>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            {/* ─── DURATION — Cyberpunk slider ─── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-widest flex items-center gap-1.5">
                  <Clock size={10} /> DURATION
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white font-mono">{duration}</span>
                  <span className="text-xs text-cyan-600 font-mono">SEC</span>
                </div>
              </div>
              {/* Custom styled range */}
              <div className="relative">
                <input
                  type="range" min={2} max={12} step={1} value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  disabled={isGenerating}
                  className="w-full h-1 appearance-none bg-white/[0.06] rounded-full cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400
                    [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,255,0.5)] [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan-300
                    disabled:opacity-30"
                />
                {/* Tick marks */}
                <div className="flex justify-between px-1 mt-1.5">
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => (
                    <div key={t} className={`flex flex-col items-center ${t === duration ? 'opacity-100' : 'opacity-30'}`}>
                      <div className={`w-[2px] h-1.5 rounded-full ${t === duration ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                      {(t === 2 || t === 5 || t === 8 || t === 12) && (
                        <span className={`text-[8px] font-mono mt-0.5 ${t === duration ? 'text-cyan-400' : 'text-gray-700'}`}>{t}s</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── CONTROLS GRID ─── */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Resolution */}
              <div>
                <label className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-widest mb-1.5 block flex items-center gap-1.5">
                  <Monitor size={10} /> RESOLUTION
                </label>
                <div className="flex gap-1">
                  {(['480p', '720p', '1080p'] as const).map(r => (
                    <button key={r} onClick={() => setResolution(r)} disabled={isGenerating}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-mono font-bold transition-all ${
                        resolution === r
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,255,255,0.1)]'
                          : 'bg-white/[0.02] text-gray-600 hover:text-gray-400 border border-white/[0.05] hover:border-white/10'
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-[10px] font-mono font-bold text-cyan-500/70 tracking-widest mb-1.5 block flex items-center gap-1.5">
                  <Maximize size={10} /> ASPECT
                </label>
                <div className="flex gap-1">
                  {(['16:9', '9:16', '1:1'] as const).map(ar => (
                    <button key={ar} onClick={() => setAspectRatio(ar)} disabled={isGenerating}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-mono font-bold transition-all ${
                        aspectRatio === ar
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,255,255,0.1)]'
                          : 'bg-white/[0.02] text-gray-600 hover:text-gray-400 border border-white/[0.05] hover:border-white/10'
                      }`}>
                      {ar}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── TOGGLES — Cyberpunk switches ─── */}
            <div className="flex gap-2.5">
              <button onClick={() => setCameraFixed(!cameraFixed)} disabled={isGenerating}
                className={`flex-1 flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all ${
                  cameraFixed
                    ? 'bg-amber-500/[0.08] border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-white/10'
                }`}>
                <div className={`p-1.5 rounded-lg ${cameraFixed ? 'bg-amber-500/15' : 'bg-white/[0.03]'}`}>
                  {cameraFixed ? <CameraOff size={14} className="text-amber-400" /> : <Camera size={14} className="text-gray-600" />}
                </div>
                <div className="text-left">
                  <div className={`text-[11px] font-mono font-bold ${cameraFixed ? 'text-amber-300' : 'text-gray-500'}`}>
                    {cameraFixed ? 'LOCKED' : 'FREE CAM'}
                  </div>
                  <div className="text-[9px] font-mono text-gray-700">{cameraFixed ? 'Static shot' : 'Dynamic motion'}</div>
                </div>
              </button>

              <button onClick={() => setGenerateAudio(!generateAudio)} disabled={isGenerating}
                className={`flex-1 flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all ${
                  generateAudio
                    ? 'bg-cyan-500/[0.08] border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.05)]'
                    : 'bg-white/[0.02] border-white/[0.05] hover:border-white/10'
                }`}>
                <div className={`p-1.5 rounded-lg ${generateAudio ? 'bg-cyan-500/15' : 'bg-white/[0.03]'}`}>
                  {generateAudio ? <Volume2 size={14} className="text-cyan-400" /> : <VolumeX size={14} className="text-gray-600" />}
                </div>
                <div className="text-left">
                  <div className={`text-[11px] font-mono font-bold ${generateAudio ? 'text-cyan-300' : 'text-gray-500'}`}>
                    {generateAudio ? 'AUDIO ON' : 'MUTED'}
                  </div>
                  <div className="text-[9px] font-mono text-gray-700">{generateAudio ? 'Synced sound' : 'Video only'}</div>
                </div>
              </button>
            </div>

            {/* High-quality warning */}
            {resolution === '1080p' && generateAudio && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-500/[0.05] border border-amber-500/15 rounded-xl">
                <Zap size={12} className="text-amber-500 flex-shrink-0" />
                <p className="text-[10px] font-mono text-amber-400/80">
                  1080p + AUDIO = MAX QUALITY // EST. 2-4 MIN RENDER
                </p>
              </div>
            )}
          </div>

          {/* ═══ FOOTER — Command bar ═══ */}
          <div className="relative px-5 py-3.5 border-t border-white/[0.05] bg-black/40">
            {/* Bottom edge accent */}
            <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

            {/* Status message */}
            {statusMsg && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-purple-500/[0.05] border border-purple-500/15 rounded-lg">
                <Loader2 size={12} className="text-purple-400 animate-spin flex-shrink-0" />
                <span className="text-[10px] font-mono text-purple-300">{statusMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              {/* Credit cost — HUD readout */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold border ${
                  !hasEnoughCredits
                    ? 'bg-red-500/10 text-red-400 border-red-500/25'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                }`}>
                  <Zap size={11} />
                  {creditCost}
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-[9px] font-mono text-gray-600">{duration}s &middot; {resolution} &middot; {aspectRatio}</span>
                  <span className="text-[9px] font-mono text-cyan-700">${(creditCost * 0.035).toFixed(3)}</span>
                </div>
              </div>

              {/* Generate button — cyber style */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-mono font-bold tracking-wider transition-all
                  ${canGenerate
                    ? 'bg-gradient-to-r from-cyan-500/90 to-cyan-400/90 text-black hover:from-cyan-400 hover:to-cyan-300 shadow-[0_0_25px_rgba(0,255,255,0.2)] hover:shadow-[0_0_35px_rgba(0,255,255,0.35)]'
                    : 'bg-white/[0.03] text-gray-700 cursor-not-allowed'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    RENDERING
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    GENERATE
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Injected keyframes for scan line animation */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
      `}} />
    </div>
  )
}
