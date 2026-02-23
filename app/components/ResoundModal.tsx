'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, Loader2, Music2, Settings, AlertCircle, Play, Pause } from 'lucide-react'

interface ResoundModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  /** Called when generation begins — parent should close modal & show chat */
  onGenerate: (params: ResoundGenerationParams) => void
}

export interface ResoundGenerationParams {
  title: string
  prompt: string
  inputAudioUrl: string
  duration: number
  continuation: boolean
  continuation_start: number
  continuation_end: number | null
  model_version: string
  output_format: string
  normalization_strategy: string
  top_k: number
  top_p: number
  temperature: number
  classifier_free_guidance: number
  multi_band_diffusion: boolean
  seed: number | null
}

const MODEL_VERSIONS = [
  { value: 'stereo-melody-large', label: 'Stereo Melody Large (recommended)' },
  { value: 'stereo-large', label: 'Stereo Large' },
  { value: 'melody-large', label: 'Melody Large' },
  { value: 'large', label: 'Large' },
]

const OUTPUT_FORMATS = [
  { value: 'wav', label: 'WAV (lossless)' },
  { value: 'mp3', label: 'MP3' },
]

const NORMALIZATION_STRATEGIES = [
  { value: 'peak', label: 'Peak' },
  { value: 'loudness', label: 'Loudness' },
  { value: 'clip', label: 'Clip' },
  { value: 'rms', label: 'RMS' },
]

const MAX_PROMPT_LENGTH = 500

