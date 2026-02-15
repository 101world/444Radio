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

/**
 * Bullet-proof proxy URL helper.
 * ALL external audio goes through /api/r2/proxy so there are zero CORS issues.
 * Same-origin URLs pass through unchanged.
 */
function safeAudioUrl(url: string): string {
  if (!url) return url
  try {
    const u = new URL(url, window.location.origin)
    if (u.pathname.startsWith('/api/')) return url          // already an API route
    if (u.origin === window.location.origin) return url     // same-origin
  } catch { /* fall through to proxy */ }
  return `/api/r2/proxy?url=${encodeURIComponent(url)}`
}

export default function PluginAudioPlayer({ track, playing, onClose, onPlayStateChange }: PluginAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Cleanup on unmount ──
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

  // ── Load & play track ──
  // IMPORTANT: No WebAudio createMediaElementSource — that hijacks audio output
  // and causes silent playback when the AudioContext is suspended or misconfigured.
  // Plain HTML5 Audio is rock-solid and works everywhere.
  useEffect(() => {
    if (!track) return
    setError(null)

    // Create fresh audio element per track to avoid stale state
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
    const onError = () => {
      const code = audio.error?.code
      const msg = code === 4 ? 'Format not supported' : code === 2 ? 'Network error' : 'Playback failed'
      console.error('[PluginPlayer] Audio error:', audio.error?.message, 'code:', code)
      setError(msg)
      setIsPlaying(false)
      onPlayStateChange?.(false)
    }

    audio.addEventListener('loadedmetadata', onLoadedMeta)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    // Set source via proxy and play
    audio.src = safeAudioUrl(track.audioUrl)
    audio.load()
    audio.play().catch((e) => {
      console.warn('[PluginPlayer] Autoplay blocked:', e.message)
    })

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMeta)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id, track?.audioUrl])

  // ── External play/pause control ──
  useEffect(() => {
    if (playing === undefined || !audioRef.current) return
    if (playing && !isPlaying) {
      audioRef.current.play().catch(() => {})
    } else if (!playing && isPlaying) {
      audioRef.current.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  // ── Volume sync ──
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  // ── Controls ──
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
  }, [isPlaying])

  const seekFromEvent = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !audioRef.current || duration <= 0) return
    const rect = waveformRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
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
    setIsMuted(prev => !prev)
  }, [])

  const changeVolume = useCallback((v: number) => {
    setVolume(v)
    setIsMuted(false)
  }, [])

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!track) return null

  // Deterministic waveform bars from seed (visual only — no WebAudio needed)
  const barCount = 48
  const bars: number[] = []
  for (let i = 0; i < barCount; i++) {
    bars.push(Math.sin(i * 0.5 + 1.3) * 0.3 + Math.sin(i * 0.2 + 0.5) * 0.2 + 0.35)
  }

  return (
    <div
      className="w-full select-none transition-all duration-300 ease-out"
      style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.88) 50%, rgba(30,27,75,0.90) 100%)',
        backdropFilter: 'blur(28px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
        borderBottom: '1px solid rgba(6,182,212,0.2)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button onClick={skipBack} className="p-1 text-white/30 hover:text-white/80 transition flex-shrink-0">
          <SkipBack size={12} />
        </button>

        <button onClick={togglePlay}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.85), rgba(34,211,238,0.6))',
            boxShadow: '0 0 12px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
          {isPlaying ? <Pause size={11} className="text-black" /> : <Play size={11} className="text-black ml-0.5" />}
        </button>

        <button onClick={skipFwd} className="p-1 text-white/30 hover:text-white/80 transition flex-shrink-0">
          <SkipForward size={12} />
        </button>

        <span className="text-[9px] text-white/30 font-mono w-6 text-right flex-shrink-0">{fmt(currentTime)}</span>

        {/* Waveform bars (pure CSS — no WebAudio dependency) */}
        <div
          ref={waveformRef}
          className="flex-1 h-6 flex items-center gap-px cursor-pointer min-w-0 rounded"
          onClick={seekFromEvent}
        >
          {bars.map((val, i) => {
            const t = i / barCount
            const played = t <= progress / 100
            const barH = Math.max(3, val * 20)
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-colors duration-150"
                style={{
                  height: `${barH}px`,
                  backgroundColor: played
                    ? (isPlaying ? 'rgba(34,211,238,0.85)' : 'rgba(34,211,238,0.7)')
                    : 'rgba(100,116,139,0.25)',
                }}
              />
            )
          })}
        </div>

        <span className="text-[9px] text-white/30 font-mono w-6 flex-shrink-0">{fmt(duration)}</span>

        <div className="flex-shrink min-w-0 max-w-[120px] hidden sm:block">
          {error ? (
            <p className="text-[10px] font-semibold text-red-400 truncate">{error}</p>
          ) : (
            <p className="text-[10px] font-semibold text-white/80 truncate">{track.title || 'AI Track'}</p>
          )}
        </div>

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

        {onClose && (
          <button onClick={onClose} className="p-1 text-white/20 hover:text-white/70 hover:rotate-90 transition-all duration-200 flex-shrink-0">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
