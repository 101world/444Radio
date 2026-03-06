'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, Loader2, Mic, MicOff, Settings, AlertCircle, Play, Pause, Music2, Square } from 'lucide-react'

interface VoiceMelodyModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  /** Called when generation begins — parent should close modal & show chat */
  onGenerate: (params: VoiceMelodyGenerationParams) => void
}

export interface VoiceMelodyGenerationParams {
  title: string
  audio_url: string
  original_tags: string
  tags: string
  edit_mode: 'remix' | 'lyrics'
  lyrics: string
  original_lyrics: string
  number_of_steps: number
  seed: number | null
  scheduler: 'euler' | 'heun'
  guidance_type: 'apg' | 'cfg' | 'cfg_star'
  guidance_scale: number
  minimum_guidance_scale: number
  tag_guidance_scale: number
  lyric_guidance_scale: number
  granularity_scale: number
  guidance_interval: number
  guidance_interval_decay: number
}

const GENRE_TAG_PRESETS = [
  'lofi', 'hiphop', 'trap', 'chill', 'jazz', 'rnb', 'rock', 'pop',
  'electronic', 'ambient', 'classical', 'folk', 'metal', 'funk',
  'soul', 'edm', 'house', 'techno', 'cinematic', 'acoustic',
  'drum and bass', 'reggae', 'blues', 'indie',
]

