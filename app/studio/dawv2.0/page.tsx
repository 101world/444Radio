'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense } from 'react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useUser } from '@clerk/nextjs'
import { MultiTrackDAW } from '@/lib/audio/MultiTrackDAW'
import type { Track, TrackClip } from '@/lib/audio/TrackManager'
import {
  Play,
  Pause,
  Square,
  Save,
  Music,
  Grid3x3,
  Repeat,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  Sparkles,
  Music2,
  Scissors,
  Download,
  X,
  Loader2,
  Mic,
  Copy,
  Trash2,
  ClipboardPaste,
  Clipboard,
  Folder
} from 'lucide-react'

// Extend Window interface for drag throttling and pending clip tracking
declare global {
  interface Window {
    lastDragUpdate?: number
    pendingClips?: Set<string>
  }
}

// Import modal components
import GenerateModal from '@/app/components/studio/GenerationModal'
import StemSplitterModal from '@/app/components/studio/StemSplitterModal'
import KeyboardHelpModal from '@/app/components/studio/KeyboardHelpModal'

export default function DAWProRebuild() {
  const { user } = useUser()
  const [daw, setDaw] = useState<MultiTrackDAW | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [bpm, setBpm] = useState(120)
  const [zoom, setZoom] = useState(200) // pixels per second - default 200 for clean view
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [showBrowser, setShowBrowser] = useState(false)
  const [library, setLibrary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(32)
  const [searchTerm, setSearchTerm] = useState('')
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [metronomeFlash, setMetronomeFlash] = useState(false)
  const [metronomeInterval, setMetronomeInterval] = useState<NodeJS.Timeout | null>(null)
  const [masterVolume, setMasterVolume] = useState(100)
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [projectName, setProjectName] = useState('Untitled Project')
  const [saving, setSaving] = useState(false)
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [editingTrackName, setEditingTrackName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string; trackId: string } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [copiedClip, setCopiedClip] = useState<{ clip: TrackClip; trackId: string } | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'autosaving'>('idle')
  const [saveTick, setSaveTick] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null)
  const [dragPreview, setDragPreview] = useState<{ time: number; trackId: string | null } | null>(null)
  const [draggingLoopHandle, setDraggingLoopHandle] = useState<'start' | 'end' | null>(null)
  const [activeLoopHandle, setActiveLoopHandle] = useState<'start' | 'end' | null>(null)
  const [draggingClip, setDraggingClip] = useState<{ clipId: string; trackId: string; offsetX: number } | null>(null)
  const [draggingFade, setDraggingFade] = useState<{ clipId: string; trackId: string; type: 'in' | 'out' } | null>(null)
  const [draggingResize, setDraggingResize] = useState<{ clipId: string; trackId: string; edge: 'left' | 'right'; originalStartTime: number; originalDuration: number; originalOffset: number } | null>(null)
  const [loadingClips, setLoadingClips] = useState<Set<string>>(new Set())
  const audioBufferCache = useRef<Map<string, Promise<AudioBuffer>>>(new Map())
  const isHydratingRef = useRef(false)
  const [dirtyCounter, setDirtyCounter] = useState(0)
  const markProjectDirty = useCallback(() => {
    if (isHydratingRef.current) return
    setDirtyCounter((prev) => prev + 1)
  }, [])
  const [hydrationProgress, setHydrationProgress] = useState<{ current: number; total: number } | null>(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 })
  const [trackLevels, setTrackLevels] = useState<Map<string, number>>(new Map())
  const [cpuUsage, setCpuUsage] = useState<number>(0)
  const levelUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Advanced generation modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatingTrack, setGeneratingTrack] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string>('')
  const [generationStep, setGenerationStep] = useState<number>(0)
  const [genPrompt, setGenPrompt] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [genLyrics, setGenLyrics] = useState('')
  const [genGenre, setGenGenre] = useState('')
  const [genBpm, setGenBpm] = useState('')
  const [genIsInstrumental, setGenIsInstrumental] = useState(false)

  // Stem splitter states
  const [showStemSplitter, setShowStemSplitter] = useState(false)
  const [isSplittingStems, setIsSplittingStems] = useState(false)
  const [selectedAudioForStems, setSelectedAudioForStems] = useState<string | null>(null)
  const [stemResults, setStemResults] = useState<any>(null)

  const timelineRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const loopRef = useRef({ enabled: false, start: 0, end: 32 })

  // Ableton-style constants
  const TRACK_HEIGHT = 100
  const TRACK_HEADER_WIDTH = 220
  const TIMELINE_HEIGHT = 48
  const TRANSPORT_HEIGHT = 72
  const GRID_SUBDIVISION = 4 // 16th notes
  const TIMELINE_SECONDS = 180 // reduce DOM nodes for smoother UI (3 minutes visible)
  const timelineWidth = TIMELINE_SECONDS * zoom

  useEffect(() => {
    loopRef.current = { enabled: loopEnabled, start: loopStart, end: loopEnd }
  }, [loopEnabled, loopStart, loopEnd])

  useEffect(() => {
    const timelineEl = timelineRef.current
    if (!timelineEl) return

    let frameId: number | null = null

    const updateRange = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      frameId = requestAnimationFrame(() => {
        const scrollLeft = timelineEl.scrollLeft
        const viewportWidth = Math.max(1, timelineEl.clientWidth - TRACK_HEADER_WIDTH)
        const nextStart = Math.max(0, scrollLeft / zoom)
        const nextEnd = Math.min(TIMELINE_SECONDS, (scrollLeft + viewportWidth) / zoom)

        setVisibleRange((prev) => {
          if (
            Math.abs(prev.start - nextStart) < 0.001 &&
            Math.abs(prev.end - nextEnd) < 0.001
          ) {
            return prev
          }
          return { start: nextStart, end: nextEnd }
        })
      })
    }

    updateRange()
    timelineEl.addEventListener('scroll', updateRange)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateRange())
      resizeObserver.observe(timelineEl)
    }

    return () => {
      timelineEl.removeEventListener('scroll', updateRange)
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
      resizeObserver?.disconnect()
    }
  }, [zoom, TIMELINE_SECONDS, TRACK_HEADER_WIDTH])

  // Initialize DAW
  useEffect(() => {
    if (!user?.id) return

    let isMounted = true
    let animationFrameId: number | null = null
    let dawInstance: MultiTrackDAW | null = null

    const initDAW = async () => {
      try {
        const instance = new MultiTrackDAW({ userId: user.id })
        dawInstance = instance

        for (let i = 0; i < 8; i++) {
          instance.createTrack(`${i + 1} Audio`)
        }

        if (!isMounted) {
          instance.dispose()
          return
        }

        setDaw(instance)
        setTracks(instance.getTracks())
        setLoading(false)

        // Handle audio context suspension (mobile browsers)
        const audioContext = instance.getAudioContext()
        if (audioContext) {
          const resumeAudio = () => {
            if (audioContext.state === 'suspended') {
              audioContext.resume().catch(console.error)
            }
          }
          audioContext.addEventListener('statechange', resumeAudio)
          window.addEventListener('click', resumeAudio, { once: true })
          window.addEventListener('touchstart', resumeAudio, { once: true })
        }

        const animate = () => {
          if (!instance) return
          const state = instance.getTransportState()
          
          // CRITICAL: Use Web Audio clock as single source of truth
          // This ensures deterministic, glitch-free timing
          const audioContext = instance.getAudioContext()
          if (state.isPlaying && audioContext) {
            const currentTime = instance.getCurrentTime()
            const loop = loopRef.current
            
            // Handle looping - check if we've passed the loop end
            if (loop.enabled && currentTime >= loop.end) {
              instance.seekTo(loop.start) // This will restart playback from loop start
            } else {
              // Use requestAnimationFrame batching to prevent UI jank
              setPlayhead(currentTime)
            }
            setIsPlaying(true)
          } else {
            setIsPlaying(false)
          }
          animationFrameId = requestAnimationFrame(animate)
        }

        animationFrameId = requestAnimationFrame(animate)
      } catch (error) {
        console.error('DAW init failed:', error)
        setLoading(false)
      }
    }

    initDAW()

    return () => {
      isMounted = false
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      dawInstance?.dispose()
      setDaw(null)
      setTracks([])
      audioBufferCache.current.clear()
      isHydratingRef.current = false
    }
  }, [user?.id])

  // Load library
  useEffect(() => {
    if (user && !loading) {
      loadLibrary()
    }
  }, [user, loading])

  const loadLibrary = async () => {
    try {
      // Fetch from all sources like main library page: DB music + R2 audio files
      const [musicRes, r2AudioRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/r2/list-audio')
      ])

      if (!musicRes.ok) {
        throw new Error(`Music API failed: ${musicRes.status}`)
      }
      if (!r2AudioRes.ok) {
        throw new Error(`R2 Audio API failed: ${r2AudioRes.status}`)
      }

      const musicData = await musicRes.json()
      const r2AudioData = await r2AudioRes.json()

      // Merge database music with R2 files, deduplicate by audio_url
      if (musicData.success && Array.isArray(musicData.music)) {
        const dbMusic = musicData.music
        const r2Music = r2AudioData.success && Array.isArray(r2AudioData.music) ? r2AudioData.music : []
        
        // Combine and deduplicate
        const allMusic = [...dbMusic, ...r2Music]
        const uniqueMusic = Array.from(
          new Map(allMusic.map((item: any) => [item.audio_url, item])).values()
        )
        
        // Normalize field names for compatibility (audio_url -> audioUrl if needed)
        const normalizedMusic = uniqueMusic.map((item: any) => ({
          ...item,
          audioUrl: item.audio_url || item.audioUrl,
          type: 'audio', // Ensure type field for filtering
          title: item.title || 'Untitled'
        }))
        
        setLibrary(normalizedMusic)
        console.log('✅ DAW Browser loaded', normalizedMusic.length, 'tracks (DB:', dbMusic.length, '+ R2:', r2Music.length, ')')
      }
    } catch (error) {
      console.error('Library load failed:', error)
    }
  }

  const snapTime = useCallback(
    (time: number) => {
      if (!snapEnabled || !daw) return time
      const timeEngine = daw.getTimeEngine()
      return timeEngine.snapToSubdivision(time) // Snap to 16th notes
    },
    [snapEnabled, daw]
  )

  const beatLength = useCallback(() => 60 / bpm, [bpm])

  const formatBarsBeats = useCallback(
    (time: number) => {
      if (!daw) {
        // Fallback if DAW not ready
        const bl = beatLength()
        const totalBeats = time / bl
        const bar = Math.floor(totalBeats / 4) + 1
        const beatInBar = Math.floor(totalBeats % 4) + 1
        const sub = Math.floor(((totalBeats - Math.floor(totalBeats)) * GRID_SUBDIVISION)) + 1
        return `${bar}:${beatInBar}.${sub}`
      }
      // Use TimeEngine for accurate musical time formatting
      const timeEngine = daw.getTimeEngine()
      return timeEngine.formatMusical(time)
    },
    [daw, beatLength]
  )

  const bufferedRange = useMemo(() => {
    const bufferSeconds = 4
    return {
      start: Math.max(0, visibleRange.start - bufferSeconds),
      end: Math.min(TIMELINE_SECONDS, visibleRange.end + bufferSeconds)
    }
  }, [visibleRange.start, visibleRange.end, TIMELINE_SECONDS])

  const timeMarkerIndices = useMemo(() => {
    const markers: number[] = []
    const start = Math.floor(bufferedRange.start)
    const end = Math.ceil(bufferedRange.end)
    for (let i = start; i <= end; i++) {
      markers.push(i)
    }
    return markers
  }, [bufferedRange.start, bufferedRange.end])

  const gridLineIndices = useMemo(() => {
    const indices: number[] = []
    const totalSteps = (TIMELINE_SECONDS + 1) * GRID_SUBDIVISION
    const start = Math.max(0, Math.floor(bufferedRange.start * GRID_SUBDIVISION))
    const end = Math.min(totalSteps, Math.ceil(bufferedRange.end * GRID_SUBDIVISION))
    for (let i = start; i < end; i++) {
      indices.push(i)
    }
    return indices
  }, [bufferedRange.start, bufferedRange.end, GRID_SUBDIVISION, TIMELINE_SECONDS])

  // Simple toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  const getAudioBuffer = useCallback(
    async (audioUrl: string) => {
      if (!daw) throw new Error('DAW not ready')

      if (!audioBufferCache.current.has(audioUrl)) {
        const promise = (async () => {
          const proxyUrl = `/api/r2/audio-proxy?url=${encodeURIComponent(audioUrl)}`
          const response = await fetch(proxyUrl)
          if (!response.ok) throw new Error('Fetch failed')

          const arrayBuffer = await response.arrayBuffer()
          const audioContext = daw.getAudioContext()
          return audioContext.decodeAudioData(arrayBuffer.slice(0))
        })()

        audioBufferCache.current.set(audioUrl, promise)

        // Limit cache size to prevent memory buildup
        const MAX_CACHE_SIZE = 50
        if (audioBufferCache.current.size > MAX_CACHE_SIZE) {
          const firstKey = audioBufferCache.current.keys().next().value
          if (firstKey) audioBufferCache.current.delete(firstKey)
        }

        try {
          await promise
        } catch (error) {
          audioBufferCache.current.delete(audioUrl)
          throw error
        }
      }

      return audioBufferCache.current.get(audioUrl)!
    },
    [daw]
  )

  const addClipFromUrl = useCallback(
    async (
      audioUrl: string,
      trackId: string,
      options: Partial<TrackClip> & { respectSnap?: boolean; skipStateUpdate?: boolean; skipDirtyFlag?: boolean } = {}
    ) => {
      if (!daw) return null

      const clipKey = `${trackId}-${audioUrl}-${options.startTime || 0}`
      
      // Show loading state
      setLoadingClips(prev => new Set(prev).add(clipKey))

      try {
        const audioBuffer = await getAudioBuffer(audioUrl)
        const { respectSnap, skipStateUpdate, skipDirtyFlag, ...clipOptions } = options
        const shouldSnap = respectSnap ?? snapEnabled
        const start = clipOptions.startTime ?? 0

        const clip: TrackClip = {
          id: clipOptions.id || `clip-${Date.now()}`,
          trackId,
          startTime: shouldSnap ? snapTime(start) : start,
          duration: clipOptions.duration ?? audioBuffer.duration,
          offset: clipOptions.offset ?? 0,
          gain: clipOptions.gain ?? 1,
          fadeIn: clipOptions.fadeIn || { duration: 0.01, curve: 'exponential' },
          fadeOut: clipOptions.fadeOut || { duration: 0.01, curve: 'exponential' },
          buffer: audioBuffer,
          locked: clipOptions.locked ?? false,
          sourceUrl: audioUrl,
          name: clipOptions.name,
          color: clipOptions.color
        }

        daw.addClipToTrack(trackId, clip)
        if (!skipStateUpdate) {
          // Use requestAnimationFrame to batch state updates and prevent glitching
          requestAnimationFrame(() => {
            setTracks(daw.getTracks())
          })
        }
        if (!skipDirtyFlag) {
          markProjectDirty()
        }
        return clip
      } catch (error) {
        console.error('Clip decode/add failed:', error)
        throw error
      } finally {
        // Hide loading state
        setLoadingClips(prev => {
          const newSet = new Set(prev)
          newSet.delete(clipKey)
          return newSet
        })
      }
    },
    [daw, getAudioBuffer, snapEnabled, snapTime, markProjectDirty]
  )

  const serializeTracks = useCallback((allTracks: Track[]) => {
    return allTracks.map((track) => ({
      ...track,
      clips: track.clips.map(({ buffer, ...rest }) => ({ ...rest }))
    }))
  }, [])

  // Metronome click sound function with downbeat detection
  const playMetronomeClick = useCallback(() => {
    if (!daw) return
    const audioContext = daw.getAudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Detect downbeat (first beat of bar for professional feel)
    const currentTime = daw.getTransportState().currentTime
    const beatDuration = 60 / bpm
    const beatsPerBar = 4 // 4/4 time signature
    const beatInBar = Math.floor(currentTime / beatDuration) % beatsPerBar
    const isDownbeat = beatInBar === 0
    
    // Downbeat: 1200Hz louder | Other beats: 800Hz softer
    oscillator.frequency.value = isDownbeat ? 1200 : 800
    oscillator.type = 'sine'
    
    // Quick envelope: instant attack, fast decay
    gainNode.gain.setValueAtTime(isDownbeat ? 0.4 : 0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.05)
  }, [daw, bpm])

  // Transport controls
  const handlePlay = useCallback(() => {
    if (!daw) return
    try {
      daw.play()
      setIsPlaying(true)

      // Start level metering at 60fps
      if (levelUpdateInterval.current) clearInterval(levelUpdateInterval.current)
      levelUpdateInterval.current = setInterval(() => {
        const trackManager = daw.getTrackManager()
        const allTracks = trackManager.getTracks()
        const newLevels = new Map<string, number>()
        
        allTracks.forEach(track => {
          const node = trackManager.getRoutingNode(track.id)
          if (node?.analyserNode) {
            const dataArray = new Uint8Array(node.analyserNode.frequencyBinCount)
            node.analyserNode.getByteTimeDomainData(dataArray)
            // Calculate RMS level
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              const normalized = (dataArray[i] - 128) / 128
              sum += normalized * normalized
            }
            const rms = Math.sqrt(sum / dataArray.length)
            newLevels.set(track.id, Math.min(1, rms * 2)) // Scale for visibility
          }
        })
        
        setTrackLevels(newLevels)
      }, 1000 / 60) // 60fps

      if (metronomeEnabled) {
        // Play first click immediately
        playMetronomeClick()
        
        const interval = setInterval(() => {
          // Visual flash
          setMetronomeFlash(true)
          setTimeout(() => setMetronomeFlash(false), 50)
          
          // Audio click
          playMetronomeClick()
        }, (60 / bpm) * 1000)
        setMetronomeInterval(interval)
      }
    } catch (error) {
      console.error('Play error:', error)
    }
  }, [daw, metronomeEnabled, bpm, playMetronomeClick])

  const handlePause = useCallback(() => {
    if (!daw) return
    daw.pause()
    setIsPlaying(false)
    
    // Stop metering
    if (levelUpdateInterval.current) {
      clearInterval(levelUpdateInterval.current)
      levelUpdateInterval.current = null
    }
    setTrackLevels(new Map())
    
    if (metronomeInterval) {
      clearInterval(metronomeInterval)
      setMetronomeInterval(null)
    }
  }, [daw, metronomeInterval])

  const handleStop = useCallback(() => {
    if (!daw) return
    daw.stop()
    setPlayhead(0)
    setIsPlaying(false)
    if (metronomeInterval) {
      clearInterval(metronomeInterval)
      setMetronomeInterval(null)
    }
  }, [daw, metronomeInterval])

  const handleAddClip = useCallback(
    async (audioUrl: string, trackId: string, startTime: number = 0) => {
      if (!daw) return
      
      // Prevent duplicate additions
      const clipKey = `${trackId}-${audioUrl}-${startTime}`
      if (window.pendingClips?.has(clipKey)) {
        console.log('Duplicate clip add prevented')
        return
      }
      
      if (!window.pendingClips) window.pendingClips = new Set()
      window.pendingClips.add(clipKey)
      
      try {
        await addClipFromUrl(audioUrl, trackId, { startTime, respectSnap: true })
      } catch (error) {
        console.error('Clip add failed:', error)
        showToast('Failed to add clip. Please try again.', 'error')
      } finally {
        window.pendingClips.delete(clipKey)
      }
    },
    [daw, addClipFromUrl, showToast]
  )

  const handleExport = useCallback(async () => {
    if (!daw || isExporting) return
    setIsExporting(true)
    showToast('Exporting project...', 'info')
    
    try {
      const allTracks = daw.getTracks()
      const trackManager = daw.getTrackManager()
      
      // Find the last clip end time
      let duration = loopEnabled ? loopEnd : 0
      allTracks.forEach(track => {
        track.clips.forEach(clip => {
          const clipEnd = clip.startTime + clip.duration
          if (clipEnd > duration) duration = clipEnd
        })
      })
      
      if (duration === 0) {
        showToast('No audio to export', 'error')
        setIsExporting(false)
        return
      }
      
      // Create offline context for rendering
      const sampleRate = 44100
      const offlineCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate)
      
      // Render each track's clips
      for (const track of allTracks) {
        const trackState = trackManager.getTrack(track.id)
        if (!trackState || trackState.muted) continue
        
        for (const clip of track.clips) {
          if (!clip.buffer) continue
          
          const source = offlineCtx.createBufferSource()
          source.buffer = clip.buffer
          
          const gainNode = offlineCtx.createGain()
          const panNode = offlineCtx.createStereoPanner()
          
          // Apply track gain and pan
          gainNode.gain.value = (trackState.volume / 100) * clip.gain * (masterVolume / 100)
          panNode.pan.value = trackState.pan
          
          // Apply fade in/out envelopes
          if (clip.fadeIn && clip.fadeIn.duration > 0) {
            gainNode.gain.setValueAtTime(0, clip.startTime)
            gainNode.gain.linearRampToValueAtTime(
              (trackState.volume / 100) * clip.gain * (masterVolume / 100),
              clip.startTime + clip.fadeIn.duration
            )
          }
          
          if (clip.fadeOut && clip.fadeOut.duration > 0) {
            const fadeStart = clip.startTime + clip.duration - clip.fadeOut.duration
            gainNode.gain.setValueAtTime(
              (trackState.volume / 100) * clip.gain * (masterVolume / 100),
              fadeStart
            )
            gainNode.gain.linearRampToValueAtTime(0, clip.startTime + clip.duration)
          }
          
          source.connect(gainNode)
          gainNode.connect(panNode)
          panNode.connect(offlineCtx.destination)
          
          source.start(clip.startTime, clip.offset, clip.duration)
        }
      }
      
      // Render to buffer
      const renderedBuffer = await offlineCtx.startRendering()
      
      // Convert to WAV
      const wav = audioBufferToWav(renderedBuffer)
      const blob = new Blob([wav], { type: 'audio/wav' })
      
      // Download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_export.wav`
      a.click()
      URL.revokeObjectURL(url)
      
      showToast('✓ Project exported', 'success')
    } catch (error) {
      console.error('Export failed:', error)
      showToast('Export failed', 'error')
    } finally {
      setIsExporting(false)
    }
  }, [daw, isExporting, loopEnabled, loopEnd, masterVolume, projectName, showToast])

  // Helper: Convert AudioBuffer to WAV
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44
    const arrayBuffer = new ArrayBuffer(length)
    const view = new DataView(arrayBuffer)
    const channels: Float32Array[] = []
    let offset = 0
    let pos = 0

    // Write WAV header
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true)
      pos += 2
    }
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true)
      pos += 4
    }

    // RIFF identifier
    setUint32(0x46464952)
    // file length minus RIFF identifier length and file description length
    setUint32(length - 8)
    // RIFF type & format
    setUint32(0x45564157)
    setUint32(0x20746d66)
    // format chunk length
    setUint32(16)
    // sample format (raw)
    setUint16(1)
    // channel count
    setUint16(buffer.numberOfChannels)
    // sample rate
    setUint32(buffer.sampleRate)
    // byte rate (sample rate * block align)
    setUint32(buffer.sampleRate * buffer.numberOfChannels * 2)
    // block align (channel count * bytes per sample)
    setUint16(buffer.numberOfChannels * 2)
    // bits per sample
    setUint16(16)
    // data chunk identifier
    setUint32(0x61746164)
    // data chunk length
    setUint32(length - pos - 4)

    // write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        view.setInt16(pos, sample, true)
        pos += 2
      }
      offset++
    }

    return arrayBuffer
  }

  const handleDuplicateClip = useCallback((trackId: string, clipId: string) => {
    if (!daw) return
    const track = daw.getTracks().find(t => t.id === trackId)
    const clip = track?.clips.find(c => c.id === clipId)
    if (!clip || !clip.buffer) return
    
    const newClip: Partial<TrackClip> = {
      startTime: clip.startTime + clip.duration + 0.1,
      duration: clip.duration,
      offset: clip.offset,
      gain: clip.gain,
      buffer: clip.buffer,
      sourceUrl: clip.sourceUrl,
      name: clip.name ? `${clip.name} (copy)` : undefined,
      color: clip.color,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut
    }
    daw.addClipToTrack(trackId, newClip)
    setTracks(daw.getTracks())
    markProjectDirty()
    showToast('Clip duplicated', 'success')
    setContextMenu(null)
  }, [daw, markProjectDirty, showToast])

  const handleStartRecording = useCallback(async () => {
    if (!recordingTrackId || !daw) return
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const audioContext = daw.getAudioContext()
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // Add recorded clip at playhead position
        const clip: Partial<TrackClip> = {
          startTime: playhead,
          duration: audioBuffer.duration,
          offset: 0,
          gain: 1,
          buffer: audioBuffer,
          name: 'Recorded Audio',
          fadeIn: { duration: 0.01, curve: 'exponential' },
          fadeOut: { duration: 0.01, curve: 'exponential' }
        }
        
        daw.addClipToTrack(recordingTrackId, clip)
        setTracks(daw.getTracks())
        markProjectDirty()
        showToast('✓ Recording added to timeline', 'success')
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        setIsRecording(false)
        setMediaRecorder(null)
      }
      
      setMediaRecorder(recorder)
      recorder.start()
      setIsRecording(true)
      showToast('🔴 Recording...', 'info')
    } catch (error) {
      console.error('Recording failed:', error)
      showToast('Microphone access denied', 'error')
    }
  }, [recordingTrackId, daw, playhead, markProjectDirty, showToast])

  const handleStopRecording = useCallback(() => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
    }
  }, [mediaRecorder, isRecording])

  const handleSave = async (mode: 'manual' | 'auto' = 'manual') => {
    if (!daw || saving) return
    setSaving(true)
    setSaveStatus(mode === 'auto' ? 'autosaving' : 'saving')
    
    console.log('💾 Saving project...', { mode, projectId: currentProjectId, projectName, trackCount: daw.getTracks().length })
    
    try {
      const projectData = {
        id: currentProjectId || undefined,
        title: projectName,
        tracks: serializeTracks(daw.getTracks()),
        tempo: bpm
      }

      console.log('💾 Project data:', { 
        hasId: !!projectData.id, 
        title: projectData.title, 
        trackCount: projectData.tracks.length,
        tempo: projectData.tempo 
      })

      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })

      console.log('💾 API response:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('💾 Save success:', data)
        
        const nextProjectId = data.id || currentProjectId
        if (data.id && data.id !== currentProjectId) {
          console.log('💾 New project ID:', data.id)
          setCurrentProjectId(data.id)
        }
        await fetchProjects({ autoLoad: false, activeId: nextProjectId || undefined })
        if (mode === 'manual') {
          showToast('✓ Project saved', 'success')
        }
        setSaveTick(true)
        setTimeout(() => setSaveTick(false), 1000)
        setDirtyCounter(0)
      } else {
        const error = await response.json()
        console.error('💾 Save failed:', error)
        showToast(`Save failed: ${error.error || 'Unknown error'}`, 'error')
      }
    } catch (error: any) {
      console.error('💾 Save error:', error)
      showToast(`Save failed: ${error.message || 'Network error'}`, 'error')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveStatus('idle'), 600)
    }
  }

  // AI Generation handler
  const handleGenerate = async () => {
    if (!genPrompt.trim()) {
      showToast('Please enter a prompt', 'error')
      return
    }

    setGeneratingTrack(true)
    setGenerationStep(0)
    setGenerationProgress('Preparing...')

    try {
      // Auto-fill missing fields
      let finalTitle = genTitle
      let finalLyrics = genLyrics
      let finalGenre = genGenre
      let finalBpm = genBpm

      // Parallelize AI generation calls for title, lyrics, genre (Steps 1-3)
      setGenerationStep(1)
      setGenerationProgress('Generating metadata...')
      
      const [titleResult, lyricsResult, genreResult] = await Promise.all([
        // Title generation
        !finalTitle.trim() 
          ? fetch('/api/generate/atom-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: genPrompt })
            }).then(r => r.json()).catch(() => ({ success: false }))
          : Promise.resolve({ success: true, title: finalTitle }),
        
        // Lyrics generation
        genIsInstrumental
          ? Promise.resolve({ success: true, lyrics: '[Instrumental]' })
          : !finalLyrics.trim()
            ? fetch('/api/generate/atom-lyrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: genPrompt })
              }).then(r => r.json()).catch(() => ({ success: false }))
            : Promise.resolve({ success: true, lyrics: finalLyrics }),
        
        // Genre detection
        !finalGenre.trim()
          ? fetch('/api/generate/atom-genre', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: genPrompt })
            }).then(r => r.json()).catch(() => ({ success: false }))
          : Promise.resolve({ success: true, genre: finalGenre })
      ])

      // Update with results
      if (titleResult.success && titleResult.title) {
        finalTitle = titleResult.title
        setGenTitle(finalTitle)
      } else if (!finalTitle.trim()) {
        finalTitle = genPrompt.split(' ').slice(0, 2).join(' ')
      }

      if (lyricsResult.success && lyricsResult.lyrics) {
        finalLyrics = lyricsResult.lyrics
        setGenLyrics(finalLyrics)
      }

      if (genreResult.success && genreResult.genre) {
        finalGenre = genreResult.genre
        setGenGenre(finalGenre)
      } else if (!finalGenre.trim()) {
        finalGenre = 'pop'
      }

      // Auto-detect BPM (Step 4/5)
      if (!finalBpm.trim()) {
        setGenerationStep(4)
        setGenerationProgress('Analyzing tempo...')
        const promptLower = genPrompt.toLowerCase()
        if (
          promptLower.includes('fast') ||
          promptLower.includes('energetic') ||
          promptLower.includes('upbeat')
        )
          finalBpm = '140'
        else if (
          promptLower.includes('slow') ||
          promptLower.includes('chill') ||
          promptLower.includes('relaxing')
        )
          finalBpm = '80'
        else if (promptLower.includes('medium') || promptLower.includes('moderate'))
          finalBpm = '110'
        else {
          if (finalGenre.includes('electronic') || finalGenre.includes('edm')) finalBpm = '128'
          else if (finalGenre.includes('hip-hop') || finalGenre.includes('rap'))
            finalBpm = '90'
          else if (finalGenre.includes('rock')) finalBpm = '120'
          else if (finalGenre.includes('lofi') || finalGenre.includes('chill')) finalBpm = '85'
          else finalBpm = '110'
        }
        setGenBpm(finalBpm)
      }

      // Call music generation API (Step 5/5)
      setGenerationStep(5)
      setGenerationProgress(`Generating "${finalTitle}"... (60-90s)`)
      const songId = `song_${Date.now()}`
      const response = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songId,
          prompt: finalLyrics,
          params: {
            title: finalTitle,
            genre: finalGenre,
            bpm: parseInt(finalBpm),
            style_strength: 0.8
          },
          language: 'english'
        })
      })

      if (!response.ok) {
        throw new Error('Generation failed')
      }

      const result = await response.json()

      if (result.success && result.audioUrl) {
        setGenerationProgress('Adding to timeline...')
        
        // Add generated track to first available empty track
        const emptyTrack = tracks.find(t => t.clips.length === 0)
        if (emptyTrack && daw) {
          try {
            await handleAddClip(result.audioUrl, emptyTrack.id, 0)
            showToast(`✓ "${finalTitle}" added to timeline`, 'success')
          } catch (error) {
            console.error('Failed to add generated track to timeline:', error)
            showToast(`✓ Track generated: "${finalTitle}" (check library)`, 'success')
          }
        } else {
          showToast(`✓ Track generated: "${finalTitle}" (drag from library)`, 'success')
        }
        
        // Refresh library to show new track
        await loadLibrary()
        setShowGenerateModal(false)
        // Reset form
        setGenPrompt('')
        setGenTitle('')
        setGenLyrics('')
        setGenGenre('')
        setGenBpm('')
        setGenIsInstrumental(false)
        setGenerationProgress('')
        setGenerationStep(0)
      } else {
        throw new Error(result.error || 'Generation failed')
      }
    } catch (error) {
      console.error('Generation error:', error)
      showToast('Generation failed. Please try again.', 'error')
    } finally {
      setGeneratingTrack(false)
      setGenerationProgress('')
      setGenerationStep(0)
    }
  }

  // Stem splitter handler
  const handleSplitStems = async () => {
    if (!selectedAudioForStems) {
      showToast('Please select an audio track to split', 'error')
      return
    }

    setIsSplittingStems(true)
    setStemResults(null)

    try {
      const response = await fetch('/api/audio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: selectedAudioForStems })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Stem splitting failed')
      }

      const data = await response.json()

      if (data.success && data.stems) {
        setStemResults(data.stems)
        showToast('Stems separated successfully! Adding to timeline...', 'success')
        
        // Automatically add stems to timeline on separate tracks
        const stemEntries = Object.entries(data.stems) as [string, string][]
        for (const [stemType, stemUrl] of stemEntries) {
          // Find or create track for this stem type
          let targetTrack = tracks.find(t => t.name.toLowerCase().includes(stemType.toLowerCase()))
          
          if (!targetTrack || targetTrack.clips.length > 0) {
            // Create new track if doesn't exist or already has clips
            const trackName = `${stemType.charAt(0).toUpperCase() + stemType.slice(1)} Stem`
            targetTrack = daw?.getTrackManager()?.createTrack({ name: trackName })
            if (targetTrack) {
              setTracks(daw?.getTracks() || [])
            }
          }
          
          if (targetTrack && daw) {
            try {
              await handleAddClip(stemUrl, targetTrack.id, 0)
            } catch (error) {
              console.error(`Failed to add ${stemType} stem:`, error)
            }
          }
        }
        
        showToast(`✓ ${stemEntries.length} stems added to timeline`, 'success')
      } else {
        throw new Error('No stems returned')
      }
    } catch (error) {
      console.error('Stem splitting error:', error)
      showToast('Stem splitting failed. Please try again.', 'error')
    } finally {
      setIsSplittingStems(false)
    }
  }

  // Loop handle drag listeners
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingLoopHandle || !timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0)
      const time = Math.max(0, snapTime(x / zoom))

      if (draggingLoopHandle === 'start') {
        setLoopStart(Math.min(time, loopEnd - 0.25))
      } else {
        setLoopEnd(Math.max(time, loopStart + 0.25))
      }
    }

    const handleUp = () => setDraggingLoopHandle(null)

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [draggingLoopHandle, loopEnd, loopStart, snapTime, zoom])

  // Autosave: debounce 5s after changes (increased from 2s for better performance)
  const queueAutosave = useCallback(() => {
    if (!currentProjectId) return // avoid autosave before first explicit save
    if (isPlaying) return // don't autosave during playback (causes lag)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      handleSave('auto')
    }, 5000) // Increased from 2000ms for better performance
  }, [handleSave, currentProjectId, isPlaying])

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current)
      }
    }
  }, [])

  const resetProject = useCallback(() => {
    if (!daw) return
    try {
      daw.stop()
      const trackManager = daw.getTrackManager()
      trackManager.getTracks().forEach((t) => trackManager.deleteTrack(t.id))
      for (let i = 0; i < 8; i++) {
        trackManager.createTrack({ name: `${i + 1} Audio` })
      }
      setProjectName('Untitled Project')
      setCurrentProjectId(null)
      setBpm(120)
      daw.setBPM(120)
      setTracks(daw.getTracks())
      setDirtyCounter(0)
      showToast('New project created', 'success')
    } catch (error) {
      console.error('Reset project failed:', error)
      showToast('Failed to create new project', 'error')
    }
  }, [daw, showToast])

  const handleRenameProject = useCallback(async () => {
    if (!currentProjectId) return
    const newName = window.prompt('Rename project to:', projectName)
    if (!newName || !newName.trim()) return
    setProjectName(newName.trim())
    markProjectDirty()
    await handleSave('manual')
    showToast('Project renamed', 'success')
  }, [currentProjectId, handleSave, projectName, showToast, markProjectDirty])

  // Autosave hooks
  useEffect(() => {
    if (!daw) return
    if (dirtyCounter === 0) return
    queueAutosave()
  }, [dirtyCounter, queueAutosave, daw])

  const hydrateProject = useCallback(
    async (project: any) => {
      if (!daw || !project?.tracks) return

      try {
        isHydratingRef.current = true
        daw.stop()
        const trackManager = daw.getTrackManager()

        // Clear existing tracks
        trackManager.getTracks().forEach((t) => trackManager.deleteTrack(t.id))

        const totalClips = project.tracks.reduce(
          (sum: number, track: any) => sum + ((track?.clips as any[])?.length || 0),
          0
        )
        setHydrationProgress(totalClips > 0 ? { current: 0, total: totalClips } : null)

        const bumpProgress = () =>
          setHydrationProgress((prev) =>
            prev ? { current: Math.min(prev.current + 1, prev.total), total: prev.total } : prev
          )

        const clipTasks: Promise<void>[] = []

        for (const trackData of project.tracks as any[]) {
          const { clips = [], ...rest } = trackData || {}
          const newTrack = trackManager.createTrack({ ...rest, clips: [] })

          for (const clipData of clips) {
            if (!clipData?.sourceUrl) continue
            const task = addClipFromUrl(clipData.sourceUrl, newTrack.id, {
              ...clipData,
              respectSnap: false,
              skipStateUpdate: true,
              skipDirtyFlag: true
            })
              .then(() => {
                bumpProgress()
              })
              .catch((err) => {
                console.error('Clip hydrate failed:', err)
                bumpProgress()
              })
            clipTasks.push(task)
          }
        }

        if (clipTasks.length) {
          await Promise.all(clipTasks)
        }

        if (project.tempo) {
          setBpm(project.tempo)
          daw.setBPM(project.tempo)
        }

        setProjectName(project.title || 'Untitled Project')
        setCurrentProjectId(project.id || null)
        setTracks(daw.getTracks())
        setDirtyCounter(0)
      } catch (error) {
        console.error('Project hydrate failed:', error)
      } finally {
        isHydratingRef.current = false
        setHydrationProgress(null)
      }
    },
    [addClipFromUrl, daw]
  )

  const handleLoadProject = useCallback(
    async (projectId: string) => {
      if (!projectId) return
      const project = projects.find((p) => p.id === projectId)
      if (!project) return
      await hydrateProject(project)
      setCurrentProjectId(projectId)
    },
    [projects, hydrateProject]
  )

  const fetchProjects = useCallback(async (options?: { autoLoad?: boolean; activeId?: string }) => {
    try {
      const response = await fetch('/api/studio/projects')
      if (!response.ok) return
      const data = await response.json()
      setProjects(data.projects || [])

      const activeId = options?.activeId ?? currentProjectId
      const shouldAutoLoad = options?.autoLoad ?? !activeId

      if (shouldAutoLoad && data.projects && data.projects.length > 0 && data.projects[0].tracks) {
        await hydrateProject(data.projects[0])
      }
    } catch (error) {
      console.error('Project load failed:', error)
    }
  }, [hydrateProject, currentProjectId])

  const handleDeleteProject = useCallback(async () => {
    if (!currentProjectId) return
    const confirmDelete = window.confirm('Delete this project? This cannot be undone.')
    if (!confirmDelete) return
    try {
      const response = await fetch(`/api/studio/projects?id=${currentProjectId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        showToast('Project deleted', 'success')
        setCurrentProjectId(null)
        await fetchProjects({ autoLoad: true })
        resetProject()
      } else {
        const err = await response.json()
        showToast(`Delete failed: ${err.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Delete project failed:', error)
      showToast('Delete failed. Please try again.', 'error')
    }
  }, [currentProjectId, fetchProjects, resetProject, showToast])

  const handleDuplicateProject = useCallback(async () => {
    if (!currentProjectId) return
    const project = projects.find((p) => p.id === currentProjectId)
    if (!project) return
    const newTitle = `${project.title || 'Untitled'} (Copy)`
    try {
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          tracks: project.tracks,
          tempo: project.tempo || 120
        })
      })
      if (response.ok) {
        showToast('Project duplicated', 'success')
        await fetchProjects({ autoLoad: false, activeId: currentProjectId || undefined })
      } else {
        const err = await response.json()
        showToast(`Duplicate failed: ${err.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Duplicate project failed:', error)
      showToast('Duplicate failed. Please try again.', 'error')
    }
  }, [currentProjectId, projects, fetchProjects, showToast])

  useEffect(() => {
    if (user && daw && !loading) {
      fetchProjects({ autoLoad: true })
    }
  }, [user, daw, loading, fetchProjects])

  const renderWaveform = useCallback((canvas: HTMLCanvasElement, buffer: AudioBuffer) => {
    // Defer rendering to prevent blocking - use requestIdleCallback with fallback to setTimeout
    const deferRender = (callback: () => void) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(callback, { timeout: 2000 })
      } else {
        setTimeout(callback, 0)
      }
    }
    
    deferRender(() => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = canvas.width
      const height = canvas.height
      const data = buffer.getChannelData(0)
      const step = Math.ceil(data.length / width)
      const amp = height / 2

      // Professional gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, '#0f0f0f')
      gradient.addColorStop(1, '#0a0a0a')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // Draw waveform with gradient
      const waveGradient = ctx.createLinearGradient(0, 0, 0, height)
      waveGradient.addColorStop(0, '#22d3ee') // Cyan 400
      waveGradient.addColorStop(0.5, '#06b6d4') // Cyan 500
      waveGradient.addColorStop(1, '#0891b2') // Cyan 600
      
      ctx.strokeStyle = waveGradient
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()

      // Optimized: access data directly instead of creating arrays
      // Use RMS for more accurate visual representation
      for (let i = 0; i < width; i++) {
        let min = 1
        let max = -1
        let sum = 0
        const offset = i * step
        
        // Calculate both min/max and RMS
        for (let j = 0; j < step && offset + j < data.length; j++) {
          const sample = data[offset + j]
          if (sample < min) min = sample
          if (sample > max) max = sample
          sum += sample * sample
        }
        
        // Use RMS for better perceived loudness
        const rms = Math.sqrt(sum / step)
        
        // Draw centered waveform
        const centerY = amp
        const minY = centerY + (min * amp * 0.9) // 0.9 for headroom
        const maxY = centerY + (max * amp * 0.9)
        
        ctx.moveTo(i, minY)
        ctx.lineTo(i, maxY)
      }

      ctx.stroke()
      
      // Add subtle grid overlay for professional look
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      // Center line
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return

      if (e.code === 'Space') {
        e.preventDefault()
        isPlaying ? handlePause() : handlePlay()
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        // Delete selected clip
        if (selectedClipId && selectedTrackId && daw) {
          daw.removeClipFromTrack(selectedTrackId, selectedClipId)
          setTracks(daw.getTracks())
          setSelectedClipId(null)
          markProjectDirty()
          showToast('Clip deleted', 'success')
        }
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        // Split selected clip at playhead
        if (selectedClipId && selectedTrackId && daw) {
          const track = daw.getTracks().find(t => t.id === selectedTrackId)
          const clip = track?.clips.find(c => c.id === selectedClipId)
          if (clip && playhead > clip.startTime && playhead < clip.startTime + clip.duration) {
            // Split clip into two parts
            const leftDuration = playhead - clip.startTime
            const rightStartTime = playhead
            const rightDuration = clip.duration - leftDuration
            const rightOffset = clip.offset + leftDuration
            
            // Update left clip (original)
            daw.updateClip(selectedTrackId, selectedClipId, { duration: leftDuration })
            
            // Create right clip
            const rightClip: Partial<TrackClip> = {
              startTime: rightStartTime,
              duration: rightDuration,
              offset: rightOffset,
              gain: clip.gain,
              buffer: clip.buffer,
              sourceUrl: clip.sourceUrl,
              name: clip.name ? `${clip.name} (split)` : undefined,
              color: clip.color,
              fadeIn: { duration: 0.01, curve: 'exponential' },
              fadeOut: clip.fadeOut
            }
            daw.addClipToTrack(selectedTrackId, rightClip)
            setTracks(daw.getTracks())
            markProjectDirty()
            showToast('Clip split at playhead', 'success')
          }
        }
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        setShowBrowser((prev) => !prev)
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShowKeyboardHelp((prev) => !prev)
      } else if (e.key === 'c' && e.ctrlKey && selectedClipId && selectedTrackId) {
        // Copy selected clip
        e.preventDefault()
        const track = daw?.getTracks().find(t => t.id === selectedTrackId)
        const clip = track?.clips.find(c => c.id === selectedClipId)
        if (clip) {
          setCopiedClip({ clip, trackId: selectedTrackId })
          showToast('Clip copied', 'info')
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId && selectedTrackId && !e.repeat) {
        // Delete selected clip
        e.preventDefault()
        if (daw && (e.target as HTMLElement).tagName !== 'INPUT') {
          daw.removeClipFromTrack(selectedTrackId, selectedClipId)
          setTracks(daw.getTracks())
          setSelectedClipId(null)
          markProjectDirty()
          showToast('✓ Clip deleted', 'success')
        }
      } else if (e.key === 'v' && e.ctrlKey && copiedClip && daw) {
        // Paste clip at playhead
        e.preventDefault()
        const track = daw.getTracks().find(t => t.id === (selectedTrackId || tracks[0]?.id))
        if (track && copiedClip.clip.buffer) {
          const newClip: Partial<TrackClip> = {
            startTime: playhead,
            duration: copiedClip.clip.duration,
            offset: copiedClip.clip.offset,
            gain: copiedClip.clip.gain,
            buffer: copiedClip.clip.buffer,
            sourceUrl: copiedClip.clip.sourceUrl,
            name: copiedClip.clip.name,
            color: copiedClip.clip.color,
            fadeIn: copiedClip.clip.fadeIn,
            fadeOut: copiedClip.clip.fadeOut
          }
          daw.addClipToTrack(track.id, newClip)
          setTracks(daw.getTracks())
          markProjectDirty()
          showToast('Clip pasted', 'success')
        }
      } else if (e.key === 'z' && e.ctrlKey && !e.shiftKey && daw) {
        // Undo
        e.preventDefault()
        const historyManager = daw.getHistoryManager()
        historyManager.undo()
        setTracks(daw.getTracks())
        showToast('↶ Undo', 'info')
      } else if (((e.key === 'y' && e.ctrlKey) || (e.key === 'z' && e.ctrlKey && e.shiftKey)) && daw) {
        // Redo (Ctrl+Y or Ctrl+Shift+Z)
        e.preventDefault()
        const historyManager = daw.getHistoryManager()
        historyManager.redo()
        setTracks(daw.getTracks())
        showToast('↷ Redo', 'info')
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && loopEnabled && activeLoopHandle) {
        e.preventDefault()
        const step = beatLength() / GRID_SUBDIVISION
        if (activeLoopHandle === 'start') {
          setLoopStart((prev) => Math.max(0, e.key === 'ArrowLeft' ? prev - step : Math.min(prev + step, loopEnd - 0.25)))
        } else {
          setLoopEnd((prev) => Math.max(loopStart + 0.25, e.key === 'ArrowLeft' ? prev - step : prev + step))
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPlaying, handlePlay, handlePause, handleSave, loopEnabled, activeLoopHandle, beatLength, loopEnd, loopStart, selectedClipId, selectedTrackId, daw, tracks, copiedClip, playhead, markProjectDirty, showToast])

  // Alt+Scroll to zoom timeline
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -10 : 10 // Zoom out/in
        setZoom(prev => Math.max(20, Math.min(200, prev + delta)))
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <div className="text-cyan-400 text-xl font-bold">Initializing Studio...</div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden md:pl-20">
      {hydrationProgress && (
        <div className="fixed top-24 right-6 z-40 px-4 py-2 bg-[#111] border border-cyan-500/40 rounded-lg text-xs text-cyan-100 shadow-lg">
          Loading project… {hydrationProgress.current}/{hydrationProgress.total}
        </div>
      )}
      {/* Top Bar */}
      <div className="h-20 bg-gradient-to-r from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] border-b border-gray-800/50 flex items-center justify-between px-6 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          {/* Logo/Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Music2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">444 Studio Pro</h1>
              <input
                id="project-name"
                name="projectName"
                type="text"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value)
                  markProjectDirty()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur() // Remove focus after Enter
                  }
                }}
                className="bg-transparent border-none text-xs text-gray-500 focus:text-cyan-400 focus:outline-none w-48 -mt-0.5"
                placeholder="Project Name"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-800"></div>

          {/* Project Controls */}
          <div className="flex items-center gap-2">
            <select
              value={currentProjectId || ''}
              onChange={(e) => {
                const id = e.target.value
                if (!id) resetProject()
                else handleLoadProject(id)
              }}
              className="bg-[#1a1a1a] border border-gray-700/50 hover:border-gray-600 rounded-lg px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none min-w-[160px] transition-all"
            >
              <option value="">New Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || 'Untitled'}
                </option>
              ))}
            </select>
            <button
              onClick={resetProject}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-300 rounded-lg text-sm transition-all"
              title="New project"
            >
              New
            </button>
            <button
              onClick={handleRenameProject}
              disabled={!currentProjectId}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-300 rounded-lg text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Rename"
            >
              Rename
            </button>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-800"></div>

          {/* BPM */}
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-gray-700/50 rounded-lg px-4 py-2">
            <span className="text-xs text-gray-500 uppercase font-semibold tracking-wider">BPM</span>
            <input
              type="range"
              min="60"
              max="200"
              value={bpm}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (daw) {
                  setBpm(next)
                  daw.setBPM(next)
                  // Update TimeEngine with new BPM
                  const timeEngine = daw.getTimeEngine()
                  timeEngine.setTempo(next, 0)
                  markProjectDirty()
                  // Clear and reset metronome if active
                  if (metronomeInterval) {
                    clearInterval(metronomeInterval)
                    setMetronomeInterval(null)
                    if (metronomeEnabled && isPlaying) {
                      const interval = setInterval(() => {
                        setMetronomeFlash(true)
                        setTimeout(() => setMetronomeFlash(false), 50)
                      }, (60 / next) * 1000)
                      setMetronomeInterval(interval)
                    }
                  }
                }
              }}
              className="w-32 accent-cyan-500"
              title={`BPM: ${bpm}`}
            />
            <span className="text-sm text-white w-10 text-center font-mono font-bold">{bpm}</span>
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-gray-700/50 rounded-lg px-4 py-2">
            <Volume2 size={16} className="text-gray-500" />
            <input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => {
                const vol = Number(e.target.value)
                setMasterVolume(vol)
                // Master volume is applied during export and per-track during playback
                // We store the value and apply it in the export function
              }}
              className="w-24 accent-cyan-500"
              title={`Master Volume: ${masterVolume}%`}
            />
            <span className="text-xs text-gray-400 w-8 text-right font-mono">{masterVolume}</span>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBrowser(!showBrowser)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              showBrowser
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-[#1a1a1a] text-gray-400 border border-gray-700/50 hover:border-gray-600'
            }`}
            title="Toggle browser (B)"
          >
            <Music2 size={16} />
            Browser
          </button>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2 shadow-xl shadow-purple-500/30 border border-purple-400/30"
            title="AI generation"
          >
            <Sparkles size={18} className="animate-pulse" />
            Generate AI
          </button>

          <button
            onClick={() => handleSave('manual')}
            disabled={saving}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-cyan-500/20"
            title={currentProjectId ? 'Save project' : 'Save as new project'}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Saving' : 'Save'}
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            title="Export project as WAV"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Exporting...' : 'Export'}
          </button>

          {(saveStatus !== 'idle' || saveTick) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-medium">
              {saveStatus !== 'idle' ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {saveStatus === 'autosaving' ? 'Auto' : 'Saving'}
                </>
              ) : (
                <>
                  <span className="text-emerald-400">✓</span>
                  Saved
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transport Bar */}
      <div className="h-18 bg-[#0d0d0d] border-b border-gray-800 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={handleStop}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-800 rounded-lg transition-colors"
            title="Stop"
          >
            <Square size={18} />
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              isPlaying
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/50'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!recordingTrackId}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
              isRecording 
                ? 'bg-red-600 text-white animate-pulse' 
                : recordingTrackId 
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white' 
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
            title={isRecording ? 'Stop recording' : recordingTrackId ? 'Start recording' : 'Arm a track first (click R)'}
          >
            <div className={`rounded-full ${isRecording ? 'w-3 h-3 bg-current' : 'w-5 h-5 bg-current'}`} />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="text-3xl font-mono tabular-nums text-cyan-400 font-bold tracking-wider" title="Press B to toggle browser | Press Space to play/pause | Ctrl+S to save">
            {Math.floor(playhead / 60)}:{String(Math.floor(playhead % 60)).padStart(2, '0')}.
            {String(Math.floor((playhead % 1) * 100)).padStart(2, '0')}
          </div>
          {(saveStatus === 'saving' || saveStatus === 'autosaving') && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-100 text-xs">
              <Loader2 size={14} className="animate-spin" />
              {saveStatus === 'autosaving' ? 'Autosaving…' : 'Saving…'}
            </div>
          )}
          {saveStatus === 'idle' && saveTick && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-100 text-xs">
              ✓ Saved
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              loopEnabled
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <Repeat size={16} className="inline mr-2" />
            Loop
          </button>
          <button
            onClick={() => {
              const nextEnabled = !metronomeEnabled
              setMetronomeEnabled(nextEnabled)
              
              // If turning on while already playing, start metronome immediately
              if (nextEnabled && isPlaying && !metronomeInterval) {
                playMetronomeClick()
                const interval = setInterval(() => {
                  setMetronomeFlash(true)
                  setTimeout(() => setMetronomeFlash(false), 50)
                  playMetronomeClick()
                }, (60 / bpm) * 1000)
                setMetronomeInterval(interval)
              } else if (!nextEnabled && metronomeInterval) {
                // Turn off
                clearInterval(metronomeInterval)
                setMetronomeInterval(null)
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              metronomeEnabled
                ? metronomeFlash
                  ? 'bg-cyan-500 text-black scale-110 shadow-lg shadow-cyan-500/50'
                  : 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            }`}
            title="Toggle metronome"
          >
            {metronomeFlash ? '🔊' : '🎵'}
            <span>Metronome</span>
          </button>
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              snapEnabled
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <Grid3x3 size={16} className="inline mr-2" />
            Snap
          </button>
          {/* CPU Usage Indicator */}
          {cpuUsage > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-lg" title={`Audio engine load: ${Math.round(cpuUsage * 100)}%`}>
              <div className="text-xs text-gray-500 uppercase font-medium">CPU</div>
              <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ${
                    cpuUsage > 0.8 ? 'bg-red-500' : cpuUsage > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, cpuUsage * 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 font-mono w-8 text-right">
                {Math.round(cpuUsage * 100)}%
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              title="Keyboard shortcuts (?)"
            >
              <span className="text-sm font-bold">?</span>
            </button>
            <div className="text-xs text-gray-500 uppercase font-medium">Zoom</div>
            <button
              onClick={() => setZoom((prev) => Math.max(10, prev - 10))}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-lg font-bold"
              title="Zoom out"
            >
              -
            </button>
            <div className="text-xs text-gray-400 w-12 text-center">{zoom}px/s</div>
            <button
              onClick={() => setZoom((prev) => Math.min(200, prev + 10))}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-lg font-bold"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser Panel */}
        {showBrowser && (
          <div className="w-80 bg-gradient-to-b from-[#0a0a0a] to-[#0d0d0d] border-r border-gray-800/50 flex flex-col">
            <div className="h-16 border-b border-gray-800/50 flex flex-col justify-center px-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">
                  Library
                </h2>
                <div className="text-xs text-gray-500 font-medium">
                  {library.filter((item) =>
                    item.title.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length} tracks
                </div>
              </div>
              <div className="flex gap-2">
                <label className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 hover:from-cyan-500/30 hover:to-cyan-600/30 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                  <Download size={13} />
                  Import Audio
                  <input
                    id="audio-import"
                    name="audioFile"
                    type="file"
                    accept="audio/mp3,audio/wav,audio/mpeg,audio/wave"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      
                      showToast('Uploading...', 'info')
                      
                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
                        formData.append('type', 'music')
                        
                        const response = await fetch('/api/profile/upload', {
                          method: 'POST',
                          body: formData
                        })
                        
                        const result = await response.json()
                        
                        if (response.ok && result.success) {
                          showToast('✓ Audio imported', 'success')
                          await loadLibrary()
                        } else {
                          console.error('Import failed:', result.error || 'Unknown error')
                          showToast(`Import failed: ${result.error || 'Unknown error'}`, 'error')
                        }
                      } catch (error: any) {
                        console.error('Import error:', error)
                        showToast(`Import failed: ${error.message || 'Network error'}`, 'error')
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  onClick={() => setShowStemSplitter(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-purple-400 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Scissors size={13} />
                  Stem Split
                </button>
              </div>
            </div>
            <div className="p-4 pb-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  size={15}
                />
                <input
                  id="library-search"
                  name="search"
                  type="text"
                  placeholder="Search your library..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700/50 hover:border-gray-600 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none transition-all placeholder:text-gray-600"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {library.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                    <Music size={28} className="text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-500 mb-2">No tracks yet</p>
                  <p className="text-xs text-gray-600">Import audio or generate with AI</p>
                </div>
              ) : (
                library
                  .filter((item) =>
                    item.title.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('audioUrl', item.audio_url)
                        e.dataTransfer.setData('title', item.title)
                        setDragPreview({ time: 0, trackId: null })
                      }}
                      onDragEnd={() => setDragPreview(null)}
                      className="group relative bg-gradient-to-br from-[#1a1a1a] to-[#151515] hover:from-[#202020] hover:to-[#1a1a1a] border border-gray-800/50 hover:border-gray-700 rounded-xl p-4 cursor-move transition-all duration-200 hover:scale-[1.01] hover:shadow-lg hover:shadow-cyan-500/10"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Music size={20} className="text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-semibold truncate group-hover:text-cyan-400 transition-colors mb-1">
                            {item.title}
                          </div>
                          {item.genre && (
                            <div className="text-xs text-gray-500 capitalize">{item.genre}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAudioForStems(item.audio_url)
                            setShowStemSplitter(true)
                          }}
                          className="flex-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                        >
                          <Scissors size={12} />
                          Split
                        </button>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-xs text-cyan-400 font-medium">
                          Drag to timeline
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Timeline Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-auto relative" ref={timelineRef}>
              <div
                className="relative inline-flex min-w-full"
                style={{ minWidth: `${TRACK_HEADER_WIDTH + timelineWidth}px` }}
              >
                <div
                  className="sticky left-0 z-30 flex-shrink-0 bg-[#111] border-r border-gray-800"
                  style={{ width: `${TRACK_HEADER_WIDTH}px` }}
                >
                  <div
                    className="sticky top-0 z-30 bg-[#111] border-b border-gray-800 flex items-center px-4 text-xs font-semibold uppercase tracking-wide text-gray-500"
                    style={{ height: `${TIMELINE_HEIGHT}px` }}
                  >
                    Tracks
                  </div>
                  <div>
                    {tracks.map((track, idx) => (
                      <div
                        key={track.id}
                        style={{ height: `${TRACK_HEIGHT}px` }}
                        className={`border-b border-gray-900 px-3 py-2 cursor-pointer transition-colors ${
                          selectedTrackId === track.id
                            ? 'bg-gray-900 border-l-2 border-l-cyan-500'
                            : 'bg-[#0d0d0d] hover:bg-gray-900/50'
                        }`}
                        onClick={() => setSelectedTrackId(track.id)}
                      >
                        {/* Track Name */}
                        <div 
                          className="text-xs font-semibold text-gray-300 mb-2 truncate cursor-text"
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setEditingTrackId(track.id)
                            setEditingTrackName(track.name)
                          }}
                        >
                          {editingTrackId === track.id ? (
                            <input
                              type="text"
                              value={editingTrackName}
                              onChange={(e) => setEditingTrackName(e.target.value)}
                              onBlur={() => {
                                if (editingTrackName.trim() && daw) {
                                  const trackManager = daw.getTrackManager()
                                  const trackState = trackManager.getTrack(track.id)
                                  if (trackState) {
                                    trackState.name = editingTrackName.trim()
                                    setTracks(daw.getTracks())
                                    markProjectDirty()
                                  }
                                }
                                setEditingTrackId(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                } else if (e.key === 'Escape') {
                                  setEditingTrackId(null)
                                }
                              }}
                              autoFocus
                              className="w-full bg-gray-800 border border-cyan-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                            />
                          ) : (
                            track.name
                          )}
                        </div>
                        
                        {/* M/S/R Buttons */}
                        <div className="flex gap-1 mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const newMuted = !track.muted
                              daw?.updateTrack(track.id, { muted: newMuted })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className={`w-7 h-6 text-[10px] font-bold rounded ${
                              track.muted
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                            }`}
                            title="Mute"
                          >
                            M
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const newSolo = !track.solo
                              daw?.updateTrack(track.id, { solo: newSolo })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className={`w-7 h-6 text-[10px] font-bold rounded ${
                              track.solo
                                ? 'bg-yellow-500 text-black'
                                : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                            }`}
                            title="Solo"
                          >
                            S
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setRecordingTrackId(recordingTrackId === track.id ? null : track.id)
                            }}
                            className={`w-7 h-6 text-[10px] font-bold rounded ${
                              recordingTrackId === track.id
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                            }`}
                            title="Arm"
                          >
                            ●
                          </button>
                        </div>
                        
                        {/* Volume Control + Level Meter */}
                        <div className="flex items-center gap-1.5">
                          <Volume2 size={10} className="text-gray-600 flex-shrink-0" />
                          <input
                            id={`volume-${track.id}`}
                            name={`volume-track-${idx + 1}`}
                            type="range"
                            min="0"
                            max="100"
                            value={track.volume * 100}
                            onChange={(e) => {
                              e.stopPropagation()
                              const newVolume = Number(e.target.value) / 100
                              daw?.updateTrack(track.id, { volume: newVolume })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className="flex-1 h-1 accent-cyan-500 min-w-0"
                            title={`Volume: ${Math.round(track.volume * 100)}%`}
                          />
                          {/* Level Meter */}
                          <div className="w-10 h-1.5 bg-gray-900 rounded-full overflow-hidden flex-shrink-0" title="Audio level">
                            <div 
                              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                              style={{ width: `${(trackLevels.get(track.id) || 0) * 100}%` }}
                            />
                          </div>
                        </div>
                        {/* Pan Control */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] text-gray-600 font-mono w-3 flex-shrink-0">L</span>
                          <input
                            id={`pan-${track.id}`}
                            name={`pan-track-${idx + 1}`}
                            type="range"
                            min="-100"
                            max="100"
                            value={Math.round(track.pan * 100)}
                            onChange={(e) => {
                              e.stopPropagation()
                              const newPan = Number(e.target.value) / 100
                              daw?.updateTrack(track.id, { pan: newPan })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className="flex-1 h-1 accent-purple-400 min-w-0"
                            title={`Pan: ${track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}`}
                          />
                          <span className="text-[9px] text-gray-600 font-mono w-3 flex-shrink-0">R</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="relative flex-1"
                  style={{ width: `${timelineWidth}px` }}
                >
                  <div
                    className="sticky top-0 z-10 bg-[#0d0d0d] border-b border-gray-800 relative cursor-pointer"
                    style={{ height: `${TIMELINE_HEIGHT}px`, width: `${timelineWidth}px` }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX - rect.left
                      const time = Math.max(0, Math.min(TIMELINE_SECONDS, x / zoom))
                      daw?.seekTo(time)
                      setPlayhead(time)
                    }}
                  >
                    {timeMarkerIndices.map((second) => (
                      <div
                        key={second}
                        className="absolute top-0 h-full"
                        style={{ left: `${second * zoom}px` }}
                      >
                        <div className="h-full border-l border-gray-700 relative">
                          <span className="text-xs text-gray-500 ml-2 absolute top-2">
                            {second}s
                          </span>
                        </div>
                      </div>
                    ))}

                    {loopEnabled && (
                      <div
                        className="absolute top-0 bottom-0 bg-orange-500/20 border-l-2 border-r-2 border-orange-500"
                        style={{
                          left: `${loopStart * zoom}px`,
                          width: `${(loopEnd - loopStart) * zoom}px`
                        }}
                      />
                    )}

                    {loopEnabled && (
                      <>
                        <div
                          className={`absolute -bottom-2 w-3 h-6 bg-orange-500 rounded cursor-ew-resize ${
                            activeLoopHandle === 'start' ? 'ring-2 ring-orange-300' : ''
                          }`}
                          style={{ left: `${loopStart * zoom - 6}px` }}
                          onMouseDown={() => {
                            setDraggingLoopHandle('start')
                            setActiveLoopHandle('start')
                          }}
                          title="Drag to set loop start"
                        />
                        <div
                          className={`absolute -bottom-2 w-3 h-6 bg-orange-500 rounded cursor-ew-resize ${
                            activeLoopHandle === 'end' ? 'ring-2 ring-orange-300' : ''
                          }`}
                          style={{ left: `${loopEnd * zoom - 6}px` }}
                          onMouseDown={() => {
                            setDraggingLoopHandle('end')
                            setActiveLoopHandle('end')
                          }}
                          title="Drag to set loop end"
                        />
                        <div className="absolute -bottom-8 left-2 text-[11px] text-orange-200 bg-[#1a1a1a] px-2 py-1 rounded border border-orange-500/40">
                          Loop {formatBarsBeats(loopStart)} → {formatBarsBeats(loopEnd)}
                        </div>
                      </>
                    )}
                  </div>

                  {tracks.map((track, idx) => (
                    <div
                      key={track.id}
                      className="relative border-b border-gray-900"
                      style={{
                        height: `${TRACK_HEIGHT}px`,
                        width: `${timelineWidth}px`,
                        backgroundColor: idx % 2 === 0 ? '#080808' : '#0a0a0a'
                      }}
                      onClick={(e) => {
                        // Click-to-seek: clicking on track background moves playhead
                        if (e.target === e.currentTarget) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const time = Math.max(0, Math.min(TIMELINE_SECONDS, x / zoom))
                          daw?.seekTo(time)
                          setPlayhead(time)
                          setSelectedTrackId(track.id)
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        const audioUrl = e.dataTransfer.getData('audioUrl')
                        if (audioUrl) {
                          setDragPreview(null) // Clear preview immediately
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const startTime = snapTime(Math.max(0, x) / zoom)
                          
                          // Show loading state
                          showToast('Adding clip...', 'info')
                          
                          try {
                            await handleAddClip(audioUrl, track.id, startTime)
                            showToast('✓ Clip added', 'success')
                          } catch (error) {
                            console.error('Drop failed:', error)
                          }
                        }
                      }}
                      onDragLeave={() => setDragPreview(null)}
                      onDragEnter={(e) => {
                        e.preventDefault()
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        // Throttle drag preview updates to every 50ms to prevent excessive re-renders
                        const now = Date.now()
                        if (!window.lastDragUpdate || now - window.lastDragUpdate > 50) {
                          window.lastDragUpdate = now
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const time = snapTime(Math.max(0, x) / zoom)
                          setDragPreview({ time, trackId: track.id })
                        }
                      }}
                    >
                      {gridLineIndices.map((stepIndex) => (
                        <div
                          key={stepIndex}
                          className="absolute top-0 bottom-0 border-l pointer-events-none"
                          style={{
                            left: `${(stepIndex / GRID_SUBDIVISION) * zoom}px`,
                            borderColor: stepIndex % GRID_SUBDIVISION === 0 ? '#333' : '#222'
                          }}
                        />
                      ))}

                      {track.clips.map((clip) => (
                        <div
                          key={clip.id}
                          className={`absolute top-2 bottom-2 bg-gradient-to-br from-cyan-500/30 to-purple-500/20 border-2 rounded-lg overflow-hidden cursor-move hover:border-cyan-400 transition-all shadow-lg hover:shadow-cyan-500/30 ${
                            selectedClipId === clip.id ? 'border-cyan-400 ring-2 ring-cyan-400/50 z-10' : 'border-cyan-500/50 z-[2]'
                          }`}
                          style={{
                            left: `${clip.startTime * zoom}px`,
                            width: `${clip.duration * zoom}px`,
                            zIndex: selectedClipId === clip.id ? 10 : 2
                          }}
                          onClick={() => {
                            setSelectedClipId(clip.id)
                            setSelectedTrackId(track.id)
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id, trackId: track.id })
                            setSelectedClipId(clip.id)
                            setSelectedTrackId(track.id)
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            setSelectedClipId(clip.id)
                            setSelectedTrackId(track.id)
                            const rect = e.currentTarget.getBoundingClientRect()
                            const offsetX = e.clientX - rect.left
                            setDraggingClip({ clipId: clip.id, trackId: track.id, offsetX })
                            
                            const handleMove = (moveE: MouseEvent) => {
                              if (!timelineRef.current) return
                              const timelineRect = timelineRef.current.getBoundingClientRect()
                              const scrollLeft = timelineRef.current.scrollLeft
                              const x = moveE.clientX - timelineRect.left + scrollLeft - TRACK_HEADER_WIDTH - offsetX
                              // Apply snap during drag for visual feedback
                              const newStartTime = snapTime(Math.max(0, x / zoom))
                              
                              if (daw) {
                                const trackManager = daw.getTrackManager()
                                const updatedClip = { ...clip, startTime: newStartTime }
                                trackManager.updateClip(track.id, clip.id, updatedClip)
                                setTracks(daw.getTracks())
                              }
                            }
                            
                            const handleUp = () => {
                              // Final snap on drag end for consistency
                              if (daw && snapEnabled) {
                                const trackManager = daw.getTrackManager()
                                const clips = trackManager.getClips(track.id)
                                const currentClip = clips.find(c => c.id === clip.id)
                                if (currentClip) {
                                  const snappedTime = snapTime(currentClip.startTime)
                                  if (Math.abs(snappedTime - currentClip.startTime) > 0.001) {
                                    trackManager.updateClip(track.id, clip.id, { ...currentClip, startTime: snappedTime })
                                    setTracks(daw.getTracks())
                                  }
                                }
                              }
                              setDraggingClip(null)
                              markProjectDirty()
                              window.removeEventListener('mousemove', handleMove)
                              window.removeEventListener('mouseup', handleUp)
                            }
                            
                            window.addEventListener('mousemove', handleMove)
                            window.addEventListener('mouseup', handleUp)
                          }}
                        >
                          <canvas
                            ref={(canvas) => {
                              if (canvas && clip.buffer) {
                                const cacheKey = `${clip.id}-${zoom.toFixed(1)}`
                                // Only re-render if zoom or clip changed
                                if (canvas.dataset.cacheKey !== cacheKey) {
                                  canvas.width = clip.duration * zoom
                                  canvas.height = TRACK_HEIGHT - 16
                                  canvas.dataset.cacheKey = cacheKey
                                  renderWaveform(canvas, clip.buffer)
                                }
                              }
                            }}
                            className="w-full h-full pointer-events-none"
                          />
                          
                          {/* Left Resize Handle */}
                          <div
                            className="absolute top-0 bottom-0 left-0 w-2 bg-purple-500/40 hover:w-3 hover:bg-purple-400 cursor-ew-resize z-[25] transition-all"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              const origStartTime = clip.startTime
                              const origDuration = clip.duration
                              const origOffset = clip.offset
                              
                              const handleMove = (moveE: MouseEvent) => {
                                if (!daw) return
                                const dx = moveE.clientX - e.clientX
                                const timeDelta = dx / zoom
                                const newStartTime = Math.max(0, origStartTime + timeDelta)
                                const newDuration = Math.max(0.1, origDuration - timeDelta)
                                const newOffset = Math.max(0, origOffset + timeDelta)
                                
                                // Ensure we don't exceed buffer duration
                                if (clip.buffer && newOffset + newDuration <= clip.buffer.duration) {
                                  daw.updateClip(track.id, clip.id, {
                                    startTime: newStartTime,
                                    duration: newDuration,
                                    offset: newOffset
                                  })
                                  setTracks(daw.getTracks())
                                }
                              }
                              
                              const handleUp = () => {
                                setDraggingResize(null)
                                markProjectDirty()
                                window.removeEventListener('mousemove', handleMove)
                                window.removeEventListener('mouseup', handleUp)
                              }
                              
                              window.addEventListener('mousemove', handleMove)
                              window.addEventListener('mouseup', handleUp)
                            }}
                            title="Drag to trim clip start"
                          />
                          
                          {/* Right Resize Handle */}
                          <div
                            className="absolute top-0 bottom-0 right-0 w-2 bg-purple-500/40 hover:w-3 hover:bg-purple-400 cursor-ew-resize z-[25] transition-all"
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              const origDuration = clip.duration
                              
                              const handleMove = (moveE: MouseEvent) => {
                                if (!daw) return
                                const dx = moveE.clientX - e.clientX
                                const timeDelta = dx / zoom
                                const newDuration = Math.max(0.1, origDuration + timeDelta)
                                
                                // Ensure we don't exceed buffer duration
                                if (clip.buffer && clip.offset + newDuration <= clip.buffer.duration) {
                                  daw.updateClip(track.id, clip.id, {
                                    duration: newDuration
                                  })
                                  setTracks(daw.getTracks())
                                }
                              }
                              
                              const handleUp = () => {
                                setDraggingResize(null)
                                markProjectDirty()
                                window.removeEventListener('mousemove', handleMove)
                                window.removeEventListener('mouseup', handleUp)
                              }
                              
                              window.addEventListener('mousemove', handleMove)
                              window.addEventListener('mouseup', handleUp)
                            }}
                            title="Drag to trim clip end"
                          />
                          
                          {/* Fade In Handle & Overlay */}
                          {clip.fadeIn && clip.fadeIn.duration > 0 && (
                            <>
                              <div 
                                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-black/60 to-transparent pointer-events-none"
                                style={{ width: `${(clip.fadeIn.duration / clip.duration) * 100}%` }}
                              />
                              <div
                                className="absolute top-0 bottom-0 left-0 w-2 bg-cyan-500/30 hover:w-3 hover:bg-cyan-400/80 cursor-ew-resize z-20 transition-all group"
                                onMouseDown={(e) => {
                                  // Fade In drag handler (existing code)
                                  e.stopPropagation()
                                  setDraggingFade({ clipId: clip.id, trackId: track.id, type: 'in' })
                                  
                                  const handleMove = (moveE: MouseEvent) => {
                                    if (!daw) return
                                    const dx = moveE.clientX - e.clientX
                                    const newFadeDuration = Math.max(0.01, Math.min(clip.duration / 2, clip.fadeIn!.duration + dx / zoom))
                                    daw.updateClip(track.id, clip.id, {
                                      fadeIn: { duration: newFadeDuration, curve: 'exponential' }
                                    })
                                    setTracks(daw.getTracks())
                                  }
                                  
                                  const handleUp = () => {
                                    setDraggingFade(null)
                                    markProjectDirty()
                                    window.removeEventListener('mousemove', handleMove)
                                    window.removeEventListener('mouseup', handleUp)
                                  }
                                  
                                  window.addEventListener('mousemove', handleMove)
                                  window.addEventListener('mouseup', handleUp)
                                }}
                                title="Drag to adjust fade in"
                              />
                            </>
                          )}
                          
                          {/* Fade Out Handle & Overlay */}
                          {clip.fadeOut && clip.fadeOut.duration > 0 && (
                            <>
                              <div 
                                className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-black/60 to-transparent pointer-events-none"
                                style={{ width: `${(clip.fadeOut.duration / clip.duration) * 100}%` }}
                              />
                              <div
                                className="absolute top-0 bottom-0 right-0 w-2 bg-cyan-500/30 hover:w-3 hover:bg-cyan-400/80 cursor-ew-resize z-20 transition-all group"
                                onMouseDown={(e) => {
                                  // Fade Out drag handler (existing code)
                                  e.stopPropagation()
                                  setDraggingFade({ clipId: clip.id, trackId: track.id, type: 'out' })
                                  
                                  const handleMove = (moveE: MouseEvent) => {
                                    if (!daw) return
                                    const dx = e.clientX - moveE.clientX
                                    const newFadeDuration = Math.max(0.01, Math.min(clip.duration / 2, clip.fadeOut!.duration + dx / zoom))
                                    daw.updateClip(track.id, clip.id, {
                                      fadeOut: { duration: newFadeDuration, curve: 'exponential' }
                                    })
                                    setTracks(daw.getTracks())
                                  }
                                  
                                  const handleUp = () => {
                                    setDraggingFade(null)
                                    markProjectDirty()
                                    window.removeEventListener('mousemove', handleMove)
                                    window.removeEventListener('mouseup', handleUp)
                                  }
                                  
                                  window.addEventListener('mousemove', handleMove)
                                  window.addEventListener('mouseup', handleUp)
                                }}
                                title="Drag to adjust fade out"
                              />
                            </>
                          )}
                        </div>
                      ))}

                      {loopEnabled && (
                        <div
                          className="absolute top-0 bottom-0 bg-orange-500/5 pointer-events-none"
                          style={{
                            left: `${loopStart * zoom}px`,
                            width: `${(loopEnd - loopStart) * zoom}px`
                          }}
                        />
                      )}
                      
                      {/* Loading indicator for clips being added to this track */}
                      {Array.from(loadingClips).some(key => key.startsWith(`${track.id}-`)) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none z-30">
                          <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/90 rounded-lg border border-cyan-500/30">
                            <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-gray-300">Loading audio...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <div
                    className="absolute top-0 w-1 bg-cyan-400 shadow-lg shadow-cyan-500/50 cursor-ew-resize"
                    style={{
                      left: `${playhead * zoom}px`,
                      height: `${TIMELINE_HEIGHT + tracks.length * TRACK_HEIGHT}px`,
                      pointerEvents: 'auto',
                      zIndex: 20
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      const startX = e.clientX
                      const startPlayhead = playhead
                      const handleMove = (moveE: MouseEvent) => {
                        const delta = (moveE.clientX - startX) / zoom
                        const newTime = Math.max(0, Math.min(TIMELINE_SECONDS, startPlayhead + delta))
                        daw?.seekTo(newTime)
                        setPlayhead(newTime)
                      }
                      const handleUp = () => {
                        window.removeEventListener('mousemove', handleMove)
                        window.removeEventListener('mouseup', handleUp)
                      }
                      window.addEventListener('mousemove', handleMove)
                      window.addEventListener('mouseup', handleUp)
                    }}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-cyan-400 rotate-45 rounded-sm pointer-events-none" />
                  </div>

                  {dragPreview && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-cyan-500/70 pointer-events-none"
                      style={{ left: `${dragPreview.time * zoom}px`, zIndex: 30 }}
                    >
                      <div className="absolute -top-6 -left-8 px-2 py-1 rounded bg-[#0d0d0d] border border-cyan-500/40 text-xs text-cyan-100 whitespace-nowrap">
                        {dragPreview.trackId ? 'Drop here' : 'Drag'} @{' '}
                        {snapEnabled ? formatBarsBeats(dragPreview.time) : `${dragPreview.time.toFixed(2)}s`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced AI Generation Modal */}
      <GenerateModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGenerate}
        generating={generatingTrack}
        progress={generationProgress}
        step={generationStep}
        prompt={genPrompt}
        setPrompt={setGenPrompt}
        title={genTitle}
        setTitle={setGenTitle}
        genre={genGenre}
        setGenre={setGenGenre}
        bpm={genBpm}
        setBpm={setGenBpm}
        isInstrumental={genIsInstrumental}
        setIsInstrumental={setGenIsInstrumental}
        lyrics={genLyrics}
        setLyrics={setGenLyrics}
      />

      {/* Stem Splitter Modal */}
      <StemSplitterModal
        isOpen={showStemSplitter}
        onClose={() => {
          setShowStemSplitter(false)
          setStemResults(null)
          setSelectedAudioForStems(null)
        }}
        isSplitting={isSplittingStems}
        selectedAudio={selectedAudioForStems}
        stemResults={stemResults}
        onSplit={handleSplitStems}
      />

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[200px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setShowGenerateModal(true)
                setContextMenu(null)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Sparkles size={14} className="text-purple-400" />
              Generate AI
            </button>
            <button
              onClick={() => {
                const track = daw?.getTracks().find(t => t.id === contextMenu.trackId)
                const clip = track?.clips.find(c => c.id === contextMenu.clipId)
                if (clip?.sourceUrl) {
                  setSelectedAudioForStems(clip.sourceUrl)
                  setShowStemSplitter(true)
                }
                setContextMenu(null)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Scissors size={14} className="text-purple-400" />
              Split Stems
            </button>
            <div className="border-t border-gray-800 my-1" />
            <button
              onClick={() => {
                handleDuplicateClip(contextMenu.trackId, contextMenu.clipId)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Copy size={14} className="text-cyan-400" />
              Duplicate
            </button>
            <button
              onClick={() => {
                const track = daw?.getTracks().find(t => t.id === contextMenu.trackId)
                const clip = track?.clips.find(c => c.id === contextMenu.clipId)
                if (clip) {
                  setCopiedClip({ clip, trackId: contextMenu.trackId })
                  showToast('Clip copied', 'info')
                }
                setContextMenu(null)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Copy size={14} className="text-cyan-400" />
              Copy
            </button>
            <button
              onClick={() => {
                if (copiedClip && daw) {
                  const track = daw.getTracks().find(t => t.id === contextMenu.trackId)
                  if (track && copiedClip.clip.buffer) {
                    const targetClip = track.clips.find(c => c.id === contextMenu.clipId)
                    const pasteTime = targetClip ? targetClip.startTime + targetClip.duration + 0.1 : playhead
                    const newClip: Partial<TrackClip> = {
                      startTime: pasteTime,
                      duration: copiedClip.clip.duration,
                      offset: copiedClip.clip.offset,
                      gain: copiedClip.clip.gain,
                      buffer: copiedClip.clip.buffer,
                      sourceUrl: copiedClip.clip.sourceUrl,
                      name: copiedClip.clip.name,
                      color: copiedClip.clip.color,
                      fadeIn: copiedClip.clip.fadeIn,
                      fadeOut: copiedClip.clip.fadeOut
                    }
                    daw.addClipToTrack(contextMenu.trackId, newClip)
                    setTracks(daw.getTracks())
                    markProjectDirty()
                    showToast('Clip pasted', 'success')
                  }
                }
                setContextMenu(null)
              }}
              disabled={!copiedClip}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Clipboard size={14} className="text-cyan-400" />
              Paste
            </button>
            <div className="border-t border-gray-800 my-1" />
            <button
              onClick={() => {
                if (daw) {
                  daw.removeClipFromTrack(contextMenu.trackId, contextMenu.clipId)
                  setTracks(daw.getTracks())
                  markProjectDirty()
                  showToast('Clip deleted', 'success')
                }
                setContextMenu(null)
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-red-900/50 hover:text-red-400 transition-colors flex items-center gap-2"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardHelpModal
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 border ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-red-500/20 border-red-500/40 text-red-200'
              : 'bg-gray-800 border-gray-700 text-gray-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
    </ErrorBoundary>
  )
}
