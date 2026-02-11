'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronRight, X, Repeat, Shuffle, ChevronDown, ChevronUp, Search, List } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'

// ─── Vertical Waveform Visualizer ───────────────────────────────
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

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(data)
      } else {
        for (let i = 0; i < bufLen; i++) {
          data[i] = Math.floor(18 + 6 * Math.sin(Date.now() / 700 + i * 0.35))
        }
      }

      // Draw bars top-down in code; canvas is CSS-flipped so it renders bottom-to-top
      const barCount = Math.min(bufLen, 48)
      const gap = 1.5
      const barH = (H - gap * (barCount - 1)) / barCount

      for (let i = 0; i < barCount; i++) {
        const v = data[i] / 255
        const barW = Math.max(2, v * W * 0.85)
        const y = i * (barH + gap)
        const x = (W - barW) / 2

        const alpha = 0.4 + v * 0.6
        c.fillStyle = `rgba(34, 211, 238, ${alpha})`
        c.shadowColor = 'rgba(34, 211, 238, 0.4)'
        c.shadowBlur = v * 5

        const r = Math.min(barH / 2, 1.5)
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
      c.shadowBlur = 0
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioElement, isPlaying])

  return <canvas ref={canvasRef} className="w-full h-full" style={{ transform: 'scaleY(-1)' }} />
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
    playlist, playTrack, removeFromPlaylist,
    isLooping, isShuffled, toggleLoop, toggleShuffle,
    getAudioElement, setPlaylist,
  } = useAudioPlayer()

  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [showQueue, setShowQueue] = useState(false)

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

  const playExploreTrack = (song: ExploreMedia) => {
    const track = {
      id: song.id,
      title: song.title,
      audioUrl: song.audioUrl || song.audio_url,
      imageUrl: song.imageUrl || song.image_url,
      artist: song.users?.username || song.username || 'Unknown',
      userId: song.user_id,
    }
    // Add all filtered explore songs as playlist
    const allTracks = filteredExplore.map(s => ({
      id: s.id,
      title: s.title,
      audioUrl: s.audioUrl || s.audio_url,
      imageUrl: s.imageUrl || s.image_url,
      artist: s.users?.username || s.username || 'Unknown',
      userId: s.user_id,
    }))
    setPlaylist(allTracks)
    playTrack(track)
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
        className="fixed top-0 right-0 h-screen w-20 z-40 flex flex-col items-center py-3 transition-all duration-300 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #111113 0%, #0a0a0c 100%)',
          borderLeft: '1px solid rgba(34, 211, 238, 0.08)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Teal accent line */}
        <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-transparent via-teal-500/20 to-transparent" />

        {/* Album art / music icon */}
        <div className="mb-4 mt-2">
          {currentTrack.imageUrl ? (
            <Image src={currentTrack.imageUrl} alt={currentTrack.title} width={48} height={48}
              className="w-12 h-12 rounded-lg object-cover ring-1 ring-white/10 shadow-lg shadow-black/50" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-800/80 flex items-center justify-center ring-1 ring-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="2">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>

        {/* Vertical waveform — fills all available space */}
        <div className="flex-1 w-14 relative overflow-hidden rounded-lg mx-auto cursor-pointer" onClick={handleVerticalSeek}>
          <VerticalWaveform audioElement={audioEl} isPlaying={isPlaying} />
          {/* Progress overlay — dims unplayed portion (top = unplayed) */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to bottom, rgba(0,0,0,0.5) ${100 - progress}%, transparent ${100 - progress}%)`,
          }} />
        </div>

        {/* Time */}
        <div className="my-1.5 text-center">
          <span className="text-[9px] text-gray-500 font-mono block">{formatTime(currentTime)}</span>
          <span className="text-[8px] text-gray-700 font-mono block">{formatTime(duration)}</span>
        </div>

        {/* Vertical controls */}
        <div className="flex flex-col items-center gap-1.5">
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
        <div className="flex flex-col items-center gap-1 mt-2 mb-1">
          <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-gray-500 hover:text-gray-300 p-1">
            {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <div className="w-1 h-10 bg-white/[0.06] rounded-full relative cursor-pointer"
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

        {/* Expand button — SVG expand icon */}
        <button
          onClick={() => setExpanded(true)}
          className="group mb-2 p-2.5 rounded-xl text-teal-500/70 hover:text-teal-400 hover:bg-teal-500/10 border border-teal-500/10 hover:border-teal-500/30 transition-all"
          title="Expand player & explore"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
    )
  }

  // ──── EXPANDED MODE (340px, Spotify-like vertical player) ───
  return (
    <div
      className="fixed top-0 right-0 h-screen w-[340px] z-40 flex flex-col transition-all duration-300"
      style={{
        background: 'linear-gradient(180deg, #111113 0%, #09090b 100%)',
        borderLeft: '1px solid rgba(34, 211, 238, 0.08)',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.5), 0 0 60px rgba(34,211,238,0.02)',
      }}
    >
      {/* Accent line */}
      <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-transparent via-teal-500/25 to-transparent" />

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-[11px] text-gray-400 font-semibold tracking-wide">NOW PLAYING</span>
        </div>
        <button onClick={() => setExpanded(false)} className="p-1.5 text-gray-500 hover:text-teal-400 hover:bg-white/5 rounded-lg transition-colors" title="Collapse">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ─── Album Art ─── */}
      <div className="px-6 pt-5 pb-3 flex-shrink-0">
        <div className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/60">
          {currentTrack.imageUrl ? (
            <Image src={currentTrack.imageUrl} alt={currentTrack.title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-800/80 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.3)" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 ring-2 ring-teal-500/20 rounded-xl animate-pulse" />
          )}
        </div>
      </div>

      {/* ─── Track Info ─── */}
      <div className="px-6 pb-2 flex-shrink-0">
        <p className="text-gray-100 font-bold text-base truncate">{currentTrack.title}</p>
        {currentTrack.artist && <p className="text-gray-500 text-sm truncate mt-0.5">{currentTrack.artist}</p>}
      </div>

      {/* ─── Waveform + Progress ─── */}
      <div className="px-6 pb-1 flex-shrink-0">
        <div className="w-full h-10 relative rounded-lg overflow-hidden cursor-pointer" onClick={handleHorizontalSeek}>
          <VerticalWaveform audioElement={audioEl} isPlaying={isPlaying} />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to right, transparent ${progress}%, rgba(0,0,0,0.45) ${progress}%)`,
          }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-500 font-mono">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-gray-500 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* ─── Transport Controls ─── */}
      <div className="px-6 py-2 flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={toggleShuffle} className={`transition-colors ${isShuffled ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`}>
          <Shuffle size={15} />
        </button>
        <button onClick={playPrevious} className="text-gray-400 hover:text-gray-200 transition-colors">
          <SkipBack size={19} />
        </button>
        <button
          onClick={togglePlayPause}
          className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all"
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #22d3ee)',
            boxShadow: isPlaying ? '0 0 24px rgba(34,211,238,0.35)' : '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {isPlaying ? <Pause size={20} className="text-gray-900" fill="currentColor" /> : <Play size={20} className="text-gray-900 ml-0.5" fill="currentColor" />}
        </button>
        <button onClick={playNext} className="text-gray-400 hover:text-gray-200 transition-colors">
          <SkipForward size={19} />
        </button>
        <button onClick={toggleLoop} className={`transition-colors ${isLooping ? 'text-teal-400' : 'text-gray-600 hover:text-gray-300'}`}>
          <Repeat size={15} />
        </button>
      </div>

      {/* ─── Volume ─── */}
      <div className="px-6 pb-3 flex items-center gap-2 flex-shrink-0">
        <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-gray-500 hover:text-gray-300">
          {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <div className="flex-1 h-1 bg-white/[0.06] rounded-full relative cursor-pointer group/vol"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setVolume(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
          }}
        >
          <div className="absolute top-0 left-0 h-full rounded-full bg-teal-500/60 transition-all" style={{ width: `${volume * 100}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-teal-400 opacity-0 group-hover/vol:opacity-100 transition-opacity"
            style={{ left: `calc(${volume * 100}% - 5px)`, boxShadow: '0 0 6px rgba(34,211,238,0.5)' }} />
        </div>
        <span className="text-[10px] text-gray-600 font-mono w-7 text-right">{Math.round(volume * 100)}%</span>
      </div>

      {/* ─── Queue (collapsible) ─── */}
      <div className="px-4 flex-shrink-0">
        <button onClick={() => setShowQueue(!showQueue)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-2 font-semibold tracking-wide uppercase">
            <List size={13} /> Queue
            {playlist.length > 0 && <span className="text-[9px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-full">{playlist.length}</span>}
          </span>
          {showQueue ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {showQueue && (
        <div className="px-2 max-h-36 overflow-y-auto flex-shrink-0 scrollbar-hide border-b border-white/5 mb-1">
          {playlist.length === 0 ? (
            <div className="py-4 text-center text-gray-700 text-[10px]">Queue empty</div>
          ) : playlist.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id
            return (
              <div key={`${track.id}-${i}`} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 ${isCurrent ? 'bg-teal-500/[0.08] border-l-2 border-teal-400' : 'hover:bg-white/[0.02] border-l-2 border-transparent'}`}>
                <button onClick={() => playTrack(track)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className="text-[9px] text-gray-600 w-4 font-mono">{i + 1}</span>
                  {track.imageUrl && <Image src={track.imageUrl} alt={track.title} width={24} height={24} className="w-6 h-6 rounded object-cover ring-1 ring-white/5" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] truncate ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-300'}`}>{track.title}</p>
                  </div>
                  {isCurrent && isPlaying && (
                    <div className="flex gap-[2px]">
                      <div className="w-[2px] h-2 bg-teal-400 rounded-full animate-pulse" />
                      <div className="w-[2px] h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-[2px] h-2 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}
                </button>
                <button onClick={() => removeFromPlaylist(track.id)} className="text-gray-700 hover:text-red-400 p-1"><X size={11} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── EXPLORE MINI-BROWSER ─── */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-white/5">
        {/* Search bar */}
        <div className="px-3 py-2 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={exploreSearch}
              onChange={(e) => setExploreSearch(e.target.value)}
              placeholder="Search songs, vibes, artists..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-teal-500/40 transition-colors"
            />
          </div>
        </div>

        {/* Song list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-hide">
          {exploreLoading ? (
            <div className="py-8 text-center">
              <div className="w-5 h-5 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-[10px] text-gray-600">Loading tracks...</p>
            </div>
          ) : filteredExplore.length === 0 ? (
            <div className="py-8 text-center">
              <Search size={20} className="mx-auto mb-2 text-gray-700" />
              <p className="text-xs text-gray-600">{exploreSearch ? 'No matches found' : 'No tracks available'}</p>
            </div>
          ) : (
            filteredExplore.slice(0, 100).map((song) => {
              const isCurrent = currentTrack?.id === song.id
              const imgUrl = song.imageUrl || song.image_url
              return (
                <button
                  key={song.id}
                  onClick={() => playExploreTrack(song)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg mb-0.5 text-left transition-colors ${
                    isCurrent ? 'bg-teal-500/[0.08] border-l-2 border-teal-400' : 'hover:bg-white/[0.03] border-l-2 border-transparent'
                  }`}
                >
                  {/* Thumbnail */}
                  {imgUrl ? (
                    <Image src={imgUrl} alt={song.title} width={36} height={36}
                      className="w-9 h-9 rounded-md object-cover ring-1 ring-white/5 flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-gray-800/60 flex items-center justify-center ring-1 ring-white/5 flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="2">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] truncate leading-tight ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-300'}`}>{song.title}</p>
                    <p className="text-[9px] text-gray-600 truncate">{song.users?.username || song.username || 'Unknown'}</p>
                  </div>
                  {song.genre && (
                    <span className="text-[8px] text-gray-600 bg-white/[0.03] px-1.5 py-0.5 rounded-full flex-shrink-0">{song.genre}</span>
                  )}
                  {isCurrent && isPlaying && (
                    <div className="flex gap-[2px] flex-shrink-0">
                      <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" />
                      <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
