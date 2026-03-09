'use client'

import { useState } from 'react'
import { X, Wand2, Replace, RefreshCw, MicVocal, Headphones, Crown, Upload, Loader2, Zap, ArrowLeft } from 'lucide-react'

interface ProFeaturesModalProps {
  isOpen: boolean
  onClose: () => void
  initialFeature: 'extend' | 'inpaint' | 'cover' | 'add-vocals' | 'voice-to-melody' | 'boost-style'
  userCredits: number | null
}

const FEATURE_INFO: Record<string, { icon: any; label: string; desc: string; cost: number; fields: string[] }> = {
  extend: {
    icon: Wand2, label: '444 Extend', desc: 'Outpaint / continue a track from a specific point',
    cost: 22,
    fields: ['audioId', 'continueAt', 'title', 'prompt', 'style'],
  },
  inpaint: {
    icon: Replace, label: '444 Inpaint', desc: 'Replace a section (6-60s) within an existing track',
    cost: 11,
    fields: ['taskId', 'audioId', 'infillStartS', 'infillEndS', 'prompt', 'tags', 'title'],
  },
  cover: {
    icon: RefreshCw, label: '444 Cover', desc: 'Re-create audio in a completely new style',
    cost: 22,
    fields: ['uploadUrl', 'title', 'prompt', 'style'],
  },
  'add-vocals': {
    icon: MicVocal, label: '444 Add Vocals', desc: 'Add AI-generated vocals to an instrumental track',
    cost: 22,
    fields: ['uploadUrl', 'title', 'prompt', 'style'],
  },
  'voice-to-melody': {
    icon: Headphones, label: '444 Voice to Melody', desc: 'Turn a vocal recording or hum into a full song',
    cost: 22,
    fields: ['uploadUrl', 'title', 'tags'],
  },
  'boost-style': {
    icon: Crown, label: '444 Boost Style', desc: 'AI-enhance your style tags for better results',
    cost: 0,
    fields: ['content'],
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
  const [continueAt, setContinueAt] = useState('')
  const [infillStartS, setInfillStartS] = useState('')
  const [infillEndS, setInfillEndS] = useState('')
  const [content, setContent] = useState('')

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!isOpen) return null

  const info = FEATURE_INFO[activeFeature]
  const canAfford = userCredits !== null && userCredits >= info.cost

  const resetForm = () => {
    setAudioId(''); setTaskId(''); setUploadUrl(''); setTitle('');
    setPrompt(''); setStyle(''); setTags(''); setContinueAt('');
    setInfillStartS(''); setInfillEndS(''); setContent('');
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
      formData.append('type', 'audio')
      const res = await fetch('/api/upload/temp', { method: 'POST', body: formData })
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
          if (!audioId) throw new Error('Audio ID is required')
          if (!continueAt || parseFloat(continueAt) <= 0) throw new Error('Continue at time (seconds) is required')
          endpoint = '/api/generate/suno/extend'
          body = { audioId, continueAt: parseFloat(continueAt), title: title || 'Extended Track', prompt, style }
          break
        case 'inpaint':
          if (!taskId || !audioId) throw new Error('Task ID and Audio ID are required')
          if (!infillStartS || !infillEndS) throw new Error('Start and end times are required')
          if (!prompt) throw new Error('Prompt is required')
          endpoint = '/api/generate/suno/inpaint'
          body = { taskId, audioId, infillStartS: parseFloat(infillStartS), infillEndS: parseFloat(infillEndS), prompt, tags, title: title || 'Inpainted Track' }
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
        case 'boost-style':
          if (!content || content.trim().length < 3) throw new Error('Style description is required (min 3 chars)')
          endpoint = '/api/generate/suno/boost-style'
          body = { content }
          break
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // For boost-style, it returns JSON directly
      if (activeFeature === 'boost-style') {
        const data = await res.json()
        if (data.success) {
          setResult(data)
        } else {
          setError(data.error || 'Failed')
        }
        setIsLoading(false)
        return
      }

      // NDJSON streaming for all other features
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
              <label className={labelClass}>Audio File</label>
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

          {info.fields.includes('audioId') && (
            <div>
              <label className={labelClass}>Audio ID</label>
              <input type="text" value={audioId} onChange={(e) => setAudioId(e.target.value)} placeholder="ID from a previous generation" className={inputClass} />
            </div>
          )}

          {info.fields.includes('taskId') && (
            <div>
              <label className={labelClass}>Task ID</label>
              <input type="text" value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="Original generation task ID" className={inputClass} />
            </div>
          )}

          {info.fields.includes('continueAt') && (
            <div>
              <label className={labelClass}>Continue At (seconds)</label>
              <input type="number" value={continueAt} onChange={(e) => setContinueAt(e.target.value)} placeholder="e.g. 30" min="1" step="0.1" className={inputClass} />
            </div>
          )}

          {info.fields.includes('infillStartS') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start (seconds)</label>
                <input type="number" value={infillStartS} onChange={(e) => setInfillStartS(e.target.value)} placeholder="e.g. 15" min="0" step="0.01" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End (seconds)</label>
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

          {info.fields.includes('content') && (
            <div>
              <label className={labelClass}>Style Description</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe the style you want to enhance, e.g. 'upbeat electronic dance music'" rows={3} className={`${inputClass} resize-none`} />
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
              {result.enhanced && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-green-300">Enhanced style:</p>
                  <p className="text-sm text-white/80 bg-white/[0.05] rounded-lg p-3">{result.enhanced}</p>
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
                {info.cost > 0 ? `Generate (${info.cost} credits)` : 'Enhance'}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
