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
  playing?: boolean              // external play/pause control from parent
  onClose?: () => void
  onPlayStateChange?: (playing: boolean) => void  // sync back to parent
}

// ── Proxy URL helper: route through server to avoid CORS in WebView ──
function proxyUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url, window.location.origin)
    const host = u.hostname
    // Custom-domain CDN hosts can play direct
    if (host.endsWith('.444radio.co.in')) return url
    // Already a proxy path
    if (u.pathname.startsWith('/api/r2/proxy')) return url
    // Everything else (raw R2, Replicate) → proxy
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

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)

  // ── Cleanup on unmount: stop audio completely ──
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

    // Reset
    audio.pause()
    const src = proxyUrl(track.audioUrl)
    audio.src = src
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

    // Auto-play
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

  // ── React to external play/pause from parent ──
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

  // ── Connect AnalyserNode (once per src) ──
  useEffect(() => {
    if (!track || !audioRef.current) return
    if (connectedSrcRef.current === track.audioUrl) return // already connected

    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.85
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

  // ── Waveform draw loop ──
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

      const barCount = 80
      const gap = 1.5
      const barW = (W - gap * (barCount - 1)) / barCount
      const analyser = analyserRef.current
      const bufLen = analyser ? analyser.frequencyBinCount : 64
      const freqData = new Uint8Array(bufLen)
      if (analyser && isPlaying) analyser.getByteFrequencyData(freqData)

      // Progress ratio
      const progress = duration > 0 ? currentTime / duration : 0

      for (let i = 0; i < barCount; i++) {
        const t = i / barCount
        // Map bar index to a frequency bin
        const binIdx = Math.min(Math.floor(t * bufLen * 0.6), bufLen - 1)
        const rawVal = freqData[binIdx] / 255

        // Base height from pseudo-waveform (seeded from index for static shape)
        const seed = Math.sin(i * 0.4 + 1.7) * 0.3 + Math.sin(i * 0.15 + 0.3) * 0.2 + 0.35
        // When playing, blend in live frequency data
        const val = isPlaying ? seed * 0.4 + rawVal * 0.6 : seed
        const barH = Math.max(2, val * H * 0.85)
        const x = i * (barW + gap)
        const y = (H - barH) / 2

        // Color: played portion = cyan, future = gray
        if (t <= progress) {
          const glow = isPlaying ? 0.7 + rawVal * 0.3 : 0.7
          c.fillStyle = `rgba(34, 211, 238, ${glow})`
          c.shadowColor = 'rgba(34, 211, 238, 0.5)'
          c.shadowBlur = isPlaying ? rawVal * 6 : 2
        } else {
          c.fillStyle = 'rgba(100, 116, 139, 0.35)'
          c.shadowColor = 'transparent'
          c.shadowBlur = 0
        }

        // Rounded bar
        const r = Math.min(barW / 2, 1.5)
        c.beginPath()
        c.moveTo(x + r, y)
        c.lineTo(x + barW - r, y)
        c.quadraticCurveTo(x + barW, y, x + barW, y + r)
        c.lineTo(x + barW, y + barH - r)
        c.quadraticCurveTo(x + barW, y + barH, x + barW - r, y + barH)
        c.lineTo(x + r, y + barH)
        c.quadraticCurveTo(x, y + barH, x, y + barH - r)
        c.lineTo(x, y + r)
        c.quadraticCurveTo(x, y, x + r, y)
        c.fill()
      }

      // Playhead line
      if (duration > 0) {
        const px = progress * W
        c.shadowBlur = 0
        c.fillStyle = 'rgba(255, 255, 255, 0.9)'
        c.fillRect(px - 0.5, 0, 1.5, H)
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

  const seek = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !audioRef.current || duration <= 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = x / rect.width
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

  if (!track) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gradient-to-r from-gray-900/98 via-black/98 to-gray-900/98 backdrop-blur-xl border-t border-cyan-500/30 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.6)]">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{track.title || 'AI Track'}</p>
          {track.prompt && <p className="text-[10px] text-gray-500 truncate">{track.prompt}</p>}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-2 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Waveform progress bar */}
      <canvas
        ref={canvasRef}
        onClick={seek}
        className="w-full h-10 cursor-pointer rounded-lg mb-2"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Time + Controls */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-400 font-mono w-8 text-right">{fmt(currentTime)}</span>

        <div className="flex items-center gap-1">
          <button onClick={skipBack} className="p-1.5 text-gray-400 hover:text-white transition">
            <SkipBack size={14} />
          </button>
          <button onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30">
            {isPlaying ? <Pause size={14} className="text-black" /> : <Play size={14} className="text-black ml-0.5" />}
          </button>
          <button onClick={skipFwd} className="p-1.5 text-gray-400 hover:text-white transition">
            <SkipForward size={14} />
          </button>
        </div>

        <span className="text-[10px] text-gray-400 font-mono w-8">{fmt(duration)}</span>

        {/* Volume */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={toggleMute} className="p-1 text-gray-400 hover:text-white transition">
            {isMuted || volume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <input
            type="range" min="0" max="1" step="0.01"
            value={isMuted ? 0 : volume}
            onChange={e => changeVolume(parseFloat(e.target.value))}
            className="w-14 h-1 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
