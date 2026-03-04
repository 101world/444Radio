'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STUDIO SAMPLE UPLOADER â€” Upload vocals/samples for Studio DAW
//
//  Key features:
//    - Presigned URL upload for large files (up to 50MB)
//    - Auto audio duration detection via Web Audio API
//    - Auto loopAt calculation from duration + BPM
//    - Live preview with play/pause
//    - Lists existing user samples with Strudel code hints
//    - Registers uploaded samples in Strudel engine at runtime
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface StudioSample {
  id: string
  name: string
  url: string
  original_filename: string
  file_size: number
  duration_ms?: number | null
  original_bpm?: number | null
  created_at: string
}

interface StudioSampleUploaderProps {
  isOpen: boolean
  onClose: () => void
  /** BPM from current project â€” used to auto-calculate loopAt */
  bpm: number
  /** Called to register sound in Strudel engine: webaudio.samples({ name: [url] }) */
  onRegisterSound: (name: string, url: string) => Promise<void>
  /** Called to add a vocal channel to the code with auto-calculated loopAt */
  onAddVocalChannel: (name: string, loopAt: number, sampleBpm?: number) => void
  /** Called to add a trimmed instrument channel usable on piano roll */
  onAddInstrumentChannel?: (name: string, begin: number, end: number) => void
  /** Called to add a drum pad channel with auto-chopped slices */
  onAddDrumPadChannel?: (name: string, chopCount: number, loopAt: number) => void
  /** Called to add a sound kit channel — trimmed sample usable as both pitched instrument and drum pads */
  onAddSoundKitChannel?: (name: string, begin: number, end: number, loopAt: number) => void
  /** Called when samples list changes (upload/delete) so parent can sync */
  onSamplesChanged?: (samples: StudioSample[]) => void
  accentColor?: string
}

/** Calculate loopAt cycles from audio duration (seconds) and BPM.
 *  Formula: Math.round(durationSeconds * BPM / 240)
 *  This ensures the sample fills exactly N cycles at the current tempo. */
function calculateLoopAt(durationSeconds: number, bpm: number): number {
  const raw = (durationSeconds * bpm) / 240
  return Math.max(1, Math.round(raw))
}

/** Calculate pitch shift in semitones caused by tempo-syncing a sample.
 *  When loopAt changes playback speed, pitch shifts proportionally.
 *  Returns positive for pitch-up, negative for pitch-down. */
function calculatePitchShift(sampleBpm: number, projectBpm: number): number {
  return 12 * Math.log2(projectBpm / sampleBpm)
}

/** Simple BPM detection via onset energy autocorrelation.
 *  Works best for rhythmic material > 3 seconds.
 *  Returns null for short samples or if detection fails. */
