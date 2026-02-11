'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown, ChevronUp, List, X, Repeat, Shuffle, RotateCcw, RotateCw } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'

// ─── Waveform Visualizer ────────────────────────────────────────
function WaveformVisualizer({ audioElement, isPlaying }: { audioElement: HTMLAudioElement | null; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const connectedElementRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return

    // Only create a new source if the audio element changed
    if (connectedElementRef.current !== audioElement) {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        const ctx = ctxRef.current

        // Create analyser
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8

        // Create source (only once per audio element)
        const source = ctx.createMediaElementSource(audioElement)
        source.connect(analyser)
        analyser.connect(ctx.destination)

        analyserRef.current = analyser
        sourceRef.current = source
        connectedElementRef.current = audioElement
      } catch {
        // Source may already be connected — that's ok
        console.warn('Waveform: Could not create audio source')
      }
    }

    const canvas = canvasRef.current
    const c = canvas.getContext('2d')
    if (!c) return

    const analyser = analyserRef.current
    const bufferLength = analyser ? analyser.frequencyBinCount : 64
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const dpr = window.devicePixelRatio || 1
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      
      // Ensure canvas is sized correctly
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
        c.scale(dpr, dpr)
      }

      c.clearRect(0, 0, W, H)

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray)
      } else {
        // Idle gentle sine wave
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.floor(20 + 8 * Math.sin(Date.now() / 600 + i * 0.3))
        }
      }

      const barCount = Math.min(bufferLength, 64)
      const gap = 1.5
      const barWidth = (W - gap * (barCount - 1)) / barCount
      const cornerRadius = Math.min(barWidth / 2, 1.5)

      for (let i = 0; i < barCount; i++) {
        const v = dataArray[i] / 255
        const barH = Math.max(2, v * H * 0.9)
        const x = i * (barWidth + gap)
        const y = (H - barH) / 2

        // Teal gradient with glow
        const alpha = 0.45 + v * 0.55
        c.fillStyle = `rgba(34, 211, 238, ${alpha})`
        c.shadowColor = 'rgba(34, 211, 238, 0.5)'
        c.shadowBlur = v * 6

        // Rounded bar
        c.beginPath()
        c.moveTo(x + cornerRadius, y)
        c.lineTo(x + barWidth - cornerRadius, y)
        c.quadraticCurveTo(x + barWidth, y, x + barWidth, y + cornerRadius)
        c.lineTo(x + barWidth, y + barH - cornerRadius)
        c.quadraticCurveTo(x + barWidth, y + barH, x + barWidth - cornerRadius, y + barH)
        c.lineTo(x + cornerRadius, y + barH)
        c.quadraticCurveTo(x, y + barH, x, y + barH - cornerRadius)
        c.lineTo(x, y + cornerRadius)
        c.quadraticCurveTo(x, y, x + cornerRadius, y)
        c.fill()
      }
      c.shadowBlur = 0
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioElement, isPlaying])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: '32px' }}
    />
  )
}

