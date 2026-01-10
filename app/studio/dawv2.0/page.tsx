'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
  Mic
} from 'lucide-react'

// Extend Window interface for drag throttling and pending clip tracking
declare global {
  interface Window {
    lastDragUpdate?: number
    pendingClips?: Set<string>
  }
}

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
  const [showBrowser, setShowBrowser] = useState(true)
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
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled Project')
  const [saving, setSaving] = useState(false)
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

  // Advanced generation modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatingTrack, setGeneratingTrack] = useState(false)
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

        const animate = () => {
          if (!instance) return
          const state = instance.getTransportState()
          if (state.isPlaying) {
            let currentTime = state.currentTime
            const loop = loopRef.current
            if (loop.enabled && currentTime >= loop.end) {
              instance.seekTo(loop.start)
              currentTime = loop.start
            }
            setPlayhead(currentTime)
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
      const response = await fetch('/api/media')
      if (response.ok) {
        const data = await response.json()
        setLibrary(data.filter((item: any) => item.type === 'audio'))
      }
    } catch (error) {
      console.error('Library load failed:', error)
    }
  }

  const snapTime = useCallback(
    (time: number) =>
      snapEnabled ? Math.round(time * GRID_SUBDIVISION) / GRID_SUBDIVISION : time,
    [snapEnabled]
  )

  const beatLength = useCallback(() => 60 / bpm, [bpm])

  const formatBarsBeats = useCallback(
    (time: number) => {
      const bl = beatLength()
      const totalBeats = time / bl
      const bar = Math.floor(totalBeats / 4) + 1
      const beatInBar = Math.floor(totalBeats % 4) + 1
      const sub = Math.floor(((totalBeats - Math.floor(totalBeats)) * GRID_SUBDIVISION)) + 1
      return `${bar}:${beatInBar}.${sub}`
    },
    [beatLength]
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

  // Transport controls
  const handlePlay = useCallback(() => {
    if (!daw) return
    try {
      daw.play()
      setIsPlaying(true)

      if (metronomeEnabled) {
        const interval = setInterval(() => {
          setMetronomeFlash(true)
          setTimeout(() => setMetronomeFlash(false), 50)
        }, (60 / bpm) * 1000)
        setMetronomeInterval(interval)
      }
    } catch (error) {
      console.error('Play error:', error)
    }
  }, [daw, metronomeEnabled, bpm])

  const handlePause = useCallback(() => {
    if (!daw) return
    daw.pause()
    setIsPlaying(false)
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

  const handleSave = async (mode: 'manual' | 'auto' = 'manual') => {
    if (!daw || saving) return
    setSaving(true)
    setSaveStatus(mode === 'auto' ? 'autosaving' : 'saving')
    try {
      const projectData = {
        id: currentProjectId || undefined,
        title: projectName, // Using 'title' to match schema
        tracks: serializeTracks(daw.getTracks()),
        tempo: bpm // Using 'tempo' to match schema
      }

      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      })

      if (response.ok) {
        const data = await response.json()
        const nextProjectId = data.id || currentProjectId
        if (data.id && data.id !== currentProjectId) {
          setCurrentProjectId(data.id)
        }
        await fetchProjects({ autoLoad: false, activeId: nextProjectId || undefined })
        if (mode === 'manual') {
          showToast('Project saved', 'success')
        }
        setSaveTick(true)
        setTimeout(() => setSaveTick(false), 1000)
        setDirtyCounter(0)
      } else {
        const error = await response.json()
        showToast(`Save failed: ${error.error || 'Unknown error'}`, 'error')
      }
    } catch (error) {
      console.error('Save error:', error)
      showToast('Save failed. Please try again.', 'error')
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

    try {
      // Auto-fill missing fields
      let finalTitle = genTitle
      let finalLyrics = genLyrics
      let finalGenre = genGenre
      let finalBpm = genBpm

      // Auto-generate title if missing
      if (!finalTitle.trim()) {
        const titleResponse = await fetch('/api/generate/atom-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: genPrompt })
        })
        const titleData = await titleResponse.json()
        if (titleData.success && titleData.title) {
          finalTitle = titleData.title
          setGenTitle(finalTitle)
        } else {
          finalTitle = genPrompt.split(' ').slice(0, 2).join(' ')
        }
      }

      // Handle instrumental mode or auto-generate lyrics
      if (genIsInstrumental) {
        finalLyrics = '[Instrumental]'
        setGenLyrics(finalLyrics)
      } else if (!finalLyrics.trim()) {
        const lyricsResponse = await fetch('/api/generate/atom-lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: genPrompt })
        })
        const lyricsData = await lyricsResponse.json()
        if (lyricsData.success && lyricsData.lyrics) {
          finalLyrics = lyricsData.lyrics
          setGenLyrics(finalLyrics)
        }
      }

      // Auto-detect genre
      if (!finalGenre.trim()) {
        const genreResponse = await fetch('/api/generate/atom-genre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: genPrompt })
        })
        const genreData = await genreResponse.json()
        if (genreData.success && genreData.genre) {
          finalGenre = genreData.genre
          setGenGenre(finalGenre)
        } else {
          finalGenre = 'pop'
        }
      }

      // Auto-detect BPM
      if (!finalBpm.trim()) {
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

      // Call music generation API
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
        showToast(`Track generated: "${finalTitle}"`, 'success')
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
      } else {
        throw new Error(result.error || 'Generation failed')
      }
    } catch (error) {
      console.error('Generation error:', error)
      showToast('Generation failed. Please try again.', 'error')
    } finally {
      setGeneratingTrack(false)
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
        showToast('Stems separated successfully!', 'success')
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

  // Autosave: debounce 2s after playhead/track change
  const queueAutosave = useCallback(() => {
    if (!currentProjectId) return // avoid autosave before first explicit save
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      handleSave('auto')
    }, 2000)
  }, [handleSave, currentProjectId])

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

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = '#06b6d4'
      ctx.lineWidth = 1.5
      ctx.beginPath()

      // Optimized: access data directly instead of creating arrays
      for (let i = 0; i < width; i++) {
        let min = 1
        let max = -1
        const offset = i * step
        
        // Direct access is much faster than Array.from + spread
        for (let j = 0; j < step && offset + j < data.length; j++) {
          const sample = data[offset + j]
          if (sample < min) min = sample
          if (sample > max) max = sample
        }
        
        ctx.moveTo(i, (1 + min) * amp)
        ctx.lineTo(i, (1 + max) * amp)
      }

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
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        setShowBrowser((prev) => !prev)
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
  }, [isPlaying, handlePlay, handlePause, handleSave, loopEnabled, activeLoopHandle, beatLength, loopEnd, loopStart])

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
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
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
              id="bpm-input"
              name="bpm"
              type="number"
              value={bpm}
              onChange={(e) => {
                const next = Number(e.target.value)
                if (next >= 60 && next <= 200 && daw) {
                  setBpm(next)
                  daw.setBPM(next)
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
              className="w-16 bg-[#0a0a0a] border border-gray-800 rounded px-2 py-1 text-sm text-center focus:border-cyan-500 focus:outline-none text-white font-mono"
              min="60"
              max="200"
            />
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
            onClick={() => setRecordingTrackId(selectedTrackId)}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              recordingTrackId ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-800'
            }`}
            title="Record"
          >
            <div className="w-5 h-5 rounded-full bg-current" />
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
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
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
            <span>Click</span>
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
          <div className="flex items-center gap-2 ml-4">
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
                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('title', file.name.replace(/\.[^/.]+$/, ''))
                        formData.append('type', 'music')
                        const response = await fetch('/api/profile/upload', {
                          method: 'POST',
                          body: formData
                        })
                        if (response.ok) {
                          showToast('✓ Audio imported', 'success')
                          await loadLibrary()
                        } else {
                          showToast('Import failed', 'error')
                        }
                      } catch (error) {
                        console.error('Import error:', error)
                        showToast('Import failed', 'error')
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
                        className={`border-b border-gray-800/50 p-4 cursor-pointer transition-all group ${
                          selectedTrackId === track.id
                            ? 'bg-gradient-to-r from-[#1a1a1a] to-[#151515] border-l-4 border-l-cyan-500 shadow-lg shadow-cyan-500/10'
                            : 'hover:bg-[#151515] hover:border-l-4 hover:border-l-gray-700'
                        }`}
                        onClick={() => setSelectedTrackId(track.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors truncate mr-2">
                            {track.name}
                          </div>
                          {selectedTrackId === track.id && (
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex gap-1.5 mb-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              daw?.updateTrack(track.id, { muted: !track.muted })
                              setTracks(daw?.getTracks() || [])
                              markProjectDirty()
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                              track.muted
                                ? 'bg-red-500 text-white'
                                : 'bg-[#1a1a1a] border border-gray-700/50 text-gray-400 hover:bg-gray-800'
                            }`}
                            title="Mute track"
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
                            className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                              track.solo
                                ? 'bg-yellow-500 text-black'
                                : 'bg-[#1a1a1a] border border-gray-700/50 text-gray-400 hover:bg-gray-800'
                            }`}
                            title="Solo track"
                          >
                            S
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setRecordingTrackId(recordingTrackId === track.id ? null : track.id)
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded transition-all ${
                              recordingTrackId === track.id
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-[#1a1a1a] border border-gray-700/50 text-gray-400 hover:bg-gray-800'
                            }`}
                            title="Arm for recording"
                          >
                            ●
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-[#0a0a0a] border border-gray-800/50 rounded-lg px-2 py-1.5">
                          <Volume2 size={12} className="text-cyan-500 flex-shrink-0" />
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
                            className="flex-1 accent-cyan-500 min-w-0"
                            title={`Volume: ${Math.round(track.volume * 100)}%`}
                          />
                          <div className="text-xs text-gray-400 font-mono w-9 text-right flex-shrink-0">
                            {Math.round(track.volume * 100)}%
                          </div>
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
                      className="relative border-b border-gray-800/50"
                      style={{
                        height: `${TRACK_HEIGHT}px`,
                        width: `${timelineWidth}px`,
                        backgroundColor: idx % 2 === 0 ? '#0a0a0a' : '#0d0d0d',
                        zIndex: 1
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        const audioUrl = e.dataTransfer.getData('audioUrl')
                        if (audioUrl) {
                          setDragPreview(null) // Clear preview immediately
                          const rect = e.currentTarget.getBoundingClientRect()
                          const scrollLeft = timelineRef.current?.scrollLeft || 0
                          const x = e.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH
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
                          const scrollLeft = timelineRef.current?.scrollLeft || 0
                          const x = e.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH
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
                          onClick={() => setSelectedClipId(clip.id)}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            setSelectedClipId(clip.id)
                            const rect = e.currentTarget.getBoundingClientRect()
                            const offsetX = e.clientX - rect.left
                            setDraggingClip({ clipId: clip.id, trackId: track.id, offsetX })
                            
                            const handleMove = (moveE: MouseEvent) => {
                              if (!timelineRef.current) return
                              const timelineRect = timelineRef.current.getBoundingClientRect()
                              const scrollLeft = timelineRef.current.scrollLeft
                              const x = moveE.clientX - timelineRect.left + scrollLeft - TRACK_HEADER_WIDTH - offsetX
                              const newStartTime = snapTime(Math.max(0, x / zoom))
                              
                              if (daw) {
                                const trackManager = daw.getTrackManager()
                                const updatedClip = { ...clip, startTime: newStartTime }
                                trackManager.updateClip(track.id, clip.id, updatedClip)
                                setTracks(daw.getTracks())
                              }
                            }
                            
                            const handleUp = () => {
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
                              if (canvas && clip.buffer && !canvas.dataset.rendered) {
                                canvas.width = clip.duration * zoom
                                canvas.height = TRACK_HEIGHT - 16
                                canvas.dataset.rendered = 'true'
                                renderWaveform(canvas, clip.buffer)
                              }
                            }}
                            className="w-full h-full pointer-events-none"
                          />
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
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                  AI Music Generation
                </h2>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Describe your track *
                  </label>
                  <textarea
                    value={genPrompt}
                    onChange={(e) => setGenPrompt(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-4 text-white resize-none focus:border-cyan-500 focus:outline-none"
                    rows={4}
                    placeholder="e.g., Uplifting electronic dance track with synths and heavy bass..."
                  />
                </div>

                {/* Instrumental Toggle */}
                <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <input
                    type="checkbox"
                    id="instrumental"
                    checked={genIsInstrumental}
                    onChange={(e) => setGenIsInstrumental(e.target.checked)}
                    className="w-5 h-5 accent-purple-500"
                  />
                  <label htmlFor="instrumental" className="text-sm font-medium text-purple-400">
                    <Music size={16} className="inline mr-2" />
                    Instrumental Mode (no lyrics)
                  </label>
                </div>

                {/* Advanced Parameters */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title (auto-generated if empty)
                    </label>
                    <input
                      type="text"
                      value={genTitle}
                      onChange={(e) => setGenTitle(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g., Neon Dreams"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Genre (auto-detected if empty)
                    </label>
                    <input
                      type="text"
                      value={genGenre}
                      onChange={(e) => setGenGenre(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                      placeholder="e.g., Electronic"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    BPM (auto-detected if empty)
                  </label>
                  <input
                    type="number"
                    value={genBpm}
                    onChange={(e) => setGenBpm(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g., 128"
                    min="60"
                    max="200"
                  />
                </div>

                {!genIsInstrumental && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Lyrics (auto-generated if empty)
                    </label>
                    <textarea
                      value={genLyrics}
                      onChange={(e) => setGenLyrics(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-4 text-white resize-none focus:border-cyan-500 focus:outline-none font-mono text-sm"
                      rows={8}
                      placeholder="Leave empty for AI-generated lyrics or paste your own..."
                    />
                  </div>
                )}

                {/* Generate Button */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleGenerate}
                    disabled={generatingTrack || !genPrompt.trim()}
                    className="flex-1 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg shadow-xl shadow-purple-500/30"
                  >
                    {generatingTrack ? (
                      <>
                        <Loader2 className="animate-spin" size={24} />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={24} />
                        Generate Track
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="px-8 py-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stem Splitter Modal */}
      {showStemSplitter && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-500/20 max-w-2xl w-full">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                  Stem Splitter
                </h2>
                <button
                  onClick={() => {
                    setShowStemSplitter(false)
                    setStemResults(null)
                  }}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <p className="text-gray-400 text-sm">
                  Separate audio into individual stems: vocals, instrumental, drums, bass, and
                  more.
                </p>

                {!stemResults ? (
                  <>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <div className="text-sm font-medium text-purple-400 mb-2">
                        Selected Track:
                      </div>
                      <div className="text-white">
                        {selectedAudioForStems ? 'Audio track selected' : 'No track selected'}
                      </div>
                    </div>

                    <button
                      onClick={handleSplitStems}
                      disabled={isSplittingStems || !selectedAudioForStems}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg shadow-xl shadow-purple-500/30"
                    >
                      {isSplittingStems ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          Splitting Stems (1-2 min)...
                        </>
                      ) : (
                        <>
                          <Scissors size={24} />
                          Split Stems
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-green-400 mb-4">
                        ✅ Stems separated successfully!
                      </div>
                      {Object.entries(stemResults).map(([key, url]: [string, any]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Music size={20} className="text-purple-400" />
                            <span className="text-white font-medium capitalize">{key}</span>
                          </div>
                          <button
                            onClick={() => window.open(url, '_blank')}
                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                          >
                            <Download size={16} />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setShowStemSplitter(false)
                        setStemResults(null)
                        setSelectedAudioForStems(null)
                      }}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
  )
}
