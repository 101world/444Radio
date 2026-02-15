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

function safeAudioUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url, window.location.origin)
    if (u.pathname.startsWith('/api/')) return url
    if (u.origin === window.location.origin) return url
  } catch {}
  return `/api/r2/proxy?url=${encodeURIComponent(url)}`
}

// ── Real-time Canvas Waveform using Web Audio API AnalyserNode ──
function LiveWaveform({
  audioElement,
  isPlaying,
  progress,
  onSeek,
}: {
  audioElement: HTMLAudioElement | null
  isPlaying: boolean
  progress: number
  onSeek: (ratio: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const connectedRef = useRef<HTMLAudioElement | null>(null)

  // Connect Web Audio API analyser to the audio element
  useEffect(() => {
    if (!audioElement) return
    if (connectedRef.current === audioElement) return

    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      const ctx = ctxRef.current
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.78

      const source = ctx.createMediaElementSource(audioElement)
      source.connect(analyser)
      analyser.connect(ctx.destination)

      analyserRef.current = analyser
      connectedRef.current = audioElement
    } catch {
      // Already connected or unsupported — fallback to idle animation
      console.warn('[PluginWaveform] Web Audio connect failed — using fallback')
    }
  }, [audioElement])

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas.getContext('2d')
    if (!c) return

    const analyser = analyserRef.current
    const bufLen = analyser ? analyser.frequencyBinCount : 64
    const data = new Uint8Array(bufLen)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const dpr = window.devicePixelRatio || 1
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
        c.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      c.clearRect(0, 0, W, H)

      // Get real frequency data if available, otherwise idle animation
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data)
      } else {
        const t = Date.now() / 900
        for (let i = 0; i < bufLen; i++) {
          data[i] = Math.floor(12 + 10 * Math.sin(t + i * 0.35) + 5 * Math.cos(t * 0.7 + i * 0.6))
        }
      }

      const barCount = Math.min(bufLen, 64)
      const gap = 1.2
      const barW = Math.max(1, (W - gap * (barCount - 1)) / barCount)
      const midY = H / 2

      // ── Draw mirrored bars (like the main site FloatingAudioPlayer) ──
      for (let i = 0; i < barCount; i++) {
        const v = data[i] / 255
        const barH = Math.max(1.5, v * midY * 0.88)
        const x = i * (barW + gap)
        const pct = (i / barCount) * 100

        // Played = vibrant cyan → unplayed = dim
        if (pct <= progress) {
          // Played bars — cyan to blue gradient
          const intensity = 0.55 + v * 0.45
          c.fillStyle = `rgba(0, 255, 255, ${intensity})`
          c.shadowColor = 'rgba(0, 255, 255, 0.35)'
          c.shadowBlur = v * 6
        } else {
          // Unplayed — dim glass
          c.fillStyle = `rgba(0, 255, 255, ${0.06 + v * 0.1})`
          c.shadowColor = 'transparent'
          c.shadowBlur = 0
        }

        const r = Math.max(0, Math.min(barW / 2, 1.5))

        // Top half (above center)
        c.beginPath()
        c.roundRect(x, midY - barH, barW, barH, r)
        c.fill()

        // Bottom half (mirror below center)
        c.beginPath()
        c.roundRect(x, midY + 0.5, barW, barH, r)
        c.fill()
      }
      c.shadowBlur = 0

      // ── Playhead line ──
      const playX = (progress / 100) * W
      const grad = c.createLinearGradient(playX, 0, playX, H)
      grad.addColorStop(0, 'rgba(0, 255, 255, 0.1)')
      grad.addColorStop(0.25, '#00ffff')
      grad.addColorStop(0.5, 'rgba(0, 136, 255, 0.9)')
      grad.addColorStop(0.75, '#00ffff')
      grad.addColorStop(1, 'rgba(0, 255, 255, 0.1)')
      c.fillStyle = grad
      c.fillRect(playX - 0.75, 0, 1.5, H)

      // Playhead glow
      c.shadowColor = 'rgba(0, 255, 255, 0.8)'
      c.shadowBlur = 8
      c.fillStyle = '#00ffff'
      c.beginPath()
      c.arc(playX, midY, 2.5, 0, Math.PI * 2)
      c.fill()
      c.shadowBlur = 0

      // ── Center line (subtle) ──
      c.fillStyle = 'rgba(0, 255, 255, 0.06)'
      c.fillRect(0, midY - 0.25, W, 0.5)

      // ── Top glass reflection ──
      const reflGrad = c.createLinearGradient(0, 0, 0, H * 0.35)
      reflGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)')
      reflGrad.addColorStop(1, 'transparent')
      c.fillStyle = reflGrad
      c.fillRect(0, 0, W, H * 0.35)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, progress])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio)
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-pointer"
      onClick={handleClick}
      style={{ display: 'block' }}
    />
  )
}

