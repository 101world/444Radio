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
  const shineRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pulse, setPulse] = useState(0)

  const barCount = 80
  const barsData = useRef<number[]>([])
  if (barsData.current.length === 0) {
    for (let i = 0; i < barCount; i++) {
      barsData.current.push(
        Math.sin(i * 0.35 + 1.7) * 0.22 +
        Math.sin(i * 0.18 + 2.5) * 0.18 +
        Math.cos(i * 0.28 + 0.9) * 0.15 +
        Math.sin(i * 0.7 + 3.1) * 0.08 + 0.38
      )
    }
  }

  // Pulsating animation — smoother with time-based
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

      {/* ── WAVEFORM — Glass node with diagonal shine ── */}
      <div ref={waveformRef}
        className="relative h-10 mx-3 mb-2 flex items-end gap-[0.4px] cursor-pointer rounded-xl overflow-hidden"
        onClick={seekFromEvent}
        style={{
          background: 'rgba(0,255,255,0.03)',
          border: '1px solid rgba(0,255,255,0.1)',
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.5), 0 0 1px rgba(0,255,255,0.08)',
        }}>

        {/* Waveform diagonal glass shine */}
        <div className="absolute inset-0 pointer-events-none z-[5] rounded-xl overflow-hidden">
          <div style={{
            position: 'absolute',
            top: '-100%',
            left: '-30%',
            width: '50%',
            height: '300%',
            background: 'linear-gradient(105deg, transparent 40%, rgba(0,255,255,0.04) 45%, rgba(255,255,255,0.08) 50%, rgba(0,255,255,0.04) 55%, transparent 60%)',
            transform: 'rotate(-20deg)',
          }} />
        </div>

        {/* Playhead line */}
        <div className="absolute top-0 bottom-0 w-[2px] z-[8] pointer-events-none"
          style={{
            left: `${progress}%`,
            background: 'linear-gradient(to bottom, #00ffff, rgba(0,136,255,0.6), rgba(0,255,255,0.15))',
            boxShadow: '0 0 8px rgba(0,255,255,0.6), 0 0 20px rgba(0,255,255,0.15)',
            transition: 'left 0.08s linear',
          }} />

        {/* Playhead glow dot */}
        <div className="absolute top-[-1px] w-2 h-2 rounded-full z-[9] pointer-events-none -translate-x-1/2"
          style={{
            left: `${progress}%`,
            background: '#00ffff',
            boxShadow: '0 0 8px rgba(0,255,255,0.9), 0 0 16px rgba(0,255,255,0.4)',
            transition: 'left 0.08s linear',
          }} />

        {/* Bars */}
        {barsData.current.map((val, i) => {
          const t = i / barCount
          const played = t <= progress / 100
          const nearPlayhead = Math.abs(t - progress / 100) < 0.05
          const pulseAmt = isPlaying
            ? Math.sin((pulse * 0.05) + i * 0.5) * 0.12 +
              Math.sin((pulse * 0.03) + i * 1.1) * 0.06 +
              Math.cos((pulse * 0.07) + i * 0.3) * 0.04
            : 0
          const barH = Math.max(2, (val + pulseAmt) * 36)

          return (
            <div key={i} className="flex-1 rounded-t-sm relative z-[2]"
              style={{
                height: `${barH}px`,
                background: played
                  ? nearPlayhead && isPlaying
                    ? '#00ffff'
                    : `linear-gradient(to top, rgba(0,255,255,${isPlaying ? 0.9 : 0.5}), rgba(0,136,255,${isPlaying ? 0.6 : 0.25}))`
                  : 'rgba(0,255,255,0.1)',
                boxShadow: played && isPlaying
                  ? nearPlayhead
                    ? '0 0 6px rgba(0,255,255,0.6)'
                    : '0 0 2px rgba(0,255,255,0.15)'
                  : 'none',
                transition: isPlaying ? 'height 50ms ease, background 80ms ease' : 'all 300ms ease',
                opacity: played ? 1 : 0.5,
              }} />
          )
        })}

        {/* Inner top reflection */}
        <div className="absolute top-0 left-0 right-0 h-[40%] pointer-events-none rounded-t-xl z-[3]"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), transparent)' }} />
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
