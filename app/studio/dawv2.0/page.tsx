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
  Folder,
  Plus,
  PanelRight,
  Image as ImageIcon,
  Film,
  Upload,
  Rocket,
  Edit3,
  Zap,
  Send,
  Lightbulb,
  ChevronLeft
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
const EffectsGenerationModal = lazy(() => import('@/app/components/EffectsGenerationModal'))
const LoopersGenerationModal = lazy(() => import('@/app/components/LoopersGenerationModal'))
const MediaUploadModal = lazy(() => import('@/app/components/MediaUploadModal'))

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

  // Right sidebar panel
  const [showRightPanel, setShowRightPanel] = useState(true)

  // Stem splitter states
  const [showStemSplitter, setShowStemSplitter] = useState(false)
  const [isSplittingStems, setIsSplittingStems] = useState(false)
  const [selectedAudioForStems, setSelectedAudioForStems] = useState<string | null>(null)
  const [stemResults, setStemResults] = useState<any>(null)

  // Credits
  const [userCredits, setUserCredits] = useState<number | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)

  // Feature modals
  const [showEffectsModal, setShowEffectsModal] = useState(false)
  const [showLoopersModal, setShowLoopersModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideasView, setIdeasView] = useState<'tags' | 'type' | 'genre' | 'generating'>('tags')
  const [promptType, setPromptType] = useState<'song' | 'beat'>('song')
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('music')

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

        for (let i = 0; i < 3; i++) {
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
          const audioContext = instance.getAudioContext()
          if (state.isPlaying && audioContext) {
            const currentTime = instance.getCurrentTime()
            const loop = loopRef.current
            
            // Handle looping
            if (loop.enabled && currentTime >= loop.end) {
              instance.seekTo(loop.start)
            } else {
              setPlayhead(currentTime)
            }
          }
          // Don't set isPlaying here — let handlePlay/handlePause own that state
          // This prevents flicker during seekTo() which does pause→play internally
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
  const handlePlay = useCallback(async () => {
    if (!daw) return
    try {
      await daw.play()
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

  // Fetch credits
  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setUserCredits(data.credits || 0)
      setIsLoadingCredits(false)
    } catch {
      setUserCredits(0)
      setIsLoadingCredits(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchCredits()
      const iv = setInterval(fetchCredits, 30000)
      return () => clearInterval(iv)
    }
  }, [user, fetchCredits])

  // Tag click handler for Ideas
  const handleTagClick = useCallback((tag: string) => {
    setGenPrompt(prev => prev ? `${prev}, ${tag}` : tag)
  }, [])

  // Generate prompt idea
  const handleGenerateIdea = useCallback(async (genre: string, type: 'song' | 'beat') => {
    setIsGeneratingIdea(true)
    try {
      const res = await fetch('/api/generate/prompt-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre, promptType: type })
      })
      const data = await res.json()
      if (data.success && data.prompt) {
        setGenPrompt(data.prompt.slice(0, 300))
        setShowIdeas(false)
      }
    } catch {
      showToast('Failed to generate idea', 'error')
    } finally {
      setIsGeneratingIdea(false)
    }
  }, [showToast])

  // Add generated audio result to an empty DAW track
  const addResultToTrack = useCallback(async (audioUrl: string, title: string) => {
    if (!daw) return
    const emptyTrack = tracks.find(t => t.clips.length === 0)
    if (emptyTrack) {
      try {
        await handleAddClip(audioUrl, emptyTrack.id, 0)
        showToast(`✓ "${title}" added to timeline`, 'success')
      } catch {
        showToast(`✓ Generated: "${title}" (check library)`, 'success')
      }
    } else {
      showToast(`✓ Generated: "${title}" (drag from library)`, 'success')
    }
    await loadLibrary()
    fetchCredits()
  }, [daw, tracks, handleAddClip, showToast, fetchCredits, loadLibrary])

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

      // Build prompt with genre/BPM like create page does
      let fullPrompt = genPrompt
      if (finalGenre) fullPrompt += ` [${finalGenre}]`
      if (finalBpm) fullPrompt += ` [${finalBpm} BPM]`

      const response = await fetch('/api/generate/music-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          title: finalTitle,
          lyrics: finalLyrics || (genIsInstrumental ? '[Instrumental]' : ''),
          duration: 'medium',
          language: 'English',
          genre: finalGenre,
          bpm: finalBpm ? parseInt(finalBpm) : undefined,
          generateCoverArt: false
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Generation failed')
      }

      const result = await response.json()

      if (result.success && result.audioUrl) {
        setGenerationProgress('Adding to timeline...')
        await addResultToTrack(result.audioUrl, finalTitle)
        if (result.creditsRemaining != null) setUserCredits(result.creditsRemaining)
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
      for (let i = 0; i < 3; i++) {
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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400/60 animate-spin mx-auto mb-3" />
          <div className="text-white/30 text-[11px] font-medium tracking-wide">Initializing Studio</div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden md:pl-20">
      {hydrationProgress && (
        <div className="fixed top-20 right-4 z-40 px-3 py-1.5 bg-[#111]/90 backdrop-blur-sm border border-white/[0.08] rounded-md text-[10px] text-white/40">
          Loading project… {hydrationProgress.current}/{hydrationProgress.total}
        </div>
      )}
      {/* Top Bar */}
      {/* Unified Top Bar */}
      <div className="h-14 bg-[#0d0d0d]/95 border-b border-white/[0.06] flex items-center px-4 gap-2 backdrop-blur-xl select-none shrink-0">
        {/* Logo */}
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-md flex items-center justify-center shrink-0">
          <Music2 size={15} className="text-white" />
        </div>

        {/* Project Name */}
        <input
          id="project-name"
          name="projectName"
          type="text"
          value={projectName}
          onChange={(e) => { setProjectName(e.target.value); markProjectDirty() }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="bg-transparent text-[13px] text-white/70 focus:text-white w-32 truncate border-none outline-none placeholder:text-white/20 font-medium"
          placeholder="Untitled"
        />

        {/* Divider */}
        <div className="h-5 w-px bg-white/[0.06]" />

        {/* Transport */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleStop}
            className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
            title="Stop"
          >
            <Square size={14} fill="currentColor" />
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              isPlaying
                ? 'bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                : 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} fill="currentColor" strokeWidth={0} />}
          </button>
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!recordingTrackId}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${
              isRecording 
                ? 'bg-red-500 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]' 
                : recordingTrackId 
                  ? 'text-red-400 hover:bg-red-500/20' 
                  : 'text-white/15 cursor-not-allowed'
            }`}
            title={isRecording ? 'Stop recording' : recordingTrackId ? 'Record' : 'Arm a track first'}
          >
            <div className={`rounded-full bg-current ${isRecording ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/[0.06]" />

        {/* Time Display */}
        <div className="flex items-baseline gap-2 min-w-[140px] justify-center font-mono">
          <span className="text-xl tabular-nums text-cyan-400 font-semibold tracking-tight">
            {formatBarsBeats(playhead)}
          </span>
          <span className="text-[11px] tabular-nums text-white/25">
            {Math.floor(playhead / 60)}:{String(Math.floor(playhead % 60)).padStart(2, '0')}.{String(Math.floor((playhead % 1) * 100)).padStart(2, '0')}
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/[0.06]" />

        {/* BPM */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30 uppercase font-semibold tracking-widest">BPM</span>
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
                const timeEngine = daw.getTimeEngine()
                timeEngine.setTempo(next, 0)
                markProjectDirty()
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
            className="w-20 h-1 accent-cyan-400 cursor-pointer"
            title={`BPM: ${bpm}`}
          />
          <span className="text-[13px] text-white/80 w-8 text-center font-mono font-semibold">{bpm}</span>
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-1.5">
          <Volume2 size={13} className="text-white/30" />
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={(e) => { setMasterVolume(Number(e.target.value)) }}
            className="w-16 h-1 accent-cyan-400 cursor-pointer"
            title={`Master: ${masterVolume}%`}
          />
          <span className="text-[11px] text-white/40 w-6 text-right font-mono">{masterVolume}</span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-white/[0.06]" />

        {/* Mode Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
              loopEnabled
                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
            title="Loop"
          >
            <Repeat size={12} />
            Loop
          </button>
          <button
            onClick={() => {
              const nextEnabled = !metronomeEnabled
              setMetronomeEnabled(nextEnabled)
              if (nextEnabled && isPlaying && !metronomeInterval) {
                playMetronomeClick()
                const interval = setInterval(() => {
                  setMetronomeFlash(true)
                  setTimeout(() => setMetronomeFlash(false), 50)
                  playMetronomeClick()
                }, (60 / bpm) * 1000)
                setMetronomeInterval(interval)
              } else if (!nextEnabled && metronomeInterval) {
                clearInterval(metronomeInterval)
                setMetronomeInterval(null)
              }
            }}
            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
              metronomeEnabled
                ? `bg-cyan-400/20 text-cyan-400 ring-1 ring-cyan-400/30 ${metronomeFlash ? 'scale-105' : ''}`
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
            title="Metronome"
          >
            <Mic size={12} />
            Met
          </button>
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
              snapEnabled
                ? 'bg-cyan-400/20 text-cyan-400 ring-1 ring-cyan-400/30'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
            title="Snap to grid"
          >
            <Grid3x3 size={12} />
            Snap
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {/* Zoom */}
          <div className="flex items-center gap-1 mr-1">
            <button onClick={() => setZoom(prev => Math.max(10, prev - 10))} className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/[0.06] text-sm font-bold" title="Zoom out">−</button>
            <span className="text-[10px] text-white/25 w-10 text-center font-mono">{zoom}px/s</span>
            <button onClick={() => setZoom(prev => Math.min(200, prev + 10))} className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/[0.06] text-sm font-bold" title="Zoom in">+</button>
          </div>

          <button
            onClick={() => setShowBrowser(!showBrowser)}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              showBrowser
                ? 'bg-cyan-400/15 text-cyan-400 ring-1 ring-cyan-400/20'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
            }`}
            title="Browser (B)"
          >
            <Music2 size={12} />
            Library
          </button>
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              showRightPanel
                ? 'bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/20'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
            }`}
            title="Tools panel"
          >
            <PanelRight size={12} />
            Tools
          </button>

          <div className="h-5 w-px bg-white/[0.06] mx-0.5" />

          {/* Credit Display + GPU Bar */}
          <div className="relative h-7 px-3 bg-cyan-500/10 border border-cyan-500/20 rounded-md flex items-center gap-1.5 overflow-hidden">
            <Zap size={11} className="text-cyan-400" />
            <span className="text-[11px] font-bold text-cyan-300">{isLoadingCredits ? '...' : userCredits}</span>
            {generatingTrack && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px]">
                <div className="h-full w-full bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400" style={{
                  backgroundSize: '200% 100%',
                  animation: 'gpuBar 1.5s ease-in-out infinite'
                }} />
              </div>
            )}
          </div>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="h-7 px-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/25 text-violet-300 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5"
            title="Generate AI"
          >
            <Sparkles size={12} />
            Generate
          </button>
          <button
            onClick={() => handleSave('manual')}
            disabled={saving}
            className="h-7 px-3 bg-white/[0.08] hover:bg-white/[0.12] text-white/80 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 disabled:opacity-40"
            title="Save (Ctrl+S)"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="h-7 px-3 bg-white/[0.08] hover:bg-white/[0.12] text-white/80 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5 disabled:opacity-40"
            title="Export WAV"
          >
            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Export
          </button>
          <button onClick={() => setShowKeyboardHelp(true)} className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-white/60 hover:bg-white/[0.06] text-[11px] font-bold" title="Shortcuts (?)">?</button>

          {/* Save Status */}
          {(saveStatus !== 'idle' || saveTick) && (
            <div className="flex items-center gap-1.5 px-2 h-6 rounded-md bg-white/[0.04] text-[10px] font-medium text-white/40">
              {saveStatus !== 'idle' ? (
                <><Loader2 size={10} className="animate-spin" />{saveStatus === 'autosaving' ? 'Auto' : 'Saving'}</>
              ) : (
                <><span className="text-emerald-400">✓</span>Saved</>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser Panel */}
        {showBrowser && (
          <div className="w-72 bg-[#0b0b0b] border-r border-white/[0.04] flex flex-col">
            <div className="h-12 border-b border-white/[0.04] flex flex-col justify-center px-4">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                  Library
                </h2>
                <div className="text-[10px] text-white/20 font-medium font-mono">
                  {library.filter((item) =>
                    item.title.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length} tracks
                </div>
              </div>
              <div className="flex gap-2">
                <label className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-cyan-400 rounded-md text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer">
                  <Download size={11} />
                  Import
                  <input
                    id="audio-import"
                    name="audioFile"
                    type="file"
                    accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff"
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
                          showToast('✓ Audio imported to library', 'success')
                          await loadLibrary()
                          
                          // Also decode and add to first available track
                          try {
                            const audioContext = daw?.getAudioContext()
                            if (audioContext && daw) {
                              const arrayBuffer = await file.arrayBuffer()
                              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
                              const currentTracks = daw.getTracks()
                              const emptyTrack = currentTracks.find(t => t.clips.length === 0) || currentTracks[0]
                              if (emptyTrack) {
                                const trackManager = daw.getTrackManager()
                                trackManager.addClip(emptyTrack.id, {
                                  buffer: audioBuffer,
                                  startTime: 0,
                                  sourceUrl: result.url || '',
                                  name: file.name.replace(/\.[^/.]+$/, '')
                                })
                                setTracks([...daw.getTracks()])
                                showToast('✓ Added to track', 'success')
                              }
                            }
                          } catch (decodeErr) {
                            console.warn('Could not auto-add to track:', decodeErr)
                          }
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
                  className="px-2.5 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-violet-400 rounded-md text-[10px] font-medium transition-all flex items-center gap-1"
                >
                  <Scissors size={11} />
                  Stems
                </button>
              </div>
            </div>
            <div className="p-3 pb-2">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20"
                  size={13}
                />
                <input
                  id="library-search"
                  name="search"
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] rounded-md pl-8 pr-3 py-2 text-[12px] focus:border-cyan-400/40 focus:outline-none transition-all placeholder:text-white/15"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
              {library.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-12 h-12 bg-white/[0.03] rounded-full flex items-center justify-center mb-3">
                    <Music size={22} className="text-white/15" />
                  </div>
                  <p className="text-[11px] text-white/25 mb-1">No tracks yet</p>
                  <p className="text-[10px] text-white/15">Import audio or generate with AI</p>
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
                      className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] rounded-lg p-3 cursor-move transition-all duration-150"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 bg-cyan-400/10 rounded-md flex items-center justify-center flex-shrink-0">
                          <Music size={14} className="text-cyan-400/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-white/80 font-medium truncate group-hover:text-cyan-400 transition-colors">
                            {item.title}
                          </div>
                          {item.genre && (
                            <div className="text-[10px] text-white/25 capitalize">{item.genre}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedAudioForStems(item.audio_url)
                            setShowStemSplitter(true)
                          }}
                          className="flex-1 px-2 py-1 bg-white/[0.04] hover:bg-violet-400/10 border border-white/[0.06] text-violet-400 rounded-md text-[10px] font-medium transition-all flex items-center justify-center gap-1"
                        >
                          <Scissors size={10} />
                          Split
                        </button>
                      </div>
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="px-1.5 py-0.5 bg-white/[0.06] rounded text-[9px] text-white/30 font-medium">
                          Drag
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
                  className="sticky left-0 z-30 flex-shrink-0 bg-[#0e0e0e] border-r border-white/[0.04]"
                  style={{ width: `${TRACK_HEADER_WIDTH}px` }}
                >
                  <div
                    className="sticky top-0 z-30 bg-[#0e0e0e] border-b border-white/[0.06] flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-widest text-white/25"
                    style={{ height: `${TIMELINE_HEIGHT}px` }}
                  >
                    <span>Tracks</span>
                    <button
                      onClick={() => {
                        if (!daw) return
                        const trackManager = daw.getTrackManager()
                        const currentTracks = daw.getTracks()
                        trackManager.createTrack({ name: `${currentTracks.length + 1} Audio` })
                        setTracks([...daw.getTracks()])
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-cyan-400 hover:bg-white/[0.06] transition-all"
                      title="Add track"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div>
                    {tracks.map((track, idx) => (
                      <div
                        key={track.id}
                        style={{ height: `${TRACK_HEIGHT}px` }}
                        className={`border-b border-white/[0.03] px-3 py-2 cursor-pointer transition-all ${
                          selectedTrackId === track.id
                            ? 'bg-white/[0.04] border-l-2 border-l-cyan-400'
                            : 'bg-transparent hover:bg-white/[0.02]'
                        }`}
                        onClick={() => setSelectedTrackId(track.id)}
                      >
                        {/* Track Name */}
                        <div 
                          className="text-[11px] font-medium text-white/60 mb-1.5 truncate cursor-text"
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
                              className="w-full bg-white/[0.06] border border-cyan-400/40 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                            />
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/40 shrink-0" />
                              {track.name}
                            </span>
                          )}
                        </div>
                        
                        {/* M/S/R Buttons */}
                        <div className="flex gap-0.5 mb-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              daw?.updateTrack(track.id, { muted: !track.muted })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className={`w-6 h-5 text-[9px] font-bold rounded transition-all ${
                              track.muted
                                ? 'bg-red-500/80 text-white shadow-[0_0_6px_rgba(239,68,68,0.3)]'
                                : 'bg-white/[0.06] text-white/25 hover:text-white/50 hover:bg-white/[0.08]'
                            }`}
                            title="Mute"
                          >
                            M
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              daw?.updateTrack(track.id, { solo: !track.solo })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className={`w-6 h-5 text-[9px] font-bold rounded transition-all ${
                              track.solo
                                ? 'bg-amber-400 text-black shadow-[0_0_6px_rgba(251,191,36,0.3)]'
                                : 'bg-white/[0.06] text-white/25 hover:text-white/50 hover:bg-white/[0.08]'
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
                            className={`w-6 h-5 text-[9px] font-bold rounded transition-all ${
                              recordingTrackId === track.id
                                ? 'bg-red-500 text-white shadow-[0_0_6px_rgba(239,68,68,0.3)]'
                                : 'bg-white/[0.06] text-white/25 hover:text-white/50 hover:bg-white/[0.08]'
                            }`}
                            title="Arm for recording"
                          >
                            ●
                          </button>
                        </div>
                        
                        {/* Volume + Level Meter */}
                        <div className="flex items-center gap-1">
                          <Volume2 size={9} className="text-white/15 flex-shrink-0" />
                          <input
                            id={`volume-${track.id}`}
                            name={`volume-track-${idx + 1}`}
                            type="range"
                            min="0"
                            max="100"
                            value={track.volume * 100}
                            onChange={(e) => {
                              e.stopPropagation()
                              daw?.updateTrack(track.id, { volume: Number(e.target.value) / 100 })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className="flex-1 h-0.5 accent-cyan-400 min-w-0 cursor-pointer"
                            title={`Volume: ${Math.round(track.volume * 100)}%`}
                          />
                          <div className="w-8 h-1 bg-white/[0.04] rounded-full overflow-hidden flex-shrink-0" title="Level">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400 transition-all duration-75"
                              style={{ width: `${(trackLevels.get(track.id) || 0) * 100}%` }}
                            />
                          </div>
                        </div>
                        {/* Pan */}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[8px] text-white/15 font-mono w-2 flex-shrink-0">L</span>
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
                            className="flex-1 h-0.5 accent-violet-400 min-w-0 cursor-pointer"
                            title={`Pan: ${track.pan === 0 ? 'C' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}`}
                          />
                          <span className="text-[8px] text-white/15 font-mono w-2 flex-shrink-0">R</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="relative flex-1"
                  style={{ width: `${timelineWidth}px` }}
                >
                  {/* Timeline Ruler with continuous scrubbing */}
                  <div
                    className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/[0.06] relative cursor-crosshair"
                    style={{ height: `${TIMELINE_HEIGHT}px`, width: `${timelineWidth}px` }}
                    onMouseDown={(e) => {
                      const ruler = e.currentTarget
                      const scrub = (ev: MouseEvent) => {
                        const rect = ruler.getBoundingClientRect()
                        const x = ev.clientX - rect.left
                        const time = Math.max(0, Math.min(TIMELINE_SECONDS, x / zoom))
                        daw?.seekTo(time)
                        setPlayhead(time)
                      }
                      scrub(e.nativeEvent)
                      const onMove = (ev: MouseEvent) => { ev.preventDefault(); scrub(ev) }
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                  >
                    {timeMarkerIndices.map((second) => (
                      <div
                        key={second}
                        className="absolute top-0 h-full"
                        style={{ left: `${second * zoom}px` }}
                      >
                        <div className="h-full border-l border-white/[0.06] relative">
                          <span className="text-[10px] text-white/25 ml-1.5 absolute top-1.5 font-mono">
                            {formatBarsBeats(second)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {loopEnabled && (
                      <div
                        className="absolute top-0 bottom-0 bg-orange-400/10 border-l border-r border-orange-400/50"
                        style={{
                          left: `${loopStart * zoom}px`,
                          width: `${(loopEnd - loopStart) * zoom}px`
                        }}
                      />
                    )}

                    {loopEnabled && (
                      <>
                        <div
                          className={`absolute -bottom-1 w-2 h-5 bg-orange-400 rounded-sm cursor-ew-resize ${
                            activeLoopHandle === 'start' ? 'ring-1 ring-orange-200' : ''
                          }`}
                          style={{ left: `${loopStart * zoom - 4}px` }}
                          onMouseDown={() => {
                            setDraggingLoopHandle('start')
                            setActiveLoopHandle('start')
                          }}
                          title="Loop start"
                        />
                        <div
                          className={`absolute -bottom-1 w-2 h-5 bg-orange-400 rounded-sm cursor-ew-resize ${
                            activeLoopHandle === 'end' ? 'ring-1 ring-orange-200' : ''
                          }`}
                          style={{ left: `${loopEnd * zoom - 6}px` }}
                          onMouseDown={() => {
                            setDraggingLoopHandle('end')
                            setActiveLoopHandle('end')
                          }}
                          title="Drag to set loop end"
                        />
                        <div className="absolute -bottom-7 left-1 text-[9px] text-orange-300/80 bg-[#111] px-1.5 py-0.5 rounded border border-orange-400/20 font-mono">
                          Loop {formatBarsBeats(loopStart)} → {formatBarsBeats(loopEnd)}
                        </div>
                      </>
                    )}
                  </div>

                  {tracks.map((track, idx) => (
                    <div
                      key={track.id}
                      className="relative border-b border-white/[0.02]"
                      style={{
                        height: `${TRACK_HEIGHT}px`,
                        width: `${timelineWidth}px`,
                        backgroundColor: idx % 2 === 0 ? '#090909' : '#0b0b0b'
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
                          className={`absolute top-1.5 bottom-1.5 bg-gradient-to-b from-cyan-400/20 to-cyan-600/10 border rounded-md overflow-hidden cursor-move hover:border-cyan-400/60 transition-all ${
                            selectedClipId === clip.id ? 'border-cyan-400/70 ring-1 ring-cyan-400/30 z-10 shadow-[0_0_12px_rgba(34,211,238,0.15)]' : 'border-white/10 z-[2]'
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
                                  canvas.height = TRACK_HEIGHT - 8
                                  canvas.dataset.cacheKey = cacheKey
                                  renderWaveform(canvas, clip.buffer)
                                }
                              }
                            }}
                            className="w-full h-full pointer-events-none"
                          />
                          
                          {/* Left Resize Handle */}
                          <div
                            className="absolute top-0 bottom-0 left-0 w-1.5 bg-white/10 hover:w-2 hover:bg-cyan-400/50 cursor-ew-resize z-[25] transition-all"
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
                            className="absolute top-0 bottom-0 right-0 w-1.5 bg-white/10 hover:w-2 hover:bg-cyan-400/50 cursor-ew-resize z-[25] transition-all"
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
                                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none"
                                style={{ width: `${(clip.fadeIn.duration / clip.duration) * 100}%` }}
                              />
                              <div
                                className="absolute top-0 bottom-0 left-0 w-1.5 bg-cyan-400/20 hover:w-2 hover:bg-cyan-400/60 cursor-ew-resize z-20 transition-all"
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
                                className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-black/40 to-transparent pointer-events-none"
                                style={{ width: `${(clip.fadeOut.duration / clip.duration) * 100}%` }}
                              />
                              <div
                                className="absolute top-0 bottom-0 right-0 w-1.5 bg-cyan-400/20 hover:w-2 hover:bg-cyan-400/60 cursor-ew-resize z-20 transition-all"
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
                          className="absolute top-0 bottom-0 bg-orange-400/[0.03] pointer-events-none"
                          style={{
                            left: `${loopStart * zoom}px`,
                            width: `${(loopEnd - loopStart) * zoom}px`
                          }}
                        />
                      )}
                      
                      {/* Loading indicator for clips being added to this track */}
                      {Array.from(loadingClips).some(key => key.startsWith(`${track.id}-`)) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none z-30">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111]/90 rounded-md border border-white/[0.08]">
                            <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[11px] text-white/50">Loading audio...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <div
                    className="absolute top-0 w-px bg-cyan-400 cursor-ew-resize"
                    style={{
                      left: `${playhead * zoom}px`,
                      height: `${TIMELINE_HEIGHT + tracks.length * TRACK_HEIGHT}px`,
                      pointerEvents: 'auto',
                      zIndex: 20,
                      boxShadow: '0 0 8px rgba(34,211,238,0.4), 0 0 2px rgba(34,211,238,0.8)'
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
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rotate-45 rounded-[1px] pointer-events-none shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
                  </div>

                  {dragPreview && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-cyan-400/40 pointer-events-none"
                      style={{ left: `${dragPreview.time * zoom}px`, zIndex: 30 }}
                    >
                      <div className="absolute -top-5 -left-8 px-1.5 py-0.5 rounded bg-[#111] border border-cyan-400/20 text-[10px] text-cyan-300 whitespace-nowrap font-mono">
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

        {/* Right Tools Panel — FeaturesSidebar style */}
        {showRightPanel && (
          <div className="w-96 bg-black/95 backdrop-blur-2xl border-l border-white/10 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-cyan-400">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <span className="text-white font-bold text-lg">Features</span>
              </div>
              <button onClick={() => setShowRightPanel(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Credits */}
            <div className="px-5 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl relative overflow-hidden">
                <Zap size={16} className="text-cyan-400" />
                <span className="text-white font-bold text-sm">
                  {isLoadingCredits ? '...' : userCredits} credits
                </span>
                {/* GPU loading bar during generation */}
                {generatingTrack && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-cyan-900/30">
                    <div className="h-full bg-gradient-to-r from-cyan-400 via-violet-400 to-cyan-400 animate-pulse" style={{
                      animation: 'gpuBar 2s ease-in-out infinite',
                      backgroundSize: '200% 100%'
                    }} />
                  </div>
                )}
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="px-5 py-3 border-b border-white/10 shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setGenIsInstrumental(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    !genIsInstrumental
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                  Vocal
                </button>
                <button
                  onClick={() => setGenIsInstrumental(true)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    genIsInstrumental
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <line x1="8" x2="8" y1="4" y2="14"/>
                    <line x1="16" x2="16" y1="4" y2="14"/>
                    <line x1="12" x2="12" y1="4" y2="14"/>
                  </svg>
                  Inst
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="px-5 py-4 border-b border-white/10 shrink-0">
              <div className="relative">
                <textarea
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  placeholder="Describe your music..."
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                  rows={4}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      e.stopPropagation()
                      if (genPrompt.trim().length >= 3) handleGenerate()
                    }
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="text-[10px] text-white/20">{genPrompt.length}/300</div>
                  <button
                    onClick={() => { if (genPrompt.trim().length >= 3) handleGenerate() }}
                    disabled={generatingTrack || genPrompt.trim().length < 3}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {generatingTrack ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {generatingTrack ? (generationProgress || 'Generating...') : 'Generate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Ideas & Tags */}
            {showIdeas && (
              <div className="px-4 py-4 border-b border-white/10 max-h-[40vh] overflow-y-auto shrink-0">
                {ideasView === 'tags' && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb size={14} className="text-yellow-400" />
                        <span className="text-sm font-bold text-white">Quick Tags</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIdeasView('type')} className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 transition-all">
                          ✨ IDEAS
                        </button>
                        <button onClick={() => setShowIdeas(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                          <X size={14} className="text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['upbeat','chill','energetic','melancholic','ambient','electronic','acoustic','jazz','rock','hip-hop','heavy bass','soft piano','guitar solo','synthwave','lo-fi beats','orchestral','dreamy','aggressive','trap','drill','phonk','house','techno','trance','indie','folk','blues','soul','funk','disco','reggae','latin','afrobeat','cinematic','epic','dark','bright','nostalgic','romantic','sad','happy','mysterious','powerful'].map((tag) => (
                        <button key={tag} onClick={() => handleTagClick(tag)} className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">
                          {tag}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {ideasView === 'type' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">✨ AI Prompt Ideas</h3>
                      <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X size={14} className="text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setPromptType('song'); setIdeasView('genre') }} className="group p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-400/40 hover:border-purple-400/60 rounded-2xl transition-all hover:scale-105">
                        <div className="text-3xl mb-2">🎤</div><div className="text-sm font-bold text-white mb-1">Song</div><div className="text-[10px] text-gray-400">With vocals & lyrics</div>
                      </button>
                      <button onClick={() => { setPromptType('beat'); setIdeasView('genre') }} className="group p-5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border-2 border-cyan-400/40 hover:border-cyan-400/60 rounded-2xl transition-all hover:scale-105">
                        <div className="text-3xl mb-2">🎹</div><div className="text-sm font-bold text-white mb-1">Beat</div><div className="text-[10px] text-gray-400">Instrumental only</div>
                      </button>
                    </div>
                  </div>
                )}
                {ideasView === 'genre' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setIdeasView('type')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><ChevronLeft size={14} /> Back</button>
                      <h3 className="text-sm font-bold text-white">🎵 Select Genre</h3>
                      <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X size={14} className="text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['electronic','hip-hop','rock','jazz','ambient','trap','drill','phonk','house','techno','lo-fi beats','synthwave','indie','folk','blues','soul','funk','reggae','latin','afrobeat','orchestral','cinematic','acoustic','vaporwave','k-pop'].map((g) => (
                        <button key={g} onClick={() => { setIdeasView('generating'); handleGenerateIdea(g, promptType); setTimeout(() => setIdeasView('tags'), 5000) }} disabled={isGeneratingIdea} className="px-2 py-2 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all disabled:opacity-50">
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {ideasView === 'generating' && (
                  <div className="space-y-4 text-center py-6">
                    <div className="w-12 h-12 mx-auto border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                    <div><h3 className="text-base font-bold text-white mb-1">Creating Prompt...</h3><p className="text-xs text-gray-400">AI is crafting the perfect description</p></div>
                  </div>
                )}
              </div>
            )}

            {/* Feature Buttons */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Ideas Button */}
              <button
                onClick={() => { setShowIdeas(!showIdeas); setIdeasView('tags') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group mb-3 ${
                  showIdeas
                    ? 'bg-gradient-to-r from-yellow-600/30 to-amber-400/20 border-yellow-400 text-yellow-300'
                    : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${showIdeas ? 'bg-white/10' : 'bg-white/5'}`}><Lightbulb size={18} /></div>
                <div className="flex-1 text-left"><div className="text-sm font-semibold">Ideas & Tags</div><div className="text-[10px] text-gray-500">AI prompts & quick tags</div></div>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">AI</span>
              </button>

              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 px-1">Creation Tools</p>
              <div className="space-y-2">
                {/* Music */}
                <button onClick={() => { setSelectedType('music'); setShowGenerateModal(true) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${selectedType === 'music' ? 'bg-gradient-to-r from-cyan-600/30 to-cyan-400/20 border-cyan-400 text-cyan-300' : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50'}`}>
                  <div className="p-2 rounded-lg bg-white/5"><Music size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Music</div><div className="text-[10px] text-gray-500">Generate AI music</div></div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-2</span>
                </button>
                {/* Effects */}
                <button onClick={() => setShowEffectsModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all">
                  <div className="p-2 rounded-lg bg-white/5"><Sparkles size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Effects</div><div className="text-[10px] text-gray-500">Sound effects</div></div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-2</span>
                </button>
                {/* Loops */}
                <button onClick={() => setShowLoopersModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all">
                  <div className="p-2 rounded-lg bg-white/5"><Repeat size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Loops</div><div className="text-[10px] text-gray-500">Fixed BPM loops</div></div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-2</span>
                </button>
                {/* Cover Art */}
                <button onClick={() => { setSelectedType('image'); setShowGenerateModal(true) }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all">
                  <div className="p-2 rounded-lg bg-white/5"><ImageIcon size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Cover Art</div><div className="text-[10px] text-gray-500">AI album artwork</div></div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-1</span>
                </button>
                {/* Video to Audio */}
                <button onClick={() => setShowUploadModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all">
                  <div className="p-2 rounded-lg bg-white/5"><Film size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Video to Audio</div><div className="text-[10px] text-gray-500">Synced SFX from video</div></div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-2</span>
                </button>
                {/* Split Stems */}
                <button onClick={() => setShowStemSplitter(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all">
                  <div className="p-2 rounded-lg bg-white/5"><Scissors size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Split Stems</div><div className="text-[10px] text-gray-500">Vocals, drums, bass & more</div></div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-5</span>
                </button>
                {/* Lyrics (only show when music + not instrumental) */}
                {selectedType === 'music' && !genIsInstrumental && (
                  <button onClick={() => setShowGenerateModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all">
                    <div className="p-2 rounded-lg bg-white/5"><Edit3 size={18} /></div>
                    <div className="flex-1 text-left"><div className="text-sm font-semibold">Lyrics</div><div className="text-[10px] text-gray-500">Write & edit lyrics</div></div>
                  </button>
                )}
                {/* Upload */}
                <button onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.aiff'
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    showToast('Uploading...', 'info')
                    try {
                      const formData = new FormData()
                      formData.append('file', file)
                      formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
                      formData.append('type', 'music')
                      const response = await fetch('/api/profile/upload', { method: 'POST', body: formData })
                      const result = await response.json()
                      if (response.ok && result.success) {
                        await addResultToTrack(result.url || '', file.name.replace(/\.[^/.]+$/, ''))
                      } else {
                        showToast(`Upload failed: ${result.error || 'Unknown'}`, 'error')
                      }
                    } catch (err: any) {
                      showToast(`Upload failed: ${err.message || 'Network error'}`, 'error')
                    }
                  }
                  input.click()
                }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all">
                  <div className="p-2 rounded-lg bg-white/5"><Upload size={18} /></div>
                  <div className="flex-1 text-left"><div className="text-sm font-semibold">Upload</div><div className="text-[10px] text-gray-500">Upload audio/video</div></div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GPU loading bar animation */}
      <style jsx>{`
        @keyframes gpuBar {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

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
            className="fixed z-50 bg-[#111]/95 backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-2xl shadow-black/50 py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setShowGenerateModal(true)
                setContextMenu(null)
              }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
            >
              <Sparkles size={12} className="text-violet-400" />
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
              className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
            >
              <Scissors size={12} className="text-violet-400" />
              Split Stems
            </button>
            <div className="border-t border-white/[0.06] my-1" />
            <button
              onClick={() => {
                handleDuplicateClip(contextMenu.trackId, contextMenu.clipId)
              }}
              className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
            >
              <Copy size={12} className="text-cyan-400" />
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
              className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2"
            >
              <Copy size={12} className="text-cyan-400" />
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
              className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Clipboard size={12} className="text-cyan-400" />
              Paste
            </button>
            <div className="border-t border-white/[0.06] my-1" />
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
              className="w-full px-3 py-1.5 text-left text-[11px] text-white/70 hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center gap-2"
            >
              <Trash2 size={12} />
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

      {/* Effects Generation Modal */}
      <Suspense fallback={null}>
        <EffectsGenerationModal
          isOpen={showEffectsModal}
          onClose={() => setShowEffectsModal(false)}
          userCredits={userCredits ?? undefined}
          onSuccess={async (url: string, prompt: string) => {
            setShowEffectsModal(false)
            await addResultToTrack(url, `Effect: ${prompt.slice(0, 30)}`)
          }}
        />
      </Suspense>

      {/* Loopers Generation Modal */}
      <Suspense fallback={null}>
        <LoopersGenerationModal
          isOpen={showLoopersModal}
          onClose={() => setShowLoopersModal(false)}
          userCredits={userCredits ?? undefined}
          onSuccess={async (variations: Array<{ url: string; variation: number }>, prompt: string) => {
            setShowLoopersModal(false)
            if (variations.length > 0) {
              await addResultToTrack(variations[0].url, `Loop: ${prompt.slice(0, 30)}`)
            }
          }}
        />
      </Suspense>

      {/* Media Upload Modal */}
      <Suspense fallback={null}>
        <MediaUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={async (result: any) => {
            setShowUploadModal(false)
            const url = result?.url || result?.audioUrl || ''
            const name = result?.title || result?.name || 'Uploaded media'
            if (url) await addResultToTrack(url, name)
          }}
        />
      </Suspense>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-3 py-2 rounded-md text-[11px] font-medium z-50 border backdrop-blur-sm ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-300'
              : 'bg-white/[0.06] border-white/[0.08] text-white/60'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
    </ErrorBoundary>
  )
}
