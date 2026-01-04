'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Sparkles, Music, Upload, Plus, Minus, Save, Download, Settings, Sliders } from 'lucide-react'
import { MultiTrackDAW } from '@/lib/audio/MultiTrackDAW'
import type { Track } from '@/lib/audio/TrackManager'
import { GlassPanel, GlassButton, GlassFader, GlassKnob, GlassMeter, GlassTooltip, GlassTransport } from '@/app/components/studio/glass'
import MixerView from '@/app/components/studio/MixerView'
import ClipEditor from '@/app/components/studio/ClipEditor'
import AutomationEditor from '@/app/components/studio/AutomationEditor'
import ProjectManager from '@/app/components/studio/ProjectManager'
import ExportModal from '@/app/components/studio/ExportModal'
import AnimatedBackground from '@/app/components/AnimatedBackground'
import { toast } from '@/lib/toast'

// Timeline ruler component
function TimelineRuler({ zoom, playhead, duration, onSeek }: { zoom: number; playhead: number; duration: number; onSeek: (time: number) => void }) {
  const rulerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    handleSeek(e)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) handleSeek(e)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleSeek = (e: React.MouseEvent) => {
    if (!rulerRef.current) return
    const rect = rulerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const time = (x / rect.width) * duration
    onSeek(Math.max(0, Math.min(duration, time)))
  }

  // Generate time markers
  const markers = []
  const interval = zoom < 20 ? 5 : zoom < 50 ? 1 : 0.5
  for (let t = 0; t <= duration; t += interval) {
    const x = (t / duration) * 100
    const minutes = Math.floor(t / 60)
    const seconds = Math.floor(t % 60)
    markers.push(
      <div key={t} className="absolute flex flex-col items-center" style={{ left: `${x}%` }}>
        <div className="w-px h-3 bg-cyan-500/50" />
        <span className="text-[10px] text-gray-400 mt-1">{minutes}:{seconds.toString().padStart(2, '0')}</span>
      </div>
    )
  }

  return (
    <div
      ref={rulerRef}
      className="relative h-12 bg-black/40 backdrop-blur-md border-b border-white/10 cursor-pointer select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {markers}
      
      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-cyan-500 shadow-lg shadow-cyan-500/50 pointer-events-none z-10"
        style={{ left: `${(playhead / duration) * 100}%` }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/50" />
      </div>
    </div>
  )
}

