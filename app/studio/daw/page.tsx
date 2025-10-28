'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { 
  Play, Pause, Square, Save, FolderOpen, Plus, Trash2, 
  Volume2, VolumeX, Scissors, Copy, Music, Sliders,
  ChevronLeft, ChevronRight, X, Zap, Sparkles
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Types
type Track = {
  id: string
  name: string
  volume: number
  pan: number
  mute: boolean
  solo: boolean
  buffer: AudioBuffer | null
  sourceUrl: string | null
  effects: Effect[]
  color: string
}

type Effect = {
  id: string
  type: 'reverb' | 'delay' | 'eq' | 'compress' | 'distortion'
  params: Record<string, number>
  enabled: boolean
}

type GenerationRequest = {
  id: string
  prompt: string
  status: 'queued' | 'generating' | 'complete' | 'error'
  audioUrl?: string
  imageUrl?: string
}

const TRACK_COLORS = [
  '#22D3EE', // cyan
  '#A78BFA', // purple
  '#FB923C', // orange
  '#34D399', // green
  '#F472B6', // pink
  '#FBBF24', // yellow
]

export default function StudioDAWPage() {
  const { user } = useUser()
  const router = useRouter()
  
  // State
  const [tracks, setTracks] = useState<Track[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [zoom, setZoom] = useState(100)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [projectName, setProjectName] = useState('Untitled Project')
  const [saving, setSaving] = useState(false)
  
  // AI Generation
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLanguage, setAiLanguage] = useState('en')
  const [generations, setGenerations] = useState<GenerationRequest[]>([])
  const [showEffectModal, setShowEffectModal] = useState(false)
  const [selectedEffect, setSelectedEffect] = useState<Effect | null>(null)
  
  // Library
  const [libraryItems, setLibraryItems] = useState<any[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  
  // Audio Context
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const trackNodesRef = useRef<Map<string, { gain: GainNode; pan: StereoPannerNode; source: AudioBufferSourceNode | null }>>(new Map())
  
  // Initialize Audio Context
  const initAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const master = ctx.createGain()
      master.gain.value = 1
      master.connect(ctx.destination)
      audioCtxRef.current = ctx
      masterGainRef.current = master
    }
    return audioCtxRef.current
  }, [])
  
  // Load user's library
  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    
    async function loadLibrary() {
      try {
        setLoadingLibrary(true)
        const { data, error } = await supabase
          .from('combined_media')
          .select('id, title, audio_url, image_url')
          .eq('user_id', user!.id)
          .not('audio_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (error) throw error
        if (mounted) setLibraryItems(data || [])
      } catch (e) {
        console.error('Failed to load library:', e)
      } finally {
        if (mounted) setLoadingLibrary(false)
      }
    }
    
    loadLibrary()
    return () => { mounted = false }
  }, [user])
  
  // Add new track
  const addTrack = () => {
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${tracks.length + 1}`,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      buffer: null,
      sourceUrl: null,
      effects: [],
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length]
    }
    setTracks([...tracks, newTrack])
  }
  
  // Delete track
  const deleteTrack = (trackId: string) => {
    setTracks(tracks.filter(t => t.id !== trackId))
    if (selectedTrackId === trackId) setSelectedTrackId(null)
  }
  
  // Load audio from URL to track
  const loadAudioToTrack = async (trackId: string, url: string) => {
    try {
      const ctx = initAudioContext()
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = await ctx.decodeAudioData(arrayBuffer)
      
      setTracks(prev => prev.map(t => 
        t.id === trackId ? { ...t, buffer, sourceUrl: url } : t
      ))
      
      // Update duration if this is the longest track
      if (buffer.duration > duration) {
        setDuration(buffer.duration)
      }
    } catch (e) {
      console.error('Failed to load audio:', e)
    }
  }
  
  // Generate AI music
  const generateMusic = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 3) return
    
    const genId = `gen-${Date.now()}`
    const newGen: GenerationRequest = {
      id: genId,
      prompt: aiPrompt,
      status: 'queued'
    }
    
    setGenerations(prev => [newGen, ...prev])
    setAiPrompt('')
    
    try {
      // Call your existing AI generation API
      const endpoint = aiLanguage === 'en' ? '/api/generate/music' : '/api/generate/music-only'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          language: aiLanguage
        })
      })
      
      if (!response.ok) throw new Error('Generation failed')
      
      const data = await response.json()
      
      setGenerations(prev => prev.map(g => 
        g.id === genId ? { ...g, status: 'complete', audioUrl: data.audioUrl, imageUrl: data.imageUrl } : g
      ))
    } catch (e) {
      console.error('Generation error:', e)
      setGenerations(prev => prev.map(g => 
        g.id === genId ? { ...g, status: 'error' } : g
      ))
    }
  }
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, item: any) => {
    e.dataTransfer.setData('audio-url', item.audio_url || item.audioUrl)
    e.dataTransfer.setData('title', item.title || item.prompt)
  }
  
  const handleDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    const url = e.dataTransfer.getData('audio-url')
    const title = e.dataTransfer.getData('title')
    
    if (url) {
      loadAudioToTrack(trackId, url)
      if (title) {
        setTracks(prev => prev.map(t => 
          t.id === trackId ? { ...t, name: title } : t
        ))
      }
    }
  }
  
  // Save project
  const saveProject = async () => {
    if (!user) return
    
    try {
      setSaving(true)
      const projectData = {
        name: projectName,
        tracks: tracks.map(t => ({
          id: t.id,
          name: t.name,
          volume: t.volume,
          pan: t.pan,
          mute: t.mute,
          solo: t.solo,
          sourceUrl: t.sourceUrl,
          effects: t.effects,
          color: t.color
        })),
        duration,
        zoom
      }
      
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, data: projectData })
      })
      
      if (!response.ok) throw new Error('Save failed')
      
      // Show success feedback
      alert('Project saved!')
    } catch (e) {
      console.error('Save error:', e)
      alert('Failed to save project')
    } finally {
      setSaving(false)
    }
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Music size={64} className="mx-auto mb-4 text-purple-400" />
          <h1 className="text-2xl font-bold mb-2">Welcome to 444Studio</h1>
          <p className="text-gray-400 mb-6">Sign in to start creating</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-500 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ChevronLeft size={20} />
          </button>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-none text-lg font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-2"
            placeholder="Project Name"
          />
        </div>
        
        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-purple-600 hover:bg-purple-500 rounded-full transition"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => setIsPlaying(false)}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition"
          >
            <Square size={20} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={saveProject}
            disabled={saving}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* AI Sidebar */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'} bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-purple-400" />
              AI Generation
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          
          {/* AI Generation Form */}
          <div className="p-4 border-b border-white/10">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe your music... (e.g., chill lofi hip hop beats)"
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <select
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
              <button
                onClick={generateMusic}
                disabled={aiPrompt.trim().length < 3}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-500 hover:to-pink-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Zap size={16} />
                Generate
              </button>
            </div>
          </div>
          
          {/* Generations Queue */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">GENERATED TRACKS</h3>
            {generations.map(gen => (
              <div
                key={gen.id}
                draggable={gen.status === 'complete'}
                onDragStart={(e) => gen.status === 'complete' && handleDragStart(e, gen)}
                className={`p-3 rounded-lg border ${
                  gen.status === 'complete' 
                    ? 'bg-white/5 border-white/10 cursor-grab active:cursor-grabbing' 
                    : 'bg-black/40 border-white/5'
                }`}
              >
                <p className="text-sm font-medium truncate">{gen.prompt}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {gen.status === 'queued' && '⏳ Queued...'}
                  {gen.status === 'generating' && '🎵 Generating...'}
                  {gen.status === 'complete' && '✅ Drag to timeline'}
                  {gen.status === 'error' && '❌ Failed'}
                </p>
              </div>
            ))}
          </div>
          
          {/* Library */}
          <div className="border-t border-white/10 p-4 max-h-64 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">YOUR LIBRARY</h3>
            {loadingLibrary ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : libraryItems.length === 0 ? (
              <p className="text-xs text-gray-500">No tracks yet</p>
            ) : (
              <div className="space-y-1">
                {libraryItems.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    className="p-2 rounded bg-white/5 hover:bg-white/10 cursor-grab active:cursor-grabbing transition text-xs truncate"
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-500 rounded-r-lg transition z-10"
          >
            <ChevronRight size={16} />
          </button>
        )}
        
        {/* Timeline Area */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Tracks */}
          <div className="flex-1 overflow-y-auto">
            {tracks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Music size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="mb-4">No tracks yet. Add your first track!</p>
                  <button
                    onClick={addTrack}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
                  >
                    Add Track
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {tracks.map(track => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      selectedTrackId === track.id ? 'bg-white/10' : 'bg-white/5'
                    } hover:bg-white/10 transition`}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    {/* Track Controls */}
                    <div className="w-48 flex flex-col gap-1">
                      <input
                        type="text"
                        value={track.name}
                        onChange={(e) => setTracks(prev => prev.map(t => 
                          t.id === track.id ? { ...t, name: e.target.value } : t
                        ))}
                        className="bg-transparent text-sm font-medium focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTracks(prev => prev.map(t => 
                            t.id === track.id ? { ...t, mute: !t.mute } : t
                          ))}
                          className={`px-2 py-1 rounded text-xs ${track.mute ? 'bg-red-600' : 'bg-white/10'}`}
                        >
                          M
                        </button>
                        <button
                          onClick={() => setTracks(prev => prev.map(t => 
                            t.id === track.id ? { ...t, solo: !t.solo } : t
                          ))}
                          className={`px-2 py-1 rounded text-xs ${track.solo ? 'bg-yellow-600' : 'bg-white/10'}`}
                        >
                          S
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={track.volume}
                          onChange={(e) => setTracks(prev => prev.map(t => 
                            t.id === track.id ? { ...t, volume: parseFloat(e.target.value) } : t
                          ))}
                          className="flex-1"
                        />
                        <button
                          onClick={() => deleteTrack(track.id)}
                          className="p-1 hover:bg-red-600/20 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    {/* Waveform/Drop Zone */}
                    <div
                      onDrop={(e) => handleDrop(e, track.id)}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex-1 h-20 rounded border-2 border-dashed border-white/20 bg-black/40 flex items-center justify-center relative overflow-hidden"
                      style={{ borderColor: track.color + '40' }}
                    >
                      {track.buffer ? (
                        <div className="absolute inset-0 flex items-center px-2" style={{ backgroundColor: track.color + '20' }}>
                          <div className="text-xs text-gray-400">{track.sourceUrl?.split('/').pop()}</div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Drop audio here</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Add Track Button */}
          <div className="p-2 border-t border-white/10">
            <button
              onClick={addTrack}
              className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={16} />
              Add Track
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
