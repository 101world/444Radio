'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronRight, X, Repeat, Shuffle, ChevronDown, ChevronUp, Search, List, Heart, Zap } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'

// ─── Vertical Waveform Visualizer (thin sidebar) ────────────────
function VerticalWaveform({ audioElement, isPlaying }: { audioElement: HTMLAudioElement | null; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const connectedRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return
    if (connectedRef.current !== audioElement) {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        const ctx = ctxRef.current
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        const source = ctx.createMediaElementSource(audioElement)
        source.connect(analyser)
        analyser.connect(ctx.destination)
        analyserRef.current = analyser
        sourceRef.current = source
        connectedRef.current = audioElement
      } catch {
        console.warn('Waveform: Could not create audio source')
      }
    }

    const canvas = canvasRef.current
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
      if (analyser && isPlaying) { analyser.getByteFrequencyData(data) }
      else { for (let i = 0; i < bufLen; i++) data[i] = Math.floor(18 + 6 * Math.sin(Date.now() / 700 + i * 0.35)) }

      const barCount = Math.min(bufLen, 48)
      const gap = 1.5
      const barH = (H - gap * (barCount - 1)) / barCount
      for (let i = 0; i < barCount; i++) {
        const v = data[i] / 255
        const barW = Math.max(2, v * W * 0.85)
        const y = i * (barH + gap)
        const x = (W - barW) / 2
        c.fillStyle = `rgba(34, 211, 238, ${0.4 + v * 0.6})`
        c.shadowColor = 'rgba(34, 211, 238, 0.4)'
        c.shadowBlur = v * 5
        const r = Math.min(barH / 2, 1.5)
        c.beginPath()
        c.moveTo(x + r, y); c.lineTo(x + barW - r, y)
        c.quadraticCurveTo(x + barW, y, x + barW, y + r)
        c.lineTo(x + barW, y + barH - r)
        c.quadraticCurveTo(x + barW, y + barH, x + barW - r, y + barH)
        c.lineTo(x + r, y + barH)
        c.quadraticCurveTo(x, y + barH, x, y + barH - r)
        c.lineTo(x, y + r)
        c.quadraticCurveTo(x, y, x + r, y)
        c.fill()
      }
      c.shadowBlur = 0
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioElement, isPlaying])

  return <canvas ref={canvasRef} className="w-full h-full" style={{ transform: 'scaleY(-1)' }} />
}

// ─── Horizontal Waveform (expanded mode) ────────────────────────
function HorizontalWaveform({ audioElement, isPlaying, progress }: { audioElement: HTMLAudioElement | null; isPlaying: boolean; progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)
  const connectedRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return
    if (connectedRef.current !== audioElement) {
      try {
        if (!ctxRef.current) {
          ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        }
        const ctx = ctxRef.current
        // Try to reuse existing analyser — the VerticalWaveform may have already connected
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.82
        try {
          const source = ctx.createMediaElementSource(audioElement)
          source.connect(analyser)
          analyser.connect(ctx.destination)
        } catch {
          // Already connected — try to get data anyway
        }
        analyserRef.current = analyser
        connectedRef.current = audioElement
      } catch {
        console.warn('HorizontalWaveform: Could not create audio source')
      }
    }

    const canvas = canvasRef.current
    const c = canvas.getContext('2d')
    if (!c) return
    const analyser = analyserRef.current
    const bufLen = analyser ? analyser.frequencyBinCount : 128
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

      if (analyser && isPlaying) { analyser.getByteFrequencyData(data) }
      else { for (let i = 0; i < bufLen; i++) data[i] = Math.floor(14 + 8 * Math.sin(Date.now() / 800 + i * 0.4)) }

      const barCount = Math.min(bufLen, 80)
      const gap = 1
      const barW = (W - gap * (barCount - 1)) / barCount
      const midY = H / 2

      for (let i = 0; i < barCount; i++) {
        const v = data[i] / 255
        const barH = Math.max(2, v * midY * 0.9)
        const x = i * (barW + gap)
        const pct = (i / barCount) * 100

        // Played = bright teal, unplayed = dim
        if (pct <= progress) {
          c.fillStyle = `rgba(34, 211, 238, ${0.5 + v * 0.5})`
          c.shadowColor = 'rgba(34, 211, 238, 0.3)'
          c.shadowBlur = v * 4
        } else {
          c.fillStyle = `rgba(255, 255, 255, ${0.06 + v * 0.12})`
          c.shadowBlur = 0
        }

        // Mirror bars from center
        const r = Math.min(barW / 2, 1.5)
        // Top half
        c.beginPath()
        c.roundRect(x, midY - barH, barW, barH, r)
        c.fill()
        // Bottom half (mirror)
        c.beginPath()
        c.roundRect(x, midY, barW, barH, r)
        c.fill()
      }
      c.shadowBlur = 0
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioElement, isPlaying, progress])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

