'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Play, Pause, Shuffle, Repeat, Music2, X, Gift, LogIn } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import SEOHeroSection from './components/SEOHeroSection'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useAudioPlayer } from './contexts/AudioPlayerContext'
import { getSharedAnalyser, ensureAudioContextResumed } from '@/lib/shared-audio-analyser'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

// Lazy load heavy 3D components for better performance
const HolographicBackgroundClient = lazy(() => import('./components/HolographicBackgroundClient'))
const FloatingGenres = lazy(() => import('./components/FloatingGenres'))

// ─── Mini Frequency Visualizer for home page player ─────────────
function MiniVisualizer({ audioElement, isPlaying }: { audioElement: HTMLAudioElement | null; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const connectedRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return
    if (connectedRef.current !== audioElement) {
      const analyser = getSharedAnalyser(audioElement, { fftSize: 256, smoothing: 0.7 })
      analyserRef.current = analyser
      connectedRef.current = audioElement
    }

    const canvas = canvasRef.current
    const c = canvas.getContext('2d')
    if (!c) return
    const analyser = analyserRef.current
    const bufLen = analyser ? analyser.frequencyBinCount : 32
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
      else {
        // Idle ambient animation
        for (let i = 0; i < bufLen; i++) data[i] = Math.floor(12 + 8 * Math.sin(Date.now() / 900 + i * 0.4))
      }

      const barCount = Math.min(bufLen, 24)
      const gap = 2
      const barW = Math.max(2, (W - gap * (barCount - 1)) / barCount)

      for (let i = 0; i < barCount; i++) {
        const v = data[i] / 255
        const barH = Math.max(2, v * H * 0.85)
        const x = i * (barW + gap)
        const y = H - barH

        c.fillStyle = `rgba(34, 211, 238, ${0.35 + v * 0.65})`
        c.shadowColor = 'rgba(34, 211, 238, 0.4)'
        c.shadowBlur = v * 6
        const r = Math.min(barW / 2, 2)
        c.beginPath()
        c.roundRect(x, y, barW, barH, [r, r, 0, 0])
        c.fill()
      }
      c.shadowBlur = 0
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [audioElement, isPlaying])

  return <canvas ref={canvasRef} className="w-full h-full" />
}