export default function ResoundModal({ isOpen, onClose, userCredits, onGenerate }: ResoundModalProps) {
  // Core fields
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [prompt, setPrompt] = useState('')

  // Audio upload
  const [inputAudioFile, setInputAudioFile] = useState<File | null>(null)
  const [inputAudioUrl, setInputAudioUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Audio preview
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Detected duration of the uploaded audio
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null)

  // Remix parameters (defaults from Replicate playground)
  const [duration, setDuration] = useState(125)
  const [continuation, setContinuation] = useState(true)
  const [continuationStart, setContinuationStart] = useState(0)
  const [continuationEnd, setContinuationEnd] = useState<number | null>(null)
  const [modelVersion, setModelVersion] = useState('stereo-melody-large')
  const [outputFormat, setOutputFormat] = useState('wav')
  const [normalizationStrategy, setNormalizationStrategy] = useState('peak')
  const [topK, setTopK] = useState(250)
  const [topP, setTopP] = useState(0)
  const [temperature, setTemperature] = useState(1)
  const [classifierFreeGuidance, setClassifierFreeGuidance] = useState(3)
  const [multiBandDiffusion, setMultiBandDiffusion] = useState(false)
  const [seed, setSeed] = useState<number | null>(null)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // When a genre is typed, prepend it to the prompt for generation
  const effectivePrompt = genre.trim()
    ? `${genre.trim()} — ${prompt.trim()}`
    : prompt.trim()

  // Detect audio duration when file is selected
  const detectAudioDuration = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.addEventListener('loadedmetadata', () => {
      const dur = Math.ceil(audio.duration)
      setDetectedDuration(dur)
      setDuration(dur) // Adapt generation duration to input length
      URL.revokeObjectURL(url)
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
    })
    audio.src = url
  }, [])

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['wav', 'mp3', 'webm', 'ogg'].includes(ext || '')) {
      setUploadError('File must be .wav, .mp3, .webm or .ogg')
      return
    }
    // Validate size (20 MB)
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File must be less than 20 MB')
      return
    }

    setUploadError('')
    setInputAudioFile(file)
    detectAudioDuration(file)

    // Upload via presigned URL (same flow as Remake / voice reference)
    setIsUploading(true)
    try {
      const presignRes = await fetch('/api/generate/upload-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || 'audio/wav',
          fileSize: file.size,
          type: 'song',
        }),
      })
      if (!presignRes.ok) throw new Error('Failed to get upload URL')
      const presignData = await presignRes.json()
      if (!presignData.uploadUrl || !presignData.publicUrl) throw new Error('Invalid upload response')

      // PUT to R2
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/wav' },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Upload to storage failed')

      setInputAudioUrl(presignData.publicUrl)
      console.log('✅ Beat uploaded for Resound:', presignData.publicUrl)
    } catch (err: any) {
      console.error('Upload error:', err)
      setUploadError(err.message || 'Upload failed')
      setInputAudioFile(null)
    } finally {
      setIsUploading(false)
    }
  }

  // Preview playback
  const togglePreview = () => {
    if (!inputAudioUrl) return
    if (isPreviewPlaying) {
      previewAudioRef.current?.pause()
      setIsPreviewPlaying(false)
    } else {
      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio(inputAudioUrl)
        previewAudioRef.current.onended = () => setIsPreviewPlaying(false)
      }
      previewAudioRef.current.play()
      setIsPreviewPlaying(true)
    }
  }

  // Cleanup preview audio on unmount/close
  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
    }
  }, [isOpen])

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setUploadError('')
      setIsGenerating(false)
    }
  }, [isOpen])

  // Validation
  const canGenerate =
    title.trim().length >= 1 &&
    effectivePrompt.length >= 3 &&
    effectivePrompt.length <= MAX_PROMPT_LENGTH &&
    inputAudioUrl &&
    !isUploading &&
    !isGenerating

  const handleSubmit = () => {
    if (!canGenerate) return
    if (userCredits !== undefined && userCredits < 10) {
      setUploadError('You need at least 10 credits to use Remix')
      return
    }
    setIsGenerating(true)

    onGenerate({
      title: title.trim(),
      prompt: effectivePrompt,
      inputAudioUrl,
      duration,
      continuation,
      continuation_start: continuationStart,
      continuation_end: continuationEnd,
      model_version: modelVersion,
      output_format: outputFormat,
      normalization_strategy: normalizationStrategy,
      top_k: topK,
      top_p: topP,
      temperature,
      classifier_free_guidance: classifierFreeGuidance,
      multi_band_diffusion: multiBandDiffusion,
      seed,
    })
  }

  if (!isOpen) return null

  const promptLen = effectivePrompt.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-gray-950/95 backdrop-blur-2xl border border-cyan-500/15 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-xl px-6 pt-6 pb-4 border-b border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 flex items-center justify-center">
                <Music2 size={20} className="text-cyan-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Remix</h3>
                <p className="text-xs text-white/40 mt-0.5">Upload a beat &amp; prompt — 444 Radio Remix</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <X size={16} className="text-white/40" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-5">
          {/* ── Title ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 100))}
              placeholder="Give your track a name"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors"
            />
            <p className="text-[10px] text-white/20 mt-1">{title.length}/100</p>
          </div>

          {/* ── Genre (appended to prompt) ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Genre <span className="text-white/25 normal-case">(added to prompt)</span></label>
            <input
              type="text"
              value={genre}
              onChange={e => setGenre(e.target.value.slice(0, 60))}
              placeholder="e.g. cinematic, lo-fi hip hop, EDM…"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors"
            />
          </div>

          {/* ── Prompt ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the music you want to generate…"
              rows={3}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              {genre.trim() && (
                <p className="text-[10px] text-cyan-400/60 truncate max-w-[65%]">
                  Final prompt: &quot;{effectivePrompt.substring(0, 80)}{effectivePrompt.length > 80 ? '…' : ''}&quot;
                </p>
              )}
              <span className={`text-[11px] font-mono ml-auto ${
                promptLen === 0 ? 'text-white/25' :
                promptLen < 3 ? 'text-red-400/90' :
                promptLen > MAX_PROMPT_LENGTH ? 'text-red-400/90' :
                promptLen > MAX_PROMPT_LENGTH * 0.9 ? 'text-yellow-400/70' :
                'text-emerald-400/70'
              }`}>
                {promptLen}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </div>

          {/* ── Upload Beat ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Input Audio File <span className="text-red-400">*</span></label>
            <input ref={fileInputRef} type="file" accept=".wav,.mp3,.webm,.ogg,audio/*" className="hidden" onChange={handleFileSelect} />
            {inputAudioFile ? (
              <div className="flex items-center justify-between px-4 py-3 bg-cyan-500/[0.08] border border-cyan-500/20 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Music2 size={16} className="text-cyan-400 flex-shrink-0" />
                  <span className="text-sm text-cyan-200 truncate">{inputAudioFile.name}</span>
                  {detectedDuration && (
                    <span className="text-[10px] text-white/30 flex-shrink-0">{detectedDuration}s</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {inputAudioUrl && (
                    <button onClick={togglePreview} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                      {isPreviewPlaying ? <Pause size={14} className="text-cyan-400" /> : <Play size={14} className="text-cyan-400" />}
                    </button>
                  )}
                  <button onClick={() => { setInputAudioFile(null); setInputAudioUrl(''); setDetectedDuration(null); previewAudioRef.current?.pause(); previewAudioRef.current = null }} className="text-xs text-white/30 hover:text-red-400 transition-colors">Remove</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full flex items-center gap-3.5 px-4 py-4 bg-white/[0.03] hover:bg-cyan-500/[0.08] border border-dashed border-white/10 hover:border-cyan-500/30 rounded-xl transition-all duration-200 group disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 flex items-center justify-center transition-colors">
                  {isUploading ? <Loader2 size={18} className="text-cyan-400 animate-spin" /> : <Upload size={18} className="text-cyan-400" />}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-white/80 group-hover:text-cyan-200 transition-colors">
                    {isUploading ? 'Uploading…' : 'Upload your beat'}
                  </div>
                  <div className="text-[11px] text-white/30">.wav or .mp3 — up to 20 MB</div>
                </div>
              </button>
            )}
            {uploadError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                <AlertCircle size={12} /> {uploadError}
              </div>
            )}
          </div>

          {/* ── Model Version ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Model Version</label>
            <select
              value={modelVersion}
              onChange={e => setModelVersion(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 rounded-xl text-sm text-white outline-none cursor-pointer appearance-none transition-colors"
              style={{
                backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(148,163,184,0.5)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.6rem center',
                backgroundSize: '1.1em 1.1em',
                paddingRight: '2.2rem',
              }}
            >
              {MODEL_VERSIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* ── Duration ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">
              Duration <span className="text-white/25 normal-case">(seconds)</span>
              {detectedDuration && <span className="text-cyan-400/60 normal-case ml-1">auto-set from input: {detectedDuration}s</span>}
            </label>
            <input
              type="number"
              min={1}
              max={300}
              value={duration}
              onChange={e => setDuration(Math.max(1, Math.min(300, parseInt(e.target.value) || 8)))}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400/50 rounded-xl text-sm text-white outline-none transition-colors"
            />
            <p className="text-[10px] text-white/20 mt-1">Default: 8. Max recommended: ~300s.</p>
          </div>

          {/* ── Output Format ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Output Format</label>
            <div className="flex gap-2">
              {OUTPUT_FORMATS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setOutputFormat(f.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                    outputFormat === f.value
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.06]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Continuation ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Continuation</label>
              <button
                onClick={() => setContinuation(!continuation)}
                className={`relative w-10 h-5 rounded-full transition-colors ${continuation ? 'bg-cyan-500/60' : 'bg-white/10'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${continuation ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <p className="text-[10px] text-white/20">If true, generated music will continue from the input audio. Otherwise, it will mimic the input audio&apos;s melody.</p>

            {continuation && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">Start (s)</label>
                  <input
                    type="number"
                    min={0}
                    value={continuationStart}
                    onChange={e => setContinuationStart(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">End (s) <span className="text-white/15">blank = end of clip</span></label>
                  <input
                    type="number"
                    min={0}
                    value={continuationEnd ?? ''}
                    onChange={e => {
                      const v = e.target.value
                      setContinuationEnd(v === '' ? null : Math.max(0, parseInt(v) || 0))
                    }}
                    placeholder="auto"
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-white/15 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Normalization Strategy ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Normalization Strategy</label>
            <select
              value={normalizationStrategy}
              onChange={e => setNormalizationStrategy(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-cyan-500/30 rounded-xl text-sm text-white outline-none cursor-pointer appearance-none transition-colors"
              style={{
                backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(148,163,184,0.5)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.6rem center',
                backgroundSize: '1.1em 1.1em',
                paddingRight: '2.2rem',
              }}
            >
              {NORMALIZATION_STRATEGIES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* ── Multi-Band Diffusion ── */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Multi-Band Diffusion</label>
              <p className="text-[10px] text-white/20 mt-0.5">EnCodec tokens decoded with MultiBand Diffusion. Only works with non-stereo models.</p>
            </div>
            <button
              onClick={() => setMultiBandDiffusion(!multiBandDiffusion)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${multiBandDiffusion ? 'bg-cyan-500/60' : 'bg-white/10'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${multiBandDiffusion ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* ── Advanced Toggle ── */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            <Settings size={12} />
            {showAdvanced ? 'Hide' : 'Show'} advanced sampling parameters
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
              {/* top_k */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">top_k <span className="text-white/20 normal-case">({topK})</span></label>
                <input
                  type="range"
                  min={0}
                  max={1000}
                  value={topK}
                  onChange={e => setTopK(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <p className="text-[10px] text-white/15 mt-0.5">Reduces sampling to the k most likely tokens. Default: 250.</p>
              </div>

              {/* top_p */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">top_p <span className="text-white/20 normal-case">({topP})</span></label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <p className="text-[10px] text-white/15 mt-0.5">Cumulative probability threshold. 0 = use top_k only. Default: 0.</p>
              </div>

              {/* temperature */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Temperature <span className="text-white/20 normal-case">({temperature})</span></label>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.05}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <p className="text-[10px] text-white/15 mt-0.5">Higher = more diversity. Default: 1.</p>
              </div>

              {/* classifier_free_guidance */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Classifier-Free Guidance <span className="text-white/20 normal-case">({classifierFreeGuidance})</span></label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={classifierFreeGuidance}
                  onChange={e => setClassifierFreeGuidance(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <p className="text-[10px] text-white/15 mt-0.5">Higher values adhere more closely to the prompt. Default: 3.</p>
              </div>

              {/* seed */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Seed <span className="text-white/20 normal-case">(optional)</span></label>
                <input
                  type="number"
                  min={-1}
                  value={seed ?? ''}
                  onChange={e => {
                    const v = e.target.value
                    setSeed(v === '' ? null : parseInt(v))
                  }}
                  placeholder="Random (-1 or blank)"
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-white/15 outline-none"
                />
                <p className="text-[10px] text-white/15 mt-0.5">-1 or blank = random seed.</p>
              </div>
            </div>
          )}

          {/* ── Generate Button ── */}
          <div className="pt-2">
            <button
              onClick={handleSubmit}
              disabled={!canGenerate}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                canGenerate
                  ? 'bg-gradient-to-r from-cyan-500/30 to-cyan-400/30 hover:from-cyan-500/40 hover:to-cyan-400/40 border border-cyan-500/30 text-white'
                  : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Generating…
                </span>
              ) : (
                'Remix — 10 credits'
              )}
            </button>
            <p className="text-[10px] text-white/20 text-center mt-2">444 Radio Remix Engine • WAV output by default</p>
          </div>
        </div>
      </div>
    </div>
  )
}
