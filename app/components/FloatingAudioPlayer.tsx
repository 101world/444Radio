'use client'

import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronRight, X, Repeat, Shuffle, ChevronDown, ChevronUp, Search, List, Heart, Zap, Music, Disc3 } from 'lucide-react'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.82
        try {
          const source = ctx.createMediaElementSource(audioElement)
          source.connect(analyser)
          analyser.connect(ctx.destination)
        } catch {
          // Already connected
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
      const gap = 1.5
      const barW = Math.max(1, (W - gap * (barCount - 1)) / barCount)
      const midY = H / 2

      for (let i = 0; i < barCount; i++) {
        const v = data[i] / 255
        const barH = Math.max(2, v * midY * 0.9)
        const x = i * (barW + gap)
        const pct = (i / barCount) * 100

        if (pct <= progress) {
          c.fillStyle = `rgba(34, 211, 238, ${0.5 + v * 0.5})`
          c.shadowColor = 'rgba(34, 211, 238, 0.3)'
          c.shadowBlur = v * 4
        } else {
          c.fillStyle = `rgba(255, 255, 255, ${0.06 + v * 0.12})`
          c.shadowBlur = 0
        }

        const r = Math.max(0, Math.min(barW / 2, 1.5))
        c.beginPath()
        c.roundRect(x, midY - barH, barW, barH, r)
        c.fill()
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
  likes?: number
  genre: string | null
  mood: string | null
  bpm: number | null
  tags: string[] | null
  description: string | null
  created_at?: string
  users?: { username: string }
  username?: string
}

// ─── Filter chips ───────────────────────────────────────────────
const GENRE_FILTERS = ['All', 'Lofi', 'Hip Hop', 'Jazz', 'R&B', 'Techno', 'Chill', 'Electronic', 'Ambient', 'Pop', 'Rock']
const MOOD_FILTERS = ['All Vibes', 'Chill', 'Energetic', 'Sad', 'Happy', 'Dark', 'Dreamy', 'Aggressive', 'Romantic', 'Nostalgic']

// Map display labels → all DB genre strings that should match
const GENRE_ALIASES: Record<string, string[]> = {
  'Lofi':       ['lofi', 'lo-fi', 'lo fi'],
  'Hip Hop':    ['hiphop', 'hip-hop', 'hip hop', 'rap'],
  'Jazz':       ['jazz'],
  'R&B':        ['rnb', 'r&b', 'r and b', 'r+b'],
  'Techno':     ['techno'],
  'Chill':      ['chill'],
  'Electronic': ['electronic', 'edm', 'electro'],
  'Ambient':    ['ambient'],
  'Pop':        ['pop'],
  'Rock':       ['rock'],
}

function matchesGenre(genre: string | null | undefined, filterLabel: string): boolean {
  if (filterLabel === 'All') return true
  const g = (genre || '').toLowerCase().trim()
  const aliases = GENRE_ALIASES[filterLabel]
  if (!aliases) return g.includes(filterLabel.toLowerCase())
  return aliases.some(alias => g === alias || g.includes(alias))
}

function matchesMood(mood: string | null | undefined, filterLabel: string): boolean {
  if (filterLabel === 'All Vibes') return true
  const m = (mood || '').toLowerCase().trim()
  return m.includes(filterLabel.toLowerCase())
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

  // Explore state
  const [exploreSongs, setExploreSongs] = useState<ExploreMedia[]>([])
  const [exploreSearch, setExploreSearch] = useState('')
  const [exploreLoading, setExploreLoading] = useState(false)
  const [exploreFetched, setExploreFetched] = useState(false)
  const [activeGenre, setActiveGenre] = useState('All')
  const [activeMood, setActiveMood] = useState('All Vibes')
  const [gridCols, setGridCols] = useState<2 | 3>(2)

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

  useEffect(() => {
    if (expanded && !exploreFetched) {
      setExploreLoading(true)
      fetch('/api/media/explore?limit=200')
        .then(r => r.json())
        .then(data => {
          if (data.combinedMedia) setExploreSongs(data.combinedMedia)
          setExploreFetched(true)
        })
        .catch(() => {})
        .finally(() => setExploreLoading(false))
    }
  }, [expanded, exploreFetched])

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

  useEffect(() => {
    const el = getAudioElement()
    if (el) el.playbackRate = playbackRate
  }, [playbackRate, getAudioElement, currentTrack])

  useEffect(() => { setLiked(false) }, [currentTrack?.id])

  const formatTime = useCallback((t: number) => {
    if (isNaN(t)) return '0:00'
    return `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`
  }, [])

  const progress = duration ? (currentTime / duration) * 100 : 0

  const handleVerticalSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
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
    playTrack(toTrack(song))
  }

  const queueExploreTrack = (e: React.MouseEvent, song: ExploreMedia) => {
    e.stopPropagation()
    addToPlaylist(toTrack(song))
  }

  // Smart filtering: text + genre + mood
  const filteredExplore = useMemo(() => {
    return exploreSongs.filter(s => {
      if (!matchesGenre(s.genre, activeGenre)) return false
      if (!matchesMood(s.mood, activeMood)) return false
      if (exploreSearch.trim()) {
        const q = exploreSearch.toLowerCase()
        const searchable = [
          s.title, s.genre, s.mood, s.description,
          s.users?.username || s.username || '',
          s.bpm ? `${s.bpm} bpm` : '',
          ...(s.tags || []),
        ].join(' ').toLowerCase()
        return searchable.includes(q)
      }
      return true
    })
  }, [exploreSongs, exploreSearch, activeGenre, activeMood])

  if (!currentTrack) return null

  // ═══════════════════════════════════════════════════════════════
  // MOBILE — top-docked bar
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50" style={{
        background: 'linear-gradient(180deg, rgba(13,13,16,0.98) 0%, rgba(8,8,11,0.99) 100%)',
        borderBottom: '1px solid rgba(34, 211, 238, 0.08)',
        boxShadow: '0 4px 30px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(20px)',
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
                <Music size={18} className="text-teal-500/50" />
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
  // DESKTOP — Right-docked sidebar
  // ═══════════════════════════════════════════════════════════════

  // ──── THIN MODE (104px, modern glassmorphic) ────────────────
  if (!expanded) {
    return (
      <div
        className="fixed top-0 right-0 h-screen w-[104px] z-40 flex flex-col items-center py-2 transition-all duration-300 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(8,8,12,0.95) 0%, rgba(4,4,8,0.98) 100%)',
          borderLeft: '1px solid rgba(34, 211, 238, 0.06)',
          boxShadow: '-4px 0 30px rgba(0,0,0,0.5), -1px 0 10px rgba(34,211,238,0.02)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Accent glow line at top */}
        <div className="w-full h-[1px] flex-shrink-0 mb-2" style={{
          background: isPlaying
            ? 'linear-gradient(90deg, transparent, rgba(34,211,238,0.3) 50%, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(34,211,238,0.08) 50%, transparent)',
        }} />
        {/* Album art — click to expand */}
        <div className="mb-3 cursor-pointer group/art" onClick={() => setExpanded(true)} title="Expand player">
          <div className="relative">
            {currentTrack.imageUrl ? (
              <Image src={currentTrack.imageUrl} alt={currentTrack.title} width={72} height={72}
                className="w-[72px] h-[72px] rounded-2xl object-cover ring-1 ring-white/[0.08] shadow-xl shadow-black/60 group-hover/art:ring-teal-500/30 group-hover/art:shadow-teal-500/10 transition-all duration-300" />
            ) : (
              <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900 flex items-center justify-center ring-1 ring-white/[0.08] group-hover/art:ring-teal-500/30 transition-all">
                <Music size={24} className="text-teal-500/40" />
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover/art:bg-black/30 flex items-center justify-center transition-all">
              <ChevronRight size={18} className="text-white opacity-0 group-hover/art:opacity-80 transition-all" />
            </div>
            {isPlaying && (
              <div className="absolute -inset-1 rounded-2xl opacity-40 animate-pulse pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)' }} />
            )}
          </div>
          <p className="text-[8px] text-gray-500 text-center mt-1.5 px-1 truncate w-[80px] mx-auto leading-tight">{currentTrack.title}</p>
        </div>

        {/* Vertical waveform */}
        <div className="flex-1 w-[72px] min-h-[80px] relative overflow-hidden rounded-xl mx-auto cursor-pointer ring-1 ring-white/[0.04]" onClick={handleVerticalSeek}
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          <VerticalWaveform audioElement={audioEl} isPlaying={isPlaying} />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `linear-gradient(to bottom, rgba(0,0,0,0.45) ${100 - progress}%, transparent ${100 - progress}%)`,
          }} />
        </div>

        {/* Time */}
        <div className="my-1 text-center">
          <span className="text-[10px] text-gray-400 font-mono block leading-tight tracking-wide">{formatTime(currentTime)}</span>
          <span className="text-[8px] text-gray-700 font-mono block leading-tight">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-0.5">
          <button onClick={toggleShuffle} className={`p-2 rounded-xl transition-all ${isShuffled ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'}`} title="Shuffle">
            <Shuffle size={13} />
          </button>
          <button onClick={playPrevious} className="text-gray-500 hover:text-gray-200 p-2 rounded-xl hover:bg-white/[0.04] transition-all" title="Previous">
            <SkipBack size={15} />
          </button>
          <button
            onClick={togglePlayPause}
            className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all my-0.5"
            style={{
              background: 'linear-gradient(135deg, #0d9488, #22d3ee)',
              boxShadow: isPlaying ? '0 0 24px rgba(34,211,238,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' : '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            {isPlaying ? <Pause size={17} className="text-white" fill="currentColor" /> : <Play size={17} className="text-white ml-0.5" fill="currentColor" />}
          </button>
          <button onClick={playNext} className="text-gray-500 hover:text-gray-200 p-2 rounded-xl hover:bg-white/[0.04] transition-all" title="Next">
            <SkipForward size={15} />
          </button>
          <button onClick={toggleLoop} className={`p-2 rounded-xl transition-all ${isLooping ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'}`} title="Loop">
            <Repeat size={13} />
          </button>
        </div>

        {/* Volume — modern vertical slider */}
        <div className="flex flex-col items-center gap-1 mt-2 mb-2">
          <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-gray-500 hover:text-teal-400 p-1 transition-colors">
            {volume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <div className="w-[6px] h-16 bg-white/[0.06] rounded-full relative cursor-pointer group/vol overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const pct = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
              setVolume(pct)
            }}
          >
            <div className="absolute bottom-0 left-0 w-full rounded-full transition-all duration-200"
              style={{
                height: `${volume * 100}%`,
                background: 'linear-gradient(to top, rgba(34,211,238,0.7), rgba(20,184,166,0.5))',
                boxShadow: '0 0 8px rgba(34,211,238,0.3)',
              }}
            />
            <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-teal-400 shadow-lg shadow-teal-500/30 transition-all duration-200 opacity-0 group-hover/vol:opacity-100"
              style={{ bottom: `calc(${volume * 100}% - 6px)` }}
            />
          </div>
          <span className="text-[8px] text-gray-600 font-mono">{Math.round(volume * 100)}</span>
        </div>
      </div>
    )
  }

  // ──── EXPANDED MODE (620px, HD modern) ─────────────────────
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div
      className="fixed top-0 right-0 h-screen w-[620px] z-40 flex flex-col transition-all duration-300"
      style={{
        background: 'linear-gradient(180deg, rgba(8,8,12,0.98) 0%, rgba(4,4,8,0.99) 100%)',
        borderLeft: '1px solid rgba(34, 211, 238, 0.06)',
        boxShadow: '-12px 0 80px rgba(0,0,0,0.8), -2px 0 20px rgba(34,211,238,0.03)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
    >
      {/* Accent glow line at top */}
      <div className="h-[1px] w-full flex-shrink-0" style={{
        background: isPlaying
          ? 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4) 30%, rgba(20,184,166,0.5) 50%, rgba(34,211,238,0.4) 70%, transparent)'
          : 'linear-gradient(90deg, transparent, rgba(34,211,238,0.1) 50%, transparent)',
      }} />

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-white/[0.03] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            {isPlaying && <div className="absolute inset-0 w-2 h-2 rounded-full bg-teal-500 animate-ping opacity-40" />}
          </div>
          <span className="text-[11px] text-gray-400 font-medium tracking-widest uppercase">Now Playing</span>
        </div>
        <button onClick={() => setExpanded(false)} className="p-2 text-gray-600 hover:text-teal-400 hover:bg-white/[0.04] rounded-xl transition-all group/collapse" title="Collapse">
          <ChevronRight size={16} className="group-hover/collapse:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ─── Now Playing ─── */}
      <div className="flex gap-5 px-6 pt-5 pb-3 flex-shrink-0">
        {/* Album art with progress ring */}
        <div className="relative w-32 h-32 flex-shrink-0">
          {/* Ambient glow behind art */}
          {isPlaying && (
            <div className="absolute -inset-3 rounded-3xl opacity-30 blur-xl pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.2) 0%, rgba(20,184,166,0.1) 50%, transparent 70%)' }} />
          )}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="url(#progressGrad)" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 46}`}
              strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress / 100)}`}
              className="transition-all duration-200" />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(20,184,166,0.8)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0.6)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-[6px] rounded-2xl overflow-hidden ring-1 ring-white/[0.06]">
            {currentTrack.imageUrl ? (
              <Image src={currentTrack.imageUrl} alt={currentTrack.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800/80 to-gray-900 flex items-center justify-center">
                <Disc3 size={40} className="text-teal-500/20" />
              </div>
            )}
          </div>
          {isPlaying && (
            <div className="absolute inset-[6px] rounded-2xl pointer-events-none"
              style={{ boxShadow: 'inset 0 0 20px rgba(34,211,238,0.06)' }} />
          )}
        </div>

        {/* Track info + quick actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-gray-100 font-bold text-[15px] truncate leading-tight tracking-tight">{currentTrack.title}</p>
          {currentTrack.artist && <p className="text-gray-500 text-[13px] truncate mt-1">{currentTrack.artist}</p>}
          {/* Genre / Mood / Tags chips */}
          {(currentTrack.genre || currentTrack.mood || (currentTrack.tags && currentTrack.tags.length > 0)) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {currentTrack.genre && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/15 font-medium">{currentTrack.genre}</span>
              )}
              {currentTrack.mood && (
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/15 font-medium">{currentTrack.mood}</span>
              )}
              {currentTrack.tags?.map((tag, i) => (
                <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-500 border border-white/[0.06] font-medium">{tag}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-3">
            <button onClick={() => setLiked(!liked)}
              className={`p-2 rounded-xl transition-all ${liked ? 'text-pink-400 bg-pink-500/10 shadow-sm shadow-pink-500/10' : 'text-gray-600 hover:text-pink-400 hover:bg-white/[0.04]'}`}
              title="Like">
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => addToPlaylist(currentTrack)}
              className="p-2 rounded-xl text-gray-600 hover:text-teal-400 hover:bg-white/[0.04] transition-all" title="Add to queue">
              <List size={15} />
            </button>
            <div className="relative">
              <button onClick={() => setShowSpeed(!showSpeed)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-medium transition-all ${playbackRate !== 1 ? 'text-teal-400 bg-teal-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'}`}
                title="Playback speed">
                {playbackRate}×
              </button>
              {showSpeed && (
                <div className="absolute bottom-full left-0 mb-2 bg-gray-900/95 border border-white/[0.08] rounded-2xl p-1.5 flex gap-1 shadow-2xl z-10 backdrop-blur-xl">
                  {speeds.map(s => (
                    <button key={s} onClick={() => { setPlaybackRate(s); setShowSpeed(false) }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono transition-all ${s === playbackRate ? 'text-teal-400 bg-teal-500/10' : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'}`}>
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 ml-auto px-2 py-1 rounded-lg bg-teal-500/[0.06] border border-teal-500/10">
              <Zap size={10} className="text-teal-500/60" />
              <span className="text-[9px] text-teal-500/60 font-semibold tracking-wider">HQ</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Horizontal Waveform ─── */}
      <div className="px-6 pb-1 flex-shrink-0">
        <div className="w-full h-16 relative rounded-xl overflow-hidden cursor-pointer ring-1 ring-white/[0.04]" onClick={handleHorizontalSeek}
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 100%)' }}
        >
          <HorizontalWaveform audioElement={audioEl} isPlaying={isPlaying} progress={progress} />
          {/* Subtle scan-line overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
          }} />
        </div>
        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[10px] text-gray-500 font-mono">{formatTime(currentTime)}</span>
          <span className="text-[10px] text-gray-500 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* ─── Transport Controls ─── */}
      <div className="px-6 py-3 flex items-center justify-center gap-6 flex-shrink-0">
        <button onClick={toggleShuffle} className={`p-2 rounded-xl transition-all ${isShuffled ? 'text-teal-400 bg-teal-500/10 shadow-sm shadow-teal-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'}`} title="Shuffle">
          <Shuffle size={15} />
        </button>
        <button onClick={playPrevious} className="text-gray-400 hover:text-gray-200 p-1.5 rounded-xl hover:bg-white/[0.04] transition-all" title="Previous">
          <SkipBack size={20} />
        </button>
        <button
          onClick={togglePlayPause}
          className="w-16 h-16 rounded-[22px] flex items-center justify-center active:scale-95 transition-all relative"
          style={{
            background: 'linear-gradient(135deg, #0d9488, #22d3ee)',
            boxShadow: isPlaying
              ? '0 0 40px rgba(34,211,238,0.25), 0 0 80px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
          title="Play/Pause (Space)"
        >
          {isPlaying ? <Pause size={22} className="text-white" fill="currentColor" /> : <Play size={22} className="text-white ml-0.5" fill="currentColor" />}
        </button>
        <button onClick={playNext} className="text-gray-400 hover:text-gray-200 p-1.5 rounded-xl hover:bg-white/[0.04] transition-all" title="Next">
          <SkipForward size={20} />
        </button>
        <button onClick={toggleLoop} className={`p-2 rounded-xl transition-all ${isLooping ? 'text-teal-400 bg-teal-500/10 shadow-sm shadow-teal-500/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.04]'}`} title="Loop">
          <Repeat size={15} />
        </button>
      </div>

      {/* ─── Volume — modern horizontal slider ─── */}
      <div className="px-6 pb-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)} className="text-gray-500 hover:text-teal-400 transition-colors">
          {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <div className="flex-1 h-[6px] bg-white/[0.04] rounded-full relative cursor-pointer group/vol overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setVolume(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
          }}
          style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}
        >
          <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-150"
            style={{
              width: `${volume * 100}%`,
              background: 'linear-gradient(90deg, rgba(20,184,166,0.6), rgba(34,211,238,0.8))',
              boxShadow: '0 0 10px rgba(34,211,238,0.2)',
            }}
          />
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all duration-150 opacity-0 group-hover/vol:opacity-100"
            style={{
              left: `calc(${volume * 100}% - 8px)`,
              background: 'linear-gradient(135deg, #14b8a6, #22d3ee)',
              boxShadow: '0 0 10px rgba(34,211,238,0.4), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          />
        </div>
        <span className="text-[10px] text-gray-600 font-mono w-8 text-right tabular-nums">{Math.round(volume * 100)}%</span>
      </div>

      {/* ─── Queue (collapsible) ─── */}
      <div className="px-5 flex-shrink-0">
        <button onClick={() => setShowQueue(!showQueue)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-all"
        >
          <span className="flex items-center gap-2 font-semibold tracking-widest uppercase">
            <List size={12} /> Queue
            {playlist.length > 0 && (
              <span className="text-[9px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-bold">{playlist.length}</span>
            )}
          </span>
          {showQueue ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showQueue && (
        <div className="px-4 max-h-32 overflow-y-auto flex-shrink-0 scrollbar-hide border-b border-white/[0.03] mb-1">
          {playlist.length === 0 ? (
            <div className="py-4 text-center text-gray-700 text-[10px]">Queue empty — add tracks below</div>
          ) : playlist.map((track, i) => {
            const isCurrent = currentTrack?.id === track.id
            return (
              <div key={`${track.id}-${i}`} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-0.5 transition-all ${isCurrent ? 'bg-teal-500/[0.06] border-l-2 border-teal-400' : 'hover:bg-white/[0.02] border-l-2 border-transparent'}`}>
                <button onClick={() => playTrack(track)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                  <span className="text-[9px] text-gray-700 w-4 font-mono">{i + 1}</span>
                  {track.imageUrl && <Image src={track.imageUrl} alt={track.title} width={24} height={24} className="w-6 h-6 rounded-lg object-cover ring-1 ring-white/5" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] truncate ${isCurrent ? 'text-teal-400 font-semibold' : 'text-gray-400'}`}>{track.title}</p>
                    {track.artist && <p className="text-[8px] text-gray-700 truncate">{track.artist}</p>}
                  </div>
                  {isCurrent && isPlaying && (
                    <div className="flex gap-[2px]">
                      <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" />
                      <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-[2px] h-2.5 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  )}
                </button>
                <button onClick={() => removeFromPlaylist(track.id)} className="text-gray-700 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/5 transition-all"><X size={11} /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          EXPLORE — Smart search + filter chips + grid toggle
         ═══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-white/[0.03]">
        {/* Search */}
        <div className="px-5 pt-3 pb-1 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              type="text"
              value={exploreSearch}
              onChange={(e) => setExploreSearch(e.target.value)}
              placeholder="Search title, artist, genre, mood, BPM, tags..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2 text-[12px] text-gray-300 placeholder-gray-700 focus:outline-none focus:border-teal-500/25 focus:bg-white/[0.04] transition-all"
              style={{ backdropFilter: 'blur(10px)' }}
            />
          </div>
        </div>

        {/* Genre chips */}
        <div className="px-5 py-1.5 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {GENRE_FILTERS.map(g => {
              const isActive = activeGenre === g
              const count = g === 'All'
                ? exploreSongs.length
                : exploreSongs.filter(s => matchesGenre(s.genre, g)).length
              return (
                <button
                  key={g}
                  onClick={() => setActiveGenre(g)}
                  className={`flex-shrink-0 px-3 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20 shadow-sm shadow-teal-500/10'
                      : 'bg-white/[0.02] text-gray-600 border border-white/[0.04] hover:text-gray-400 hover:border-white/[0.08]'
                  }`}
                >
                  {g}
                  {count > 0 && <span className={`ml-1 text-[8px] ${isActive ? 'text-teal-500/70' : 'text-gray-700'}`}>{count}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mood/Vibe chips */}
        <div className="px-5 pb-1 flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {MOOD_FILTERS.map(m => {
              const isActive = activeMood === m
              return (
                <button
                  key={m}
                  onClick={() => setActiveMood(m)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                      : 'bg-white/[0.01] text-gray-700 border border-white/[0.03] hover:text-gray-500 hover:border-white/[0.06]'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>

        {/* Grid controls + result count */}
        <div className="px-5 pb-1 flex items-center justify-between flex-shrink-0">
          <span className="text-[9px] text-gray-700 font-mono">
            {filteredExplore.length} track{filteredExplore.length !== 1 ? 's' : ''}
            {(activeGenre !== 'All' || activeMood !== 'All Vibes' || exploreSearch) && ' filtered'}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setGridCols(2)}
              className={`p-1 rounded-lg transition-all ${gridCols === 2 ? 'text-teal-400 bg-teal-500/10' : 'text-gray-700 hover:text-gray-500'}`} title="2 columns">
              <div className="grid grid-cols-2 gap-[2px] w-3 h-3">
                <div className="bg-current rounded-[1px]" /><div className="bg-current rounded-[1px]" />
                <div className="bg-current rounded-[1px]" /><div className="bg-current rounded-[1px]" />
              </div>
            </button>
            <button onClick={() => setGridCols(3)}
              className={`p-1 rounded-lg transition-all ${gridCols === 3 ? 'text-teal-400 bg-teal-500/10' : 'text-gray-700 hover:text-gray-500'}`} title="3 columns">
              <div className="grid grid-cols-3 gap-[1.5px] w-3 h-3">
                <div className="bg-current rounded-[0.5px]" /><div className="bg-current rounded-[0.5px]" /><div className="bg-current rounded-[0.5px]" />
                <div className="bg-current rounded-[0.5px]" /><div className="bg-current rounded-[0.5px]" /><div className="bg-current rounded-[0.5px]" />
                <div className="bg-current rounded-[0.5px]" /><div className="bg-current rounded-[0.5px]" /><div className="bg-current rounded-[0.5px]" />
              </div>
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {exploreLoading ? (
            <div className="py-10 text-center">
              <div className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[11px] text-gray-700">Loading tracks...</p>
            </div>
          ) : filteredExplore.length === 0 ? (
            <div className="py-10 text-center">
              <Search size={22} className="mx-auto mb-3 text-gray-800" />
              <p className="text-[12px] text-gray-600 font-medium">{exploreSearch || activeGenre !== 'All' || activeMood !== 'All Vibes' ? 'No matches found' : 'No tracks available'}</p>
              {(activeGenre !== 'All' || activeMood !== 'All Vibes') && (
                <button onClick={() => { setActiveGenre('All'); setActiveMood('All Vibes') }}
                  className="mt-2 text-[10px] text-teal-500 hover:text-teal-400 transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className={`grid gap-2.5 ${gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {filteredExplore.slice(0, 80).map((song) => {
                const isCurrent = currentTrack?.id === song.id
                const imgUrl = song.imageUrl || song.image_url
                const artist = song.users?.username || song.username || 'Unknown'
                return (
                  <div
                    key={song.id}
                    className={`group/card relative rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer ${
                      isCurrent
                        ? 'ring-1 ring-teal-500/30 bg-teal-500/[0.04]'
                        : 'ring-1 ring-white/[0.04] hover:ring-white/[0.1] hover:bg-white/[0.02]'
                    }`}
                  >
                    <button onClick={() => playExploreTrack(song)} className="w-full text-left">
                      <div className="aspect-square relative overflow-hidden">
                        {imgUrl ? (
                          <Image src={imgUrl} alt={song.title} fill className="object-cover group-hover/card:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-800/60 to-gray-900/80 flex items-center justify-center">
                            <Music size={gridCols === 3 ? 18 : 24} className="text-teal-500/15" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/40 transition-all duration-200 flex items-center justify-center">
                          <div className={`${gridCols === 3 ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 scale-75 group-hover/card:scale-100 transition-all duration-200`}
                            style={{
                              background: 'linear-gradient(135deg, rgba(20,184,166,0.9), rgba(34,211,238,0.9))',
                              boxShadow: '0 4px 16px rgba(34,211,238,0.3)',
                            }}>
                            {isCurrent && isPlaying ? (
                              <Pause size={gridCols === 3 ? 12 : 14} className="text-white" fill="currentColor" />
                            ) : (
                              <Play size={gridCols === 3 ? 12 : 14} className="text-white ml-0.5" fill="currentColor" />
                            )}
                          </div>
                        </div>
                        {/* Genre badge */}
                        {song.genre && (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md">
                            <span className="text-[7px] text-gray-300 font-medium uppercase tracking-wider">{song.genre}</span>
                          </div>
                        )}
                        {/* Playing bars */}
                        {isCurrent && isPlaying && (
                          <div className="absolute bottom-1.5 left-1.5 flex gap-[2px] px-1.5 py-1 rounded-md bg-black/50 backdrop-blur-md">
                            <div className="w-[2px] h-3 bg-teal-400 rounded-full animate-pulse" />
                            <div className="w-[2px] h-3 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                            <div className="w-[2px] h-3 bg-teal-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                          </div>
                        )}
                        {/* Plays count */}
                        {song.plays > 0 && (
                          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/50 backdrop-blur-md">
                            <span className="text-[7px] text-gray-400 font-mono">{song.plays > 999 ? `${(song.plays / 1000).toFixed(1)}k` : song.plays} plays</span>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className={`px-2.5 ${gridCols === 3 ? 'py-1.5' : 'py-2'}`}>
                        <p className={`${gridCols === 3 ? 'text-[9px]' : 'text-[11px]'} truncate leading-tight font-medium ${isCurrent ? 'text-teal-400' : 'text-gray-300'}`}>
                          {song.title}
                        </p>
                        <p className={`${gridCols === 3 ? 'text-[7px]' : 'text-[9px]'} text-gray-600 truncate mt-0.5`}>{artist}</p>
                        {gridCols === 2 && (song.mood || song.bpm) && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {song.mood && (
                              <span className="text-[7px] text-purple-400/70 bg-purple-500/[0.08] px-1.5 py-0.5 rounded">{song.mood}</span>
                            )}
                            {song.bpm && (
                              <span className="text-[7px] text-gray-600 font-mono">{song.bpm} BPM</span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                    {/* Queue button */}
                    <button
                      onClick={(e) => queueExploreTrack(e, song)}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-xl bg-black/50 text-gray-400 hover:text-teal-400 opacity-0 group-hover/card:opacity-100 transition-all backdrop-blur-md hover:bg-black/70"
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