function detectBPM(audioBuffer: AudioBuffer): number | null {
  if (audioBuffer.duration < 3) return null

  const data = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // Compute energy envelope in 20ms windows
  const windowSize = Math.floor(sampleRate * 0.02)
  const hopSize = Math.floor(windowSize / 2)
  const numWindows = Math.floor((data.length - windowSize) / hopSize)
  if (numWindows < 20) return null

  const energy = new Float32Array(numWindows)
  for (let i = 0; i < numWindows; i++) {
    let sum = 0
    const offset = i * hopSize
    for (let j = 0; j < windowSize; j++) {
      sum += data[offset + j] ** 2
    }
    energy[i] = Math.sqrt(sum / windowSize)
  }

  // Onset strength (positive energy differences)
  const onset = new Float32Array(numWindows - 1)
  for (let i = 1; i < numWindows; i++) {
    onset[i - 1] = Math.max(0, energy[i] - energy[i - 1])
  }

  // Autocorrelation to find dominant periodicity in BPM range 60-200
  const windowsPerSecond = sampleRate / hopSize
  const minLag = Math.floor(windowsPerSecond * 60 / 200) // fastest = 200 BPM
  const maxLag = Math.ceil(windowsPerSecond * 60 / 60)    // slowest = 60 BPM

  let bestLag = minLag
  let bestCorr = -Infinity

  for (let lag = minLag; lag <= Math.min(maxLag, onset.length - 1); lag++) {
    let corr = 0
    const len = Math.min(onset.length - lag, onset.length)
    for (let i = 0; i < len; i++) {
      corr += onset[i] * onset[i + lag]
    }
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }

  const detected = Math.round(windowsPerSecond * 60 / bestLag)
  return detected >= 60 && detected <= 200 ? detected : null
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function StudioSampleUploader({
  isOpen, onClose, bpm, onRegisterSound, onAddVocalChannel,
  onSamplesChanged,
  onAddInstrumentChannel,
  onAddDrumPadChannel,
  onAddSoundKitChannel,
  accentColor = '#22d3ee',
}: StudioSampleUploaderProps) {
  const [samples, setSamples] = useState<StudioSample[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [soundName, setSoundName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sampleBpm, setSampleBpm] = useState<number | null>(null)
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null)
  const [importMode, setImportMode] = useState<'soundkit' | 'instrument' | 'drumpad'>('soundkit')
  const [trimBegin, setTrimBegin] = useState(0)   // 0.0 - 1.0 fraction
  const [trimEnd, setTrimEnd] = useState(1)       // 0.0 - 1.0 fraction
  const [chopCount, setChopCount] = useState(8)   // auto-chop slices for drum pad mode
  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastAudioBufferRef = useRef<AudioBuffer | null>(null)

  // Computed loopAt from duration + BPM
  const autoLoopAt = useMemo(() => {
    if (!audioDuration || !bpm) return null
    return calculateLoopAt(audioDuration, bpm)
  }, [audioDuration, bpm])

  // Fetch existing samples on open
  const fetchSamples = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/studio/samples')
      const data = await res.json()
      if (data.samples) {
        setSamples(data.samples)
        // Re-register all existing samples in Strudel
        for (const s of data.samples) {
          try { await onRegisterSound(s.name, s.url) }
          catch { /* Strudel may not be ready yet */ }
        }
      }
    } catch (err) {
      console.error('[StudioSampleUploader] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [onRegisterSound])

  useEffect(() => {
    if (isOpen) fetchSamples()
  }, [isOpen, fetchSamples])

  // Notify parent when samples list changes
  useEffect(() => {
    onSamplesChanged?.(samples)
  }, [samples, onSamplesChanged])

  // Cleanup preview URL
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  // Detect audio duration using Web Audio API (reuse single AudioContext)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const detectDuration = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const actx = audioCtxRef.current
      const audioBuffer = await actx.decodeAudioData(arrayBuffer)
      const duration = audioBuffer.duration
      setAudioDuration(duration)

      // Auto-detect BPM for samples > 3 seconds
      lastAudioBufferRef.current = audioBuffer
      const detected = detectBPM(audioBuffer)
      setDetectedBpm(detected)
      if (detected) setSampleBpm(detected)

      return duration
    } catch (err) {
      console.warn('[StudioSampleUploader] duration detection failed, using HTML5 fallback:', err)
      // Fallback: use HTML audio element
      return new Promise<number>((resolve) => {
        const audio = new Audio()
        audio.src = URL.createObjectURL(file)
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(audio.duration)
          URL.revokeObjectURL(audio.src)
          resolve(audio.duration)
        })
        audio.addEventListener('error', () => {
          setAudioDuration(null)
          resolve(0)
        })
      })
    }
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setError('Only audio files accepted (WAV, MP3, OGG, FLAC)')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File must be under 50MB')
      return
    }
    setSelectedFile(file)
    setError(null)
    setAudioDuration(null)
    setSampleBpm(null)
    setDetectedBpm(null)
    lastAudioBufferRef.current = null

    // Auto-generate name from filename
    const baseName = file.name.replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 32)
    if (!soundName) setSoundName(baseName)

    // Preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))

    // Detect duration
    await detectDuration(file)
  }, [soundName, previewUrl, detectDuration])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    dragCounterRef.current = 0
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !soundName) return

    const cleanName = soundName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    if (cleanName.length < 2 || cleanName.length > 32) {
      setError('Name must be 2-32 characters'); return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress('Preparing upload...')

    try {
      const isLargeFile = selectedFile.size > 4 * 1024 * 1024

      if (isLargeFile) {
        // â”€â”€ PRESIGNED URL MODE for large files â”€â”€
        setUploadProgress('Getting upload URL...')
        const initRes = await fetch('/api/studio/samples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
            durationMs: audioDuration ? Math.round(audioDuration * 1000) : null,
            originalBpm: sampleBpm || null,
          }),
        })
        const initData = await initRes.json()
        if (!initRes.ok) { setError(initData.error || 'Failed to init upload'); return }

        // Upload directly to R2 via presigned URL
        setUploadProgress(`Uploading ${formatFileSize(selectedFile.size)}...`)
        const uploadRes = await fetch(initData.uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type },
        })

        if (!uploadRes.ok) {
          setError('Direct upload to storage failed')
          return
        }

        setUploadProgress('Registering in engine...')
        // Register in Strudel
        await onRegisterSound(cleanName, initData.sample.url)

        setSamples(prev => [initData.sample, ...prev])
        setSuccess(`âœ“ "${cleanName}" uploaded! Use s("${cleanName}") in your code`)
      } else {
        // â”€â”€ FORMDATA MODE for small files â”€â”€
        setUploadProgress('Uploading...')
        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('name', cleanName)
        if (sampleBpm) formData.append('originalBpm', String(sampleBpm))

        const res = await fetch('/api/studio/samples', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Upload failed'); return }

        setUploadProgress('Registering in engine...')
        await onRegisterSound(cleanName, data.sample.url)

        setSamples(prev => [data.sample, ...prev])
        setSuccess(`âœ“ "${cleanName}" uploaded! Use s("${cleanName}") in your code`)
      }

      // Reset form
      setSelectedFile(null)
      setSoundName('')
      setAudioDuration(null)
      setTrimBegin(0)
      setTrimEnd(1)
      setChopCount(8)
      setSampleBpm(null)
      setDetectedBpm(null)
      lastAudioBufferRef.current = null
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('[StudioSampleUploader] upload error:', err)
      setError('Upload failed â€” check connection')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }, [selectedFile, soundName, audioDuration, onRegisterSound, previewUrl])

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/studio/samples?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        setSamples(prev => prev.filter(s => s.id !== id))
        setSuccess(`"${name}" deleted`)
      } else {
        setError(data.error || 'Delete failed')
      }
    } catch { setError('Delete failed') }
    finally { setDeletingId(null) }
  }, [deletingId])

  const togglePreview = useCallback(() => {
    if (!previewUrl) return
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    } else {
      const audio = new Audio(previewUrl)
      audioRef.current = audio
      audio.onended = () => setIsPlaying(false)
      audio.play()
      setIsPlaying(true)
    }
  }, [previewUrl, isPlaying])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
    }
  }, [previewUrl])

  // Pitch shift for current upload preview
  const uploadPitchShift = useMemo(() => {
    if (!sampleBpm || !bpm || sampleBpm === bpm) return null
    return calculatePitchShift(sampleBpm, bpm)
  }, [sampleBpm, bpm])

  // Use sample as vocal channel
  const handleUseAsVocal = useCallback((sample: StudioSample) => {
    const duration = sample.duration_ms ? sample.duration_ms / 1000 : null
    // Use sample's original BPM for accurate bar-count calculation, fallback to project BPM
    const calcBpm = sample.original_bpm || bpm
    const loopAt = duration ? calculateLoopAt(duration, calcBpm) : 8
    onAddVocalChannel(sample.name, loopAt, sample.original_bpm || undefined)
    onClose()
  }, [bpm, onAddVocalChannel, onClose])

  // Use sample as trimmed instrument (piano roll)
  const handleUseAsInstrument = useCallback((sample: StudioSample) => {
    if (onAddInstrumentChannel) {
      onAddInstrumentChannel(sample.name, trimBegin, trimEnd)
    } else {
      // Fallback: add as vocal with begin/end in the code hint
      const duration = sample.duration_ms ? sample.duration_ms / 1000 : null
      const calcBpm = sample.original_bpm || bpm
      const loopAt = duration ? calculateLoopAt(duration, calcBpm) : 8
      onAddVocalChannel(sample.name, loopAt, sample.original_bpm || undefined)
    }
    onClose()
  }, [bpm, onAddInstrumentChannel, onAddVocalChannel, onClose, trimBegin, trimEnd])

  // Use sample as auto-chopped drum pad
  const handleUseAsDrumPad = useCallback((sample: StudioSample) => {
    const duration = sample.duration_ms ? sample.duration_ms / 1000 : null
    const calcBpm = sample.original_bpm || bpm
    const loopAt = duration ? calculateLoopAt(duration, calcBpm) : 8
    if (onAddDrumPadChannel) {
      onAddDrumPadChannel(sample.name, chopCount, loopAt)
    } else {
      // Fallback: add as vocal channel (user can manually add .chop)
      onAddVocalChannel(sample.name, loopAt, sample.original_bpm || undefined)
    }
    onClose()
  }, [bpm, chopCount, onAddDrumPadChannel, onAddVocalChannel, onClose])

  // Use sample as sound kit — trimmed, pitched, usable on piano roll AND pad sampler
  const handleUseAsSoundKit = useCallback((sample: StudioSample) => {
    const duration = sample.duration_ms ? sample.duration_ms / 1000 : null
    const calcBpm = sample.original_bpm || bpm
    const loopAt = duration ? calculateLoopAt(duration, calcBpm) : 4
    if (onAddSoundKitChannel) {
      onAddSoundKitChannel(sample.name, trimBegin, trimEnd, loopAt)
    } else {
      // Fallback: add as instrument
      if (onAddInstrumentChannel) {
        onAddInstrumentChannel(sample.name, trimBegin, trimEnd)
      } else {
        onAddVocalChannel(sample.name, loopAt, sample.original_bpm || undefined)
      }
    }
    onClose()
  }, [bpm, trimBegin, trimEnd, onAddSoundKitChannel, onAddInstrumentChannel, onAddVocalChannel, onClose])


  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: '#0a0b0d',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* â”€â”€ Header â”€â”€ */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111318' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">ðŸŽ¤</span>
            <span className="text-sm font-black uppercase tracking-wider" style={{ color: '#e8ecf0' }}>
              Samples / Vocals
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: `${accentColor}15`, color: accentColor }}>
              {samples.length}/50
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono px-2 py-0.5 rounded-full" style={{ background: '#16181d', color: '#7fa998' }}>
              {bpm} BPM
            </span>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm cursor-pointer"
              style={{
                background: '#16181d',
                color: '#5a616b',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}>
              âœ•
            </button>
          </div>
        </div>

        {/* â”€â”€ Upload area â”€â”€ */}
        <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Drop zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
            style={{
              borderColor: dragOver ? accentColor : 'rgba(255,255,255,0.08)',
              background: dragOver ? `${accentColor}08` : '#131316',
            }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; setDragOver(true) }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setDragOver(false) } }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
            />
            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">ðŸ“Ž</span>
                  <span className="text-xs font-medium" style={{ color: '#e8ecf0' }}>{selectedFile.name}</span>
                  <span className="text-[10px]" style={{ color: '#5a616b' }}>{formatFileSize(selectedFile.size)}</span>
                </div>

                {/* Duration + auto loopAt info */}
                {audioDuration !== null && (
                  <div className="flex items-center justify-center gap-3 text-[10px]">
                    <span style={{ color: '#7fa998' }}>â± {formatDuration(audioDuration)}</span>
                    {autoLoopAt && (
                      <span style={{ color: '#b8a47f' }}>
                        loopAt({autoLoopAt}) @ {bpm}bpm
                      </span>
                    )}
                  </div>
                )}

                {/* BPM input + pitch shift indicator */}
                {audioDuration !== null && audioDuration >= 3 && (
                  <div className="flex items-center justify-center gap-2 text-[10px]" onClick={e => e.stopPropagation()}>
                    <span style={{ color: '#5a616b' }}>BPM:</span>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={sampleBpm ?? ''}
                      onChange={e => {
                        const v = parseInt(e.target.value)
                        setSampleBpm(isNaN(v) ? null : Math.max(30, Math.min(300, v)))
                      }}
                      placeholder={detectedBpm ? String(detectedBpm) : 'â€”'}
                      className="w-14 px-1.5 py-0.5 rounded text-center font-mono outline-none"
                      style={{ background: '#0a0a0c', color: '#e8ecf0', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    {detectedBpm && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: '#7fa99815', color: '#7fa998' }}>
                        auto: {detectedBpm}
                      </span>
                    )}
                    {uploadPitchShift !== null && (
                      <span className="px-1.5 py-0.5 rounded font-bold" style={{
                        background: Math.abs(uploadPitchShift) > 3 ? '#ef444420' : '#f59e0b20',
                        color: Math.abs(uploadPitchShift) > 3 ? '#ef4444' : '#f59e0b',
                      }}>
                        {uploadPitchShift > 0 ? '+' : ''}{uploadPitchShift.toFixed(1)} st
                      </span>
                    )}
                    {sampleBpm && sampleBpm === bpm && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>
                        âœ“ matched
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-center gap-2">
                  {previewUrl && (
                    <button
                      onClick={e => { e.stopPropagation(); togglePreview() }}
                      className="px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all hover:scale-105"
                      style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
                      {isPlaying ? 'â¹ Stop' : 'â–¶ Preview'}
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); setSoundName(''); setAudioDuration(null); setSampleBpm(null); setDetectedBpm(null); lastAudioBufferRef.current = null; if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) } }}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                    style={{ color: '#5a616b' }}>
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium" style={{ color: '#9aa7b3' }}>
                  Drop audio file here or click to browse
                </p>
                <p className="text-[10px]" style={{ color: '#5a616b' }}>
                  WAV, MP3, OGG, FLAC â€” up to 50MB Â· Vocals, loops, one-shots
                </p>
              </div>
            )}
          </div>


          {/* Import Mode Toggle */}
          {selectedFile && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#5a616b' }}>Mode:</span>
                <button
                  onClick={() => setImportMode('soundkit')}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                  style={{
                    background: importMode === 'soundkit' ? '#22d3ee20' : '#0a0b0d',
                    color: importMode === 'soundkit' ? '#22d3ee' : '#5a616b',
                    border: importMode === 'soundkit' ? '1px solid #22d3ee40' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: importMode === 'soundkit' ? 'inset 0 0 8px #22d3ee10' : 'none',
                  }}
                >
                  🎛️ Sound Kit
                </button>
                <button
                  onClick={() => setImportMode('instrument')}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                  style={{
                    background: importMode === 'instrument' ? '#6f8fb320' : '#0a0b0d',
                    color: importMode === 'instrument' ? '#6f8fb3' : '#5a616b',
                    border: importMode === 'instrument' ? '1px solid #6f8fb340' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: importMode === 'instrument' ? 'inset 0 0 8px #6f8fb310' : 'none',
                  }}
                >
                  🎹 Instrument
                </button>
                <button
                  onClick={() => setImportMode('drumpad')}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                  style={{
                    background: importMode === 'drumpad' ? '#b8a47f20' : '#0a0b0d',
                    color: importMode === 'drumpad' ? '#b8a47f' : '#5a616b',
                    border: importMode === 'drumpad' ? '1px solid #b8a47f40' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: importMode === 'drumpad' ? 'inset 0 0 8px #b8a47f10' : 'none',
                  }}
                >
                  🥁 Drum Pad
                </button>
              </div>
              {/* Sound Kit Mode: Trim Controls — produces note+loopAt channel for piano roll + pad sampler */}
              {importMode === 'soundkit' && audioDuration !== null && (
                <div className="space-y-1.5 mt-2 px-2 py-2 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.04)' }} onClick={e => e.stopPropagation()}>
                  <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#22d3ee' }}>
                    Sound Kit — usable on Piano Roll and Drum Pads
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>Begin:</span>
                      <input
                        type="range" min={0} max={0.99} step={0.01} value={trimBegin}
                        onChange={e => { const v = parseFloat(e.target.value); if (v < trimEnd) setTrimBegin(v) }}
                        className="w-16 h-1 accent-[#22d3ee]"
                      />
                      <span className="text-[8px] font-mono w-8 text-right" style={{ color: '#e8ecf0' }}>
                        {(trimBegin * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>End:</span>
                      <input
                        type="range" min={0.01} max={1} step={0.01} value={trimEnd}
                        onChange={e => { const v = parseFloat(e.target.value); if (v > trimBegin) setTrimEnd(v) }}
                        className="w-16 h-1 accent-[#22d3ee]"
                      />
                      <span className="text-[8px] font-mono w-8 text-right" style={{ color: '#e8ecf0' }}>
                        {(trimEnd * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Visual trim bar */}
                  <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#16181d' }}>
                    <div className="absolute top-0 h-full rounded-full" style={{
                      left: `${trimBegin * 100}%`,
                      width: `${(trimEnd - trimBegin) * 100}%`,
                      background: 'linear-gradient(90deg, #22d3ee40, #22d3ee80)',
                    }} />
                  </div>
                  <p className="text-[7px] font-mono text-center" style={{ color: '#5a616b' }}>
                    note + .loopAt + {trimBegin > 0 || trimEnd < 1 ? `.begin(${trimBegin.toFixed(2)}).end(${trimEnd.toFixed(2)})` : 'full sample'} — opens in Piano Roll or Pad Sampler
                  </p>
                </div>
              )}
              {/* Instrument Mode: Trim Controls */}
              {importMode === 'instrument' && audioDuration !== null && (
                <div className="space-y-1.5 mt-2 px-2 py-2 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.04)' }} onClick={e => e.stopPropagation()}>
                  <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#6f8fb3' }}>
                    Trim Range — plays on Piano Roll as pitched instrument
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>Begin:</span>
                      <input
                        type="range" min={0} max={0.99} step={0.01} value={trimBegin}
                        onChange={e => { const v = parseFloat(e.target.value); if (v < trimEnd) setTrimBegin(v) }}
                        className="w-16 h-1 accent-[#6f8fb3]"
                      />
                      <span className="text-[8px] font-mono w-8 text-right" style={{ color: '#e8ecf0' }}>
                        {(trimBegin * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>End:</span>
                      <input
                        type="range" min={0.01} max={1} step={0.01} value={trimEnd}
                        onChange={e => { const v = parseFloat(e.target.value); if (v > trimBegin) setTrimEnd(v) }}
                        className="w-16 h-1 accent-[#6f8fb3]"
                      />
                      <span className="text-[8px] font-mono w-8 text-right" style={{ color: '#e8ecf0' }}>
                        {(trimEnd * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {/* Visual trim bar */}
                  <div className="relative h-3 rounded-full overflow-hidden" style={{ background: '#16181d' }}>
                    <div className="absolute top-0 h-full rounded-full" style={{
                      left: `${trimBegin * 100}%`,
                      width: `${(trimEnd - trimBegin) * 100}%`,
                      background: 'linear-gradient(90deg, #6f8fb340, #6f8fb380)',
                    }} />
                  </div>
                  <p className="text-[7px] font-mono text-center" style={{ color: '#5a616b' }}>
                    .begin({trimBegin.toFixed(2)}).end({trimEnd.toFixed(2)}) — {audioDuration ? formatDuration(audioDuration * (trimEnd - trimBegin)) : '?'} selected
                  </p>
                </div>
              )}
              {/* Drum Pad Mode: Chop Controls */}
              {importMode === 'drumpad' && audioDuration !== null && (
                <div className="space-y-1.5 mt-2 px-2 py-2 rounded-lg" style={{ background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.04)' }} onClick={e => e.stopPropagation()}>
                  <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#b8a47f' }}>
                    Auto-Chop — splits into drum pad slices
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>Slices:</span>
                    {[2, 4, 8, 16, 32].map(n => (
                      <button
                        key={n}
                        onClick={() => setChopCount(n)}
                        className="px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-all"
                        style={{
                          background: chopCount === n ? '#b8a47f25' : '#16181d',
                          color: chopCount === n ? '#b8a47f' : '#5a616b',
                          border: chopCount === n ? '1px solid #b8a47f40' : '1px solid transparent',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {/* Visual chop bar */}
                  <div className="relative h-3 rounded-full overflow-hidden flex gap-px" style={{ background: '#16181d' }}>
                    {Array.from({ length: chopCount }, (_, i) => (
                      <div key={i} className="flex-1 rounded-sm" style={{
                        background: `hsl(${35 + (i * 360 / chopCount) % 60}, 40%, ${30 + (i % 2) * 8}%)`,
                      }} />
                    ))}
                  </div>
                  <p className="text-[7px] font-mono text-center" style={{ color: '#5a616b' }}>
                    .chop({chopCount}) — each slice = {audioDuration ? formatDuration(audioDuration / chopCount) : '?'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Name input + upload */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono" style={{ color: '#5a616b' }}>s(&quot;</span>
              <input
                type="text"
                value={soundName}
                onChange={e => setSoundName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32))}
                placeholder="my_vocal"
                maxLength={32}
                className="w-full pl-8 pr-8 py-2 rounded-lg text-xs font-mono outline-none"
                style={{ background: '#131316', color: '#e8ecf0', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono" style={{ color: '#5a616b' }}>&quot;)</span>
            </div>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !soundName || uploading}
              className="px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: '#7fa998',
                color: '#0a0a0c',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}>
              {uploading ? 'â³' : 'â†‘ Upload'}
            </button>
          </div>

          {/* Progress / status */}
          {uploadProgress && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: '#111318' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
              <span className="text-[10px] font-mono" style={{ color: accentColor }}>{uploadProgress}</span>
            </div>
          )}
          {error && (
            <p className="text-[11px] px-2 py-1 rounded-lg" style={{ background: '#ef444412', color: '#ef4444' }}>
              âš  {error}
            </p>
          )}
          {success && (
            <p className="text-[11px] px-2 py-1 rounded-lg" style={{ background: '#7fa99812', color: '#7fa998' }}>
              {success}
            </p>
          )}
        </div>

        {/* â”€â”€ Existing samples list â”€â”€ */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-1">
          {loading ? (
            <p className="text-[11px] text-center py-8" style={{ color: '#5a616b' }}>Loading samplesâ€¦</p>
          ) : samples.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-2xl">ðŸŽ¤</p>
              <p className="text-xs" style={{ color: '#5a616b' }}>
                No samples yet. Upload your first vocal or sound!
              </p>
              <p className="text-[10px]" style={{ color: '#5a616b' }}>
                After upload, use <span className="font-mono" style={{ color: accentColor }}>s(&quot;name&quot;)</span> or click &quot;+ Channel&quot; to auto-add
              </p>
            </div>
          ) : (
            <>
              <p className="text-[8px] font-black uppercase tracking-[.15em] mb-2" style={{ color: '#5a616b' }}>
                Your Samples
              </p>
              {samples.map(s => {
                const dur = s.duration_ms ? s.duration_ms / 1000 : null
                const calcBpm = s.original_bpm || bpm
                const sampleLoopAt = dur ? calculateLoopAt(dur, calcBpm) : null
                const pitchSt = s.original_bpm ? calculatePitchShift(s.original_bpm, bpm) : null
                return (
                  <div key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl group transition-all"
                    style={{
                      background: '#111318',
                      border: '1px solid rgba(255,255,255,0.04)',
                      boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                    }}>
                    <span className="text-xs">ðŸ”Š</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-bold truncate" style={{ color: '#e8ecf0' }}>
                        {s.name}
                      </p>
                      <div className="flex items-center gap-2 text-[9px]" style={{ color: '#5a616b' }}>
                        <span>{formatFileSize(s.file_size)}</span>
                        {dur && <span>â± {formatDuration(dur)}</span>}
                        {s.original_bpm && <span style={{ color: '#6f8fb3' }}>{s.original_bpm} BPM</span>}
                        {sampleLoopAt && <span style={{ color: '#b8a47f' }}>loopAt({sampleLoopAt})</span>}
                        {pitchSt !== null && Math.abs(pitchSt) > 0.1 && (
                          <span className="font-bold" style={{
                            color: Math.abs(pitchSt) > 3 ? '#ef4444' : '#f59e0b',
                          }}>
                            {pitchSt > 0 ? '+' : ''}{pitchSt.toFixed(1)}st
                          </span>
                        )}
                        {pitchSt !== null && Math.abs(pitchSt) <= 0.1 && (
                          <span style={{ color: '#22c55e' }}>âœ“</span>
                        )}
                      </div>
                    </div>

                    {/* Mode-aware add buttons */}
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleUseAsSoundKit(s)}
                        className="px-1.5 py-1 rounded-lg text-[7px] font-bold uppercase cursor-pointer hover:scale-105 transition-all"
                        style={{ background: '#22d3ee15', color: '#22d3ee', border: '1px solid #22d3ee30' }}
                        title="Add as sound kit — piano roll + drum pads">
                        + Kit
                      </button>
                      <button
                        onClick={() => handleUseAsVocal(s)}
                        className="px-1.5 py-1 rounded-lg text-[7px] font-bold uppercase cursor-pointer hover:scale-105 transition-all"
                        style={{ background: '#7fa99815', color: '#7fa998', border: '1px solid #7fa99830' }}
                        title="Add as vocal/loop channel">
                        + Loop
                      </button>
                      <button
                        onClick={() => handleUseAsInstrument(s)}
                        className="px-1.5 py-1 rounded-lg text-[7px] font-bold uppercase cursor-pointer hover:scale-105 transition-all"
                        style={{ background: '#6f8fb315', color: '#6f8fb3', border: '1px solid #6f8fb330' }}
                        title="Add as pitched instrument for piano roll">
                        + Inst
                      </button>
                      <button
                        onClick={() => handleUseAsDrumPad(s)}
                        className="px-1.5 py-1 rounded-lg text-[7px] font-bold uppercase cursor-pointer hover:scale-105 transition-all"
                        style={{ background: '#b8a47f15', color: '#b8a47f', border: '1px solid #b8a47f30' }}
                        title="Add as auto-chopped drum pad">
                        + Pad
                      </button>
                    </div>

                    {/* Code hint */}
                    <code className="text-[8px] px-1.5 py-0.5 rounded font-mono hidden group-hover:block shrink-0"
                      style={{ background: `${accentColor}10`, color: accentColor }}>
                      s(&quot;{s.name}&quot;)
                    </code>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deletingId === s.id}
                      className="w-6 h-6 flex items-center justify-center rounded text-[10px] opacity-0 group-hover:opacity-100 transition-all hover:scale-110 cursor-pointer shrink-0"
                      style={{ background: '#ef444412', color: '#ef4444', border: '1px solid #ef444420' }}
                      title="Delete sample">
                      {deletingId === s.id ? 'â³' : 'âœ•'}
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* â”€â”€ Footer â”€â”€ */}
        <div className="px-5 py-2 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#111318' }}>
          <p className="text-[9px]" style={{ color: '#5a616b' }}>
            Use <span className="font-mono" style={{ color: accentColor }}>s(&quot;name&quot;).loopAt(N)</span> for
            tempo-synced playback Â· <span className="font-mono" style={{ color: '#b8a47f' }}>.begin(0).end(0.5)</span> to
            slice Â· <span className="font-mono" style={{ color: '#6f8fb3' }}>.speed(1.5)</span> to pitch
          </p>
        </div>
      </div>
    </div>
  )
}