// ─── Explore media item type ────────────────────────────────────
interface ExploreMedia {
  id: string
  title: string
  audio_url: string
  image_url: string
  audioUrl?: string
  imageUrl?: string
  user_id: string
  plays: number
  genre: string | null
  users?: { username: string }
  username?: string
}

// ─── Main Player Component ──────────────────────────────────────
export default function FloatingAudioPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume,
    togglePlayPause, setVolume, seekTo, playNext, playPrevious,
    playlist, playTrack, removeFromPlaylist, addToPlaylist,
    isLooping, isShuffled, toggleLoop, toggleShuffle,
    getAudioElement, setPlaylist,
  } = useAudioPlayer()

  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [liked, setLiked] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSpeed, setShowSpeed] = useState(false)

  // Explore mini-browser state
  const [exploreSongs, setExploreSongs] = useState<ExploreMedia[]>([])
  const [exploreSearch, setExploreSearch] = useState('')
  const [exploreLoading, setExploreLoading] = useState(false)
  const [exploreFetched, setExploreFetched] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const el = getAudioElement()
    if (el) setAudioEl(el)
    const timer = setInterval(() => {
      const e = getAudioElement()
      if (e && e !== audioEl) setAudioEl(e)
    }, 1000)
    return () => clearInterval(timer)
  }, [currentTrack, getAudioElement, audioEl])

  // Fetch explore songs when expanded
  useEffect(() => {
    if (expanded && !exploreFetched) {
      setExploreLoading(true)
      fetch('/api/media/explore?limit=200')
        .then(r => r.json())
        .then(data => {
          if (data.combinedMedia) {
            setExploreSongs(data.combinedMedia)
          }
          setExploreFetched(true)
        })
        .catch(() => {})
        .finally(() => setExploreLoading(false))
    }
  }, [expanded, exploreFetched])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') { e.preventDefault(); togglePlayPause() }
      if (e.key === 'ArrowRight' && e.shiftKey) playNext()
      if (e.key === 'ArrowLeft' && e.shiftKey) playPrevious()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlayPause, playNext, playPrevious])

  // Sync playback rate
  useEffect(() => {
    const el = getAudioElement()
    if (el) el.playbackRate = playbackRate
  }, [playbackRate, getAudioElement, currentTrack])

  // Reset liked state on track change
  useEffect(() => { setLiked(false) }, [currentTrack?.id])

  const formatTime = useCallback((t: number) => {
    if (isNaN(t)) return '0:00'
    return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`
  }, [])

  const progress = duration ? (currentTime / duration) * 100 : 0

  const handleVerticalSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // Bottom-to-top: clicking higher = further in track
    const pct = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    seekTo(pct * duration)
  }

  const handleHorizontalSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(pct * duration)
  }

  const toTrack = (song: ExploreMedia) => ({
    id: song.id,
    title: song.title,
    audioUrl: song.audioUrl || song.audio_url,
    imageUrl: song.imageUrl || song.image_url,
    artist: song.users?.username || song.username || 'Unknown',
    userId: song.user_id,
  })

  const playExploreTrack = (song: ExploreMedia) => {
    // Just play this single song — don't set playlist
    playTrack(toTrack(song))
  }

  const queueExploreTrack = (e: React.MouseEvent, song: ExploreMedia) => {
    e.stopPropagation()
    addToPlaylist(toTrack(song))
  }

  const filteredExplore = exploreSongs.filter(s => {
    if (!exploreSearch.trim()) return true
    const q = exploreSearch.toLowerCase()
    return s.title.toLowerCase().includes(q) ||
      (s.genre && s.genre.toLowerCase().includes(q)) ||
      (s.users?.username || s.username || '').toLowerCase().includes(q)
  })

  if (!currentTrack) return null

  // ═══════════════════════════════════════════════════════════════
  // MOBILE — top-docked bar (unchanged from previous design)
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50" style={{
        background: 'linear-gradient(180deg, #111113 0%, #0c0c0e 100%)',
        borderBottom: '1px solid rgba(34, 211, 238, 0.12)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}>
        <div className="h-[2px] w-full bg-white/5 relative">
          <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center gap-3">
            {currentTrack.imageUrl ? (
              <Image src={currentTrack.imageUrl} alt={currentTrack.title} width={40} height={40}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 ring-1 ring-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0 ring-1 ring-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.6)" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-gray-100 font-semibold text-xs truncate">{currentTrack.title}</p>
              {currentTrack.artist && <p className="text-gray-500 text-[10px] truncate">{currentTrack.artist}</p>}
            </div>
            {!collapsed && (
              <div className="flex items-center gap-1.5">
                <button onClick={playPrevious} className="text-gray-400 hover:text-gray-200 p-1"><SkipBack size={15} /></button>
                <button onClick={togglePlayPause}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #14b8a6, #22d3ee)' }}
                >
                  {isPlaying ? <Pause size={13} className="text-gray-900" fill="currentColor" /> : <Play size={13} className="text-gray-900 ml-0.5" fill="currentColor" />}
                </button>
                <button onClick={playNext} className="text-gray-400 hover:text-gray-200 p-1"><SkipForward size={15} /></button>
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
          {!collapsed && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] text-gray-500 w-8 text-right font-mono">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/5 rounded-full cursor-pointer relative group" onClick={handleHorizontalSeek}>
                <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-100" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[9px] text-gray-500 w-8 font-mono">{formatTime(duration)}</span>
            </div>
          )}
          {showQueue && !collapsed && (
            <div className="mt-2 border-t border-white/5 pt-2 max-h-[40vh] overflow-y-auto">
              {playlist.length === 0 ? (
                <div className="py-4 text-center text-gray-600 text-xs">No tracks in queue</div>
              ) : playlist.map((track, i) => {
                const isCurrent = currentTrack?.id === track.id
                return (
                  <div key={`${track.id}-${i}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 ${isCurrent ? 'bg-teal-500/10' : 'hover:bg-white/[0.03]'}`}>
                    <button onClick={() => playTrack(track)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      <span className="text-[9px] text-gray-600 w-4 font-mono">{i + 1}</span>
                      <p className={`text-[10px] truncate flex-1 ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-300'}`}>{track.title}</p>
                    </button>
                    <button onClick={() => removeFromPlaylist(track.id)} className="text-gray-600 hover:text-red-400 p-1"><X size={12} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP — Right-docked sidebar (thin → expanded)
  // ═══════════════════════════════════════════════════════════════

  // ──── THIN MODE (80px, mirrors left sidebar) ────────────────
  if (!expanded) {
    return (
      <div
        className="fixed top-0 right-0 h-screen w-[88px] z-40 flex flex-col items-center py-1 transition-all duration-300 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(17,17,19,0.95) 0%, rgba(10,10,12,0.97) 100%)',
          borderLeft: '1px solid rgba(34, 211, 238, 0.06)',
        }}
      >
        {/* Album art / music icon — click to expand */}
        <div className="mb-2 mt-1 cursor-pointer" onClick={() => setExpanded(true)} title="Expand player">
          {currentTrack.imageUrl ? (
            <Image src={currentTrack.imageUrl} alt={currentTrack.title} width={56} height={56}
              className="w-14 h-14 rounded-lg object-cover ring-1 ring-white/10 shadow-lg shadow-black/50 hover:ring-teal-500/30 transition-all" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-800/80 flex items-center justify-center ring-1 ring-white/10 hover:ring-teal-500/30 transition-all">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>

        {/* Vertical waveform — fills all available space */}
        <div className="flex-1 w-16 min-h-[80px] relative overflow-hidden rounded-md mx-auto cursor-pointer" onClick={handleVerticalSeek}>
          <VerticalWaveform audioElement={audioEl} isPlaying={isPlaying} />
          {/* Progress overlay — dims unplayed portion (top = unplayed) */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to bottom, rgba(0,0,0,0.5) ${100 - progress}%, transparent ${100 - progress}%)`,
          }} />
        </div>

        {/* Time */}
        <div className="my-0.5 text-center">
          <span className="text-[9px] text-gray-500 font-mono block leading-tight">{formatTime(currentTime)}</span>
          <span className="text-[8px] text-gray-700 font-mono block leading-tight">{formatTime(duration)}</span>
        </div>

        {/* Vertical controls */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={toggleShuffle} className={`p-1.5 rounded-lg transition-colors ${isShuffled ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300'}`} title="Shuffle">
            <Shuffle size={14} />
          </button>
          <button onClick={playPrevious} className="text-gray-500 hover:text-gray-200 p-1.5 transition-colors" title="Previous">
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #22d3ee)',
              boxShadow: isPlaying ? '0 0 16px rgba(34,211,238,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {isPlaying ? <Pause size={16} className="text-gray-900" fill="currentColor" /> : <Play size={16} className="text-gray-900 ml-0.5" fill="currentColor" />}
          </button>
          <button onClick={playNext} className="text-gray-500 hover:text-gray-200 p-1.5 transition-colors" title="Next">
            <SkipForward size={16} />
          </button>
          <button onClick={toggleLoop} className={`p-1.5 rounded-lg transition-colors ${isLooping ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300'}`} title="Loop">
            <Repeat size={14} />
          </button>
        </div>

        {/* Volume - vertical */}
        <div className="flex flex-col items-center gap-0.5 mt-1 mb-1">
          <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-gray-500 hover:text-gray-300 p-0.5">
            {volume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          <div className="w-1 h-8 bg-white/[0.06] rounded-full relative cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
              setVolume(pct)
            }}
          >
            <div className="absolute bottom-0 left-0 w-full rounded-full bg-teal-500/50 transition-all"
              style={{ height: `${volume * 100}%` }} />
          </div>
        </div>
      </div>
    )
  }

  // ──── EXPANDED MODE (544px, wide player + 2×2 explore grid) ───
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div
      className="fixed top-0 right-0 h-screen w-[544px] z-40 flex flex-col transition-all duration-300"
      style={{
        background: 'linear-gradient(180deg, #0d0d10 0%, #08080b 100%)',
        borderLeft: '1px solid rgba(34, 211, 238, 0.06)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
      }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-[10px] text-gray-500 font-semibold tracking-widest uppercase">Now Playing</span>
        </div>
        <button onClick={() => setExpanded(false)} className="p-1.5 text-gray-600 hover:text-teal-400 hover:bg-white/5 rounded-lg transition-colors" title="Collapse">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ─── Now Playing Section ─── */}
      <div className="flex gap-4 px-5 pt-4 pb-2 flex-shrink-0">
        {/* Album art with progress ring */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
              className="transition-all duration-200" />
          </svg>
          <div className="absolute inset-[5px] rounded-xl overflow-hidden ring-1 ring-white/[0.08]">
            {currentTrack.imageUrl ? (
              <Image src={currentTrack.imageUrl} alt={currentTrack.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-800/80 flex items-center justify-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>
          {isPlaying && <div className="absolute inset-[5px] rounded-xl ring-1 ring-teal-500/20 animate-pulse" />}
        </div>

        {/* Track info + quick actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-gray-100 font-bold text-sm truncate leading-tight">{currentTrack.title}</p>
          {currentTrack.artist && <p className="text-gray-500 text-xs truncate mt-0.5">{currentTrack.artist}</p>}
          <div className="flex items-center gap-2 mt-2.5">
            {/* Like */}
            <button onClick={() => setLiked(!liked)}
              className={`p-1.5 rounded-lg transition-all ${liked ? 'text-pink-400 bg-pink-500/10' : 'text-gray-600 hover:text-pink-400'}`}
              title="Like">
              <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            </button>
            {/* Queue current */}
            <button onClick={() => addToPlaylist(currentTrack)}
              className="p-1.5 rounded-lg text-gray-600 hover:text-teal-400 transition-all" title="Add to queue">
              <List size={14} />
            </button>
            {/* Speed */}
            <div className="relative">
              <button onClick={() => setShowSpeed(!showSpeed)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${playbackRate !== 1 ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'}`}
                title="Playback speed">
                {playbackRate}×
              </button>
              {showSpeed && (
                <div className="absolute bottom-full left-0 mb-1 bg-gray-900 border border-white/10 rounded-lg p-1 flex gap-0.5 shadow-xl z-10">
                  {speeds.map(s => (
                    <button key={s} onClick={() => { setPlaybackRate(s); setShowSpeed(false) }}
                      className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${s === playbackRate ? 'text-teal-400 bg-teal-500/10' : 'text-gray-500 hover:text-gray-200'}`}>
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* BPM indicator */}
            <div className="flex items-center gap-1 ml-auto">
              <Zap size={10} className="text-teal-500/50" />
              <span className="text-[9px] text-gray-600 font-mono">HQ</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Horizontal Waveform ─── */}
      <div className="px-5 pb-1 flex-shrink-0">
        <div className="w-full h-14 relative rounded-lg overflow-hidden cursor-pointer" onClick={handleHorizontalSeek}>
          <HorizontalWaveform audioElement={audioEl} isPlaying={isPlaying} progress={progress} />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-gray-600 font-mono">{formatTime(currentTime)}</span>
          <span className="text-[9px] text-gray-600 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* ─── Transport Controls ─── */}
      <div className="px-5 py-1.5 flex items-center justify-center gap-5 flex-shrink-0">
        <button onClick={toggleShuffle} className={`transition-colors ${isShuffled ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`} title="Shuffle (Shift+←→)">
          <Shuffle size={14} />
        </button>
        <button onClick={playPrevious} className="text-gray-400 hover:text-gray-200 transition-colors" title="Previous">
          <SkipBack size={18} />
        </button>
        <button
          onClick={togglePlayPause}
          className="w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all"
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #22d3ee)',
            boxShadow: isPlaying ? '0 0 20px rgba(34,211,238,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
          }}
          title="Play/Pause (Space)"
        >
          {isPlaying ? <Pause size={18} className="text-gray-900" fill="currentColor" /> : <Play size={18} className="text-gray-900 ml-0.5" fill="currentColor" />}
        </button>
        <button onClick={playNext} className="text-gray-400 hover:text-gray-200 transition-colors" title="Next">
          <SkipForward size={18} />
        </button>
        <button onClick={toggleLoop} className={`transition-colors ${isLooping ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`} title="Loop">
          <Repeat size={14} />
        </button>
      </div>

      {/* ─── Volume ─── */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-shrink-0">
        <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-gray-600 hover:text-gray-300">
          {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
        <div className="flex-1 h-[3px] bg-white/[0.06] rounded-full relative cursor-pointer group/vol"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setVolume(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
          }}
        >
          <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all" style={{ width: `${volume * 100}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-teal-400 opacity-0 group-hover/vol:opacity-100 transition-opacity"
            style={{ left: `calc(${volume * 100}% - 4px)`, boxShadow: '0 0 6px rgba(34,211,238,0.5)' }} />
        </div>
        <span className="text-[9px] text-gray-700 font-mono w-6 text-right">{Math.round(volume * 100)}</span>
      </div>

      {/* ─── Queue (collapsible) ─── */}
      <div className="px-4 flex-shrink-0">
        <button onClick={() => setShowQueue(!showQueue)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-colors"
        >
          <span className="flex items-center gap-1.5 font-semibold tracking-widest uppercase">
            <List size={11} /> Queue
            {playlist.length > 0 && <span className="text-[8px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-full">{playlist.length}</span>}
          </span>
          {showQueue ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showQueue && (
        <div className="px-3 max-h-28 overflow-y-auto flex-shrink-0 scrollbar-hide border-b border-white/[0.04] mb-1">
          {playlist.length === 0 ? (
            <div className="py-3 text-center text-gray-700 text-[9px]">Queue empty</div>
          ) : playlist.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id
            return (
              <div key={`${track.id}-${i}`} className={`flex items-center gap-2 px-2 py-1 rounded-lg mb-0.5 ${isCurrent ? 'bg-teal-500/[0.06] border-l-2 border-teal-400' : 'hover:bg-white/[0.02] border-l-2 border-transparent'}`}>
                <button onClick={() => playTrack(track)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className="text-[8px] text-gray-700 w-3 font-mono">{i + 1}</span>
                  {track.imageUrl && <Image src={track.imageUrl} alt={track.title} width={20} height={20} className="w-5 h-5 rounded object-cover ring-1 ring-white/5" />}
                  <p className={`text-[10px] truncate flex-1 ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-400'}`}>{track.title}</p>
                  {isCurrent && isPlaying && (
                    <div className="flex gap-[2px]">
                      <div className="w-[2px] h-2 bg-teal-400 rounded-full animate-pulse" />
                      <div className="w-[2px] h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-[2px] h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}
                </button>
                <button onClick={() => removeFromPlaylist(track.id)} className="text-gray-700 hover:text-red-400 p-0.5"><X size={10} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── EXPLORE — 2×2 GRID ─── */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-white/[0.04]">
        {/* Search bar */}
        <div className="px-4 py-2 flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={exploreSearch}
              onChange={(e) => setExploreSearch(e.target.value)}
              placeholder="Search songs, artists, genres..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-700 focus:outline-none focus:border-teal-500/30 transition-colors"
            />
          </div>
        </div>

        {/* 2×2 Grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
          {exploreLoading ? (
            <div className="py-8 text-center">
              <div className="w-5 h-5 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[10px] text-gray-700">Loading...</p>
            </div>
          ) : filteredExplore.length === 0 ? (
            <div className="py-8 text-center">
              <Search size={18} className="mx-auto mb-2 text-gray-800" />
              <p className="text-[11px] text-gray-700">{exploreSearch ? 'No matches' : 'No tracks'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredExplore.slice(0, 60).map((song) => {
                const isCurrent = currentTrack?.id === song.id
                const imgUrl = song.imageUrl || song.image_url
                return (
                  <div
                    key={song.id}
                    className={`group/card relative rounded-xl overflow-hidden transition-all cursor-pointer ${
                      isCurrent ? 'ring-1 ring-teal-500/30 bg-teal-500/[0.06]' : 'hover:bg-white/[0.03] ring-1 ring-white/[0.04] hover:ring-white/[0.08]'
                    }`}
                  >
                    <button onClick={() => playExploreTrack(song)} className="w-full text-left">
                      {/* Cover */}
                      <div className="aspect-square relative overflow-hidden">
                        {imgUrl ? (
                          <Image src={imgUrl} alt={song.title} fill className="object-cover group-hover/card:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-800/60 to-gray-900/80 flex items-center justify-center">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.2)" strokeWidth="1.5">
                              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                            </svg>
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/40 transition-all flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-teal-500/90 flex items-center justify-center opacity-0 group-hover/card:opacity-100 scale-75 group-hover/card:scale-100 transition-all shadow-lg shadow-teal-500/20">
                            {isCurrent && isPlaying ? (
                              <Pause size={14} className="text-gray-900" fill="currentColor" />
                            ) : (
                              <Play size={14} className="text-gray-900 ml-0.5" fill="currentColor" />
                            )}
                          </div>
                        </div>
                        {/* Now playing indicator */}
                        {isCurrent && isPlaying && (
                          <div className="absolute bottom-1 left-1 flex gap-[2px]">
                            <div className="w-[2px] h-3 bg-teal-400 rounded-full animate-pulse" />
                            <div className="w-[2px] h-3 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                            <div className="w-[2px] h-3 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="px-2 py-1.5">
                        <p className={`text-[10px] truncate leading-tight font-medium ${isCurrent ? 'text-teal-400' : 'text-gray-300'}`}>{song.title}</p>
                        <p className="text-[8px] text-gray-600 truncate mt-0.5">{song.users?.username || song.username || 'Unknown'}</p>
                      </div>
                    </button>
                    {/* Queue button — appears on hover */}
                    <button
                      onClick={(e) => queueExploreTrack(e, song)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-gray-400 hover:text-teal-400 opacity-0 group-hover/card:opacity-100 transition-all backdrop-blur-sm"
                      title="Add to queue"
                    >
                      <List size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