export default function VoiceMelodyModal({ isOpen, onClose, userCredits, onGenerate }: VoiceMelodyModalProps) {
  // Core fields
  const [title, setTitle] = useState('')
  const [originalTags, setOriginalTags] = useState('')
  const [tags, setTags] = useState('')
  const [editMode, setEditMode] = useState<'remix' | 'lyrics'>('remix')
  const [lyrics, setLyrics] = useState('')
  const [originalLyrics, setOriginalLyrics] = useState('')

  // Audio upload
  const [inputAudioFile, setInputAudioFile] = useState<File | null>(null)
  const [inputAudioUrl, setInputAudioUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Audio preview
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Detected duration
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null)

  // Voice Melody parameters
  const [numberOfSteps, setNumberOfSteps] = useState(27)
  const [seed, setSeed] = useState<number | null>(null)
  const [scheduler, setScheduler] = useState<'euler' | 'heun'>('euler')
  const [guidanceType, setGuidanceType] = useState<'apg' | 'cfg' | 'cfg_star'>('apg')
  const [guidanceScale, setGuidanceScale] = useState(15)
  const [minimumGuidanceScale, setMinimumGuidanceScale] = useState(3)
  const [tagGuidanceScale, setTagGuidanceScale] = useState(5)
  const [lyricGuidanceScale, setLyricGuidanceScale] = useState(1.5)
  const [granularityScale, setGranularityScale] = useState(10)
  const [guidanceInterval, setGuidanceInterval] = useState(0.5)
  const [guidanceIntervalDecay, setGuidanceIntervalDecay] = useState(0)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Detect audio duration when file is selected
  const detectAudioDuration = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.addEventListener('loadedmetadata', () => {
      const dur = Math.ceil(audio.duration)
      setDetectedDuration(dur)
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

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['wav', 'mp3', 'webm', 'ogg', 'm4a', 'mp4', 'aac'].includes(ext || '')) {
      setUploadError('File must be .wav, .mp3, .m4a, .mp4, .webm or .ogg')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File must be less than 20 MB')
      return
    }

    setUploadError('')
    setInputAudioFile(file)
    detectAudioDuration(file)

    // Upload via presigned URL
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

      const uploadRes = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/wav' },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Upload to storage failed')

      setInputAudioUrl(presignData.publicUrl)
      console.log('✅ Audio uploaded for Voice Melody:', presignData.publicUrl)
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

  // Convert an AudioBuffer to a WAV Blob (PCM 16-bit)
  const audioBufferToWav = useCallback((buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const format = 1 // PCM
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataLength = buffer.length * numChannels * (bitsPerSample / 8)
    const headerLength = 44
    const arrayBuffer = new ArrayBuffer(headerLength + dataLength)
    const view = new DataView(arrayBuffer)

    // WAV header
    const writeStr = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, format, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)
    writeStr(36, 'data')
    view.setUint32(40, dataLength, true)

    // Interleave channels and write PCM samples
    let offset = 44
    const channels = []
    for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch))
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }, [])

  // Start recording from mic
  const startRecording = async () => {
    try {
      setUploadError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick best supported format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType })
        if (rawBlob.size < 1000) {
          setUploadError('Recording too short — try again')
          return
        }

        // Convert recorded webm/ogg → WAV so fal.ai can process it
        setIsUploading(true)
        try {
          const audioCtx = new AudioContext()
          const arrayBuf = await rawBlob.arrayBuffer()
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuf)
          await audioCtx.close()

          const wavBlob = audioBufferToWav(audioBuffer)
          const file = new File([wavBlob], `recording-${Date.now()}.wav`, { type: 'audio/wav' })
          setInputAudioFile(file)
          detectAudioDuration(file)

          // Upload WAV
          const presignRes = await fetch('/api/generate/upload-reference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileType: 'audio/wav',
              fileSize: file.size,
              type: 'song',
            }),
          })
          if (!presignRes.ok) throw new Error('Failed to get upload URL')
          const presignData = await presignRes.json()
          if (!presignData.uploadUrl || !presignData.publicUrl) throw new Error('Invalid upload response')

          const uploadRes = await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'audio/wav' },
            body: file,
          })
          if (!uploadRes.ok) throw new Error('Upload to storage failed')

          setInputAudioUrl(presignData.publicUrl)
          console.log('✅ Recorded audio converted to WAV & uploaded:', presignData.publicUrl)
        } catch (err: any) {
          console.error('Recording conversion/upload error:', err)
          setUploadError(err.message || 'Failed to process recording')
          setInputAudioFile(null)
        } finally {
          setIsUploading(false)
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(250) // collect chunks every 250ms
      setIsRecording(true)
      setRecordingTime(0)

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Mic access error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setUploadError('Microphone access denied — check browser permissions')
      } else {
        setUploadError('Could not access microphone')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setIsRecording(false)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Cleanup preview audio & recording on unmount/close
  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause()
      previewAudioRef.current = null
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
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
    originalTags.trim().length >= 1 &&
    tags.trim().length >= 1 &&
    inputAudioUrl &&
    !isUploading &&
    !isGenerating

  const handleSubmit = () => {
    if (!canGenerate) return
    if (userCredits !== undefined && userCredits < 2) {
      setUploadError('You need at least 2 credits to use Voice Melody')
      return
    }
    setIsGenerating(true)

    onGenerate({
      title: title.trim(),
      audio_url: inputAudioUrl,
      original_tags: originalTags.trim(),
      tags: tags.trim(),
      edit_mode: editMode,
      lyrics: lyrics.trim(),
      original_lyrics: originalLyrics.trim(),
      number_of_steps: numberOfSteps,
      seed,
      scheduler,
      guidance_type: guidanceType,
      guidance_scale: guidanceScale,
      minimum_guidance_scale: minimumGuidanceScale,
      tag_guidance_scale: tagGuidanceScale,
      lyric_guidance_scale: lyricGuidanceScale,
      granularity_scale: granularityScale,
      guidance_interval: guidanceInterval,
      guidance_interval_decay: guidanceIntervalDecay,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-gray-950/95 backdrop-blur-2xl border border-purple-500/15 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-xl px-6 pt-6 pb-4 border-b border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-400/20 flex items-center justify-center">
                <Mic size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Voice Melody</h3>
                <p className="text-xs text-white/40 mt-0.5">Hum or sing → AI transforms into instruments</p>
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
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-purple-500/30 focus:border-purple-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors"
            />
            <p className="text-[10px] text-white/20 mt-1">{title.length}/100</p>
          </div>

          {/* ── Upload Audio ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Input Audio <span className="text-red-400">*</span></label>
            <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-purple-500/[0.08] border border-purple-500/20 rounded-lg">
              <Mic size={14} className="text-purple-400 flex-shrink-0" />
              <p className="text-[11px] text-purple-300/80">Upload your <strong>voice melody, humming, or existing track</strong> — it will be transformed into a new style/instrument arrangement.</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".wav,.mp3,.m4a,.mp4,.aac,.webm,.ogg,audio/*" className="hidden" onChange={handleFileSelect} />
            {isRecording ? (
              /* ── Recording in progress ── */
              <div className="flex items-center justify-between px-4 py-4 bg-red-500/[0.1] border border-red-500/30 rounded-xl animate-pulse">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <Mic size={18} className="text-red-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-red-300">Recording…</div>
                    <div className="text-xs text-red-400/60 tabular-nums">{formatTime(recordingTime)}</div>
                  </div>
                </div>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-xl text-red-300 text-sm font-medium transition-colors"
                >
                  <Square size={14} fill="currentColor" /> Stop
                </button>
              </div>
            ) : inputAudioFile ? (
              <div className="flex items-center justify-between px-4 py-3 bg-purple-500/[0.08] border border-purple-500/20 rounded-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Music2 size={16} className="text-purple-400 flex-shrink-0" />
                  <span className="text-sm text-purple-200 truncate">{inputAudioFile.name}</span>
                  {detectedDuration && (
                    <span className="text-[10px] text-white/30 flex-shrink-0">{detectedDuration}s</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {inputAudioUrl && (
                    <button onClick={togglePreview} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                      {isPreviewPlaying ? <Pause size={14} className="text-purple-400" /> : <Play size={14} className="text-purple-400" />}
                    </button>
                  )}
                  <button onClick={() => { setInputAudioFile(null); setInputAudioUrl(''); setDetectedDuration(null); previewAudioRef.current?.pause(); previewAudioRef.current = null }} className="text-xs text-white/30 hover:text-red-400 transition-colors">Remove</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Record button */}
                <button
                  onClick={startRecording}
                  disabled={isUploading}
                  className="flex-1 flex items-center gap-3.5 px-4 py-4 bg-white/[0.03] hover:bg-red-500/[0.08] border border-dashed border-white/10 hover:border-red-500/30 rounded-xl transition-all duration-200 group disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 flex items-center justify-center transition-colors">
                    <Mic size={18} className="text-red-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white/80 group-hover:text-red-200 transition-colors">
                      Record
                    </div>
                    <div className="text-[11px] text-white/30">Hum or sing into mic</div>
                  </div>
                </button>
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 flex items-center gap-3.5 px-4 py-4 bg-white/[0.03] hover:bg-purple-500/[0.08] border border-dashed border-white/10 hover:border-purple-500/30 rounded-xl transition-all duration-200 group disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                    {isUploading ? <Loader2 size={18} className="text-purple-400 animate-spin" /> : <Upload size={18} className="text-purple-400" />}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white/80 group-hover:text-purple-200 transition-colors">
                      {isUploading ? 'Uploading…' : 'Upload'}
                    </div>
                    <div className="text-[11px] text-white/30">.wav / .mp3 / .m4a — max 20 MB</div>
                  </div>
                </button>
              </div>
            )}
            {uploadError && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                <AlertCircle size={12} /> {uploadError}
              </div>
            )}
          </div>

          {/* ── Edit Mode ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Edit Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode('remix')}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  editMode === 'remix'
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                    : 'bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.06]'
                }`}
              >
                🎵 Remix
                <span className="block text-[10px] mt-0.5 opacity-60">Transform style & genre</span>
              </button>
              <button
                onClick={() => setEditMode('lyrics')}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  editMode === 'lyrics'
                    ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300'
                    : 'bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/[0.06]'
                }`}
              >
                ✍️ Lyrics
                <span className="block text-[10px] mt-0.5 opacity-60">Re-sing with new lyrics</span>
              </button>
            </div>
          </div>

          {/* ── Original Tags (required) ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Original Tags <span className="text-red-400">*</span> <span className="text-white/25 normal-case">(describe input audio genre)</span></label>
            <input
              type="text"
              value={originalTags}
              onChange={e => setOriginalTags(e.target.value)}
              placeholder="e.g. lofi, hiphop, chill, vocals"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-purple-500/30 focus:border-purple-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {GENRE_TAG_PRESETS.slice(0, 12).map(tag => (
                <button
                  key={tag}
                  onClick={() => setOriginalTags(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="px-2 py-0.5 bg-white/5 hover:bg-purple-500/10 border border-white/10 rounded-md text-[10px] text-white/50 hover:text-purple-300 transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ── Target Tags (required) ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Target Tags <span className="text-red-400">*</span> <span className="text-white/25 normal-case">(desired output style)</span></label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. cinematic, orchestral, epic, instrumental"
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-purple-500/30 focus:border-purple-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {GENRE_TAG_PRESETS.slice(0, 12).map(tag => (
                <button
                  key={tag}
                  onClick={() => setTags(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="px-2 py-0.5 bg-white/5 hover:bg-purple-500/10 border border-white/10 rounded-md text-[10px] text-white/50 hover:text-purple-300 transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ── Lyrics (optional, especially for lyrics mode) ── */}
          <div>
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">
              {editMode === 'lyrics' ? 'New Lyrics' : 'Lyrics'} <span className="text-white/25 normal-case">(optional — leave blank or type [inst] for instrumental)</span>
            </label>
            <textarea
              value={lyrics}
              onChange={e => setLyrics(e.target.value)}
              placeholder={editMode === 'lyrics'
                ? '[verse]\nYour new lyrics here...\n\n[chorus]\nChorus lyrics...'
                : '[inst] for instrumental, or add lyrics with [verse] [chorus] tags'
              }
              rows={4}
              className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-purple-500/30 focus:border-purple-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors resize-none font-mono"
            />
          </div>

          {/* ── Original Lyrics (for edit mode = lyrics) ── */}
          {editMode === 'lyrics' && (
            <div>
              <label className="block text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1.5">Original Lyrics <span className="text-white/25 normal-case">(optional)</span></label>
              <textarea
                value={originalLyrics}
                onChange={e => setOriginalLyrics(e.target.value)}
                placeholder="Paste original lyrics from the input audio if available..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 hover:border-fuchsia-500/30 focus:border-fuchsia-400/50 rounded-xl text-sm text-white placeholder-white/25 outline-none transition-colors resize-none font-mono"
              />
            </div>
          )}

          {/* ── Advanced Toggle ── */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            <Settings size={12} />
            {showAdvanced ? 'Hide' : 'Show'} advanced parameters
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
              {/* Number of Steps */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Inference Steps <span className="text-white/20 normal-case">({numberOfSteps})</span>
                </label>
                <input type="range" min={10} max={100} value={numberOfSteps} onChange={e => setNumberOfSteps(parseInt(e.target.value))} className="w-full accent-purple-500" />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-white/15">10 (fast)</span>
                  <span className="text-[9px] text-white/15">100 (best)</span>
                </div>
              </div>

              {/* Scheduler */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Scheduler</label>
                <div className="flex gap-2">
                  {(['euler', 'heun'] as const).map(s => (
                    <button key={s} onClick={() => setScheduler(s)} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${scheduler === s ? 'border-purple-500/50 bg-purple-500/15 text-purple-400' : 'border-white/10 bg-white/[0.03] text-white/30'}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Guidance Type */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">Guidance Type</label>
                <div className="flex gap-2">
                  {(['apg', 'cfg', 'cfg_star'] as const).map(g => (
                    <button key={g} onClick={() => setGuidanceType(g)} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${guidanceType === g ? 'border-purple-500/50 bg-purple-500/15 text-purple-400' : 'border-white/10 bg-white/[0.03] text-white/30'}`}>
                      {g.toUpperCase().replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Guidance Scale */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Guidance Scale <span className="text-white/20 normal-case">({guidanceScale})</span>
                </label>
                <input type="range" min={1} max={30} step={0.5} value={guidanceScale} onChange={e => setGuidanceScale(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              {/* Min Guidance Scale */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Min Guidance Scale <span className="text-white/20 normal-case">({minimumGuidanceScale})</span>
                </label>
                <input type="range" min={0} max={15} step={0.5} value={minimumGuidanceScale} onChange={e => setMinimumGuidanceScale(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              {/* Tag Guidance Scale */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Tag Guidance Scale <span className="text-white/20 normal-case">({tagGuidanceScale})</span>
                </label>
                <input type="range" min={0} max={15} step={0.5} value={tagGuidanceScale} onChange={e => setTagGuidanceScale(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              {/* Lyric Guidance Scale */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Lyric Guidance Scale <span className="text-white/20 normal-case">({lyricGuidanceScale})</span>
                </label>
                <input type="range" min={0} max={10} step={0.1} value={lyricGuidanceScale} onChange={e => setLyricGuidanceScale(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              {/* Granularity Scale */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Granularity Scale <span className="text-white/20 normal-case">({granularityScale})</span>
                </label>
                <input type="range" min={1} max={30} value={granularityScale} onChange={e => setGranularityScale(parseInt(e.target.value))} className="w-full accent-purple-500" />
                <p className="text-[9px] text-white/15 mt-0.5">Higher = reduces artifacts</p>
              </div>

              {/* Guidance Interval */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Guidance Interval <span className="text-white/20 normal-case">({guidanceInterval})</span>
                </label>
                <input type="range" min={0} max={1} step={0.05} value={guidanceInterval} onChange={e => setGuidanceInterval(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              {/* Guidance Interval Decay */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1">
                  Interval Decay <span className="text-white/20 normal-case">({guidanceIntervalDecay})</span>
                </label>
                <input type="range" min={0} max={1} step={0.05} value={guidanceIntervalDecay} onChange={e => setGuidanceIntervalDecay(parseFloat(e.target.value))} className="w-full accent-purple-500" />
                <p className="text-[9px] text-white/15 mt-0.5">0 = no decay</p>
              </div>

              {/* Seed */}
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
                  placeholder="Random (blank)"
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-white/15 outline-none"
                />
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
                  ? 'bg-gradient-to-r from-purple-500/30 to-fuchsia-400/30 hover:from-purple-500/40 hover:to-fuchsia-400/40 border border-purple-500/30 text-white'
                  : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Transforming…
                </span>
              ) : (
                `Voice Melody — 2 credits`
              )}
            </button>
            <p className="text-[10px] text-white/20 text-center mt-2">Voice Melody • Hum → Instrument • WAV output</p>
          </div>
        </div>
      </div>
    </div>
  )
}
