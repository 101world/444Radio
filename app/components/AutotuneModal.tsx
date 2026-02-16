'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, Mic, Loader2, Play, Pause, RotateCcw, Zap, ChevronDown } from 'lucide-react'

interface AutotuneModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
  onStart?: () => void
  onError?: (error: string) => void
}

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function AutotuneModal({ isOpen, onClose, onSuccess, onStart, onError }: AutotuneModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [outputUrl, setOutputUrl] = useState<string | null>(null)
  const [autotuneKey, setAutotuneKey] = useState('C')
  const [autotuneScale, setAutotuneScale] = useState<'maj' | 'min'>('maj')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [error, setError] = useState('')

  // Playback state
  const [isPlayingInput, setIsPlayingInput] = useState(false)
  const [isPlayingOutput, setIsPlayingOutput] = useState(false)
  const [inputProgress, setInputProgress] = useState(0)
  const [outputProgress, setOutputProgress] = useState(0)
  const [inputDuration, setInputDuration] = useState(0)
  const [outputDuration, setOutputDuration] = useState(0)

  // Audio refs
  const inputAudioRef = useRef<HTMLAudioElement | null>(null)
  const outputAudioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Waveform refs
  const inputCanvasRef = useRef<HTMLCanvasElement>(null)
  const outputCanvasRef = useRef<HTMLCanvasElement>(null)
  const inputAnimFrameRef = useRef<number>(0)
  const outputAnimFrameRef = useRef<number>(0)

  // AudioContext refs for waveform
  const audioCtxRef = useRef<AudioContext | null>(null)
  const inputAnalyserRef = useRef<AnalyserNode | null>(null)
  const outputAnalyserRef = useRef<AnalyserNode | null>(null)
  const inputSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const outputSourceRef = useRef<MediaElementAudioSourceNode | null>(null)

  // Static waveform data
  const [inputWaveformData, setInputWaveformData] = useState<Float32Array | null>(null)
  const [outputWaveformData, setOutputWaveformData] = useState<Float32Array | null>(null)

  // Cleanup
  useEffect(() => {
    return () => {
      if (inputAnimFrameRef.current) cancelAnimationFrame(inputAnimFrameRef.current)
      if (outputAnimFrameRef.current) cancelAnimationFrame(outputAnimFrameRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // Generate static waveform from audio file
  const generateStaticWaveform = useCallback(async (url: string, isInput: boolean) => {
    try {
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const channelData = audioBuffer.getChannelData(0)

      // Downsample to 200 points
      const samples = 200
      const blockSize = Math.floor(channelData.length / samples)
      const waveform = new Float32Array(samples)

      for (let i = 0; i < samples; i++) {
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j])
        }
        waveform[i] = sum / blockSize
      }

      if (isInput) {
        setInputWaveformData(waveform)
      } else {
        setOutputWaveformData(waveform)
      }

      audioContext.close()
    } catch (err) {
      console.warn('Could not generate static waveform:', err)
    }
  }, [])

  // Draw static waveform
  const drawStaticWaveform = useCallback((
    canvas: HTMLCanvasElement,
    waveformData: Float32Array,
    progress: number,
    accentColor: string,
    dimColor: string
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)

    const barCount = waveformData.length
    const barWidth = Math.max(1, (width / barCount) * 0.6)
    const gap = (width / barCount) * 0.4
    const centerY = height / 2
    const maxBarHeight = height * 0.8

    // Normalize
    let max = 0
    for (let i = 0; i < waveformData.length; i++) {
      if (waveformData[i] > max) max = waveformData[i]
    }
    if (max === 0) max = 1

    const progressX = progress * width

    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + gap)
      const amp = (waveformData[i] / max) * maxBarHeight / 2
      const barH = Math.max(1.5, amp)

      const isPast = x < progressX

      // Glow for played section
      if (isPast) {
        ctx.shadowColor = accentColor
        ctx.shadowBlur = 4
        ctx.fillStyle = accentColor
      } else {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.fillStyle = dimColor
      }

      // Top bar
      ctx.beginPath()
      ctx.roundRect(x, centerY - barH, barWidth, barH, 1)
      ctx.fill()

      // Bottom bar (mirror)
      ctx.beginPath()
      ctx.roundRect(x, centerY + 1, barWidth, barH, 1)
      ctx.fill()
    }

    // Playhead
    if (progress > 0 && progress < 1) {
      ctx.shadowColor = accentColor
      ctx.shadowBlur = 8
      ctx.fillStyle = '#fff'
      ctx.fillRect(progressX - 1, 0, 2, height)
      ctx.shadowBlur = 0
    }
  }, [])

  // Setup live waveform analyser
  const setupAnalyser = useCallback((audioEl: HTMLAudioElement, isInput: boolean) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    const ctx = audioCtxRef.current
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.85

    // Avoid creating duplicate sources
    const sourceRef = isInput ? inputSourceRef : outputSourceRef
    if (!sourceRef.current) {
      const source = ctx.createMediaElementSource(audioEl)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      sourceRef.current = source
    } else {
      sourceRef.current.connect(analyser)
      analyser.connect(ctx.destination)
    }

    if (isInput) {
      inputAnalyserRef.current = analyser
    } else {
      outputAnalyserRef.current = analyser
    }

    return analyser
  }, [])

  // Animate live waveform
  const animateLiveWaveform = useCallback((
    canvas: HTMLCanvasElement,
    analyser: AnalyserNode,
    accentColor: string,
    isInput: boolean
  ) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)

      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, width, height)

      const barCount = analyser.frequencyBinCount
      const barWidth = Math.max(1, (width / barCount) * 0.7)
      const gap = (width / barCount) * 0.3
      const centerY = height / 2

      for (let i = 0; i < barCount; i++) {
        const amp = (dataArray[i] / 255) * (height / 2) * 0.9
        const x = i * (barWidth + gap)

        ctx.shadowColor = accentColor
        ctx.shadowBlur = amp > 10 ? 6 : 2
        ctx.fillStyle = accentColor

        // Top bar
        ctx.beginPath()
        ctx.roundRect(x, centerY - amp, barWidth, Math.max(1, amp), 1)
        ctx.fill()

        // Bottom bar
        ctx.beginPath()
        ctx.roundRect(x, centerY + 1, barWidth, Math.max(1, amp), 1)
        ctx.fill()
      }

      ctx.shadowBlur = 0

      const frameRef = isInput ? inputAnimFrameRef : outputAnimFrameRef
      frameRef.current = requestAnimationFrame(draw)
    }

    draw()
  }, [])

  // Track playback progress
  useEffect(() => {
    const inputAudio = inputAudioRef.current
    const outputAudio = outputAudioRef.current

    const updateInputProgress = () => {
      if (inputAudio && inputAudio.duration) {
        setInputProgress(inputAudio.currentTime / inputAudio.duration)
      }
    }
    const updateOutputProgress = () => {
      if (outputAudio && outputAudio.duration) {
        setOutputProgress(outputAudio.currentTime / outputAudio.duration)
      }
    }

    inputAudio?.addEventListener('timeupdate', updateInputProgress)
    outputAudio?.addEventListener('timeupdate', updateOutputProgress)

    inputAudio?.addEventListener('loadedmetadata', () => setInputDuration(inputAudio.duration))
    outputAudio?.addEventListener('loadedmetadata', () => setOutputDuration(outputAudio.duration))

    inputAudio?.addEventListener('ended', () => { setIsPlayingInput(false); setInputProgress(0) })
    outputAudio?.addEventListener('ended', () => { setIsPlayingOutput(false); setOutputProgress(0) })

    return () => {
      inputAudio?.removeEventListener('timeupdate', updateInputProgress)
      outputAudio?.removeEventListener('timeupdate', updateOutputProgress)
    }
  }, [previewUrl, outputUrl])

  // Redraw static waveforms when progress/data changes
  useEffect(() => {
    if (inputCanvasRef.current && inputWaveformData && !isPlayingInput) {
      drawStaticWaveform(inputCanvasRef.current, inputWaveformData, inputProgress, '#a78bfa', 'rgba(167,139,250,0.15)')
    }
  }, [inputProgress, inputWaveformData, isPlayingInput, drawStaticWaveform])

  useEffect(() => {
    if (outputCanvasRef.current && outputWaveformData && !isPlayingOutput) {
      drawStaticWaveform(outputCanvasRef.current, outputWaveformData, outputProgress, '#22d3ee', 'rgba(34,211,238,0.15)')
    }
  }, [outputProgress, outputWaveformData, isPlayingOutput, drawStaticWaveform])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setOutputUrl(null)
    setOutputWaveformData(null)

    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file')
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('File must be under 100MB')
      return
    }

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    generateStaticWaveform(url, true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setError('Please drop an audio file')
      return
    }
    setSelectedFile(file)
    setOutputUrl(null)
    setOutputWaveformData(null)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    generateStaticWaveform(url, true)
  }

  const togglePlayInput = () => {
    if (!inputAudioRef.current) return

    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    if (isPlayingInput) {
      inputAudioRef.current.pause()
      if (inputAnimFrameRef.current) cancelAnimationFrame(inputAnimFrameRef.current)
      setIsPlayingInput(false)
    } else {
      // Pause other
      if (isPlayingOutput && outputAudioRef.current) {
        outputAudioRef.current.pause()
        if (outputAnimFrameRef.current) cancelAnimationFrame(outputAnimFrameRef.current)
        setIsPlayingOutput(false)
      }

      inputAudioRef.current.play()
      setIsPlayingInput(true)

      // Setup analyser if needed and animate
      if (inputCanvasRef.current) {
        if (!inputAnalyserRef.current) {
          const analyser = setupAnalyser(inputAudioRef.current, true)
          animateLiveWaveform(inputCanvasRef.current, analyser, '#a78bfa', true)
        } else {
          animateLiveWaveform(inputCanvasRef.current, inputAnalyserRef.current, '#a78bfa', true)
        }
      }
    }
  }

  const togglePlayOutput = () => {
    if (!outputAudioRef.current) return

    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    if (isPlayingOutput) {
      outputAudioRef.current.pause()
      if (outputAnimFrameRef.current) cancelAnimationFrame(outputAnimFrameRef.current)
      setIsPlayingOutput(false)
    } else {
      // Pause other
      if (isPlayingInput && inputAudioRef.current) {
        inputAudioRef.current.pause()
        if (inputAnimFrameRef.current) cancelAnimationFrame(inputAnimFrameRef.current)
        setIsPlayingInput(false)
      }

      outputAudioRef.current.play()
      setIsPlayingOutput(true)

      if (outputCanvasRef.current) {
        if (!outputAnalyserRef.current) {
          const analyser = setupAnalyser(outputAudioRef.current, false)
          animateLiveWaveform(outputCanvasRef.current, analyser, '#22d3ee', false)
        } else {
          animateLiveWaveform(outputCanvasRef.current, outputAnalyserRef.current, '#22d3ee', false)
        }
      }
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleClose = () => {
    // Stop all playback
    if (inputAudioRef.current) { inputAudioRef.current.pause(); inputAudioRef.current.currentTime = 0 }
    if (outputAudioRef.current) { outputAudioRef.current.pause(); outputAudioRef.current.currentTime = 0 }
    if (inputAnimFrameRef.current) cancelAnimationFrame(inputAnimFrameRef.current)
    if (outputAnimFrameRef.current) cancelAnimationFrame(outputAnimFrameRef.current)

    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setOutputUrl(null)
    setError('')
    setIsProcessing(false)
    setProcessingStatus('')
    setIsPlayingInput(false)
    setIsPlayingOutput(false)
    setInputProgress(0)
    setOutputProgress(0)
    setInputWaveformData(null)
    setOutputWaveformData(null)
    setAutotuneKey('C')
    setAutotuneScale('maj')

    // Reset source refs so they can be recreated for new files
    inputSourceRef.current = null
    outputSourceRef.current = null
    inputAnalyserRef.current = null
    outputAnalyserRef.current = null

    onClose()
  }

  const handleProcess = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setError('')

    try {
      // Step 1: Upload to R2
      setProcessingStatus('Uploading audio...')
      const presignResponse = await fetch('/api/upload/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        })
      })

      if (!presignResponse.ok) {
        const err = await presignResponse.json()
        throw new Error(err.error || 'Failed to prepare upload')
      }

      const { uploadUrl, publicUrl } = await presignResponse.json()

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      })

      if (!uploadResponse.ok) throw new Error('Upload failed')

      // Wait for R2 propagation
      setProcessingStatus('Verifying file...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Verify accessibility
      let retries = 0
      while (retries < 3) {
        try {
          const head = await fetch(publicUrl, { method: 'HEAD' })
          if (head.ok) break
        } catch { /* retry */ }
        await new Promise(resolve => setTimeout(resolve, 2000))
        retries++
      }

      // Step 2: Call autotune API
      onStart?.()
      const scale = `${autotuneKey}:${autotuneScale}`
      setProcessingStatus(`Autotuning to ${autotuneKey} ${autotuneScale === 'maj' ? 'Major' : 'Minor'}...`)

      const autotuneResponse = await fetch('/api/generate/autotune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_file: publicUrl,
          scale: scale,
          trackTitle: selectedFile.name.replace(/\.[^/.]+$/, '') || 'Audio',
          output_format: 'wav',
        })
      })

      const result = await autotuneResponse.json()

      if (!autotuneResponse.ok || result.error) {
        throw new Error(result.error || 'Autotune processing failed')
      }

      // Step 3: Show output
      setOutputUrl(result.audioUrl)
      generateStaticWaveform(result.audioUrl, false)
      setProcessingStatus('')

      // Notify parent
      onSuccess?.({ ...result, type: 'autotune' })
    } catch (err) {
      console.error('Autotune error:', err)
      const msg = err instanceof Error ? err.message : 'Processing failed'
      setError(msg)
      onError?.(msg)
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a0a] shadow-[0_0_80px_rgba(0,0,0,0.8)]">

        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <Mic size={18} className="text-white/70" />
              </div>
              {isProcessing && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90 tracking-wide">AUTOTUNE</h3>
              <p className="text-[10px] text-white/25 tracking-widest uppercase">Pitch Correction Engine</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors">
            <X size={18} className="text-white/30 hover:text-white/60 transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">

          {/* Drop Zone — No file selected */}
          {!selectedFile && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer rounded-xl border border-dashed border-white/[0.08] hover:border-violet-500/30 bg-white/[0.01] hover:bg-violet-500/[0.02] transition-all duration-300 p-10"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:border-violet-500/20 group-hover:bg-violet-500/[0.04] transition-all">
                  <Upload size={24} className="text-white/20 group-hover:text-violet-400/60 transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/50 group-hover:text-white/70 transition-colors">
                    Drop audio file or click to browse
                  </p>
                  <p className="text-[11px] text-white/20 mt-1">WAV, MP3, FLAC, OGG — up to 100MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* File selected — Main interface */}
          {selectedFile && (
            <>
              {/* Input Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60" />
                    <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase">Input</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/15 font-mono">{selectedFile.name}</span>
                    <button
                      onClick={() => {
                        setSelectedFile(null)
                        if (previewUrl) URL.revokeObjectURL(previewUrl)
                        setPreviewUrl(null)
                        setOutputUrl(null)
                        setInputWaveformData(null)
                        setOutputWaveformData(null)
                      }}
                      className="text-[10px] text-red-400/40 hover:text-red-400/80 transition-colors"
                    >
                      remove
                    </button>
                  </div>
                </div>

                {/* Waveform + playback controls */}
                <div className="relative rounded-lg bg-white/[0.015] border border-white/[0.04] p-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayInput}
                      disabled={!previewUrl}
                      className="w-9 h-9 flex-shrink-0 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center hover:bg-violet-500/20 transition-all disabled:opacity-30"
                    >
                      {isPlayingInput
                        ? <Pause size={14} className="text-violet-300" />
                        : <Play size={14} className="text-violet-300 ml-0.5" />
                      }
                    </button>
                    <div className="flex-1 relative h-12">
                      <canvas ref={inputCanvasRef} className="w-full h-full" />
                    </div>
                    <span className="text-[10px] font-mono text-white/20 w-10 text-right flex-shrink-0">
                      {inputDuration > 0 ? formatTime(inputDuration) : '--:--'}
                    </span>
                  </div>
                  <audio ref={inputAudioRef} src={previewUrl || undefined} preload="metadata" crossOrigin="anonymous" />
                </div>
              </div>

              {/* Key & Scale Selector */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase">Key & Scale</span>
                </div>

                {/* Key grid */}
                <div className="grid grid-cols-12 gap-1">
                  {MUSICAL_KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setAutotuneKey(k)}
                      className={`py-2 rounded text-[11px] font-bold transition-all duration-150 ${
                        autotuneKey === k
                          ? 'bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.15)]'
                          : 'bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50 border border-white/[0.04]'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Scale toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAutotuneScale('maj')}
                    className={`py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150 ${
                      autotuneScale === 'maj'
                        ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.1)]'
                        : 'bg-white/[0.02] text-white/25 hover:bg-white/[0.05] hover:text-white/40 border border-white/[0.04]'
                    }`}
                  >
                    MAJOR
                  </button>
                  <button
                    onClick={() => setAutotuneScale('min')}
                    className={`py-2.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-150 ${
                      autotuneScale === 'min'
                        ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.1)]'
                        : 'bg-white/[0.02] text-white/25 hover:bg-white/[0.05] hover:text-white/40 border border-white/[0.04]'
                    }`}
                  >
                    MINOR
                  </button>
                </div>

                {/* Selected key indicator */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <span className="text-[10px] text-white/15 tracking-widest uppercase">Target</span>
                  <span className="text-sm font-bold text-white/80 tracking-wide">
                    {autotuneKey} {autotuneScale === 'maj' ? 'Major' : 'Minor'}
                  </span>
                </div>
              </div>

              {/* Output Section — only after processing */}
              {outputUrl && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
                    <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase">Output</span>
                    <span className="text-[10px] text-cyan-400/40 ml-auto font-mono">{autotuneKey}:{autotuneScale}</span>
                  </div>

                  <div className="relative rounded-lg bg-cyan-500/[0.02] border border-cyan-500/[0.08] p-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={togglePlayOutput}
                        className="w-9 h-9 flex-shrink-0 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center hover:bg-cyan-500/20 transition-all"
                      >
                        {isPlayingOutput
                          ? <Pause size={14} className="text-cyan-300" />
                          : <Play size={14} className="text-cyan-300 ml-0.5" />
                        }
                      </button>
                      <div className="flex-1 relative h-12">
                        <canvas ref={outputCanvasRef} className="w-full h-full" />
                      </div>
                      <span className="text-[10px] font-mono text-white/20 w-10 text-right flex-shrink-0">
                        {outputDuration > 0 ? formatTime(outputDuration) : '--:--'}
                      </span>
                    </div>
                    <audio ref={outputAudioRef} src={outputUrl} preload="metadata" crossOrigin="anonymous" />
                  </div>
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full border-2 border-white/[0.06]" />
                    <div className="absolute inset-0 w-8 h-8 rounded-full border-2 border-transparent border-t-violet-400 animate-spin" />
                  </div>
                  <span className="text-xs text-white/40">{processingStatus || 'Processing...'}</span>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/[0.06] border border-red-500/[0.1]">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 flex-shrink-0" />
              <p className="text-xs text-red-300/70">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/15 tracking-widest uppercase">Cost</span>
            <span className="text-xs font-bold text-white/50">1 credit</span>
          </div>
          <div className="flex items-center gap-2">
            {outputUrl && (
              <button
                onClick={() => {
                  setOutputUrl(null)
                  setOutputWaveformData(null)
                  setIsPlayingOutput(false)
                  setOutputProgress(0)
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white/30 hover:text-white/50 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-all"
              >
                <RotateCcw size={13} className="inline mr-1.5 -mt-0.5" />
                Redo
              </button>
            )}
            <button
              onClick={handleProcess}
              disabled={!selectedFile || isProcessing}
              className="px-6 py-2 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.08)] hover:shadow-[0_0_28px_rgba(255,255,255,0.14)]"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" />
                  Processing
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Zap size={13} />
                  {outputUrl ? 'Retune' : 'Autotune'}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>
    </div>
  )
}