// ─── Main Player ────────────────────────────────────────────────
export default function FloatingAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlayPause,
    setVolume,
    seekTo,
    playNext,
    playPrevious,
    playlist,
    playTrack,
    removeFromPlaylist,
    isLooping,
    isShuffled,
    toggleLoop,
    toggleShuffle,
    skipBackward,
    skipForward,
    getAudioElement
  } = useAudioPlayer()

  const [isMobile, setIsMobile] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Grab audio element for waveform
  useEffect(() => {
    const el = getAudioElement()
    if (el) setAudioEl(el)
    // Re-check when track changes
    const timer = setInterval(() => {
      const e = getAudioElement()
      if (e && e !== audioEl) setAudioEl(e)
    }, 1000)
    return () => clearInterval(timer)
  }, [currentTrack, getAudioElement, audioEl])

  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return '0:00'
    const m = Math.floor(time / 60)
    const s = Math.floor(time % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }, [])

  const progress = duration ? (currentTime / duration) * 100 : 0

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(pct * duration)
  }

  if (!currentTrack) return null

  // ─── Mobile ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50" style={{
          background: 'linear-gradient(180deg, #111113 0%, #0c0c0e 100%)',
          borderBottom: '1px solid rgba(34, 211, 238, 0.12)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.04)',
        }}>
          {/* Progress line at very top */}
          <div className="h-[2px] w-full bg-white/5 relative">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>

          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              {/* Art */}
              {currentTrack.imageUrl ? (
                <Image src={currentTrack.imageUrl} alt={currentTrack.title} width={40} height={40}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10 shadow-lg shadow-black/40" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.6)" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-gray-100 font-semibold text-xs truncate">{currentTrack.title}</p>
                {currentTrack.artist && <p className="text-gray-500 text-[10px] truncate">{currentTrack.artist}</p>}
              </div>

              {/* Controls */}
              {!collapsed && (
                <div className="flex items-center gap-1.5">
                  <button onClick={toggleShuffle} className={`p-1 ${isShuffled ? 'text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}><Shuffle size={13} /></button>
                  <button onClick={playPrevious} className="text-gray-400 hover:text-gray-200 p-1"><SkipBack size={15} /></button>
                  <button onClick={togglePlayPause}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, #14b8a6, #22d3ee)',
                      boxShadow: '0 0 12px rgba(34,211,238,0.25)',
                    }}
                  >
                    {isPlaying ? <Pause size={13} className="text-gray-900" fill="currentColor" /> : <Play size={13} className="text-gray-900 ml-0.5" fill="currentColor" />}
                  </button>
                  <button onClick={playNext} className="text-gray-400 hover:text-gray-200 p-1"><SkipForward size={15} /></button>
                  <button onClick={toggleLoop} className={`p-1 ${isLooping ? 'text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}><Repeat size={13} /></button>
                </div>
              )}

              {collapsed && (
                <button onClick={togglePlayPause}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #14b8a6, #22d3ee)' }}
                >
                  {isPlaying ? <Pause size={12} className="text-gray-900" fill="currentColor" /> : <Play size={12} className="text-gray-900 ml-0.5" fill="currentColor" />}
                </button>
              )}

              <button onClick={() => setShowQueue(!showQueue)} className="text-gray-500 hover:text-teal-400 p-1"><List size={16} /></button>
              <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500 hover:text-teal-400 p-1">
                {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            </div>

            {/* Seekbar */}
            {!collapsed && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] text-gray-500 w-8 text-right font-mono">{formatTime(currentTime)}</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full cursor-pointer relative group" onClick={handleSeek}>
                  <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-100" style={{ width: `${progress}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `calc(${progress}% - 5px)` }} />
                </div>
                <span className="text-[9px] text-gray-500 w-8 font-mono">{formatTime(duration)}</span>
              </div>
            )}

            {/* Mobile Queue */}
            {showQueue && !collapsed && (
              <div className="mt-2 border-t border-white/5 pt-2">
                <div className="max-h-[40vh] overflow-y-auto scrollbar-thin">
                  {playlist.length === 0 ? (
                    <div className="py-4 text-center text-gray-600 text-xs">No tracks in queue</div>
                  ) : playlist.map((track, i) => {
                    const isCurrent = currentTrack?.id === track.id
                    return (
                      <div key={`${track.id}-${i}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 ${isCurrent ? 'bg-teal-500/10 border border-teal-500/20' : 'hover:bg-white/[0.03]'}`}>
                        <button onClick={() => playTrack(track)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          <span className="text-[9px] text-gray-600 w-4 font-mono">{i + 1}</span>
                          {track.imageUrl && <Image src={track.imageUrl} alt={track.title} width={24} height={24} className="w-6 h-6 rounded object-cover" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[10px] truncate ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-300'}`}>{track.title}</p>
                            {track.artist && <p className="text-[9px] text-gray-600 truncate">{track.artist}</p>}
                          </div>
                          {isCurrent && isPlaying && (
                            <div className="flex gap-[2px]">
                              <div className="w-[2px] h-2 bg-teal-400 animate-pulse" />
                              <div className="w-[2px] h-2 bg-teal-400 animate-pulse" style={{ animationDelay: '0.15s' }} />
                              <div className="w-[2px] h-2 bg-teal-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
                            </div>
                          )}
                        </button>
                        <button onClick={() => removeFromPlaylist(track.id)} className="text-gray-600 hover:text-red-400 p-1"><X size={12} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // ─── Desktop — Unified Dark Gray + Teal Mini Player Bar ──────
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{
      background: 'linear-gradient(180deg, #141416 0%, #0e0e10 100%)',
      borderTop: '1px solid rgba(34, 211, 238, 0.08)',
      boxShadow: '0 -4px 32px rgba(0,0,0,0.5), 0 0 60px rgba(34,211,238,0.03)',
    }}>
      {/* Scanline accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />

      {/* Progress bar — click to seek */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.03] cursor-pointer group" onClick={handleSeek}>
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-teal-600 via-teal-400 to-cyan-400 transition-all duration-100 rounded-r-full"
          style={{ width: `${progress}%` }}
        />
        {/* Glow dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-teal-400 scale-0 group-hover:scale-100 transition-transform"
          style={{
            left: `calc(${progress}% - 6px)`,
            boxShadow: '0 0 10px rgba(34,211,238,0.8)',
          }}
        />
      </div>

      <div className="max-w-[1800px] mx-auto px-4 md:px-6 py-2.5 flex items-center gap-4">
        {/* ─── Left: Track Info ─── */}
        <div className="flex items-center gap-3 min-w-0 w-[280px] flex-shrink-0">
          {currentTrack.imageUrl ? (
            <div className="relative group/art">
              <Image
                src={currentTrack.imageUrl}
                alt={currentTrack.title}
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-cover ring-1 ring-white/10 shadow-xl shadow-black/60 group-hover/art:ring-teal-500/30 transition-all"
              />
              {isPlaying && (
                <div className="absolute inset-0 rounded-lg ring-1 ring-teal-500/20 animate-pulse" />
              )}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-800/80 flex items-center justify-center ring-1 ring-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-gray-100 font-semibold text-sm truncate leading-tight">{currentTrack.title}</p>
            {currentTrack.artist && <p className="text-gray-500 text-xs truncate mt-0.5">{currentTrack.artist}</p>}
          </div>
        </div>

        {/* ─── Center: Controls + Waveform ─── */}
        <div className="flex-1 flex flex-col items-center gap-1.5 max-w-3xl mx-auto">
          {/* Transport */}
          <div className="flex items-center gap-3">
            <button onClick={toggleShuffle} className={`transition-colors ${isShuffled ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`} title="Shuffle">
              <Shuffle size={15} />
            </button>
            <button onClick={() => skipBackward(10)} className="text-gray-500 hover:text-gray-300 transition-colors" title="−10s">
              <RotateCcw size={15} />
            </button>
            <button onClick={playPrevious} className="text-gray-400 hover:text-gray-200 transition-colors" title="Previous">
              <SkipBack size={17} />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #22d3ee)',
                boxShadow: isPlaying
                  ? '0 0 20px rgba(34,211,238,0.3), 0 0 40px rgba(34,211,238,0.1)'
                  : '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {isPlaying ? (
                <Pause size={17} className="text-gray-900" fill="currentColor" />
              ) : (
                <Play size={17} className="text-gray-900 ml-0.5" fill="currentColor" />
              )}
            </button>

            <button onClick={playNext} className="text-gray-400 hover:text-gray-200 transition-colors" title="Next">
              <SkipForward size={17} />
            </button>
            <button onClick={() => skipForward(10)} className="text-gray-500 hover:text-gray-300 transition-colors" title="+10s">
              <RotateCw size={15} />
            </button>
            <button onClick={toggleLoop} className={`transition-colors ${isLooping ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`} title="Loop">
              <Repeat size={15} />
            </button>
          </div>

          {/* Waveform + Time */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] text-gray-500 w-10 text-right font-mono tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative cursor-pointer rounded-md overflow-hidden" onClick={handleSeek}>
              <WaveformVisualizer audioElement={audioEl} isPlaying={isPlaying} />
              {/* Overlay progress dim — dims the unplayed portion */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, transparent ${progress}%, rgba(0,0,0,0.45) ${progress}%)`,
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500 w-10 font-mono tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ─── Right: Volume + Queue ─── */}
        <div className="flex items-center gap-3 w-[220px] flex-shrink-0 justify-end">
          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <div
              className="w-20 h-1 bg-white/[0.06] rounded-full relative cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setVolume(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
              }}
            >
              <div
                className="absolute top-0 left-0 h-full rounded-full bg-teal-500/60 transition-all"
                style={{ width: `${volume * 100}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal-400 opacity-0 group-hover/vol:opacity-100 transition-opacity"
                style={{
                  left: `calc(${volume * 100}% - 4px)`,
                  boxShadow: '0 0 6px rgba(34,211,238,0.5)',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-600 font-mono w-7 text-right">{Math.round(volume * 100)}%</span>
          </div>

          {/* Queue Toggle */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`relative p-1.5 rounded-lg transition-colors ${showQueue ? 'text-teal-400 bg-teal-500/10' : 'text-gray-500 hover:text-gray-300'}`}
            title="Queue"
          >
            <List size={16} />
            {playlist.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-teal-500 text-gray-900 text-[8px] font-bold flex items-center justify-center">
                {playlist.length > 9 ? '9+' : playlist.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Queue Dropdown ─── */}
      {showQueue && (
        <div
          className="absolute bottom-full right-4 mb-2 w-[360px] max-h-[50vh] rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #18181b, #111113)',
            border: '1px solid rgba(34,211,238,0.1)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.03)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-xs text-gray-400 font-semibold tracking-wide uppercase">Queue</span>
            <span className="text-[10px] text-gray-600">{playlist.length} tracks</span>
          </div>
          <div className="overflow-y-auto max-h-[calc(50vh-48px)] scrollbar-thin">
            {playlist.length === 0 ? (
              <div className="py-8 text-center">
                <List size={24} className="mx-auto mb-2 text-gray-700" />
                <p className="text-xs text-gray-600">Queue is empty</p>
              </div>
            ) : (
              playlist.map((track, i) => {
                const isCurrent = currentTrack?.id === track.id
                return (
                  <div
                    key={`${track.id}-${i}`}
                    className={`flex items-center gap-2.5 px-4 py-2 transition-colors ${
                      isCurrent
                        ? 'bg-teal-500/[0.08] border-l-2 border-teal-400'
                        : 'hover:bg-white/[0.02] border-l-2 border-transparent'
                    }`}
                  >
                    <button onClick={() => playTrack(track)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                      <span className="text-[10px] text-gray-600 w-5 font-mono">{i + 1}</span>
                      {track.imageUrl ? (
                        <Image src={track.imageUrl} alt={track.title} width={32} height={32} className="w-8 h-8 rounded object-cover ring-1 ring-white/5" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center ring-1 ring-white/5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="2">
                            <path d="M9 18V5l12-2v13" />
                            <circle cx="6" cy="18" r="3" />
                            <circle cx="18" cy="16" r="3" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] truncate ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-300'}`}>
                          {track.title}
                        </p>
                        {track.artist && <p className="text-[9px] text-gray-600 truncate">{track.artist}</p>}
                      </div>
                      {isCurrent && isPlaying && (
                        <div className="flex gap-[2px] flex-shrink-0">
                          <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" />
                          <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                          <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                        </div>
                      )}
                    </button>
                    <button onClick={() => removeFromPlaylist(track.id)} className="text-gray-700 hover:text-red-400 transition-colors p-1">
                      <X size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