interface Track {
  id: string
  title: string
  artist: string
  audio_url: string
  image_url?: string
  video_url?: string
  user_id?: string
}

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isSignedIn } = useUser()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [promptText, setPromptText] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [tuneRotation, setTuneRotation] = useState(0)
  const [pulseIntensity, setPulseIntensity] = useState(0)
  const pulseAnalyserRef = useRef<AnalyserNode | null>(null)
  const pulseRafRef = useRef<number>(0)
  const pulseConnectedRef = useRef<HTMLAudioElement | null>(null)
  const volumeKnobRef = useRef<HTMLDivElement>(null)
  const tuneKnobRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef(0)
  const { 
    setPlaylist, 
    playTrack, 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    isShuffled, 
    isLooping, 
    toggleShuffle, 
    toggleLoop,
    currentTime,
    duration,
    playNext,
    playPrevious,
    getAudioElement,
    volume,
    setVolume
  } = useAudioPlayer()
  volumeRef.current = volume

  // Track the audio element for the visualizer
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  useEffect(() => {
    const el = getAudioElement()
    if (el) setAudioEl(el)
    const timer = setInterval(() => {
      const e = getAudioElement()
      if (e && e !== audioEl) setAudioEl(e)
    }, 500)
    return () => clearInterval(timer)
  }, [currentTrack, getAudioElement, audioEl])

  // Audio-reactive pulse: read amplitude and drive border/glow colors
  useEffect(() => {
    if (!audioEl) return
    if (pulseConnectedRef.current !== audioEl) {
      pulseAnalyserRef.current = getSharedAnalyser(audioEl, { fftSize: 256, smoothing: 0.8 })
      pulseConnectedRef.current = audioEl
    }
    const analyser = pulseAnalyserRef.current
    if (!analyser) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(dataArray)
      // Average of low-mid frequencies (bass/kick driven)
      let sum = 0
      const count = Math.min(32, dataArray.length)
      for (let i = 0; i < count; i++) sum += dataArray[i]
      const avg = sum / count / 255 // 0-1
      setPulseIntensity(avg)
      pulseRafRef.current = requestAnimationFrame(tick)
    }
    if (isPlaying) {
      pulseRafRef.current = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(pulseRafRef.current)
  }, [audioEl, isPlaying])

  // When playing: use audio-reactive colors; when paused: fall back to CSS keyframe animation
  const useAudioPulse = isPlaying && pulseIntensity > 0.01
  const pulseBorderColor = useAudioPulse ? `rgba(${Math.round(6 + pulseIntensity * 233)}, ${Math.round(182 - pulseIntensity * 114)}, ${Math.round(212 - pulseIntensity * 144)}, ${0.3 + pulseIntensity * 0.5})` : undefined
  const pulseGlowColor = useAudioPulse ? `rgba(${Math.round(6 + pulseIntensity * 233)}, ${Math.round(182 - pulseIntensity * 114)}, ${Math.round(212 - pulseIntensity * 144)}, ${0.15 + pulseIntensity * 0.35})` : undefined
  const pulseTextColor = useAudioPulse ? `rgba(${Math.round(6 + pulseIntensity * 249)}, ${Math.round(182 + pulseIntensity * 73)}, ${Math.round(212 + pulseIntensity * 43)}, ${0.7 + pulseIntensity * 0.3})` : undefined

  // Check for payment success
  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShowSuccessMessage(true)
      // Auto-hide after 8 seconds
      setTimeout(() => setShowSuccessMessage(false), 8000)
      // Clean URL
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams])

  useEffect(() => {
    fetchAllTracks()
  }, [])

  // Spacebar to play/pause
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        // Don't trigger if user is typing in an input
        if (document.activeElement?.tagName === 'INPUT' || 
            document.activeElement?.tagName === 'TEXTAREA') {
          return
        }
        e.preventDefault()
        handlePlayAll()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [tracks, currentTrack, isPlaying])

  // ─── Volume knob: scroll wheel + drag to change volume ───
  useEffect(() => {
    const el = volumeKnobRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const newVol = Math.max(0, Math.min(1, volumeRef.current + (e.deltaY < 0 ? 0.05 : -0.05)))
      setVolume(newVol)
    }
    let dragging = false
    let startX = 0
    let startY = 0
    let startVol = 0
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      startX = e.clientX
      startY = e.clientY
      startVol = volumeRef.current
      el.setPointerCapture(e.pointerId)
      e.preventDefault()
      e.stopPropagation()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      e.preventDefault()
      // Support both horizontal (turning) and vertical (sliding) drag
      const dx = e.clientX - startX   // right = increase
      const dy = startY - e.clientY   // up = increase
      // Use whichever axis has more movement
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
      setVolume(Math.max(0, Math.min(1, startVol + delta / 80)))
    }
    const onPointerUp = (e: PointerEvent) => {
      if (dragging) {
        try { el.releasePointerCapture(e.pointerId) } catch {}
      }
      dragging = false
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [setVolume])

  // ─── Main tuning dial: drag right=next, left=prev, click=play/pause ───
  useEffect(() => {
    const el = tuneKnobRef.current
    if (!el) return
    let dragging = false
    let startX = 0
    let hasTrigger = false
    let totalMove = 0
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      startX = e.clientX
      hasTrigger = false
      totalMove = 0
      el.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      totalMove = Math.abs(dx)
      setTuneRotation(Math.max(-120, Math.min(120, dx * 4)))
      if (dx > 15 && !hasTrigger) {
        hasTrigger = true
        playNext()
      } else if (dx < -15 && !hasTrigger) {
        hasTrigger = true
        playPrevious()
      }
    }
    const onPointerUp = () => {
      if (dragging && !hasTrigger && totalMove < 6) {
        handlePlayAll()
      }
      dragging = false
      setTuneRotation(0)
    }
    let wheelCooldown = false
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (wheelCooldown) return
      wheelCooldown = true
      setTimeout(() => { wheelCooldown = false }, 500)
      if (e.deltaY < 0 || e.deltaX > 0) playNext()
      else playPrevious()
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('wheel', onWheel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, currentTrack, isPlaying])

  const fetchAllTracks = async () => {
    try {
      const res = await fetch('/api/media/radio')
      if (!res.ok) {
        console.error('❌ Radio API failed:', res.status, res.statusText)
        return
      }
      const data = await res.json()
      if (data.success && data.combinedMedia) {
        interface MediaItem {
          id: string
          title?: string
          artist?: string
          audio_url?: string
          image_url?: string
          video_url?: string
          user_id?: string
          users?: { username?: string; avatar_url?: string }
        }
        
        const audioTracks: Track[] = data.combinedMedia
          .filter((item: MediaItem) => item.audio_url)
          .map((item: MediaItem) => ({
            id: item.id,
            title: item.title || 'Untitled',
            artist: item.users?.username || item.artist || 'Unknown Artist',
            audio_url: item.audio_url!,
            image_url: item.image_url,
            video_url: item.video_url,
            user_id: item.user_id
          }))
        setTracks(audioTracks)
      }
    } catch (error) {
      console.error('Failed to fetch tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAll = () => {
    if (!tracks.length) return
    
    // Resume AudioContext on user gesture (required by browsers)
    ensureAudioContextResumed()
    
    if (currentTrack && isPlaying) {
      togglePlayPause()
      return
    }
    
    const playerTracks = tracks.map(t => ({
      id: t.id,
      audioUrl: t.audio_url,
      title: t.title,
      artist: t.artist,
      imageUrl: t.image_url,
      videoUrl: t.video_url,
      userId: t.user_id // Include userId for play tracking
    }))
    
    // setPlaylist already calls playTrack internally (via setPlaylistAndPlay)
    // Do NOT call playTrack separately — that causes a double-load race = perceived lag
    setPlaylist(playerTracks, 0)
  }

  const handleInputClick = () => {
    router.push('/create')
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* 3D Background with lazy loading */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>

      {/* Floating genres animation */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <Suspense fallback={null}>
          <FloatingGenres />
        </Suspense>
      </div>

      {/* Minimal blur overlay - only 5% blur */}
      <div className="fixed inset-0 backdrop-blur-[0.5px] bg-black/10 -z-5"></div>

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 z-10 md:pl-24">
        {/* SEO Hero Section - Hidden but crawlable */}
        <div className="sr-only">
          <SEOHeroSection />
        </div>
        
        {/* Landing View - Centered Hero */}
        <div className="max-w-4xl w-full">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            
            {/* 444 RADIO Header */}
            <div className="relative mb-3">
              <h2 
                className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight"
                style={{
                  fontFamily: 'Anton, Impact, Arial Black, sans-serif',
                  fontWeight: 900
                }}
              >
                444 RADIO
              </h2>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-lg -z-10" />
            </div>

            {/* Compact Radio Player */}
            <div className="relative group w-full max-w-xs mx-auto">
              {/* Glow effect */}
              <div className={`absolute -inset-0.5 rounded-2xl blur-md opacity-40 group-hover:opacity-70 transition-colors duration-100 ${!useAudioPulse ? 'animate-[borderPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { background: pulseGlowColor } : undefined} />
              
              <div className={`relative bg-black/95 backdrop-blur-2xl border rounded-2xl overflow-hidden transition-colors duration-100 ${!useAudioPulse ? 'animate-[borderColorPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { borderColor: pulseBorderColor, boxShadow: `0 0 ${10 + pulseIntensity * 20}px ${pulseGlowColor}` } : { boxShadow: '0 0 20px rgba(6,182,212,0.15)' }}>
                
                {/* Video / Art — 16:9 hero */}
                <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black overflow-hidden">
                  {currentTrack?.videoUrl ? (
                    <>
                      <video
                        src={currentTrack.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {isPlaying && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      )}
                    </>
                  ) : currentTrack?.imageUrl ? (
                    <>
                      <img 
                        src={currentTrack.imageUrl} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {isPlaying && audioEl ? (
                        <div className="absolute inset-2">
                          <MiniVisualizer audioElement={audioEl} isPlaying={isPlaying} />
                        </div>
                      ) : (
                        <span className="text-cyan-400/30 text-sm font-bold tracking-[0.25em] uppercase" style={{ fontFamily: 'Anton, sans-serif' }}>free the music</span>
                      )}
                    </div>
                  )}
                  {/* Overlay track info on bottom of video */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-5 bg-gradient-to-t from-black/90 to-transparent">
                    <h3 className="text-white font-semibold text-xs truncate leading-tight">
                      {currentTrack?.title || 'Welcome to the Future'}
                    </h3>
                    {currentTrack?.userId ? (
                      <Link href={`/profile/${currentTrack.userId}`} className="text-cyan-400/80 hover:text-cyan-300 text-[11px] truncate leading-tight block transition-colors">
                        {currentTrack?.artist || 'Unknown Artist'}
                      </Link>
                    ) : (
                      <p className="text-cyan-400/60 text-[11px] truncate leading-tight">
                        {currentTrack?.artist || 'Tap dial to play · Turn for next'}
                      </p>
                    )}
                  </div>
                  </div>
                </div>

                {/* Controls panel */}
                <div className="px-3 py-2 space-y-1.5">
                  {/* Time */}
                  <div className="flex items-center justify-center">
                    <span className="text-sm font-bold text-cyan-400 font-mono leading-none tracking-wider">
                      {formatTime(currentTime)}
                    </span>
                  </div>

                  {/* Analog Controls */}
                  <div className="flex items-center justify-center gap-3">
                    {/* Volume Knob — scroll wheel + drag to adjust */}
                    <div ref={volumeKnobRef} className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing select-none touch-none" title={`Volume: ${Math.round(volume * 100)}% — Scroll or drag to adjust`}>
                      <svg width="34" height="34" viewBox="0 0 44 44" className="drop-shadow-[0_0_4px_rgba(6,182,212,0.3)] pointer-events-none">
                        {/* Track arc (background) */}
                        <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth="2.5" strokeDasharray="119" strokeLinecap="round" transform="rotate(-135 22 22)" />
                        {/* Value arc (filled) */}
                        <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(6,182,212,0.8)" strokeWidth="2.5" strokeDasharray={`${volume * 89} 119`} strokeLinecap="round" transform="rotate(-135 22 22)" className="transition-[stroke-dasharray] duration-100" />
                        {/* Outer ring */}
                        <circle cx="22" cy="22" r="14" fill="rgba(12,12,12,0.95)" stroke="rgba(6,182,212,0.4)" strokeWidth="1" />
                        {/* Grip notches */}
                        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
                          <line key={deg} x1="22" y1="9.5" x2="22" y2="11.5" stroke="rgba(200,200,200,0.2)" strokeWidth="0.7" transform={`rotate(${deg} 22 22)`} />
                        ))}
                        {/* Inner body */}
                        <circle cx="22" cy="22" r="8.5" fill="rgba(18,18,18,0.9)" stroke="rgba(100,100,100,0.25)" strokeWidth="0.5" />
                        {/* Pointer */}
                        <line x1="22" y1="22" x2="22" y2="12.5" stroke="rgba(6,182,212,1)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${-135 + volume * 270} 22 22)`} className="transition-transform duration-100" />
                        {/* Center dot */}
                        <circle cx="22" cy="22" r="2" fill="rgba(6,182,212,0.6)" />
                      </svg>
                      <span className="text-[6px] text-gray-500 font-mono uppercase tracking-widest">Vol</span>
                    </div>

                    {/* Shuffle */}
                    <button
                      onClick={toggleShuffle}
                      className={`p-1.5 rounded-full transition-all duration-200 ${isShuffled ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-cyan-400'}`}
                      title="Shuffle"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>

                    {/* ═══ MAIN TUNING DIAL ═══ */}
                    <div ref={tuneKnobRef} className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing select-none touch-none" title="Drag right → Next · Drag left → Previous · Tap → Play/Pause">
                      <svg width="48" height="48" viewBox="0 0 62 62" className="drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]" style={{ transform: `rotate(${tuneRotation}deg)`, transition: tuneRotation === 0 ? 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' : 'none' }}>
                        {/* Outer glow ring */}
                        <circle cx="31" cy="31" r="29.5" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1" />
                        {/* Main body */}
                        <circle cx="31" cy="31" r="27" fill="rgba(10,10,10,0.95)" stroke="rgba(6,182,212,0.5)" strokeWidth="1.5" />
                        {/* Grip notches — bright cyan ticks */}
                        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => (
                          <line key={deg} x1="31" y1="5.5" x2="31" y2="9.5" stroke="rgba(6,182,212,0.3)" strokeWidth="1" transform={`rotate(${deg} 31 31)`} />
                        ))}
                        {/* Inner ring */}
                        <circle cx="31" cy="31" r="18" fill="rgba(14,14,14,0.9)" stroke="rgba(6,182,212,0.25)" strokeWidth="0.7" />
                        {/* Center play/pause icon area */}
                        <circle cx="31" cy="31" r="11" fill="rgba(16,16,16,0.95)" stroke="rgba(6,182,212,0.35)" strokeWidth="0.5" />
                        {/* Play triangle or Pause bars in center */}
                        {isPlaying && currentTrack ? (
                          <>
                            <rect x="27" y="25" width="2.5" height="12" rx="1" fill="rgba(6,182,212,0.7)" />
                            <rect x="32.5" y="25" width="2.5" height="12" rx="1" fill="rgba(6,182,212,0.7)" />
                          </>
                        ) : (
                          <path d="M28 24 L28 38 L40 31 Z" fill="rgba(6,182,212,0.6)" />
                        )}
                        {/* Top indicator notch */}
                        <line x1="31" y1="3" x2="31" y2="10" stroke="rgba(6,182,212,0.9)" strokeWidth="2" strokeLinecap="round" />
                        {/* Left arrow — visible cyan */}
                        <path d="M5 31 L11 27 L11 35 Z" fill="rgba(6,182,212,0.35)" stroke="rgba(6,182,212,0.5)" strokeWidth="0.5" />
                        {/* Right arrow — visible cyan */}
                        <path d="M57 31 L51 27 L51 35 Z" fill="rgba(6,182,212,0.35)" stroke="rgba(6,182,212,0.5)" strokeWidth="0.5" />
                      </svg>
                      <span className="text-[6px] text-cyan-400/60 font-mono uppercase tracking-widest">Tune</span>
                    </div>

                    {/* Loop */}
                    <button
                      onClick={toggleLoop}
                      className={`p-1.5 rounded-full transition-all duration-200 ${isLooping ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-cyan-400'}`}
                      title="Loop"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Hint text */}
                  <p className="text-center text-[7px] text-gray-500 italic tracking-wide">← prev · tap play · next →  ·  scroll vol</p>
                </div>
              </div>
            </div>

            {/* Aesthetic describe your sound bar - navigates to create page */}
            <div className="w-full max-w-xs mx-auto">
              <div className="relative group cursor-pointer" onClick={handleInputClick}>
                <div className={`absolute -inset-0.5 rounded-2xl blur opacity-60 group-hover:opacity-90 transition-colors duration-100 ${!useAudioPulse ? 'animate-[borderPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { background: pulseGlowColor } : undefined}></div>
                <div className="relative">
                  <div className={`w-full px-6 py-4 bg-black/60 backdrop-blur-2xl border rounded-2xl group-hover:border-white/30 focus:outline-none transition-colors duration-100 text-center text-sm md:text-base ${!useAudioPulse ? 'animate-[borderColorPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { borderColor: pulseBorderColor } : undefined}>
                    <span className={`transition-colors duration-100 ${!useAudioPulse ? 'animate-[textPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { color: pulseTextColor } : undefined}>Describe Your Sound...</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Success Message Toast */}
      {showSuccessMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="relative group">
            {/* Glowing background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-300"></div>
            
            {/* Content */}
            <div className="relative bg-black border-2 border-cyan-400/50 rounded-2xl px-8 py-6 shadow-2xl shadow-cyan-500/50 backdrop-blur-xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-black text-white mb-2 bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
                    Thank You! 🎉
                  </h3>
                  <p className="text-cyan-300 text-lg font-medium mb-1">
                    Your subscription is active!
                  </p>
                  <p className="text-cyan-400/80 text-sm">
                    Can't wait to hear what you create with <span className="font-bold text-cyan-300">444</span>
                  </p>
                </div>

                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="flex-shrink-0 text-cyan-400/60 hover:text-cyan-400 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Left Buttons — inline row */}
      <div className="fixed bottom-5 left-6 md:left-24 z-40 flex items-center gap-2">
        {/* Claim Free Credits */}
        <Link href="/decrypt">
          <div className="group cursor-pointer relative">
            <div className={`absolute -inset-0.5 rounded-full blur-sm opacity-50 group-hover:opacity-80 transition-colors duration-100 ${!useAudioPulse ? 'animate-[borderPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { background: pulseGlowColor } : undefined}></div>
            <div className={`relative rounded-full px-3 py-1.5 shadow-md transition-colors duration-100 group-hover:scale-105 flex items-center gap-1 border bg-black/70 ${!useAudioPulse ? 'animate-[borderColorPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { borderColor: pulseBorderColor } : undefined}>
              <Gift className={`w-3 h-3 ${!useAudioPulse ? 'animate-[textPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { color: pulseTextColor } : undefined} />
              <span className={`font-bold text-[11px] whitespace-nowrap ${!useAudioPulse ? 'animate-[textPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { color: pulseTextColor } : undefined}>Claim Free Credits</span>
            </div>
          </div>
        </Link>
        {/* Sign In / Sign Up for unauthenticated users */}
        {!isSignedIn && (
          <Link href="/sign-in">
            <div className="group cursor-pointer relative">
              <div className={`absolute -inset-0.5 rounded-full blur-sm opacity-50 group-hover:opacity-80 transition-colors duration-100 ${!useAudioPulse ? 'animate-[borderPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { background: pulseGlowColor } : undefined}></div>
              <div className={`relative bg-black/80 border rounded-full px-3 py-1.5 shadow-md transition-colors duration-100 group-hover:scale-105 flex items-center gap-1 ${!useAudioPulse ? 'animate-[borderColorPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { borderColor: pulseBorderColor } : undefined}>
                <LogIn className={`w-3 h-3 ${!useAudioPulse ? 'animate-[textPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { color: pulseTextColor } : undefined} />
                <span className={`font-semibold text-[11px] whitespace-nowrap ${!useAudioPulse ? 'animate-[textPulse_8s_ease-in-out_infinite]' : ''}`} style={useAudioPulse ? { color: pulseTextColor } : undefined}>Sign In / Sign Up</span>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Floating Menu */}
      <FloatingMenu />
    </>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomePageContent />
    </Suspense>
  )
}
