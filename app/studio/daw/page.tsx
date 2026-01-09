'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef, useState, useCallback } from 'react'
import { 
  Play, Pause, Square, Plus, Save, FolderOpen, Download,
  Volume2, Trash2, Music, Wand2, Scissors, ZoomIn, ZoomOut,
  Repeat, Settings, Sliders, X, Loader2, Check, AlertCircle
} from 'lucide-react'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface AudioClip {
  id: string
  trackId: string
  buffer: AudioBuffer
  startTime: number
  duration: number
  offset: number
  name: string
  color: string
  url: string
}

interface Track {
  id: string
  name: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  color: string
  height: number
}

interface Project {
  id?: string
  title: string
  tracks: Track[]
  clips: any[]
  tempo: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const TRACK_HEIGHT = 100
const TIMELINE_HEIGHT = 40
const PIXELS_PER_SECOND = 80

// ============================================================================
// WAVEFORM RENDERING UTILITY
// ============================================================================

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  buffer: AudioBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
) {
  const data = buffer.getChannelData(0)
  const step = Math.ceil(data.length / width)
  const amp = height / 2

  ctx.fillStyle = color + '40'
  ctx.strokeStyle = color
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(x, y + amp)

  for (let i = 0; i < width; i++) {
    let min = 1.0
    let max = -1.0
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j]
      if (datum < min) min = datum
      if (datum > max) max = datum
    }
    ctx.lineTo(x + i, y + amp + (max * amp))
  }

  for (let i = width - 1; i >= 0; i--) {
    let min = 1.0
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j]
      if (datum < min) min = datum
    }
    ctx.lineTo(x + i, y + amp + (min * amp))
  }

  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

// ============================================================================
// MAIN DAW COMPONENT
// ============================================================================

