'use client'

import { useState } from 'react'
import { X, Wand2, Replace, RefreshCw, MicVocal, Headphones, Crown, Upload, Loader2, Zap, ArrowLeft, HelpCircle } from 'lucide-react'

interface ProFeaturesModalProps {
  isOpen: boolean
  onClose: () => void
  initialFeature: 'extend' | 'inpaint' | 'cover' | 'add-vocals' | 'voice-to-melody'
  userCredits: number | null
}

const FEATURE_INFO: Record<string, { icon: any; label: string; desc: string; cost: number; fields: string[]; help: string }> = {
  extend: {
    icon: Wand2, label: '444 Extend', desc: 'Outpaint / continue a track from any point',
    cost: 4,
    fields: ['uploadUrl', 'side', 'title', 'prompt', 'tags'],
    help: 'Upload an audio file or paste a URL. Choose to extend from the beginning (left) or end (right). Optionally add style tags and lyrics to guide the new section. 4 credits per generation.',
  },
  inpaint: {
    icon: Replace, label: '444 Inpaint', desc: 'Replace a section within an existing track',
    cost: 4,
    fields: ['uploadUrl', 'infillStartS', 'infillEndS', 'tags', 'title'],
    help: 'Upload an audio file and set start/end times (in seconds) for the section to replace. Add style tags to guide the replacement. Leave lyrics empty for instrumental. 4 credits per generation.',
  },
  cover: {
    icon: RefreshCw, label: '444 Cover', desc: 'Re-create audio in a completely new style',
    cost: 22,
    fields: ['uploadUrl', 'title', 'prompt', 'style'],
    help: 'Upload any audio file (up to 8 min) or paste a public URL. The AI will re-create it in a completely different style while preserving the melody and structure. Add style tags to guide the output.',
  },
  'add-vocals': {
    icon: MicVocal, label: '444 Add Vocals', desc: 'Add AI-generated vocals to an instrumental track',
    cost: 22,
    fields: ['uploadUrl', 'title', 'prompt', 'style'],
    help: 'Upload an instrumental track (no vocals). Write lyrics in the prompt field and set style tags. The AI will generate and layer vocals that match the beat and your lyrics.',
  },
  'voice-to-melody': {
    icon: Headphones, label: '444 Voice to Melody', desc: 'Turn a vocal recording or hum into a full song',
    cost: 22,
    fields: ['uploadUrl', 'title', 'tags'],
    help: 'Upload a vocal recording, hum, or melody you\'ve sung. The AI will create full instrumental backing that matches your melody. Add style tags (e.g. "lo-fi hip-hop, chill") to guide the genre.',
  },
}