// Track lane component
function TrackLane({ track, zoom, playhead, isSelected, onSelect, onVolumeChange, onPanChange, onClipDoubleClick, showAutomation, onToggleAutomation, onAddAutomationPoint, onMoveAutomationPoint, onDeleteAutomationPoint }: {
  track: Track
  zoom: number
  playhead: number
  isSelected: boolean
  onSelect: () => void
  onVolumeChange: (volume: number) => void
  onPanChange: (pan: number) => void
  onClipDoubleClick: (trackId: string, clipId: string) => void
  showAutomation: boolean
  onToggleAutomation: () => void
  onAddAutomationPoint: (laneId: string, time: number, value: number) => void
  onMoveAutomationPoint: (laneId: string, pointIndex: number, time: number, value: number) => void
  onDeleteAutomationPoint: (laneId: string, pointIndex: number) => void
}) {
  const [vuLevel, setVuLevel] = useState(0)

  return (
    <div
      className={`flex border-b border-white/10 transition-colors duration-200 ${isSelected ? 'bg-cyan-500/5' : 'hover:bg-white/5'}`}
      onClick={onSelect}
    >
      {/* Track header (left sidebar) */}
      <div className="w-64 flex-shrink-0 bg-black/40 backdrop-blur-md border-r border-white/10 p-4">
        <div className="flex flex-col gap-3">
          {/* Track name */}
          <div className="flex items-center justify-between">
            <input
              type="text"
              value={track.name}
              className="bg-transparent text-white font-medium text-sm outline-none border-b border-transparent hover:border-cyan-500/50 focus:border-cyan-500 transition-colors"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-1">
              <GlassButton
                variant={track.solo ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {}}
              >
                S
              </GlassButton>
              <GlassButton
                variant={track.muted ? 'danger' : 'ghost'}
                size="sm"
                onClick={() => {}}
              >
                M
              </GlassButton>
            </div>
          </div>

          {/* Volume fader */}
          <div className="flex items-center gap-2">
            <GlassFader
              value={track.volume}
              onChange={onVolumeChange}
              color="cyan"
              orientation="vertical"
              showValue
              className="h-20"
            />
            <GlassMeter
              level={vuLevel}
              color="cyan"
              orientation="vertical"
              className="h-20"
            />
          </div>

          {/* Pan knob */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-8">Pan</span>
            <GlassKnob
              value={(track.pan + 1) / 2}
              onChange={(val) => onPanChange(val * 2 - 1)}
              color="purple"
              showValue
            />
          </div>
        </div>
      </div>

      {/* Track content (clips timeline) */}
      <div className="flex-1 flex flex-col">
        <div className="relative min-h-[120px] bg-black/20">
          {track.clips.map((clip) => {
            const clipWidth = (clip.duration / 60) * zoom * 100
            const clipLeft = (clip.startTime / 60) * zoom * 100
            
            return (
              <div
                key={clip.id}
                className="absolute h-[80%] top-[10%] bg-gradient-to-r from-cyan-500/40 to-purple-500/40 backdrop-blur-sm border border-cyan-500/30 rounded-lg shadow-lg cursor-move hover:border-cyan-500/60 transition-all"
                style={{
                  left: `${clipLeft}px`,
                  width: `${clipWidth}px`
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onClipDoubleClick(track.id, clip.id)
                }}
              >
                <div className="p-2 text-xs text-white font-medium truncate">
                  {clip.name}
                </div>
              </div>
            )
          })}
          
          {/* Automation toggle button */}
          <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
            <GlassButton
              variant={showAutomation ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onToggleAutomation()}
            >
              A
            </GlassButton>
          </div>
        </div>
        
        {/* Automation lane */}
        {showAutomation && (
          <div className="border-t border-white/10">
            <AutomationEditor
              lane={{
                id: `${track.id}-volume`,
                trackId: track.id,
                parameter: 'volume',
                points: track.automation.find(l => l.id === `${track.id}-volume`)?.points || [],
                color: '#06B6D4'
              }}
              duration={60}
              zoom={zoom}
              playhead={playhead}
              onAddPoint={(time, value) => onAddAutomationPoint(`${track.id}-volume`, time, value)}
              onMovePoint={(index, time, value) => onMoveAutomationPoint(`${track.id}-volume`, index, time, value)}
              onDeletePoint={(index) => onDeleteAutomationPoint(`${track.id}-volume`, index)}
              onClose={onToggleAutomation}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// AI Generation floating panel
function AIGenerationPanel({ onGenerate, isGenerating }: { onGenerate: (params: any) => void; isGenerating: boolean }) {
  const [prompt, setPrompt] = useState('')
  const [genre, setGenre] = useState('lofi')
  const [bpm, setBpm] = useState(120)
  const [lyrics, setLyrics] = useState('')
  const [isInstrumental, setIsInstrumental] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleGenerate = () => {
    if (prompt.length < 3) {
      toast.error('Prompt must be at least 3 characters')
      return
    }
    onGenerate({
      prompt,
      genre,
      bpm,
      lyrics: isInstrumental ? '[Instrumental]' : lyrics,
      isInstrumental
    })
  }

  return (
    <div className="fixed right-6 bottom-24 z-40">
      {isExpanded ? (
        <GlassPanel blur="lg" glow="cyan" className="w-96 p-6">
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-500" />
                <h3 className="text-white font-bold">AI Music Generation</h3>
              </div>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
              >
                ×
              </GlassButton>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Prompt *</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your music..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  rows={3}
                  disabled={isGenerating}
                />
                <div className="text-xs text-gray-500 mt-1">{prompt.length}/300</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Genre</label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-cyan-500/50"
                    disabled={isGenerating}
                  >
                    <option value="lofi">Lo-Fi</option>
                    <option value="hiphop">Hip Hop</option>
                    <option value="jazz">Jazz</option>
                    <option value="chill">Chill</option>
                    <option value="rnb">R&B</option>
                    <option value="techno">Techno</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">BPM</label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-cyan-500/50"
                    min={60}
                    max={200}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Lyrics (optional)</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInstrumental}
                      onChange={(e) => setIsInstrumental(e.target.checked)}
                      className="w-4 h-4 accent-cyan-500"
                      disabled={isGenerating}
                    />
                    <span className="text-xs text-gray-400">Instrumental</span>
                  </label>
                </div>
                <textarea
                  value={isInstrumental ? '[Instrumental]' : lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Optional lyrics..."
                  className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  rows={3}
                  disabled={isGenerating || isInstrumental}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-gray-400">
                  Cost: <span className="text-purple-400 font-bold">2 credits</span>
                </div>
                <GlassButton
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating || prompt.length < 3}
                  icon={isGenerating ? undefined : <Music className="w-4 h-4" />}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </GlassButton>
              </div>
            </div>
          </div>
        </GlassPanel>
      ) : (
        <GlassTooltip content="Open AI Generation Panel" position="left">
          <GlassButton
            variant="primary"
            size="lg"
            icon={<Sparkles className="w-6 h-6" />}
            onClick={() => setIsExpanded(true)}
            className="w-16 h-16 rounded-full shadow-2xl shadow-cyan-500/30"
          >{''}</GlassButton>
        </GlassTooltip>
      )}
    </div>
  )
}

// Main component
export default function MultiTrackStudio() {
  const { user } = useUser()
  const [daw, setDaw] = useState<MultiTrackDAW | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [bpm, setBpm] = useState(120)
  const [zoom, setZoom] = useState(50)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [duration, setDuration] = useState(60)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showMixer, setShowMixer] = useState(false)
  const [showClipEditor, setShowClipEditor] = useState(false)
  const [selectedClip, setSelectedClip] = useState<{ trackId: string; clipId: string } | null>(null)
  const [showProjectManager, setShowProjectManager] = useState(false)
  const [showAutomation, setShowAutomation] = useState<Record<string, boolean>>({})
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [masterVolume, setMasterVolume] = useState(1)
  const [masterVULevel, setMasterVULevel] = useState(0)

  const rafRef = useRef<number | undefined>(undefined)

  // Initialize DAW
  useEffect(() => {
    const dawInstance = new MultiTrackDAW({
      sampleRate: 48000,
      bpm: 120,
      userId: user?.id,
      timeSignature: { numerator: 4, denominator: 4 }
    })

    setDaw(dawInstance)
    setTracks(dawInstance.getTracks())

    // Listen for track changes
    dawInstance.on('trackCreated', (track: Track) => {
      setTracks(dawInstance.getTracks())
    })

    dawInstance.on('trackDeleted', () => {
      setTracks(dawInstance.getTracks())
    })

    return () => {
      dawInstance.dispose()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [user?.id])

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !daw) return

    const updatePlayhead = () => {
      const currentTime = daw.getAudioContext().currentTime
      setPlayhead(currentTime)
      
      if (currentTime >= duration) {
        stop()
      } else {
        rafRef.current = requestAnimationFrame(updatePlayhead)
      }
    }

    rafRef.current = requestAnimationFrame(updatePlayhead)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, daw, duration])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      // Ctrl shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault()
            setShowProjectManager(true)
            break
          case 'o':
            e.preventDefault()
            setShowProjectManager(true)
            break
        }
        return
      }
      
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'e':
          if (selectedClip) {
            setShowClipEditor(true)
          }
          break
        case 'a':
          if (selectedTrackId) {
            setShowAutomation(prev => ({ ...prev, [selectedTrackId]: !prev[selectedTrackId] }))
          }
          break
        case 's':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            handleSave()
          } else {
            stop()
          }
          break
        case 'm':
          e.preventDefault()
          setShowMixer(!showMixer)
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom(Math.min(200, zoom + 10))
          break
        case '-':
        case '_':
          e.preventDefault()
          setZoom(Math.max(10, zoom - 10))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoom, showMixer])

  const togglePlay = () => {
    if (!daw) return
    
    if (isPlaying) {
      daw.pause()
      setIsPlaying(false)
    } else {
      daw.play()
      setIsPlaying(true)
    }
  }

  const stop = () => {
    if (!daw) return
    daw.stop()
    setIsPlaying(false)
    setPlayhead(0)
  }

  const handleSeek = (time: number) => {
    if (!daw) return
    // Note: Seek functionality requires implementation in MultiTrackDAW
    setPlayhead(time)
  }

  const handleAddTrack = () => {
    if (!daw) return
    const track = daw.createTrack(`Track ${tracks.length + 1}`)
    setTracks(daw.getTracks())
    setSelectedTrackId(track.id)
    toast.success('Track added')
  }

  const handleVolumeChange = (trackId: string, volume: number) => {
    if (!daw) return
    daw.setTrackVolume(trackId, volume)
    setTracks(daw.getTracks())
  }

  const handlePanChange = (trackId: string, pan: number) => {
    if (!daw) return
    daw.setTrackPan(trackId, pan)
    setTracks(daw.getTracks())
  }

  const handleSave = async () => {
    setShowProjectManager(true)
  }

  const handleExport = async () => {
    setShowExportModal(true)
  }

  const handleDoExport = async (format: 'mp3' | 'wav', normalize: boolean, sampleRate: number) => {
    if (!daw) return
    // TODO: Implement actual export using Web Audio offline rendering
    console.log('Export:', { format, normalize, sampleRate })
    toast.success(`Exporting as ${format.toUpperCase()}...`)
  }

  // Clip editing handlers
  const handleClipDoubleClick = (trackId: string, clipId: string) => {
    setSelectedClip({ trackId, clipId })
    setShowClipEditor(true)
  }

  const handleClipSplit = (position: number) => {
    if (!selectedClip || !daw) return
    daw.splitClip(selectedClip.trackId, selectedClip.clipId, position)
    toast.success('Clip split successfully')
    setShowClipEditor(false)
  }

  const handleClipTrim = (startTime: number, duration: number) => {
    if (!selectedClip || !daw) return
    daw.trimClip(selectedClip.trackId, selectedClip.clipId, startTime, duration)
    toast.success('Clip trimmed successfully')
  }

  const handleClipFadeChange = (fadeIn: number, fadeOut: number) => {
    if (!selectedClip || !daw) return
    daw.applyClipFade(selectedClip.trackId, selectedClip.clipId, fadeIn, fadeOut)
    toast.success('Fade applied successfully')
  }

  const handleClipDelete = () => {
    if (!selectedClip || !daw) return
    daw.deleteClip(selectedClip.trackId, selectedClip.clipId)
    toast.success('Clip deleted')
    setShowClipEditor(false)
    setSelectedClip(null)
  }

  // Project management handlers
  const handleSaveProject = async (projectName: string) => {
    if (!daw) return
    // TODO: Serialize DAW state and save to IndexedDB
    console.log('Save project:', projectName)
    toast.success(`Project "${projectName}" saved`)
  }

  const handleLoadProject = async (projectId: string) => {
    if (!daw) return
    // TODO: Load project from IndexedDB and restore DAW state
    console.log('Load project:', projectId)
    toast.success('Project loaded')
  }

  const handleDeleteProject = async (projectId: string) => {
    // TODO: Delete project from IndexedDB
    console.log('Delete project:', projectId)
    toast.success('Project deleted')
  }

  const handleNewProject = () => {
    if (!daw) return
    // TODO: Clear DAW state and create new project
    console.log('New project')
    setCurrentProject(null)
    toast.success('New project created')
  }

  // Automation handlers
  const handleAddAutomationPoint = (trackId: string, laneId: string, time: number, value: number) => {
    if (!daw) return
    daw.addAutomationPoint(trackId, laneId, time, value)
  }

  const handleMoveAutomationPoint = (trackId: string, laneId: string, pointIndex: number, time: number, value: number) => {
    if (!daw) return
    daw.moveAutomationPoint(trackId, laneId, pointIndex, time, value)
  }

  const handleDeleteAutomationPoint = (trackId: string, laneId: string, pointIndex: number) => {
    if (!daw) return
    daw.deleteAutomationPoint(trackId, laneId, pointIndex)
  }

  const handleGenerate = async (params: any) => {
    setIsGenerating(true)
    
    try {
      // Check credits first
      const creditsRes = await fetch('/api/credits')
      const creditsData = await creditsRes.json()
      
      if (creditsData.credits < 2) {
        toast.error('Not enough credits! You need 2 credits to generate music.')
        return
      }

      // Generate music
      const response = await fetch('/api/generate/music-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed')
      }

      if (!data.audio_url) {
        throw new Error('No audio URL returned')
      }

      // Add to DAW as new track
      if (daw) {
        const track = daw.createTrack(params.prompt.slice(0, 30))
        
        // Load audio into track
        const audioContext = daw.getAudioContext()
        const audioResponse = await fetch(data.audio_url)
        const arrayBuffer = await audioResponse.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        daw.addClipToTrack(track.id, {
          id: `clip-${Date.now()}`,
          name: params.prompt.slice(0, 30),
          startTime: 0,
          duration: audioBuffer.duration,
          buffer: audioBuffer,
          fadeIn: { duration: 0, curve: 'linear' },
          fadeOut: { duration: 0, curve: 'linear' },
          offset: 0
        })
        
        setTracks(daw.getTracks())
        setSelectedTrackId(track.id)
        setDuration(Math.max(duration, audioBuffer.duration))
        
        toast.success('Music generated and added to timeline!')
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      toast.error(error.message || 'Failed to generate music')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!daw) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-lg">Loading DAW...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <AnimatedBackground />

      {/* Header */}
      <div className="relative z-10 h-20 bg-black/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
            Multi-Track Studio
          </h1>
          <div className="text-sm text-gray-400">
            {tracks.length} tracks • {bpm} BPM
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlassTooltip content="Zoom Out (-)">
            <GlassButton variant="secondary" size="sm" icon={<Minus className="w-4 h-4" />} onClick={() => setZoom(Math.max(10, zoom - 10))}>{''}</GlassButton>
          </GlassTooltip>
          
          <div className="text-xs text-gray-400">{zoom}px/s</div>
          
          <GlassTooltip content="Zoom In (+)">
            <GlassButton variant="secondary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setZoom(Math.min(200, zoom + 10))}>{''}</GlassButton>
          </GlassTooltip>

          <div className="w-px h-8 bg-white/10" />

          <GlassTooltip content="Open Mixer (M)">
            <GlassButton variant="secondary" size="sm" icon={<Sliders className="w-4 h-4" />} onClick={() => setShowMixer(true)}>{''}</GlassButton>
          </GlassTooltip>

          <GlassTooltip content="Save Project (Ctrl+S)">
            <GlassButton variant="secondary" size="sm" icon={<Save className="w-4 h-4" />} onClick={handleSave}>{''}</GlassButton>
          </GlassTooltip>

          <GlassTooltip content="Export Audio">
            <GlassButton variant="secondary" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExport}>{''}</GlassButton>
          </GlassTooltip>

          <GlassTooltip content="Settings">
            <GlassButton variant="secondary" size="sm" icon={<Settings className="w-4 h-4" />}>{''}</GlassButton>
          </GlassTooltip>
        </div>
      </div>

      {/* Transport controls */}
      <div className="relative z-10 flex items-center justify-center py-4 bg-black/40 backdrop-blur-md border-b border-white/10">
        <GlassTransport
          isPlaying={isPlaying}
          onPlay={togglePlay}
          onPause={togglePlay}
          onStop={stop}
          showSeekButtons={false}
          showSkipButtons={false}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Timeline ruler */}
        <TimelineRuler zoom={zoom} playhead={playhead} duration={duration} onSeek={handleSeek} />

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto">
          {tracks.map((track) => (
            <TrackLane
              key={track.id}
              track={track}
              zoom={zoom}
              playhead={playhead}
              isSelected={selectedTrackId === track.id}
              onSelect={() => setSelectedTrackId(track.id)}
              onVolumeChange={(volume) => handleVolumeChange(track.id, volume)}
              onPanChange={(pan) => handlePanChange(track.id, pan)}
              onClipDoubleClick={handleClipDoubleClick}
              showAutomation={showAutomation[track.id] || false}
              onToggleAutomation={() => setShowAutomation(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
              onAddAutomationPoint={(laneId, time, value) => handleAddAutomationPoint(track.id, laneId, time, value)}
              onMoveAutomationPoint={(laneId, index, time, value) => handleMoveAutomationPoint(track.id, laneId, index, time, value)}
              onDeleteAutomationPoint={(laneId, index) => handleDeleteAutomationPoint(track.id, laneId, index)}
            />
          ))}

          {/* Add track button */}
          <div className="p-4 border-b border-white/10">
            <GlassButton
              variant="secondary"
              icon={<Plus className="w-4 h-4" />}
              onClick={handleAddTrack}
            >
              Add Track
            </GlassButton>
          </div>
        </div>
      </div>

      {/* AI Generation Panel */}
      <AIGenerationPanel onGenerate={handleGenerate} isGenerating={isGenerating} />

      {/* Mixer View */}
      <MixerView
        isOpen={showMixer}
        onClose={() => setShowMixer(false)}
        tracks={tracks}
        masterVolume={masterVolume}
        masterVULevel={masterVULevel}
        onMasterVolumeChange={setMasterVolume}
        onTrackVolumeChange={(trackId, volume) => handleVolumeChange(trackId, volume)}
        onTrackPanChange={(trackId, pan) => handlePanChange(trackId, pan)}
        onTrackMuteToggle={(trackId) => {
          if (daw) {
            daw.toggleTrackMute(trackId)
            setTracks(daw.getTracks())
          }
        }}
        onTrackSoloToggle={(trackId) => {
          if (daw) {
            daw.toggleTrackSolo(trackId)
            setTracks(daw.getTracks())
          }
        }}
        onTrackEQChange={(trackId, band, value) => {
          if (daw) {
            daw.setTrackEQ(trackId, band, value)
          }
        }}
        onTrackCompressionChange={(trackId, value) => {
          if (daw) {
            daw.setTrackCompression(trackId, value)
          }
        }}
        onTrackReverbChange={(trackId, value) => {
          if (daw) {
            daw.setTrackReverb(trackId, value)
          }
        }}
      />

      {/* Clip Editor */}
      {showClipEditor && selectedClip && (() => {
        const track = tracks.find(t => t.id === selectedClip.trackId)
        const clip = track?.clips.find(c => c.id === selectedClip.clipId)
        
        if (!clip) return null

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <ClipEditor
              clipId={clip.id}
              clipName={clip.name || 'Untitled Clip'}
              startTime={clip.startTime}
              duration={clip.duration}
              fadeIn={0}
              fadeOut={0}
              onSplit={handleClipSplit}
              onTrim={handleClipTrim}
              onFadeChange={handleClipFadeChange}
              onDelete={handleClipDelete}
              onClose={() => setShowClipEditor(false)}
            />
          </div>
        )
      })()}

      {/* Project Manager */}
      <ProjectManager
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        currentProject={currentProject}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        onNewProject={handleNewProject}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onStartExport={handleDoExport}
        projectName="Multi-Track Project"
        bpm={bpm}
        timeSig="4/4"
      />
    </div>
  )
}