export default function DAWStudio() {
  const { user } = useUser()
  
  // State
  const [tracks, setTracks] = useState<Track[]>([])
  const [clips, setClips] = useState<AudioClip[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(120)
  const [tempo, setTempo] = useState(120)
  const [zoom, setZoom] = useState(1)
  const [projectTitle, setProjectTitle] = useState('Untitled Project')
  const [selectedClip, setSelectedClip] = useState<string | null>(null)
  const [showMixer, setShowMixer] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [library, setLibrary] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [userCredits, setUserCredits] = useState(0)
  const [draggedClip, setDraggedClip] = useState<{ clip: AudioClip; offsetX: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null)
  const scheduledNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map())
  const startTimeRef = useRef(0)
  const animFrameRef = useRef<number | undefined>(undefined)

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    audioContextRef.current = new AudioContext()
    loadUserLibrary()
    fetchCredits()
    
    // Initialize with 4 empty tracks
    const initialTracks: Track[] = [
      { id: '1', name: 'Track 1', volume: 0.8, pan: 0, muted: false, solo: false, color: COLORS[0], height: TRACK_HEIGHT },
      { id: '2', name: 'Track 2', volume: 0.8, pan: 0, muted: false, solo: false, color: COLORS[1], height: TRACK_HEIGHT },
      { id: '3', name: 'Track 3', volume: 0.8, pan: 0, muted: false, solo: false, color: COLORS[2], height: TRACK_HEIGHT },
      { id: '4', name: 'Track 4', volume: 0.8, pan: 0, muted: false, solo: false, color: COLORS[3], height: TRACK_HEIGHT },
    ]
    setTracks(initialTracks)

    return () => {
      audioContextRef.current?.close()
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  useEffect(() => {
    drawTimeline()
    drawTracks()
  }, [tracks, clips, currentTime, zoom, duration])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.code === 'Space') {
        e.preventDefault()
        isPlaying ? handlePause() : handlePlay()
      } else if (e.key === 'Delete' && selectedClip) {
        removeClip(selectedClip)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, selectedClip])

  // ============================================================================
  // AUDIO ENGINE
  // ============================================================================

  const handlePlay = useCallback(async () => {
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') await ctx.resume()

    const soloTracks = tracks.filter(t => t.solo)
    const activeTracks = soloTracks.length > 0 ? soloTracks : tracks.filter(t => !t.muted)
    const activeTrackIds = new Set(activeTracks.map(t => t.id))

    // Schedule all clips
    clips.forEach(clip => {
      if (!activeTrackIds.has(clip.trackId)) return

      const track = tracks.find(t => t.id === clip.trackId)
      if (!track) return

      const source = ctx.createBufferSource()
      source.buffer = clip.buffer

      const gainNode = ctx.createGain()
      gainNode.gain.value = track.volume

      const panNode = ctx.createStereoPanner()
      panNode.pan.value = track.pan

      source.connect(gainNode)
      gainNode.connect(panNode)
      panNode.connect(ctx.destination)

      const startOffset = Math.max(0, currentTime - clip.startTime)
      if (startOffset < clip.duration) {
        source.start(0, clip.offset + startOffset, clip.duration - startOffset)
        scheduledNodesRef.current.set(clip.id, source)
      }
    })

    startTimeRef.current = ctx.currentTime - currentTime
    setIsPlaying(true)
    updatePlayhead()
  }, [tracks, clips, currentTime])

  const handlePause = useCallback(() => {
    scheduledNodesRef.current.forEach(node => {
      try { node.stop() } catch (e) {}
    })
    scheduledNodesRef.current.clear()
    setIsPlaying(false)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
  }, [])

  const handleStop = useCallback(() => {
    handlePause()
    setCurrentTime(0)
  }, [handlePause])

  const updatePlayhead = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current
    setCurrentTime(elapsed)

    const maxTime = Math.max(duration, ...clips.map(c => c.startTime + c.duration))
    if (elapsed >= maxTime) {
      handleStop()
    } else {
      animFrameRef.current = requestAnimationFrame(updatePlayhead)
    }
  }, [isPlaying, duration, clips, handleStop])

  // ============================================================================
  // TIMELINE RENDERING
  // ============================================================================

  const drawTimeline = useCallback(() => {
    const canvas = timelineCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = duration * PIXELS_PER_SECOND * zoom
    canvas.width = width
    canvas.height = TIMELINE_HEIGHT

    // Background
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, TIMELINE_HEIGHT)

    // Grid lines and markers
    ctx.strokeStyle = '#333'
    ctx.fillStyle = '#888'
    ctx.font = '10px monospace'

    const secondsPerMarker = zoom < 0.5 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 2 : 1
    
    for (let t = 0; t <= duration; t += secondsPerMarker) {
      const x = t * PIXELS_PER_SECOND * zoom
      
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, TIMELINE_HEIGHT)
      ctx.stroke()

      const mins = Math.floor(t / 60)
      const secs = t % 60
      ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, x + 4, 12)
    }

    // Playhead
    const playheadX = currentTime * PIXELS_PER_SECOND * zoom
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, TIMELINE_HEIGHT)
    ctx.stroke()
  }, [currentTime, duration, zoom])

  // ============================================================================
  // TRACKS & CLIPS RENDERING
  // ============================================================================

  const drawTracks = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = duration * PIXELS_PER_SECOND * zoom
    const height = tracks.length * TRACK_HEIGHT
    canvas.width = width
    canvas.height = height

    // Draw tracks
    tracks.forEach((track, index) => {
      const y = index * TRACK_HEIGHT

      // Track background
      ctx.fillStyle = index % 2 === 0 ? '#0f0f0f' : '#1a1a1a'
      ctx.fillRect(0, y, width, TRACK_HEIGHT)

      // Track border
      ctx.strokeStyle = '#333'
      ctx.strokeRect(0, y, width, TRACK_HEIGHT)

      // Beat grid
      ctx.strokeStyle = '#222'
      const beatsPerSecond = tempo / 60
      const secondsPerBeat = 1 / beatsPerSecond
      for (let t = 0; t <= duration; t += secondsPerBeat) {
        const x = t * PIXELS_PER_SECOND * zoom
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + TRACK_HEIGHT)
        ctx.stroke()
      }
    })

    // Draw clips
    clips.forEach(clip => {
      const track = tracks.find(t => t.id === clip.trackId)
      if (!track) return

      const trackIndex = tracks.indexOf(track)
      const x = clip.startTime * PIXELS_PER_SECOND * zoom
      const y = trackIndex * TRACK_HEIGHT + 10
      const w = clip.duration * PIXELS_PER_SECOND * zoom
      const h = TRACK_HEIGHT - 20

      // Clip background
      ctx.fillStyle = clip.id === selectedClip ? track.color : track.color + 'aa'
      ctx.fillRect(x, y, w, h)

      // Waveform
      try {
        drawWaveform(ctx, clip.buffer, x, y, w, h, '#ffffff')
      } catch (e) {
        console.error('Waveform draw error:', e)
      }

      // Clip border
      ctx.strokeStyle = clip.id === selectedClip ? '#fff' : '#666'
      ctx.lineWidth = clip.id === selectedClip ? 2 : 1
      ctx.strokeRect(x, y, w, h)

      // Clip name
      ctx.fillStyle = '#fff'
      ctx.font = '12px sans-serif'
      ctx.fillText(clip.name, x + 8, y + 20)
    })

    // Playhead
    const playheadX = currentTime * PIXELS_PER_SECOND * zoom
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()
  }, [tracks, clips, currentTime, duration, zoom, tempo, selectedClip])

  // ============================================================================
  // CLIP MANAGEMENT
  // ============================================================================

  const addClipFromLibrary = useCallback(async (libraryItem: any, trackId: string) => {
    if (!audioContextRef.current) return

    try {
      const response = await fetch(libraryItem.audio_url || libraryItem.url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer)

      const track = tracks.find(t => t.id === trackId)
      if (!track) return

      const newClip: AudioClip = {
        id: crypto.randomUUID(),
        trackId,
        buffer: audioBuffer,
        startTime: currentTime,
        duration: audioBuffer.duration,
        offset: 0,
        name: libraryItem.title || 'Clip',
        color: track.color,
        url: libraryItem.audio_url || libraryItem.url
      }

      setClips(prev => [...prev, newClip])
      setDuration(prev => Math.max(prev, newClip.startTime + newClip.duration + 10))
      setShowLibrary(false)
    } catch (error) {
      console.error('Error adding clip:', error)
      alert('Failed to load audio clip')
    }
  }, [tracks, currentTime])

  const removeClip = useCallback((clipId: string) => {
    setClips(prev => prev.filter(c => c.id !== clipId))
    if (selectedClip === clipId) setSelectedClip(null)
  }, [selectedClip])

  // ============================================================================
  // TRACK MANAGEMENT
  // ============================================================================

  const addTrack = useCallback(() => {
    const newTrack: Track = {
      id: crypto.randomUUID(),
      name: `Track ${tracks.length + 1}`,
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      color: COLORS[tracks.length % COLORS.length],
      height: TRACK_HEIGHT
    }
    setTracks(prev => [...prev, newTrack])
  }, [tracks])

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }, [])

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id))
    setClips(prev => prev.filter(c => c.trackId !== id))
  }, [])

  // ============================================================================
  // AI GENERATION
  // ============================================================================

  const generateMusic = useCallback(async (prompt: string, genre: string) => {
    if (userCredits < 5) {
      alert('Insufficient credits! Need 5 credits to generate music.')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genre, tempo, duration: 30 })
      })

      if (!response.ok) throw new Error('Generation failed')

      const data = await response.json()
      
      // Fetch and decode the generated audio
      const audioResponse = await fetch(data.url)
      const arrayBuffer = await audioResponse.arrayBuffer()
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer)

      // Add to first available track
      const targetTrack = tracks[0]
      const newClip: AudioClip = {
        id: crypto.randomUUID(),
        trackId: targetTrack.id,
        buffer: audioBuffer,
        startTime: currentTime,
        duration: audioBuffer.duration,
        offset: 0,
        name: prompt.slice(0, 20),
        color: targetTrack.color,
        url: data.url
      }

      setClips(prev => [...prev, newClip])
      setDuration(prev => Math.max(prev, newClip.startTime + newClip.duration + 10))
      setUserCredits(prev => prev - 5)
      setShowGenerate(false)
      alert('Music generated successfully!')
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate music')
    } finally {
      setIsGenerating(false)
    }
  }, [tracks, currentTime, tempo, userCredits])

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadUserLibrary = useCallback(async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/media?userId=${user.id}&type=audio`)
      if (response.ok) {
        const data = await response.json()
        setLibrary(data.media || [])
      }
    } catch (error) {
      console.error('Error loading library:', error)
    }
  }, [user])

  const fetchCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/credits')
      if (response.ok) {
        const data = await response.json()
        setUserCredits(data.credits || 0)
      }
    } catch (error) {
      console.error('Error fetching credits:', error)
    }
  }, [])

  // ============================================================================
  // PROJECT MANAGEMENT
  // ============================================================================

  const handleSave = useCallback(async () => {
    if (!user) return

    try {
      const project: Project = {
        title: projectTitle,
        tracks,
        clips: clips.map(c => ({
          ...c,
          buffer: null, // Can't serialize AudioBuffer
        })),
        tempo
      }

      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      })

      if (!response.ok) throw new Error('Save failed')
      alert('Project saved!')
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save project')
    }
  }, [user, projectTitle, tracks, clips, tempo])

  // ============================================================================
  // CANVAS INTERACTIONS
  // ============================================================================

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return // Don't select if we just finished dragging
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicked on a clip
    const clickedClip = clips.find(clip => {
      const track = tracks.find(t => t.id === clip.trackId)
      if (!track) return false

      const trackIndex = tracks.indexOf(track)
      const clipX = clip.startTime * PIXELS_PER_SECOND * zoom
      const clipY = trackIndex * TRACK_HEIGHT + 10
      const clipW = clip.duration * PIXELS_PER_SECOND * zoom
      const clipH = TRACK_HEIGHT - 20

      return x >= clipX && x <= clipX + clipW && y >= clipY && y <= clipY + clipH
    })

    setSelectedClip(clickedClip?.id || null)
  }, [clips, tracks, zoom, isDragging])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Find clip under mouse
    const clickedClip = clips.find(clip => {
      const track = tracks.find(t => t.id === clip.trackId)
      if (!track) return false

      const trackIndex = tracks.indexOf(track)
      const clipX = clip.startTime * PIXELS_PER_SECOND * zoom
      const clipY = trackIndex * TRACK_HEIGHT + 10
      const clipW = clip.duration * PIXELS_PER_SECOND * zoom
      const clipH = TRACK_HEIGHT - 20

      return x >= clipX && x <= clipX + clipW && y >= clipY && y <= clipY + clipH
    })

    if (clickedClip) {
      const clipX = clickedClip.startTime * PIXELS_PER_SECOND * zoom
      setDraggedClip({ clip: clickedClip, offsetX: x - clipX })
      setIsDragging(true)
      setSelectedClip(clickedClip.id)
    }
  }, [clips, tracks, zoom])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggedClip) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Calculate new start time (snap to 0.1s grid)
    const newStartTime = Math.max(0, Math.round((x - draggedClip.offsetX) / (PIXELS_PER_SECOND * zoom) * 10) / 10)

    // Check which track we're over
    const trackIndex = Math.floor(y / TRACK_HEIGHT)
    const newTrack = tracks[trackIndex]

    if (newTrack) {
      setClips(prev => prev.map(c => 
        c.id === draggedClip.clip.id 
          ? { ...c, startTime: newStartTime, trackId: newTrack.id, color: newTrack.color }
          : c
      ))
    }
  }, [draggedClip, tracks, zoom])

  const handleCanvasMouseUp = useCallback(() => {
    if (draggedClip) {
      setTimeout(() => setIsDragging(false), 50) // Delay to prevent immediate click after drag
    }
    setDraggedClip(null)
  }, [draggedClip])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggedClip) {
        setTimeout(() => setIsDragging(false), 50)
      }
      setDraggedClip(null)
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [draggedClip])

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950 to-gray-950 text-white">
      <AnimatedBackground />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl p-4">
          <div className="max-w-[2000px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Music className="text-purple-400" size={32} />
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-2xl font-bold bg-transparent border-b border-purple-500/50 focus:border-purple-400 focus:outline-none px-2 py-1"
                placeholder="Project Title"
              />
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>{tempo} BPM</span>
                <input
                  type="number"
                  value={tempo}
                  onChange={(e) => setTempo(parseInt(e.target.value) || 120)}
                  className="bg-gray-800/50 px-2 py-1 rounded w-16 text-center"
                  min="40"
                  max="240"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded">
                {userCredits} Credits
              </div>
              <button
                onClick={() => setShowMixer(!showMixer)}
                className={`px-4 py-2 rounded transition ${showMixer ? 'bg-purple-600' : 'bg-gray-800/50 hover:bg-gray-700/50'}`}
              >
                <Sliders size={18} />
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded transition flex items-center gap-2"
              >
                <Save size={18} />
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl p-4">
          <div className="max-w-[2000px] mx-auto flex items-center gap-4">
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="bg-purple-600 hover:bg-purple-500 p-4 rounded-full transition"
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button
              onClick={handleStop}
              className="bg-gray-800 hover:bg-gray-700 p-4 rounded-full transition"
            >
              <Square size={24} />
            </button>

            <div className="flex-1 flex items-center gap-2 text-sm">
              <span className="font-mono">{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              <span className="font-mono">{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-sm">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
                className="p-2 bg-gray-800 hover:bg-gray-700 rounded transition"
              >
                <ZoomIn size={18} />
              </button>
            </div>

            <button
              onClick={() => setShowLibrary(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition flex items-center gap-2"
            >
              <FolderOpen size={18} />
              Library
            </button>
            <button
              onClick={() => setShowGenerate(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded transition flex items-center gap-2"
            >
              <Wand2 size={18} />
              Generate AI
            </button>
            <button
              onClick={addTrack}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded transition flex items-center gap-2"
            >
              <Plus size={18} />
              Add Track
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex max-w-[2000px] mx-auto">
          {/* Track Headers */}
          <div className="w-64 border-r border-white/10 bg-black/40 backdrop-blur-xl">
            <div className="h-10 border-b border-white/10" />
            <div>
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="h-[100px] border-b border-white/10 p-4 flex flex-col justify-between"
                  style={{ backgroundColor: index % 2 === 0 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)' }}
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={track.name}
                      onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                      className="bg-transparent border-b border-gray-700 focus:border-purple-400 focus:outline-none px-1 text-sm w-full"
                    />
                    <button
                      onClick={() => removeTrack(track.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateTrack(track.id, { muted: !track.muted })}
                      className={`px-2 py-1 text-xs rounded ${track.muted ? 'bg-red-600' : 'bg-gray-700'}`}
                    >
                      M
                    </button>
                    <button
                      onClick={() => updateTrack(track.id, { solo: !track.solo })}
                      className={`px-2 py-1 text-xs rounded ${track.solo ? 'bg-yellow-600' : 'bg-gray-700'}`}
                    >
                      S
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.volume}
                      onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline & Tracks */}
          <div className="flex-1 overflow-auto max-h-[calc(100vh-200px)]">
            <canvas
              ref={timelineCanvasRef}
              className="border-b border-white/10 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = e.clientX - rect.left
                setCurrentTime(x / (PIXELS_PER_SECOND * zoom))
              }}
            />
            <canvas
              ref={canvasRef}
              className="cursor-move"
              onClick={handleCanvasClick}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
          </div>
        </div>

        {/* Library Modal */}
        {showLibrary && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
            <div className="bg-gray-900 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto p-8 border border-purple-500/30">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Your Library</h2>
                <button onClick={() => setShowLibrary(false)}>
                  <X size={24} />
                </button>
              </div>
              
              {library.length === 0 ? (
                <p className="text-gray-400 text-center py-12">No audio files in your library yet.</p>
              ) : (
                <div className="space-y-2">
                  {library.map((item) => (
                    <div key={item.id} className="bg-gray-800/50 p-4 rounded flex items-center justify-between hover:bg-gray-800 transition">
                      <div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-gray-400">{item.genre}</p>
                      </div>
                      <div className="flex gap-2">
                        {tracks.map(track => (
                          <button
                            key={track.id}
                            onClick={() => addClipFromLibrary(item, track.id)}
                            className="px-3 py-1 rounded text-sm"
                            style={{ backgroundColor: track.color }}
                          >
                            → {track.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate AI Modal */}
        {showGenerate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
            <div className="bg-gray-900 rounded-xl max-w-2xl w-full p-8 border border-purple-500/30">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Generate AI Music</h2>
                <button onClick={() => setShowGenerate(false)}>
                  <X size={24} />
                </button>
              </div>
              
              <AIGenerateForm
                onGenerate={generateMusic}
                isGenerating={isGenerating}
                userCredits={userCredits}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// AI GENERATION FORM COMPONENT
// ============================================================================

function AIGenerateForm({ 
  onGenerate, 
  isGenerating, 
  userCredits 
}: { 
  onGenerate: (prompt: string, genre: string) => void
  isGenerating: boolean
  userCredits: number
}) {
  const [prompt, setPrompt] = useState('')
  const [genre, setGenre] = useState('lofi')

  const genres = ['lofi', 'hiphop', 'jazz', 'electronic', 'rock', 'ambient', 'techno', 'house']

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-2">Prompt (3-300 characters)</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the music you want to create..."
          className="w-full bg-gray-800 border border-gray-700 rounded p-3 h-24 focus:outline-none focus:border-purple-500"
          maxLength={300}
        />
        <div className={`text-sm mt-1 ${prompt.length < 3 ? 'text-red-400' : prompt.length > 270 ? 'text-yellow-400' : 'text-gray-500'}`}>
          {prompt.length}/300 characters
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Genre</label>
        <div className="grid grid-cols-4 gap-2">
          {genres.map(g => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={`px-4 py-2 rounded capitalize transition ${
                genre === g ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded">
        <span className="text-sm text-gray-400">Cost: 5 credits</span>
        <span className={`text-sm font-semibold ${userCredits >= 5 ? 'text-green-400' : 'text-red-400'}`}>
          Your credits: {userCredits}
        </span>
      </div>

      <button
        onClick={() => onGenerate(prompt, genre)}
        disabled={isGenerating || prompt.length < 3 || userCredits < 5}
        className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 size={20} />
            Generate Music
          </>
        )}
      </button>
    </div>
  )
}

// ============================================================================
// ANIMATED BACKGROUND COMPONENT
// ============================================================================

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-pulse delay-1000" />
    </div>
  )
}
