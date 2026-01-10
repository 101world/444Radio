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

export default function DAWProRebuild() {
  const { user } = useUser()
  const [daw, setDaw] = useState<MultiTrackDAW | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [bpm, setBpm] = useState(120)
  const [zoom, setZoom] = useState(40) // pixels per second
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
          setTracks(daw.getTracks())
        }
        if (!skipDirtyFlag) {
          markProjectDirty()
        }
        return clip
      } catch (error) {
        console.error('Clip decode/add failed:', error)
        throw error
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
      try {
        await addClipFromUrl(audioUrl, trackId, { startTime, respectSnap: true })
      } catch (error) {
        console.error('Clip add failed:', error)
        showToast('Failed to add clip. Please try again.', 'error')
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
    } catch (error) {
      console.error('Reset project failed:', error)
    }
  }, [daw])

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

  const renderWaveform = (canvas: HTMLCanvasElement, buffer: AudioBuffer) => {
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

    for (let i = 0; i < width; i++) {
      const min = Math.min(
        ...Array.from({ length: step }, (_, j) => data[i * step + j] || 0)
      )
      const max = Math.max(
        ...Array.from({ length: step }, (_, j) => data[i * step + j] || 0)
      )
      ctx.moveTo(i, (1 + min) * amp)
      ctx.lineTo(i, (1 + max) * amp)
    }

    ctx.stroke()
  }

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
      <div className="h-14 bg-[#111] border-b border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Music2 className="w-6 h-6 text-cyan-400" />
            <div className="text-cyan-400 font-bold text-xl">444 Studio Pro</div>
          </div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value)
              markProjectDirty()
            }}
            className="bg-[#1a1a1a] border border-gray-700 rounded px-4 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none min-w-[240px]"
            placeholder="Project Name"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 uppercase font-medium">Project</div>
            <select
              value={currentProjectId || ''}
              onChange={(e) => {
                const id = e.target.value
                if (!id) {
                  resetProject()
                } else {
                  handleLoadProject(id)
                }
              }}
              className="bg-[#1a1a1a] border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none min-w-[200px]"
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
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
              title="Start a new project"
            >
              New
            </button>
            <button
              onClick={handleDeleteProject}
              disabled={!currentProjectId}
              className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm disabled:opacity-40"
              title={currentProjectId ? 'Delete current project' : 'No project to delete'}
            >
              Delete
            </button>
            <button
              onClick={handleRenameProject}
              disabled={!currentProjectId}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-40"
              title={currentProjectId ? 'Rename current project' : 'No project to rename'}
            >
              Rename
            </button>
            <button
              onClick={handleDuplicateProject}
              disabled={!currentProjectId}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-40"
              title={currentProjectId ? 'Duplicate current project' : 'No project to duplicate'}
            >
              Duplicate
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 uppercase font-medium">BPM</div>
            <input
              type="number"
              value={bpm}
              onChange={(e) => {
                const next = Number(e.target.value)
                setBpm(next)
                daw?.setBPM(next)
                markProjectDirty()
              }}
              className="w-20 bg-[#1a1a1a] border border-gray-700 rounded px-3 py-1.5 text-sm text-center focus:border-cyan-500 focus:outline-none"
              min="60"
              max="200"
            />
          </div>

          <button
            onClick={() => handleSave('manual')}
            disabled={saving}
            className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            title={currentProjectId ? 'Save project' : 'Save as new project'}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? (saveStatus === 'autosaving' ? 'Autosaving...' : 'Saving...') : currentProjectId ? 'Save' : 'Save As'}
          </button>
          <div className="text-xs text-gray-500 min-w-[90px] text-right">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'autosaving' && 'Autosaving...'}
          </div>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white rounded-lg font-medium transition-opacity flex items-center gap-2"
              title="AI generation"
            >
              <Sparkles size={16} />
              Generate AI
            </button>
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
            title={isPlaying ? 'Pause' : 'Play'}
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
          <div className="text-3xl font-mono tabular-nums text-cyan-400 font-bold tracking-wider" title={showBrowser ? 'Press B to hide browser' : 'Press B to show browser'}>
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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              metronomeEnabled
                ? metronomeFlash
                  ? 'bg-cyan-400 text-black scale-110'
                  : 'bg-cyan-500 text-black'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {metronomeFlash ? '●' : 'Click'}
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
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser Panel */}
        {showBrowser && (
          <div className="w-72 bg-[#0d0d0d] border-r border-gray-800 flex flex-col">
            <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4">
              <div className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                Browser
              </div>
              <button
                onClick={() => {
                  setShowStemSplitter(true)
                }}
                className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs font-medium transition-colors flex items-center gap-1"
              >
                <Scissors size={12} />
                Stem Split
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Search tracks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {library
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
                    className="p-3 mb-2 bg-[#1a1a1a] hover:bg-[#252525] rounded-lg cursor-move transition-all hover:scale-[1.02] group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-cyan-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <Music size={16} className="text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-medium truncate group-hover:text-cyan-400 transition-colors">
                          {item.title}
                        </div>
                        {item.genre && (
                          <div className="text-xs text-gray-500 mt-0.5">{item.genre}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAudioForStems(item.audio_url)
                        setShowStemSplitter(true)
                      }}
                      className="w-full px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Scissors size={12} />
                      Split Stems
                    </button>
                  </div>
                ))}
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
                        className={`border-b border-gray-800 p-4 cursor-pointer transition-all ${
                          selectedTrackId === track.id
                            ? 'bg-[#1a1a1a] border-l-4 border-l-cyan-500'
                            : 'hover:bg-[#151515]'
                        }`}
                        onClick={() => setSelectedTrackId(track.id)}
                      >
                        <div className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
                          {track.name}
                          {selectedTrackId === track.id && (
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                          )}
                        </div>
                        <div className="flex gap-2 mb-3">
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
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
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
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
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
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            ●
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Volume2 size={14} className="text-gray-500" />
                          <input
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
                            className="flex-1 accent-cyan-500"
                          />
                          <div className="text-xs text-gray-500 w-8 text-right">
                            {Math.round(track.volume * 100)}
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
                    className="sticky top-0 z-10 bg-[#0d0d0d] border-b border-gray-800 relative"
                    style={{ height: `${TIMELINE_HEIGHT}px`, width: `${timelineWidth}px` }}
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
                      className="relative border-b border-gray-800"
                      style={{
                        height: `${TRACK_HEIGHT}px`,
                        width: `${timelineWidth}px`,
                        backgroundColor: idx % 2 === 0 ? '#0a0a0a' : '#0d0d0d'
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        const audioUrl = e.dataTransfer.getData('audioUrl')
                        if (audioUrl) {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0)
                          const startTime = snapTime(x / zoom)
                          await handleAddClip(audioUrl, track.id, startTime)
                        }
                        setDragPreview(null)
                      }}
                      onDragLeave={() => setDragPreview(null)}
                      onDragEnter={(e) => {
                        e.preventDefault()
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0)
                        const time = snapTime(x / zoom)
                        setDragPreview({ time, trackId: track.id })
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
                          className="absolute top-2 bottom-2 bg-gradient-to-br from-cyan-500/30 to-purple-500/20 border-2 border-cyan-500/50 rounded-lg overflow-hidden cursor-move hover:border-cyan-400 transition-all shadow-lg hover:shadow-cyan-500/30"
                          style={{
                            left: `${clip.startTime * zoom}px`,
                            width: `${clip.duration * zoom}px`
                          }}
                          onClick={() => setSelectedClipId(clip.id)}
                        >
                          <canvas
                            ref={(canvas) => {
                              if (canvas && clip.buffer) {
                                canvas.width = clip.duration * zoom
                                canvas.height = TRACK_HEIGHT - 16
                                renderWaveform(canvas, clip.buffer)
                              }
                            }}
                            className="w-full h-full"
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
                    </div>
                  ))}

                  <div
                    className="absolute top-0 w-1 bg-cyan-400 z-20 pointer-events-none shadow-lg shadow-cyan-500/50"
                    style={{
                      left: `${playhead * zoom}px`,
                      height: `${TIMELINE_HEIGHT + tracks.length * TRACK_HEIGHT}px`
                    }}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-cyan-400 rotate-45 rounded-sm" />
                  </div>

                  {dragPreview && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-cyan-500/70 z-30 pointer-events-none"
                      style={{ left: `${dragPreview.time * zoom}px` }}
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
