'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Wand2, Replace, RefreshCw, MicVocal, Headphones, Crown, Upload, Loader2, Zap, ArrowLeft, HelpCircle, Mic, Square, Sparkles } from 'lucide-react'

interface ProFeaturesModalProps {
  isOpen: boolean
  onClose: () => void
  initialFeature: 'extend' | 'inpaint' | 'remix' | 'add-vocals' | 'voice-to-melody'
  userCredits: number | null
  onGenerated?: (result: { audioUrl: string;
                                                   secondAudioUrl?: string;
                                                   title: string;
                                                   secondTitle?: string;
                                                   lyrics?: string;
                                                   secondLyrics?: string;
                                                   libraryId?: string;
                                                   secondLibraryId?: string;
                                                   creditsRemaining?: number;
                                                   creditsDeducted?: number;
                                                   engine: string;
                                                   trackCount?: number;
  }) => void
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
  remix: {
    icon: RefreshCw, label: '444 Remix', desc: 'Remix any song into a brand new style',
    cost: 3,
    fields: ['uploadUrl', 'title', 'lyrics', 'style', 'remixOptions'],
    help: 'Upload any song — with or without vocals. 444 Remix re-creates it in a completely different style while preserving the melody & structure. Leave lyrics empty to keep the original vocals. 3 credits per remix.',
  },
  'add-vocals': {
    icon: MicVocal, label: '444 Add Vocals', desc: 'Add AI-generated vocals to an instrumental track',
    cost: 5,
    fields: ['uploadUrl', 'title', 'prompt', 'style'],
    help: 'Upload an instrumental track (no vocals). Write lyrics in the prompt field and set style tags. The AI will generate and layer vocals that match the beat and your lyrics. 5 credits per generation.',
  },
  'voice-to-melody': {
    icon: Headphones, label: '444 Voice to Melody', desc: 'Turn a vocal recording or hum into a full song',
    cost: 5,
    fields: ['uploadUrl', 'title', 'tags'],
    help: 'Upload a vocal recording, hum, or melody you\'ve sung. The AI will create full instrumental backing that matches your melody. Add style tags (e.g. "lo-fi hip-hop, chill") to guide the genre. 5 credits per generation.',
  },
}

