'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, Mic, Loader2, Play, Pause, RotateCcw, Zap, Waves, Sparkles } from 'lucide-react'

interface AutotuneModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
  onStart?: () => void
  onError?: (error: string) => void
}

const MUSICAL_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

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

      if (isInput) setInputWaveformData(waveform)
      else setOutputWaveformData(waveform)

      audioContext.close()
    } catch (err) {
      console.warn('Could not generate static waveform:', err)
    }
  }, [])

  // Draw static waveform — monochrome glass style
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
    const barWidth = Math.max(1, (width / barCount) * 0.55)
    const gap = (width / barCount) * 0.45
    const centerY = height / 2
    const maxBarHeight = height * 0.8

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

      if (isPast) {
        ctx.shadowColor = accentColor
        ctx.shadowBlur = 3
        ctx.fillStyle = accentColor
      } else {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.fillStyle = dimColor
      }

      ctx.beginPath()
      ctx.roundRect(x, centerY - barH, barWidth, barH, 1)
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(x, centerY + 1, barWidth, barH, 1)
      ctx.fill()
    }

    if (progress > 0 && progress < 1) {
      ctx.shadowColor = accentColor
      ctx.shadowBlur = 6
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

    if (isInput) inputAnalyserRef.current = analyser
    else outputAnalyserRef.current = analyser

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
        ctx.shadowBlur = amp > 10 ? 5 : 2
        ctx.fillStyle = accentColor

        ctx.beginPath()
        ctx.roundRect(x, centerY - amp, barWidth, Math.max(1, amp), 1)
        ctx.fill()
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
      if (inputAudio && inputAudio.duration) setInputProgress(inputAudio.currentTime / inputAudio.duration)
    }
    const updateOutputProgress = () => {
      if (outputAudio && outputAudio.duration) setOutputProgress(outputAudio.currentTime / outputAudio.duration)
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

  // Redraw static waveforms — monochrome for input, green-tint for output
  useEffect(() => {
    if (inputCanvasRef.current && inputWaveformData && !isPlayingInput) {
      drawStaticWaveform(inputCanvasRef.current, inputWaveformData, inputProgress, 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.1)')
    }
  }, [inputProgress, inputWaveformData, isPlayingInput, drawStaticWaveform])

  useEffect(() => {
    if (outputCanvasRef.current && outputWaveformData && !isPlayingOutput) {
      drawStaticWaveform(outputCanvasRef.current, outputWaveformData, outputProgress, 'rgba(0,255,200,0.65)', 'rgba(0,255,200,0.1)')
    }
  }, [outputProgress, outputWaveformData, isPlayingOutput, drawStaticWaveform])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setOutputUrl(null)
    setOutputWaveformData(null)
    if (!file.type.startsWith('audio/')) { setError('Please select an audio file'); return }
    if (file.size > 100 * 1024 * 1024) { setError('File must be under 100MB'); return }
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    generateStaticWaveform(url, true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) { setError('Please drop an audio file'); return }
    setSelectedFile(file)
    setOutputUrl(null)
    setOutputWaveformData(null)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    generateStaticWaveform(url, true)
  }

  const togglePlayInput = () => {
    if (!inputAudioRef.current) return
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()

    if (isPlayingInput) {
      inputAudioRef.current.pause()
      if (inputAnimFrameRef.current) cancelAnimationFrame(inputAnimFrameRef.current)
      setIsPlayingInput(false)
    } else {
      if (isPlayingOutput && outputAudioRef.current) {
        outputAudioRef.current.pause()
        if (outputAnimFrameRef.current) cancelAnimationFrame(outputAnimFrameRef.current)
        setIsPlayingOutput(false)
      }
      inputAudioRef.current.play()
      setIsPlayingInput(true)
      if (inputCanvasRef.current) {
        if (!inputAnalyserRef.current) {
          const analyser = setupAnalyser(inputAudioRef.current, true)
          animateLiveWaveform(inputCanvasRef.current, analyser, 'rgba(255,255,255,0.55)', true)
        } else {
          animateLiveWaveform(inputCanvasRef.current, inputAnalyserRef.current, 'rgba(255,255,255,0.55)', true)
        }
      }
    }
  }

  const togglePlayOutput = () => {
    if (!outputAudioRef.current) return
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()

    if (isPlayingOutput) {
      outputAudioRef.current.pause()
      if (outputAnimFrameRef.current) cancelAnimationFrame(outputAnimFrameRef.current)
      setIsPlayingOutput(false)
    } else {
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
          animateLiveWaveform(outputCanvasRef.current, analyser, 'rgba(0,255,200,0.55)', false)
        } else {
          animateLiveWaveform(outputCanvasRef.current, outputAnalyserRef.current, 'rgba(0,255,200,0.55)', false)
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
      setProcessingStatus('Uploading audio...')
      const presignResponse = await fetch('/api/upload/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: selectedFile.name, fileType: selectedFile.type, fileSize: selectedFile.size })
      })
      if (!presignResponse.ok) {
        const err = await presignResponse.json()
        throw new Error(err.error || 'Failed to prepare upload')
      }

      const { uploadUrl, publicUrl } = await presignResponse.json()
      const uploadResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile })
      if (!uploadResponse.ok) throw new Error('Upload failed')

      setProcessingStatus('Verifying file...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      let retries = 0
      while (retries < 3) {
        try { const head = await fetch(publicUrl, { method: 'HEAD' }); if (head.ok) break } catch { /* retry */ }
        await new Promise(resolve => setTimeout(resolve, 2000))
        retries++
      }

      onStart?.()
      const scale = `${autotuneKey}:${autotuneScale}`
      setProcessingStatus(`Autotuning to ${autotuneKey} ${autotuneScale === 'maj' ? 'Major' : 'Minor'}...`)

      const autotuneResponse = await fetch('/api/generate/autotune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_file: publicUrl, scale, trackTitle: selectedFile.name.replace(/\.[^/.]+$/, '') || 'Audio', output_format: 'wav' })
      })

      const result = await autotuneResponse.json()
      if (!autotuneResponse.ok || result.error) throw new Error(result.error || 'Autotune processing failed')

      setOutputUrl(result.audioUrl)
      generateStaticWaveform(result.audioUrl, false)
      setProcessingStatus('')
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

  // ═══════════════════════════════════════════════════════════════
  //  RENDER — Black + White Glass Morphism AI Theme
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'autotuneIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      {/* Backdrop — deep black with desaturation */}
      <div className="absolute inset-0" onClick={handleClose}
        style={{
          background: 'rgba(0,0,0,0.92)',
          backdropFilter: 'blur(40px) saturate(0.4)',
          WebkitBackdropFilter: 'blur(40px) saturate(0.4)',
        }}
      />

      {/* ─── Modal ─── */}
      <div className="relative w-full max-w-[580px] overflow-hidden rounded-3xl"
        style={{
          background: 'linear-gradient(180deg, rgba(22,22,24,0.88) 0%, rgba(14,14,16,0.94) 40%, rgba(8,8,10,0.98) 100%)',
          backdropFilter: 'blur(80px) saturate(1.1)',
          WebkitBackdropFilter: 'blur(80px) saturate(1.1)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 60px 120px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {/* Top glass shine */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.1) 75%, transparent 95%)' }} />

        {/* Ambient light orbs */}
        <div className="absolute top-[-25%] right-[-8%] w-[280px] h-[280px] rounded-full pointer-events-none opacity-[0.035]"
          style={{ background: 'radial-gradient(circle, #fff, transparent 60%)' }} />
        <div className="absolute bottom-[-15%] left-[-8%] w-[220px] h-[220px] rounded-full pointer-events-none opacity-[0.025]"
          style={{ background: 'radial-gradient(circle, rgba(180,255,230,1), transparent 60%)' }} />

        {/* Diagonal frosted glass sheet */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div style={{
            position: 'absolute', top: '-60%', left: '-15%', width: '40%', height: '220%',
            background: 'linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.015) 47%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.015) 53%, transparent 58%)',
            transform: 'rotate(-15deg)',
          }} />
        </div>

        {/* ─── Header ─── */}
        <div className="relative flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3.5">
            {/* AI orb icon */}
            <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))',
                border: '1px solid rgba(255,255,255,0.09)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.35)',
              }}
            >
              <Mic size={16} className="text-white/50" />
              {isProcessing && (
                <div className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.12), transparent)',
                    animation: 'spin 2s linear infinite',
                  }} />
              )}
              {/* Glass highlight */}
              <div className="absolute top-0 left-0 right-0 h-[45%] rounded-t-2xl pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent)' }} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white/85 tracking-[0.06em]">AUTOTUNE</h3>
              <p className="text-[9.5px] text-white/18 tracking-[0.18em] font-medium">AI PITCH CORRECTION ENGINE</p>
            </div>
          </div>

          <button onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <X size={13} className="text-white/25 hover:text-white/55 transition-colors" />
          </button>
        </div>

        {/* Separator line */}
        <div className="mx-6 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />

        {/* ─── Content ─── */}
        <div className="p-6 space-y-5 max-h-[62vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>

          {/* Drop Zone */}
          {!selectedFile && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer rounded-2xl p-10 transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.015)', border: '1.5px dashed rgba(255,255,255,0.07)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.16)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.035)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)'
                ;(e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)'
              }}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px rgba(0,0,0,0.25)',
                  }}
                >
                  <Upload size={22} className="text-white/20 group-hover:text-white/45 transition-colors duration-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/35 group-hover:text-white/60 transition-colors duration-300">
                    Drop audio or click to browse
                  </p>
                  <p className="text-[10.5px] text-white/12 mt-1.5 tracking-wide">WAV · MP3 · FLAC · OGG — max 100 MB</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />
            </div>
          )}

          {/* ── File selected ── */}
          {selectedFile && (
            <>
              {/* Input section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/25" />
                    <span className="text-[10px] font-bold text-white/25 tracking-[0.2em]">ORIGINAL</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] text-white/12 font-mono truncate max-w-[180px]">{selectedFile.name}</span>
                    <button
                      onClick={() => {
                        setSelectedFile(null)
                        if (previewUrl) URL.revokeObjectURL(previewUrl)
                        setPreviewUrl(null)
                        setOutputUrl(null)
                        setInputWaveformData(null)
                        setOutputWaveformData(null)
                      }}
                      className="text-[10px] text-white/12 hover:text-red-400/50 transition-colors"
                    >remove</button>
                  </div>
                </div>

                {/* Glass waveform card */}
                <div className="relative rounded-xl p-3 overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <button onClick={togglePlayInput} disabled={!previewUrl}
                      className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-15"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}
                    >
                      {isPlayingInput ? <Pause size={13} className="text-white/55" /> : <Play size={13} className="text-white/55 ml-0.5" />}
                    </button>
                    <div className="flex-1 relative h-12">
                      <canvas ref={inputCanvasRef} className="w-full h-full" />
                    </div>
                    <span className="text-[10px] font-mono text-white/18 w-10 text-right flex-shrink-0">
                      {inputDuration > 0 ? formatTime(inputDuration) : '--:--'}
                    </span>
                  </div>
                  <audio ref={inputAudioRef} src={previewUrl || undefined} preload="metadata" crossOrigin="anonymous" />
                </div>
              </div>

              {/* ── Key & Scale Selector ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(180,255,230,0.3)' }} />
                  <span className="text-[10px] font-bold text-white/22 tracking-[0.2em]">TARGET KEY</span>
                </div>

                {/* Chromatic key grid — glass keys */}
                <div className="grid grid-cols-12 gap-[5px]">
                  {MUSICAL_KEYS.map((k) => {
                    const isSharp = k.includes('b')
                    const isSelected = autotuneKey === k
                    return (
                      <button key={k} onClick={() => setAutotuneKey(k)}
                        className={`py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 ${isSelected ? '' : 'hover:border-white/12'}`}
                        style={isSelected ? {
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))',
                          border: '1px solid rgba(255,255,255,0.22)',
                          color: 'rgba(255,255,255,0.92)',
                          boxShadow: '0 0 18px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.14), 0 4px 14px rgba(0,0,0,0.35)',
                        } : {
                          background: isSharp ? 'rgba(255,255,255,0.008)' : 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.035)',
                          color: isSharp ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.22)',
                        }}
                      >
                        {k}
                      </button>
                    )
                  })}
                </div>

                {/* Scale toggle — glass pills */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { value: 'maj' as const, label: 'MAJOR', sub: 'bright · happy · uplifting' },
                    { value: 'min' as const, label: 'MINOR', sub: 'dark · moody · emotional' },
                  ].map(({ value, label, sub }) => (
                    <button key={value} onClick={() => setAutotuneScale(value)}
                      className="relative py-3.5 rounded-xl text-center transition-all duration-200 overflow-hidden"
                      style={autotuneScale === value ? {
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))',
                        border: '1px solid rgba(255,255,255,0.18)',
                        boxShadow: '0 0 22px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.1)',
                      } : {
                        background: 'rgba(255,255,255,0.012)',
                        border: '1px solid rgba(255,255,255,0.035)',
                      }}
                    >
                      {autotuneScale === value && (
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)', borderRadius: 'inherit' }} />
                      )}
                      <span className={`text-xs font-bold tracking-wider relative z-10 ${autotuneScale === value ? 'text-white/85' : 'text-white/18'}`}>{label}</span>
                      <p className={`text-[9px] mt-0.5 relative z-10 tracking-wide ${autotuneScale === value ? 'text-white/28' : 'text-white/08'}`}>{sub}</p>
                    </button>
                  ))}
                </div>

                {/* Selected key badge — floating glass */}
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-2.5 px-5 py-2 rounded-2xl"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                  >
                    <Waves size={11} className="text-white/16" />
                    <span className="text-[10px] text-white/16 tracking-widest">TARGET</span>
                    <span className="text-sm font-bold text-white/75 tracking-wide">
                      {autotuneKey} {autotuneScale === 'maj' ? 'Major' : 'Minor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Output ── */}
              {outputUrl && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(0,255,200,0.45)', boxShadow: '0 0 6px rgba(0,255,200,0.25)' }} />
                    <span className="text-[10px] font-bold tracking-[0.2em]" style={{ color: 'rgba(0,255,200,0.35)' }}>AUTOTUNED</span>
                    <span className="text-[10px] font-mono ml-auto" style={{ color: 'rgba(0,255,200,0.2)' }}>{autotuneKey}:{autotuneScale}</span>
                  </div>

                  <div className="relative rounded-xl p-3 overflow-hidden"
                    style={{ background: 'rgba(0,255,200,0.015)', border: '1px solid rgba(0,255,200,0.07)', boxShadow: 'inset 0 1px 0 rgba(0,255,200,0.035)' }}
                  >
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlayOutput}
                        className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all"
                        style={{ background: 'rgba(0,255,200,0.05)', border: '1px solid rgba(0,255,200,0.1)', boxShadow: 'inset 0 1px 0 rgba(0,255,200,0.05)' }}
                      >
                        {isPlayingOutput
                          ? <Pause size={13} style={{ color: 'rgba(0,255,200,0.65)' }} />
                          : <Play size={13} className="ml-0.5" style={{ color: 'rgba(0,255,200,0.65)' }} />
                        }
                      </button>
                      <div className="flex-1 relative h-12">
                        <canvas ref={outputCanvasRef} className="w-full h-full" />
                      </div>
                      <span className="text-[10px] font-mono w-10 text-right flex-shrink-0" style={{ color: 'rgba(0,255,200,0.2)' }}>
                        {outputDuration > 0 ? formatTime(outputDuration) : '--:--'}
                      </span>
                    </div>
                    <audio ref={outputAudioRef} src={outputUrl} preload="metadata" crossOrigin="anonymous" />
                  </div>
                </div>
              )}

              {/* Processing spinner — abstract */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-3 py-5">
                  <div className="relative w-9 h-9">
                    <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(255,255,255,0.04)' }} />
                    <div className="absolute inset-0 rounded-full"
                      style={{
                        border: '2px solid transparent',
                        borderTopColor: 'rgba(255,255,255,0.35)',
                        borderRightColor: 'rgba(255,255,255,0.12)',
                        animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite',
                        filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.12))',
                      }}
                    />
                    <div className="absolute inset-[35%] rounded-full bg-white/15" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                  </div>
                  <span className="text-xs text-white/28 font-light">{processingStatus || 'Processing...'}</span>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(255,60,60,0.035)', border: '1px solid rgba(255,60,60,0.08)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,80,80,0.55)', boxShadow: '0 0 6px rgba(255,80,80,0.25)' }} />
              <p className="text-xs text-red-300/55">{error}</p>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="relative px-6 py-3.5 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.035)', background: 'rgba(255,255,255,0.008)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={11} className="text-white/12" />
            <span className="text-[10px] text-white/12 tracking-widest">COST</span>
            <span className="text-xs font-bold text-white/45">1 credit</span>
          </div>

          <div className="flex items-center gap-2.5">
            {outputUrl && (
              <button
                onClick={() => { setOutputUrl(null); setOutputWaveformData(null); setIsPlayingOutput(false); setOutputProgress(0) }}
                className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
              >
                <RotateCcw size={11} className="inline mr-1.5 -mt-0.5" />Redo
              </button>
            )}
            <button onClick={handleProcess} disabled={!selectedFile || isProcessing}
              className="px-6 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-12 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.04))',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.88)',
                boxShadow: '0 0 22px rgba(255,255,255,0.035), inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 18px rgba(0,0,0,0.45)',
              }}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" />Processing</span>
              ) : (
                <span className="flex items-center gap-1.5"><Zap size={12} />{outputUrl ? 'Retune' : 'Autotune'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.05) 50%, transparent 95%)' }} />
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes autotuneIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
