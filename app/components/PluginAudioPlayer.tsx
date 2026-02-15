'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react'

interface PluginPlayerTrack {
  id: string
  audioUrl: string
  title?: string
  prompt?: string
}

interface PluginAudioPlayerProps {
  track: PluginPlayerTrack | null
  playing?: boolean
  onClose?: () => void
  onPlayStateChange?: (playing: boolean) => void
}

// ── Proxy URL helper ──
function proxyUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url, window.location.origin)
    const host = u.hostname
    if (host.endsWith('.444radio.co.in')) return url
    if (u.pathname.startsWith('/api/r2/proxy')) return url
    return `/api/r2/proxy?url=${encodeURIComponent(url)}`
  } catch {
    return `/api/r2/proxy?url=${encodeURIComponent(url)}`
  }
}

export default function PluginAudioPlayer({ track, playing, onClose, onPlayStateChange }: PluginAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const connectedSrcRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const progressBarRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      connectedSrcRef.current = null
    }
  }, [])

  // ── Load track ──
  useEffect(() => {
    if (!track) return
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.crossOrigin = 'anonymous'
    }
    const audio = audioRef.current
    audio.pause()
    audio.src = proxyUrl(track.audioUrl)
    audio.volume = isMuted ? 0 : volume
    audio.load()
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)

    const onLoaded = () => setDuration(audio.duration)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setIsPlaying(false); onPlayStateChange?.(false) }
    const onPlay = () => { setIsPlaying(true); onPlayStateChange?.(true) }
    const onPause = () => { setIsPlaying(false); onPlayStateChange?.(false) }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    audio.play().catch(() => {})

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.audioUrl])

  // ── External play/pause ──
  useEffect(() => {
    if (playing === undefined || !audioRef.current) return
    if (playing && !isPlaying) {
      if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
      audioRef.current.play().catch(() => {})
    } else if (!playing && isPlaying) {
      audioRef.current.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  // ── Connect AnalyserNode ──
  useEffect(() => {
    if (!track || !audioRef.current) return
    if (connectedSrcRef.current === track.audioUrl) return

    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      const source = ctx.createMediaElementSource(audioRef.current)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      analyserRef.current = analyser
      sourceRef.current = source
      connectedSrcRef.current = track.audioUrl
    } catch {
      console.warn('[PluginPlayer] Could not connect analyser')
    }
  }, [track])

  // ── Mini waveform draw loop (compact bars) ──
  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const c = canvas.getContext('2d')
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
        c.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      c.clearRect(0, 0, W, H)

      const barCount = 48
      const gap = 1
      const barW = (W - gap * (barCount - 1)) / barCount
      const analyser = analyserRef.current
      const bufLen = analyser ? analyser.frequencyBinCount : 32
      const freqData = new Uint8Array(bufLen)
      if (analyser && isPlaying) analyser.getByteFrequencyData(freqData)

      const progress = duration > 0 ? currentTime / duration : 0

      for (let i = 0; i < barCount; i++) {
        const t = i / barCount
        const binIdx = Math.min(Math.floor(t * bufLen * 0.6), bufLen - 1)
        const rawVal = freqData[binIdx] / 255
        const seed = Math.sin(i * 0.5 + 1.3) * 0.3 + Math.sin(i * 0.2 + 0.5) * 0.2 + 0.35
        const val = isPlaying ? seed * 0.3 + rawVal * 0.7 : seed
        const barH = Math.max(2, val * H * 0.9)
        const x = i * (barW + gap)
        const y = (H - barH) / 2

        if (t <= progress) {
          c.fillStyle = `rgba(34, 211, 238, ${isPlaying ? 0.7 + rawVal * 0.3 : 0.7})`
        } else {
          c.fillStyle = 'rgba(100, 116, 139, 0.25)'
        }

        c.beginPath()
        c.roundRect(x, y, barW, barH, 1)
        c.fill()
      }
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, currentTime, duration])

  // ── Controls ──
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
      audioRef.current.play().catch(() => {})
    }
  }, [isPlaying])

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !audioRef.current || duration <= 0) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    audioRef.current.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }, [duration])

  const seekCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !audioRef.current || duration <= 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    audioRef.current.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }, [duration])

  const skipBack = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)
  }, [])

  const skipFwd = useCallback(() => {
    if (!audioRef.current) return
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5)
  }, [duration])

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return
    const next = !isMuted
    setIsMuted(next)
    audioRef.current.volume = next ? 0 : volume
  }, [isMuted, volume])

  const changeVolume = useCallback((v: number) => {
    setVolume(v)
    setIsMuted(false)
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!track) return null

  return (
    <div
      className="w-full select-none transition-all duration-300 ease-out"
      style={{
        background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(0,0,0,0.35) 50%, rgba(139,92,246,0.06) 100%)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Thin progress bar at very top */}
      <div
        ref={progressBarRef}
        onClick={seek}
        className="h-[2px] w-full cursor-pointer group relative"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div
          className="h-full transition-[width] duration-100 relative"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, rgba(34,211,238,0.9), rgba(139,92,246,0.8))',
          }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Main row: controls + waveform + title + volume + close */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Skip back */}
        <button onClick={skipBack} className="p-1 text-white/30 hover:text-white/80 transition flex-shrink-0">
          <SkipBack size={12} />
        </button>

        {/* Play/Pause */}
        <button onClick={togglePlay}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.85), rgba(34,211,238,0.6))',
            boxShadow: '0 0 12px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
          {isPlaying ? <Pause size={11} className="text-black" /> : <Play size={11} className="text-black ml-0.5" />}
        </button>

        {/* Skip forward */}
        <button onClick={skipFwd} className="p-1 text-white/30 hover:text-white/80 transition flex-shrink-0">
          <SkipForward size={12} />
        </button>

        {/* Time */}
        <span className="text-[9px] text-white/30 font-mono w-6 text-right flex-shrink-0">{fmt(currentTime)}</span>

        {/* Mini waveform visualizer */}
        <canvas
          ref={canvasRef}
          onClick={seekCanvas}
          className="flex-1 h-6 cursor-pointer rounded min-w-0"
        />

        <span className="text-[9px] text-white/30 font-mono w-6 flex-shrink-0">{fmt(duration)}</span>

        {/* Track title */}
        <div className="flex-shrink min-w-0 max-w-[120px] hidden sm:block">
          <p className="text-[10px] font-semibold text-white/80 truncate">{track.title || 'AI Track'}</p>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-0.5 flex-shrink-0 relative">
          <button onClick={toggleMute} onMouseEnter={() => setShowVolume(true)} className="p-1 text-white/30 hover:text-white/80 transition">
            {isMuted || volume === 0 ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
          {showVolume && (
            <div
              className="absolute top-full right-0 mt-1 rounded-lg p-2 z-50"
              style={{
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              onMouseLeave={() => setShowVolume(false)}>
              <input
                type="range" min="0" max="1" step="0.01"
                value={isMuted ? 0 : volume}
                onChange={e => changeVolume(parseFloat(e.target.value))}
                className="w-20 h-1 accent-cyan-400 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Close */}
        {onClose && (
          <button onClick={onClose} className="p-1 text-white/20 hover:text-white/70 transition flex-shrink-0 hover:rotate-90 transition-all duration-200">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