export default function ProFeaturesModal({ isOpen, onClose, initialFeature, userCredits }: ProFeaturesModalProps) {
  const [activeFeature, setActiveFeature] = useState(initialFeature)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [audioId, setAudioId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [uploadUrl, setUploadUrl] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('')
  const [tags, setTags] = useState('')
  const [side, setSide] = useState<'left' | 'right'>('right')
  const [infillStartS, setInfillStartS] = useState('')
  const [infillEndS, setInfillEndS] = useState('')

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!isOpen) return null

  const info = FEATURE_INFO[activeFeature]
  const canAfford = userCredits !== null && userCredits >= info.cost

  const resetForm = () => {
    setAudioId(''); setTaskId(''); setUploadUrl(''); setTitle('');
    setPrompt(''); setStyle(''); setTags(''); setSide('right');
    setInfillStartS(''); setInfillEndS('');
    setResult(null); setError(null); setUploadFile(null)
  }

  const switchFeature = (feat: typeof activeFeature) => {
    resetForm()
    setActiveFeature(feat)
  }

  const handleFileUpload = async (file: File) => {
    setUploadFile(file)
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/media', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setUploadUrl(data.url || data.publicUrl)
    } catch (err) {
      setError('Failed to upload file. You can also paste a direct URL.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      let endpoint = ''
      let body: Record<string, unknown> = {}

      switch (activeFeature) {
        case 'extend':
          if (!uploadUrl) throw new Error('Audio file or URL is required')
          endpoint = '/api/generate/suno/extend'
          body = { audio_url: uploadUrl, side, title: title || 'Extended Track', prompt, tags }
          break
        case 'inpaint':
          if (!uploadUrl) throw new Error('Audio file or URL is required')
          if (!infillStartS || !infillEndS) throw new Error('Start and end times are required')
          endpoint = '/api/generate/suno/inpaint'
          body = { audio_url: uploadUrl, start: parseFloat(infillStartS), end: parseFloat(infillEndS), tags, title: title || 'Inpainted Track' }
          break
        case 'cover':
          if (!uploadUrl) throw new Error('Audio URL is required')
          endpoint = '/api/generate/suno/cover'
          body = { uploadUrl, title: title || 'Cover Track', prompt, style }
          break
        case 'add-vocals':
          if (!uploadUrl) throw new Error('Instrumental audio URL is required')
          if (!prompt) throw new Error('Lyrics / prompt are required')
          if (!style) throw new Error('Style tags are required')
          endpoint = '/api/generate/suno/add-vocals'
          body = { uploadUrl, title: title || 'Vocals Added', prompt, style }
          break
        case 'voice-to-melody':
          if (!uploadUrl) throw new Error('Vocal recording URL is required')
          if (!tags) throw new Error('Style tags are required')
          endpoint = '/api/generate/suno/voice-to-melody'
          body = { uploadUrl, title: title || 'Voice to Melody', tags }
          break
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // NDJSON streaming for all features
      if (!res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const errData = await res.json()
        throw new Error(errData.error || `Error (${res.status})`)
      }

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
            const parsed = JSON.parse(line)
            if (parsed.type === 'result') {
              if (parsed.success) {
                setResult(parsed)
              } else {
                setError(parsed.error || 'Generation failed')
              }
            }
          } catch { /* skip */ }
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer)
          if (parsed.type === 'result') {
            if (parsed.success) setResult(parsed)
            else setError(parsed.error || 'Generation failed')
          }
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  const featureKeys = Object.keys(FEATURE_INFO) as Array<keyof typeof FEATURE_INFO>

  const inputClass = 'w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-red-400/50 focus:ring-1 focus:ring-red-400/20 transition-all'
  const labelClass = 'text-[11px] font-bold text-white/50 uppercase tracking-wider mb-1.5 block'

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[680px] md:max-h-[85vh] bg-gradient-to-b from-[#0d0608] via-[#0a0506] to-[#080404] border border-red-500/20 rounded-2xl shadow-2xl shadow-red-500/10 z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/30 to-red-600/20 flex items-center justify-center shadow-lg shadow-red-500/20">
              <info.icon size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{info.label}</h2>
              <p className="text-[11px] text-white/40">{info.desc}</p>
            </div>
            {/* Help popover */}
            <div className="relative group/info">
              <HelpCircle size={16} className="text-white/25 hover:text-red-400 cursor-help transition-colors" />
              <div className="hidden group-hover/info:block absolute right-0 top-8 z-50 w-72 p-3 rounded-xl bg-black/95 border border-red-500/20 shadow-2xl shadow-red-500/10">
                <p className="text-[11px] text-white/70 leading-relaxed">{info.help}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {info.cost > 0 && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${canAfford ? 'bg-red-500/15 text-red-300 border border-red-500/20' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                <Zap size={10} /> {info.cost} credits
              </div>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.08]">
              <X size={16} className="text-white/40" />
            </button>
          </div>
        </div>

        {/* Feature tabs */}
        <div className="px-4 pt-3 pb-1 shrink-0">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {featureKeys.map((key) => {
              const f = FEATURE_INFO[key]
              const Icon = f.icon
              const isActive = activeFeature === key
              return (
                <button
                  key={key}
                  onClick={() => switchFeature(key as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-red-500/20 text-red-300 shadow-sm shadow-red-500/10'
                      : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={11} />
                  {f.label.replace('444 ', '')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* URL / Audio ID fields */}
          {info.fields.includes('uploadUrl') && (
            <div>
              <label className={labelClass}>
                Audio File
                <span className="relative group/tip inline-block ml-1 align-middle">
                  <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                  <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-52 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Upload an audio file or paste a public URL. Supports MP3, WAV, and most audio formats up to 100MB.</span>
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="Paste audio URL or upload below..."
                  className={`${inputClass} flex-1`}
                />
              </div>
              <div className="mt-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/10 hover:border-red-400/30 cursor-pointer transition-all group">
                  {uploading ? <Loader2 size={14} className="text-red-400 animate-spin" /> : <Upload size={14} className="text-white/30 group-hover:text-red-400" />}
                  <span className="text-xs text-white/30 group-hover:text-white/50">{uploadFile ? uploadFile.name : 'Or upload audio file'}</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </label>
              </div>
            </div>
          )}

          {info.fields.includes('side') && (
            <div>
              <label className={labelClass}>
                Extend Direction
                <span className="relative group/tip inline-block ml-1 align-middle">
                  <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                  <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-52 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Choose &quot;right&quot; to extend from the end, or &quot;left&quot; to add a new intro before the track.</span>
                </span>
              </label>
              <select value={side} onChange={(e) => setSide(e.target.value as 'left' | 'right')} className={inputClass}>
                <option value="right">Right (extend from end)</option>
                <option value="left">Left (add intro)</option>
              </select>
            </div>
          )}

          {info.fields.includes('infillStartS') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Start (seconds)
                  <span className="relative group/tip inline-block ml-1 align-middle">
                    <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                    <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-44 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Where the section to replace begins (min 6s range)</span>
                  </span>
                </label>
                <input type="number" value={infillStartS} onChange={(e) => setInfillStartS(e.target.value)} placeholder="e.g. 15" min="0" step="0.01" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  End (seconds)
                  <span className="relative group/tip inline-block ml-1 align-middle">
                    <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                    <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-44 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Where the replacement ends (max 60s range)</span>
                  </span>
                </label>
                <input type="number" value={infillEndS} onChange={(e) => setInfillEndS(e.target.value)} placeholder="e.g. 45" min="0" step="0.01" className={inputClass} />
              </div>
            </div>
          )}

          {info.fields.includes('title') && (
            <div>
              <label className={labelClass}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" maxLength={80} className={inputClass} />
            </div>
          )}

          {info.fields.includes('prompt') && (
            <div>
              <label className={labelClass}>{activeFeature === 'add-vocals' ? 'Lyrics / Prompt' : 'Prompt'}</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={activeFeature === 'add-vocals' ? 'Write lyrics for the vocals...' : 'Describe what you want...'} rows={3} className={`${inputClass} resize-none`} />
            </div>
          )}

          {info.fields.includes('style') && (
            <div>
              <label className={labelClass}>Style Tags</label>
              <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g. lo-fi hip-hop, chill, dreamy" className={inputClass} />
            </div>
          )}

          {info.fields.includes('tags') && (
            <div>
              <label className={labelClass}>Style Tags</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. electronic, ambient, upbeat" className={inputClass} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              {result.audioUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-green-300">Generation complete!</p>
                  <audio controls src={result.audioUrl} className="w-full h-10 rounded-lg" />
                  <p className="text-[10px] text-white/30">{result.title}</p>
                </div>
              )}
              {result.creditsDeducted !== undefined && (
                <p className="text-[10px] text-white/25 mt-2">{result.creditsDeducted} credits used</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-red-500/10 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={isLoading || (!canAfford && info.cost > 0)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 active:translate-y-[1px]"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap size={14} />
                Generate ({info.cost} credits)
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