export default function PluginAudioPlayer({ track, playing, onClose, onPlayStateChange }: PluginAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const shineRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
        audioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!track) return
    setError(null)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }
    const audio = new Audio()
    audio.crossOrigin = 'anonymous' // Required for Web Audio API AnalyserNode
    audioRef.current = audio
    audio.volume = isMuted ? 0 : volume
    audio.preload = 'auto'

    const onLoadedMeta = () => setDuration(audio.duration)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setIsPlaying(false); onPlayStateChange?.(false) }
    const onPlay = () => { setIsPlaying(true); onPlayStateChange?.(true) }
    const onPause = () => { setIsPlaying(false); onPlayStateChange?.(false) }
    const onErr = () => {
      const code = audio.error?.code
      const msg = code === 4 ? 'Format not supported' : code === 2 ? 'Network error' : 'Playback failed'
      setError(msg); setIsPlaying(false); onPlayStateChange?.(false)
    }

    audio.addEventListener('loadedmetadata', onLoadedMeta)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onErr)

    audio.src = safeAudioUrl(track.audioUrl)
    audio.load()
    audio.play().catch(() => {})

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMeta)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onErr)
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.audioUrl])

  useEffect(() => {
    if (playing === undefined || !audioRef.current) return
    if (playing && !isPlaying) audioRef.current.play().catch(() => {})
    else if (!playing && isPlaying) audioRef.current.pause()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => {})
  }, [isPlaying])

  const handleSeek = useCallback((ratio: number) => {
    if (!audioRef.current || duration <= 0) return
    audioRef.current.currentTime = ratio * duration
    setCurrentTime(ratio * duration)
  }, [duration])

  const skipBack = useCallback(() => {
    if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)
  }, [])

  const skipFwd = useCallback(() => {
    if (audioRef.current) audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5)
  }, [duration])

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  if (!track) return null

  return (
    <div className="w-full select-none relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, rgba(5,18,28,0.95), rgba(3,12,20,0.97))',
      borderBottom: '1px solid rgba(0,255,255,0.1)',
      boxShadow: '0 12px 48px rgba(0,0,0,0.9), 0 0 20px rgba(0,255,255,0.03)',
    }}>
      {/* ── Diagonal glass shine sweep ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" ref={shineRef}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-20%',
          width: '60%',
          height: '200%',
          background: 'linear-gradient(105deg, transparent 38%, rgba(0,255,255,0.03) 43%, rgba(255,255,255,0.07) 50%, rgba(0,255,255,0.03) 57%, transparent 62%)',
          transform: 'rotate(-15deg)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Ambient tracking glow — follows playback position ── */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 30% 120% at ${progress}% 100%, rgba(0,255,255,0.07) 0%, transparent 60%)`,
          transition: 'background 0.3s ease',
        }} />
      )}

      {/* ── Top edge highlight — cyan shine catch ── */}
      <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(0,255,255,0.15) 30%, rgba(0,255,255,0.3) 50%, rgba(0,255,255,0.15) 70%, transparent 95%)' }} />

      {/* ── Bottom edge subtle glow ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(0,255,255,0.12) 50%, transparent 90%)' }} />

      {/* ── Controls row ── */}
      <div className="relative flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        {/* Skip back */}
        <button onClick={skipBack}
          className="p-1.5 rounded-lg transition-all duration-200 active:scale-90"
          style={{
            color: 'rgba(255,255,255,0.25)',
            background: 'transparent',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(0,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'transparent' }}>
          <SkipBack size={11} />
        </button>

        {/* Play/Pause — the hero button */}
        <button onClick={togglePlay}
          className="relative w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 flex-shrink-0"
          style={{
            background: isPlaying
              ? 'linear-gradient(135deg, #00ffff, #0088ff)'
              : 'rgba(0,255,255,0.15)',
            border: isPlaying ? 'none' : '1px solid rgba(0,255,255,0.3)',
            boxShadow: isPlaying
              ? '0 0 20px rgba(0,255,255,0.5), 0 0 60px rgba(0,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.4)'
              : '0 0 8px rgba(0,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
          {/* Pulse rings when playing */}
          {isPlaying && (
            <>
              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(0,255,255,0.15)', animationDuration: '2s' }} />
              <div className="absolute inset-[-4px] rounded-full" style={{
                border: '1px solid rgba(0,255,255,0.1)',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
            </>
          )}
          {isPlaying
            ? <Pause size={11} className="relative z-10" style={{ color: '#000000' }} />
            : <Play size={11} className="relative z-10 ml-0.5" style={{ color: '#00ffff' }} />}
        </button>

        {/* Skip forward */}
        <button onClick={skipFwd}
          className="p-1.5 rounded-lg transition-all duration-200 active:scale-90"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(0,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'transparent' }}>
          <SkipForward size={11} />
        </button>

        {/* Current time */}
        <span className="text-[9px] font-mono w-7 text-right flex-shrink-0 tabular-nums tracking-tight"
          style={{ color: 'rgba(0,255,255,0.5)' }}>{fmt(currentTime)}</span>

        {/* Track title */}
        <div className="flex-1 min-w-0 px-2">
          {error ? (
            <p className="text-[9px] font-medium truncate" style={{ color: '#ff4444' }}>{error}</p>
          ) : (
            <p className="text-[9px] font-semibold truncate tracking-[0.15em] uppercase"
              style={{ color: 'rgba(255,255,255,0.65)' }}>{track.title || 'AI Track'}</p>
          )}
        </div>

        {/* Duration */}
        <span className="text-[9px] font-mono w-7 flex-shrink-0 tabular-nums tracking-tight"
          style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(duration)}</span>

        {/* Volume */}
        <div className="flex items-center flex-shrink-0 relative">
          <button onClick={() => setIsMuted(p => !p)} onMouseEnter={() => setShowVolume(true)}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseOver={e => e.currentTarget.style.color = 'rgba(0,255,255,0.6)'}
            onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
            {isMuted || volume === 0 ? <VolumeX size={11} /> : <Volume2 size={11} />}
          </button>
          {showVolume && (
            <div className="absolute top-full right-0 mt-1 rounded-xl p-2.5 z-50"
              style={{
                background: 'linear-gradient(135deg, rgba(5,18,28,0.97), rgba(3,12,20,0.98))',
                border: '1px solid rgba(0,255,255,0.12)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.9), 0 0 12px rgba(0,255,255,0.04)',
              }}
              onMouseLeave={() => setShowVolume(false)}>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false) }}
                className="w-16 h-0.5 accent-cyan-400 cursor-pointer" />
            </div>
          )}
        </div>

        {/* Close */}
        {onClose && (
          <button onClick={onClose}
            className="p-1 transition-all duration-300 flex-shrink-0 rounded-lg"
            style={{ color: 'rgba(255,255,255,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.transform = 'rotate(90deg)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'rotate(0deg)' }}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── LIVE WAVEFORM — Canvas-based Web Audio API visualization ── */}
      <div className="relative h-12 mx-3 mb-2 rounded-xl overflow-hidden"
        style={{
          background: 'rgba(0,255,255,0.02)',
          border: '1px solid rgba(0,255,255,0.1)',
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.5), 0 0 1px rgba(0,255,255,0.08)',
        }}>

        {/* Glass diagonal shine overlay */}
        <div className="absolute inset-0 pointer-events-none z-[5] rounded-xl overflow-hidden">
          <div style={{
            position: 'absolute',
            top: '-100%',
            left: '-30%',
            width: '50%',
            height: '300%',
            background: 'linear-gradient(105deg, transparent 40%, rgba(0,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(0,255,255,0.03) 55%, transparent 60%)',
            transform: 'rotate(-20deg)',
          }} />
        </div>

        {/* Live canvas waveform */}
        <LiveWaveform
          audioElement={audioRef.current}
          isPlaying={isPlaying}
          progress={progress}
          onSeek={handleSeek}
        />
      </div>

      {/* CSS for pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
