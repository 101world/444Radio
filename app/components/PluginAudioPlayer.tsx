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

export default function PluginAudioPlayer({ track, playing, onClose, onPlayStateChange }: PluginAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pulse, setPulse] = useState(0)

  const barCount = 64
  const barsData = useRef<number[]>([])
  if (barsData.current.length === 0) {
    for (let i = 0; i < barCount; i++) {
      barsData.current.push(
        Math.sin(i * 0.4 + 1.3) * 0.25 +
        Math.sin(i * 0.15 + 2.1) * 0.2 +
        Math.cos(i * 0.3 + 0.7) * 0.15 + 0.4
      )
    }
  }

  // Pulsating animation
  useEffect(() => {
    let frame = 0
    const animate = () => {
      frame++
      setPulse(frame)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(animate)
    } else {
      setPulse(0)
    }
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isPlaying])

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

  const seekFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !audioRef.current || duration <= 0) return
    const rect = waveformRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
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
      background: 'linear-gradient(160deg, rgba(2,6,23,0.97) 0%, rgba(15,23,42,0.94) 50%, rgba(30,27,75,0.92) 100%)',
      backdropFilter: 'blur(40px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
      borderBottom: '1px solid rgba(6,182,212,0.12)',
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 80px rgba(6,182,212,0.04)',
    }}>
      {/* Ambient tracking glow */}
      {isPlaying && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 40% 100% at ${progress}% 80%, rgba(6,182,212,0.1) 0%, transparent 70%)`,
          transition: 'background 0.5s ease',
        }} />
      )}

      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), rgba(139,92,246,0.15), transparent)' }} />

      {/* Controls row */}
      <div className="relative flex items-center gap-1 px-2.5 pt-2 pb-0.5">
        <button onClick={skipBack} className="p-1 text-white/20 hover:text-cyan-400/70 transition-all duration-200 flex-shrink-0 active:scale-90">
          <SkipBack size={10} />
        </button>

        <button onClick={togglePlay}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 flex-shrink-0 relative group"
          style={{
            background: isPlaying
              ? 'linear-gradient(135deg, rgba(34,211,238,0.95), rgba(99,102,241,0.75))'
              : 'linear-gradient(135deg, rgba(34,211,238,0.8), rgba(34,211,238,0.55))',
            boxShadow: isPlaying
              ? '0 0 16px rgba(34,211,238,0.45), 0 0 40px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.3)'
              : '0 0 10px rgba(34,211,238,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
          {/* Outer pulse ring */}
          {isPlaying && <div className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: 'rgba(34,211,238,0.4)' }} />}
          {isPlaying ? <Pause size={10} className="text-black relative z-10" /> : <Play size={10} className="text-black ml-0.5 relative z-10" />}
        </button>

        <button onClick={skipFwd} className="p-1 text-white/20 hover:text-cyan-400/70 transition-all duration-200 flex-shrink-0 active:scale-90">
          <SkipForward size={10} />
        </button>

        <span className="text-[8px] text-cyan-400/40 font-mono w-6 text-right flex-shrink-0 tabular-nums tracking-tight">{fmt(currentTime)}</span>

        {/* Title */}
        <div className="flex-1 min-w-0 px-1.5">
          {error ? (
            <p className="text-[9px] font-medium text-red-400/90 truncate">{error}</p>
          ) : (
            <p className="text-[9px] font-semibold text-white/60 truncate tracking-wider uppercase">{track.title || 'AI Track'}</p>
          )}
        </div>

        <span className="text-[8px] text-white/15 font-mono w-6 flex-shrink-0 tabular-nums tracking-tight">{fmt(duration)}</span>

        {/* Volume */}
        <div className="flex items-center flex-shrink-0 relative">
          <button onClick={() => setIsMuted(p => !p)} onMouseEnter={() => setShowVolume(true)}
            className="p-1 text-white/20 hover:text-cyan-400/50 transition-all">
            {isMuted || volume === 0 ? <VolumeX size={10} /> : <Volume2 size={10} />}
          </button>
          {showVolume && (
            <div className="absolute top-full right-0 mt-1 rounded-xl p-2 z-50"
              style={{
                background: 'rgba(2,6,23,0.95)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(6,182,212,0.1)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}
              onMouseLeave={() => setShowVolume(false)}>
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false) }}
                className="w-16 h-0.5 accent-cyan-400 cursor-pointer" />
            </div>
          )}
        </div>

        {onClose && (
          <button onClick={onClose} className="p-0.5 text-white/10 hover:text-white/50 hover:rotate-90 transition-all duration-300 flex-shrink-0">
            <X size={10} />
          </button>
        )}
      </div>

      {/* Futuristic waveform with pulsating bars */}
      <div ref={waveformRef} className="relative h-8 mx-2.5 mb-1.5 flex items-end gap-[0.5px] cursor-pointer rounded-lg overflow-hidden"
        onClick={seekFromEvent}
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(6,182,212,0.06)',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
        }}>
        {/* Playhead */}
        <div className="absolute top-0 bottom-0 w-[1.5px] z-10 pointer-events-none"
          style={{
            left: `${progress}%`,
            background: 'linear-gradient(to bottom, rgba(34,211,238,0.95), rgba(139,92,246,0.7), rgba(34,211,238,0.3))',
            boxShadow: '0 0 6px rgba(34,211,238,0.5), 0 0 12px rgba(34,211,238,0.15)',
            transition: 'left 0.1s ease',
          }} />
        {/* Playhead dot */}
        <div className="absolute top-0 w-1.5 h-1.5 rounded-full z-10 pointer-events-none -translate-x-1/2"
          style={{
            left: `${progress}%`,
            background: 'rgba(34,211,238,1)',
            boxShadow: '0 0 6px rgba(34,211,238,0.8)',
            transition: 'left 0.1s ease',
          }} />

        {barsData.current.map((val, i) => {
          const t = i / barCount
          const played = t <= progress / 100
          const pulseAmt = isPlaying
            ? Math.sin((pulse * 0.06) + i * 0.4) * 0.1 + Math.sin((pulse * 0.04) + i * 0.9) * 0.05
            : 0
          const barH = Math.max(1.5, (val + pulseAmt) * 28)

          return (
            <div key={i} className="flex-1 rounded-t-[1px]"
              style={{
                height: `${barH}px`,
                background: played
                  ? `linear-gradient(to top, rgba(34,211,238,${isPlaying ? 0.9 : 0.65}), rgba(139,92,246,${isPlaying ? 0.65 : 0.35}))`
                  : 'rgba(100,116,139,0.1)',
                boxShadow: played && isPlaying ? '0 0 3px rgba(34,211,238,0.2)' : 'none',
                transition: isPlaying ? 'height 60ms ease, background 100ms ease' : 'all 200ms ease',
                opacity: played ? 1 : 0.6,
              }} />
          )
        })}

        {/* Reflection / glass effect */}
        <div className="absolute inset-0 pointer-events-none rounded-lg"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent 40%)' }} />
      </div>
    </div>
  )
}