export default function ProFeaturesModal({ isOpen, onClose, initialFeature, userCredits, onGenerated }: ProFeaturesModalProps) {
  const [activeFeature, setActiveFeature] = useState(initialFeature)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)

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
  const [author, setAuthor] = useState('444 Radio')
  const [domainName, setDomainName] = useState('444radio.co.in')

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Boost style state
  const [isBoosting, setIsBoosting] = useState(false)

  // Remix advanced options
  const [instrumental, setInstrumental] = useState(false)
  const [vocalGender, setVocalGender] = useState<'m' | 'f' | ''>('')
  const [negativeTags, setNegativeTags] = useState('noise, distortion')
  const [styleWeight, setStyleWeight] = useState(50)
  const [weirdness, setWeirdness] = useState(50)
  const [audioWeight, setAudioWeight] = useState(50)
  const [showRemixAdvanced, setShowRemixAdvanced] = useState(false)

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' })
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        setRecordedBlob(blob)
        setIsRecording(false)
        // Auto-upload the recording via presigned URL (avoids 413 body limit)
        setUploading(true)
        setError(null)
        try {
          const ext = recorder.mimeType.includes('webm') ? 'webm' : 'mp4'
          const file = new File([blob], `voice-recording-${Date.now()}.${ext}`, { type: recorder.mimeType })

          // Step 1: Get presigned URL
          const metaRes = await fetch('/api/upload/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
          })
          if (!metaRes.ok) throw new Error('Upload failed')
          const { uploadUrl: presignedUrl, publicUrl } = await metaRes.json()

          // Step 2: Upload directly to R2
          const uploadRes = await fetch(presignedUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          })
          if (!uploadRes.ok) throw new Error('Direct upload failed')

          setUploadUrl(publicUrl)
          setUploadFile(file)
        } catch {
          setError('Failed to upload recording. Try again or upload a file instead.')
        } finally {
          setUploading(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setRecordingTime(0)
      setIsRecording(true)
      setRecordedBlob(null)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleBoostStyle = useCallback(async (content: string, setter: (v: string) => void) => {
    if (!content.trim() || content.trim().length < 3) return
    setIsBoosting(true)
    try {
      const res = await fetch('/api/generate/suno/boost-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) throw new Error('Boost failed')
      const data = await res.json()
      if (data.success && data.enhanced) {
        setter(data.enhanced)
      }
    } catch {
      // Silently fail — style stays unchanged
    } finally {
      setIsBoosting(false)
    }
  }, [])

  if (!isOpen) return null

  const info = FEATURE_INFO[activeFeature]
  const canAfford = userCredits !== null && userCredits >= info.cost

  const resetForm = () => {
    setAudioId(''); setTaskId(''); setUploadUrl(''); setTitle('');
    setPrompt(''); setStyle(''); setTags(''); setSide('right');
    setInfillStartS(''); setInfillEndS('');
    setAuthor('444 Radio'); setDomainName('444radio.co.in');
    setResult(null); setError(null); setProgressMessage(null); setUploadFile(null);
    setRecordedBlob(null); setRecordingTime(0);
    setInstrumental(false); setVocalGender(''); setNegativeTags('noise, distortion');
    setStyleWeight(50); setWeirdness(50); setAudioWeight(50); setShowRemixAdvanced(false);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
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
      // Step 1: Get presigned URL from our API (sends only metadata, avoids 413)
      const metaRes = await fetch('/api/upload/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      })
      if (!metaRes.ok) {
        const errData = await metaRes.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to get upload URL')
      }
      const { uploadUrl: presignedUrl, publicUrl } = await metaRes.json()

      // Step 2: Upload file directly to R2 using the presigned URL
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Direct upload to storage failed')

      setUploadUrl(publicUrl)
    } catch (err: any) {
      setError(err.message || 'Failed to upload file. You can also paste a direct URL.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    setProgressMessage(null)

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
        case 'remix':
          if (!uploadUrl) throw new Error('Upload a song to remix')
          endpoint = '/api/generate/suno/cover'
          body = {
            uploadUrl,
            title: title || 'Remixed Track',
            prompt,
            style,
            instrumental,
            ...(vocalGender ? { vocalGender } : {}),
            negativeTags: negativeTags || 'noise, distortion',
            ...(styleWeight !== 50 ? { styleWeight: styleWeight / 100 } : {}),
            ...(weirdness !== 50 ? { weirdnessConstraint: weirdness / 100 } : {}),
            ...(audioWeight !== 50 ? { audioWeight: audioWeight / 100 } : {}),
          }
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

      // Handle non-ok responses (both JSON and NDJSON error cases)
      if (!res.ok) {
        const ct = res.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const errData = await res.json()
          throw new Error(errData.error || `Error (${res.status})`)
        }
        // Non-JSON error (e.g. HTML 502/504 from Vercel)
        const text = await res.text().catch(() => '')
        throw new Error(text?.substring(0, 100) || `Server error (${res.status})`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let gotResult = false

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
            if (parsed.type === 'started') {
              setProgressMessage('Generation started...')
            } else if (parsed.type === 'progress') {
              setProgressMessage(parsed.message || 'Processing...')
            } else if (parsed.type === 'result') {
              gotResult = true
              if (parsed.success) {
                setResult(parsed)
                setProgressMessage(null)                // Notify parent of successful generation
                onGenerated?.({
                  audioUrl: parsed.audioUrl,
                  secondAudioUrl: parsed.secondAudioUrl,
                  title: parsed.title || title || 'Generated Track',
                  secondTitle: parsed.secondTitle,
                  lyrics: parsed.lyrics,
                  secondLyrics: parsed.secondLyrics,
                  libraryId: parsed.libraryId,
                  secondLibraryId: parsed.secondLibraryId,
                  creditsRemaining: parsed.creditsRemaining,
                  creditsDeducted: parsed.creditsDeducted,
                  engine: activeFeature,
                  trackCount: parsed.trackCount,
                })
              } else {
                setError(parsed.error || 'Generation failed')
                setProgressMessage(null)
              }
            }
          } catch { /* skip non-JSON lines */ }
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer)
          if (parsed.type === 'result') {
            gotResult = true
            if (parsed.success) {
              setResult(parsed)
              onGenerated?.({
                audioUrl: parsed.audioUrl,
                secondAudioUrl: parsed.secondAudioUrl,
                title: parsed.title || title || 'Generated Track',
                secondTitle: parsed.secondTitle,
                lyrics: parsed.lyrics,
                secondLyrics: parsed.secondLyrics,
                libraryId: parsed.libraryId,
                secondLibraryId: parsed.secondLibraryId,
                creditsRemaining: parsed.creditsRemaining,
                creditsDeducted: parsed.creditsDeducted,
                engine: activeFeature,
                trackCount: parsed.trackCount,
              })
            } else {
              setError(parsed.error || 'Generation failed')
            }
            setProgressMessage(null)
          }
        } catch { /* ignore */ }
      }
      // Stream ended without a result event — likely disconnected or timed out
      if (!gotResult) {
        setError('Generation stream ended unexpectedly. Check your library — the track may still have been saved.')
        setProgressMessage(null)
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
                  <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-52 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Upload an audio file. Supports MP3, WAV, and most audio formats up to 100MB.</span>
                </span>
              </label>
              <div>
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/10 hover:border-red-400/30 cursor-pointer transition-all group">
                  {uploading ? <Loader2 size={14} className="text-red-400 animate-spin" /> : uploadFile && uploadUrl ? <Upload size={14} className="text-green-400" /> : <Upload size={14} className="text-white/30 group-hover:text-red-400" />}
                  <span className={`text-xs ${uploadFile && uploadUrl ? 'text-green-400/70' : 'text-white/30 group-hover:text-white/50'}`}>{uploadFile ? (uploadUrl ? `✓ ${uploadFile.name}` : uploadFile.name) : 'Upload audio file (MP3, WAV, etc.)'}</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                </label>
              </div>

              {/* Microphone recording — voice-to-melody only */}
              {activeFeature === 'voice-to-melody' && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={startRecording}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 hover:bg-red-500/25 hover:border-red-500/40 text-red-300 text-xs font-semibold transition-all disabled:opacity-30"
                      >
                        <Mic size={14} />
                        Record Melody / Hum
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/30 border border-red-500/40 text-red-200 text-xs font-semibold animate-pulse transition-all"
                      >
                        <Square size={12} className="fill-red-300" />
                        Stop — {recordingTime}s
                      </button>
                    )}
                    {recordedBlob && !isRecording && (
                      <span className="text-[10px] text-green-400/60">✓ Recorded {recordingTime}s</span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/20 mt-1.5">Sing, hum, or whistle your melody. Min 5 seconds recommended.</p>
                </div>
              )}
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

          {info.fields.includes('lyrics') && (
            <div>
              <label className={labelClass}>
                Lyrics (optional)
                <span className="relative group/tip inline-block ml-1 align-middle">
                  <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                  <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-56 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Leave empty to keep the original vocals/lyrics. Add new lyrics here to change the words while remixing the style.</span>
                </span>
              </label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Leave empty to keep original lyrics. Write new lyrics here to change them..." rows={3} className={`${inputClass} resize-none`} />
            </div>
          )}

          {info.fields.includes('style') && (
            <div>
              <label className={labelClass}>Style Tags</label>
              <div className="flex gap-2">
                <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g. lo-fi hip-hop, chill, dreamy" className={`${inputClass} flex-1`} />
                <button
                  type="button"
                  onClick={() => handleBoostStyle(style, setStyle)}
                  disabled={isBoosting || style.trim().length < 3}
                  title="AI-enhance your style tags (free)"
                  className="px-3 rounded-xl border border-white/10 hover:border-red-400/30 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                >
                  {isBoosting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Remix advanced options */}
          {info.fields.includes('remixOptions') && (
            <div className="space-y-3">
              {/* How 444 Remix works — always visible */}
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-red-500/[0.06] border border-red-500/10 rounded-xl">
                <HelpCircle size={14} className="text-red-400/60 mt-0.5 shrink-0" />
                <p className="text-[11px] text-white/50 leading-relaxed">
                  <span className="text-red-300 font-medium">444 Remix</span> — Upload any song (with or without vocals), set your style, and the AI will re-create it in a completely new genre and feel. Adjust vocal gender, weirdness, and fidelity below.
                </p>
              </div>

              {/* Instrumental toggle + vocal gender */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5 text-red-500 focus:ring-red-400/30" />
                  <span className="text-xs text-white/60">Instrumental only (no vocals)</span>
                  <span className="relative group/tip inline-block ml-1 align-middle">
                    <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                    <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-48 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Enable this to strip all vocals and produce an instrumental-only remix.</span>
                  </span>
                </label>
              </div>
              {!instrumental && (
                <div>
                  <label className={labelClass}>
                    Vocal Gender
                    <span className="relative group/tip inline-block ml-1 align-middle">
                      <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                      <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-48 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Choose the gender of the AI-generated vocals. Auto-detect will match the original track.</span>
                    </span>
                  </label>
                  <select value={vocalGender} onChange={(e) => setVocalGender(e.target.value as any)} className={inputClass}>
                    <option value="">Auto-detect</option>
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </div>
              )}

              {/* Negative tags */}
              <div>
                <label className={labelClass}>
                  Avoid Tags
                  <span className="relative group/tip inline-block ml-1 align-middle">
                    <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                    <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-48 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">Comma-separated tags the AI should avoid (e.g. noise, distortion, reverb). Helps keep the remix clean.</span>
                  </span>
                </label>
                <input type="text" value={negativeTags} onChange={(e) => setNegativeTags(e.target.value)} placeholder="noise, distortion" className={inputClass} />
              </div>

              {/* Advanced sliders */}
              <button
                type="button"
                onClick={() => setShowRemixAdvanced(!showRemixAdvanced)}
                className="text-[11px] text-white/30 hover:text-red-400 transition-colors"
              >
                {showRemixAdvanced ? '▾ Hide advanced' : '▸ Advanced controls'}
              </button>
              {showRemixAdvanced && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className={labelClass}>Style Weight — {styleWeight}%</label>
                    <input type="range" min={0} max={100} value={styleWeight} onChange={(e) => setStyleWeight(Number(e.target.value))} className="w-full accent-red-500" />
                    <p className="text-[10px] text-white/20">How much the new style overrides the original</p>
                  </div>
                  <div>
                    <label className={labelClass}>Weirdness — {weirdness}%</label>
                    <input type="range" min={0} max={100} value={weirdness} onChange={(e) => setWeirdness(Number(e.target.value))} className="w-full accent-red-500" />
                    <p className="text-[10px] text-white/20">Higher = more experimental & unpredictable</p>
                  </div>
                  <div>
                    <label className={labelClass}>Audio Fidelity — {audioWeight}%</label>
                    <input type="range" min={0} max={100} value={audioWeight} onChange={(e) => setAudioWeight(Number(e.target.value))} className="w-full accent-red-500" />
                    <p className="text-[10px] text-white/20">Higher = stays closer to the original audio</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {info.fields.includes('taskId') && (
            <div>
              <label className={labelClass}>
                Task ID
                <span className="relative group/tip inline-block ml-1 align-middle">
                  <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                  <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-52 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">The task ID from a previously completed music generation. Found in your generation history.</span>
                </span>
              </label>
              <input type="text" value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="Paste task ID from generation..." className={inputClass} />
            </div>
          )}

          {info.fields.includes('audioId') && (
            <div>
              <label className={labelClass}>
                Audio ID
                <span className="relative group/tip inline-block ml-1 align-middle">
                  <HelpCircle size={10} className="text-white/20 hover:text-red-400 cursor-help" />
                  <span className="hidden group-hover/tip:block absolute left-0 top-4 z-50 w-52 p-2 rounded-lg bg-black/95 border border-white/10 text-[10px] text-white/60 font-normal normal-case tracking-normal shadow-xl">The audio ID of the specific track to create a video for.</span>
                </span>
              </label>
              <input type="text" value={audioId} onChange={(e) => setAudioId(e.target.value)} placeholder="Paste audio ID..." className={inputClass} />
            </div>
          )}

          {info.fields.includes('author') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Author</label>
                <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="444 Radio" maxLength={50} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Domain</label>
                <input type="text" value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="444radio.co.in" maxLength={50} className={inputClass} />
              </div>
            </div>
          )}

          {info.fields.includes('tags') && (
            <div>
              <label className={labelClass}>Style Tags</label>
              <div className="flex gap-2">
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. electronic, ambient, upbeat" className={`${inputClass} flex-1`} />
                <button
                  type="button"
                  onClick={() => handleBoostStyle(tags, setTags)}
                  disabled={isBoosting || tags.trim().length < 3}
                  title="AI-enhance your style tags (free)"
                  className="px-3 rounded-xl border border-white/10 hover:border-red-400/30 hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                >
                  {isBoosting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Progress */}
          {isLoading && progressMessage && (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-red-400 animate-spin" />
                <p className="text-xs text-white/60 font-medium">{progressMessage}</p>
              </div>
              <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-500/60 to-red-400/40 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
              <p className="text-[10px] text-white/20">This may take 1–3 minutes. Don&apos;t close this window.</p>
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
              {result.secondAudioUrl && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-bold text-green-300">Second take ready!</p>
                  <audio controls src={result.secondAudioUrl} className="w-full h-10 rounded-lg" />
                  <p className="text-[10px] text-white/30">{result.secondTitle || `${result.title} (Take 2)`}</p>
                </div>
              )}
              {result.secondAudioUrl && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-bold text-green-300">Second take ready!</p>
                  <audio controls src={result.secondAudioUrl} className="w-full h-10 rounded-lg" />
                  <p className="text-[10px] text-white/30">{result.secondTitle || `${result.title} (Take 2)`}</p>
                </div>
              )}
              {result.videoUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-green-300">Video ready!</p>
                  <video controls src={result.videoUrl} className="w-full rounded-lg" />
                  <a href={result.videoUrl} download className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200 underline underline-offset-2">Download MP4</a>
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
                {progressMessage || 'Starting...'}
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
