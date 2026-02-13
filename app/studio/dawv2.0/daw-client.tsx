'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  WaveformPlaylistProvider,
  PlaylistVisualization,
  usePlaylistControls,
  usePlaybackAnimation,
  usePlaylistData,
  usePlaylistState,
  useExportWav,
  usePlaybackShortcuts,
  useClipDragHandlers,
  useDragSensors,
  AudioPosition,
} from '@waveform-playlist/browser'
import {
  createTrack,
  createClipFromSeconds,
  samplesToSeconds,
  type ClipTrack,
  type AudioClip,
} from '@waveform-playlist/core'
import { DndContext } from '@dnd-kit/core'
import {
  Play, Pause, Square, SkipBack, SkipForward,
  ZoomIn, ZoomOut, Repeat, Volume2,
  FolderOpen, Save, Plus, Download, Trash2,
  Music, Wand2, Scissors, Upload, Keyboard,
  Search, X, Loader2, Sparkles, Music2,
  Image as ImageIcon, Film, Zap, PanelRight,
} from 'lucide-react'

// === MODALS ===
import GenerateModal from '@/app/components/studio/GenerationModal'
import StemSplitterModal from '@/app/components/studio/StemSplitterModal'
import KeyboardHelpModal from '@/app/components/studio/KeyboardHelpModal'
const EffectsGenerationModal = lazy(() => import('@/app/components/EffectsGenerationModal'))
const LoopersGenerationModal = lazy(() => import('@/app/components/LoopersGenerationModal'))
const MediaUploadModal = lazy(() => import('@/app/components/MediaUploadModal'))
import { useCredits } from '@/app/contexts/CreditsContext'

// ============================================================
// TYPES
// ============================================================
interface LibraryItem {
  id: string
  title: string
  audioUrl: string
  type: string
  artist?: string
}
interface Project {
  id: string
  title: string
  tracks: SerializedTrack[]
  tempo: number
  created_at: string
  updated_at: string
}
interface SerializedTrack {
  name: string
  volume?: number
  pan?: number
  muted?: boolean
  soloed?: boolean
  clips: SerializedClip[]
}
interface SerializedClip {
  sourceUrl: string
  startTime: number
  duration: number
  offset: number
  name: string
}
interface ToastData {
  message: string
  type: 'success' | 'error' | 'info'
}

// ============================================================
// CONSTANTS
// ============================================================
const DEFAULT_BPM = 120
const AUTOSAVE_MS = 5000
const MAX_CACHE = 50

const DARK_THEME: Record<string, string> = {
  backgroundColor: '#0a0a0a',
  surfaceColor: '#111111',
  borderColor: 'rgba(255,255,255,0.08)',
  textColor: 'rgba(255,255,255,0.87)',
  textColorMuted: 'rgba(255,255,255,0.4)',
  waveFillColor: '#4ade80',
  waveOutlineColor: '#22c55e',
  waveProgressColor: '#16a34a',
  selectedWaveFillColor: '#86efac',
  selectedWaveOutlineColor: '#4ade80',
  playheadColor: '#ffffff',
  selectionColor: 'rgba(74,222,128,0.2)',
  loopRegionColor: 'rgba(168,85,247,0.2)',
  loopMarkerColor: '#a855f7',
  timescaleBackgroundColor: '#0f0f0f',
  timeColor: 'rgba(255,255,255,0.5)',
  clipHeaderBackgroundColor: 'rgba(255,255,255,0.06)',
  clipHeaderBorderColor: 'rgba(255,255,255,0.08)',
  clipHeaderTextColor: 'rgba(255,255,255,0.7)',
  clipHeaderFontFamily: 'Inter, system-ui, sans-serif',
  selectedClipHeaderBackgroundColor: 'rgba(74,222,128,0.15)',
  selectedTrackControlsBackground: 'rgba(74,222,128,0.05)',
  fadeOverlayColor: 'rgba(0,0,0,0.4)',
  inputBackground: '#1a1a1a',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputText: 'rgba(255,255,255,0.87)',
  inputPlaceholder: 'rgba(255,255,255,0.3)',
  inputFocusBorder: '#4ade80',
  buttonBackground: 'rgba(255,255,255,0.06)',
  buttonText: 'rgba(255,255,255,0.87)',
  buttonBorder: 'rgba(255,255,255,0.08)',
  buttonHoverBackground: 'rgba(255,255,255,0.1)',
  sliderTrackColor: 'rgba(255,255,255,0.1)',
  sliderThumbColor: '#4ade80',
  annotationBoxBackground: 'rgba(255,255,255,0.05)',
  annotationBoxActiveBackground: 'rgba(74,222,128,0.1)',
  annotationBoxHoverBackground: 'rgba(255,255,255,0.08)',
  annotationBoxBorder: 'rgba(255,255,255,0.1)',
  annotationBoxActiveBorder: '#4ade80',
  annotationLabelColor: 'rgba(255,255,255,0.7)',
  annotationResizeHandleColor: 'rgba(255,255,255,0.3)',
  annotationResizeHandleActiveColor: '#4ade80',
  annotationTextItemHoverBackground: 'rgba(255,255,255,0.05)',
  borderRadius: '6px',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: '12px',
  fontSizeSmall: '10px',
}

// ============================================================
// AUDIO HELPERS  (shared across renders)
// ============================================================
let _ctx: AudioContext | null = null
function ctx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext()
  return _ctx
}

const bufferCache = new Map<string, Promise<AudioBuffer>>()

function proxyUrl(url: string) {
  return `/api/r2/audio-proxy?url=${encodeURIComponent(url)}`
}

async function decodeAudio(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url)
  if (cached) return cached
  if (bufferCache.size >= MAX_CACHE) {
    const first = bufferCache.keys().next().value
    if (first) bufferCache.delete(first)
  }
  const p = fetch(proxyUrl(url))
    .then((r) => {
      if (!r.ok) throw new Error(`Fetch ${r.status}`)
      return r.arrayBuffer()
    })
    .then((ab) => ctx().decodeAudioData(ab))
  bufferCache.set(url, p)
  return p
}

/** Maps clipId → source audio URL for save / load */
const clipSrcMap = new Map<string, string>()

function mkDefaultTracks(): ClipTrack[] {
  return [
    createTrack({ name: '1 Audio' }),
    createTrack({ name: '2 Audio' }),
    createTrack({ name: '3 Audio' }),
  ]
}

// ============================================================
// PAGE  (manages tracks + wraps Provider)
// ============================================================
export default function DAWPage() {
  const { isLoaded } = useUser()
  const [tracks, setTracks] = useState<ClipTrack[]>(mkDefaultTracks)
  const [providerKey, setProviderKey] = useState(0)

  const resetProvider = useCallback(() => setProviderKey((k) => k + 1), [])

  if (!isLoaded) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
      </div>
    )
  }

  return (
    <WaveformPlaylistProvider
      key={providerKey}
      tracks={tracks}
      timescale
      waveHeight={80}
      samplesPerPixel={1024}
      zoomLevels={[256, 512, 1024, 2048, 4096]}
      automaticScroll
      controls={{ show: true, width: 150 }}
      theme={DARK_THEME}
    >
      <DAWContent
        tracks={tracks}
        setTracks={setTracks}
        resetProvider={resetProvider}
      />
    </WaveformPlaylistProvider>
  )
}

// ============================================================
// DAW CONTENT  (inside Provider — uses all hooks)
// ============================================================
interface ContentProps {
  tracks: ClipTrack[]
  setTracks: React.Dispatch<React.SetStateAction<ClipTrack[]>>
  resetProvider: () => void
}

function DAWContent({ tracks, setTracks, resetProvider }: ContentProps) {
  const { user } = useUser()

  // ---- waveform-playlist hooks ----
  const ctl = usePlaylistControls()
  const { isPlaying } = usePlaybackAnimation()
  const plData = usePlaylistData()
  const plState = usePlaylistState()
  usePlaybackShortcuts()

  const sensors = useDragSensors()
  const clipDrag = useClipDragHandlers({
    onTracksChange: (t: ClipTrack[]) => {
      setTracks(t)
      dirty()
    },
  } as never)
  const exportWav = useExportWav()

  // ---- local state ----
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [showBrowser, setShowBrowser] = useState(true)
  const [search, setSearch] = useState('')

  const [projects, setProjects] = useState<Project[]>([])
  const [projId, setProjId] = useState<string | null>(null)
  const [projName, setProjName] = useState('Untitled Project')
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [showProjMenu, setShowProjMenu] = useState(false)
  const dirtyRef = useRef(0)
  const hydratingRef = useRef(false)

  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const { credits: contextCredits, refreshCredits, isLoading: contextCreditsLoading } = useCredits()

  const [showGen, setShowGen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProg, setGenProg] = useState(0)
  const [genStep, setGenStep] = useState('')
  const [prompt, setPrompt] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [genGenre, setGenGenre] = useState('')
  const [genBpm, setGenBpm] = useState('')
  const [genInst, setGenInst] = useState(false)
  const [genLyrics, setGenLyrics] = useState('')

  const [showStems, setShowStems] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [stemAudio, setStemAudio] = useState<string | null>(null)
  const [stemResults, setStemResults] = useState<Record<string, string> | null>(null)

  const [showEffects, setShowEffects] = useState(false)
  const [showLoops, setShowLoops] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [showFeatures, setShowFeatures] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)

  // ---- helpers ----
  const notify = useCallback((msg: string, type: ToastData['type'] = 'info') => {
    setToast({ message: msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  const dirty = useCallback(() => {
    if (!hydratingRef.current) dirtyRef.current += 1
  }, [])

  // ---- library ----
  const loadLibrary = useCallback(async () => {
    setLibLoading(true)
    try {
      const [libR, r2R] = await Promise.all([
        fetch('/api/library/music').then((r) => r.json()).catch(() => []),
        fetch('/api/r2/list-audio').then((r) => r.json()).catch(() => ({ files: [] })),
      ])
      const items = Array.isArray(libR) ? libR : libR.items || libR.data || []
      const r2 = Array.isArray(r2R.files) ? r2R.files : []
      const seen = new Set<string>()
      const out: LibraryItem[] = []
      for (const i of items) {
        const u = i.audio_url || i.audioUrl || i.url || ''
        if (!u || seen.has(u)) continue
        seen.add(u)
        out.push({
          id: i.id || u,
          title: i.title || i.name || 'Untitled',
          audioUrl: u,
          type: i.type || 'audio',
          artist: i.artist_name || i.artist || '',
        })
      }
      for (const i of r2) {
        const u = i.url || i.audioUrl || ''
        if (!u || seen.has(u)) continue
        seen.add(u)
        out.push({
          id: i.key || u,
          title: i.name || i.key?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled',
          audioUrl: u,
          type: 'audio',
        })
      }
      setLibrary(out)
    } catch (e) {
      console.error('Library load:', e)
    } finally {
      setLibLoading(false)
    }
  }, [])

  // ---- credits synced from shared context ----
  useEffect(() => {
    if (contextCredits !== null) {
      setCredits(contextCredits)
      setCreditsLoading(false)
    }
  }, [contextCredits])

  // ---- projects ----
  const fetchProjects = useCallback(async () => {
    try {
      const d = await fetch('/api/studio/projects').then((r) => r.json())
      setProjects(Array.isArray(d) ? d : d.projects || [])
    } catch { /* ignore */ }
  }, [])

  // Init
  useEffect(() => {
    if (user) {
      loadLibrary()
      fetchProjects()
    }
  }, [user, loadLibrary, fetchProjects])

  // ---- add audio to track ----
  const addAudio = useCallback(
    async (url: string, name: string, idx?: number) => {
      try {
        const buf = await decodeAudio(url)
        const clip = createClipFromSeconds({
          audioBuffer: buf,
          startTime: 0,
          duration: buf.duration,
          offset: 0,
          name,
        })
        clipSrcMap.set(clip.id, url)
        setTracks((prev) => {
          const next = prev.map((t) => ({ ...t, clips: [...t.clips] }))
          let ti = idx ?? -1
          if (ti < 0) ti = next.findIndex((t) => t.clips.length === 0)
          if (ti >= 0 && ti < next.length) {
            next[ti] = { ...next[ti], clips: [...next[ti].clips, clip] }
          } else {
            next.push(createTrack({ name, clips: [clip] }))
          }
          return next
        })
        dirty()
        notify(`✓ "${name}" added`, 'success')
      } catch (e) {
        console.error('addAudio:', e)
        notify('Failed to add audio', 'error')
      }
    },
    [setTracks, dirty, notify],
  )

  // ---- serialize / save ----
  const serialize = useCallback((): SerializedTrack[] => {
    const sr = 44100
    return tracks.map((t) => ({
      name: t.name || '',
      volume: t.volume,
      pan: t.pan,
      muted: t.muted,
      soloed: t.soloed,
      clips: t.clips.map((c) => ({
        sourceUrl: clipSrcMap.get(c.id) || '',
        startTime: samplesToSeconds(c.startSample, sr),
        duration: samplesToSeconds(c.durationSamples, sr),
        offset: samplesToSeconds(c.offsetSamples, sr),
        name: c.name || '',
      })),
    }))
  }, [tracks])

  const handleSave = useCallback(
    async (mode: 'manual' | 'auto' = 'manual') => {
      try {
        const body = { id: projId || undefined, title: projName, tracks: serialize(), tempo: bpm }
        const r = await fetch('/api/studio/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!r.ok) throw new Error()
        const d = await r.json()
        if (d.id && !projId) setProjId(d.id)
        dirtyRef.current = 0
        if (mode === 'manual') {
          notify('Project saved', 'success')
          fetchProjects()
        }
      } catch {
        if (mode === 'manual') notify('Save failed', 'error')
      }
    },
    [projId, projName, bpm, serialize, notify, fetchProjects],
  )

  // Autosave
  useEffect(() => {
    const iv = setInterval(() => {
      if (dirtyRef.current > 0 && projId) handleSave('auto')
    }, AUTOSAVE_MS)
    return () => clearInterval(iv)
  }, [handleSave, projId])

  // ---- load project ----
  const hydrateProject = useCallback(
    async (p: Project) => {
      hydratingRef.current = true
      try {
        clipSrcMap.clear()
        const loaded: ClipTrack[] = []
        for (const td of p.tracks || []) {
          const clips: AudioClip[] = []
          for (const cd of td.clips || []) {
            if (!cd.sourceUrl) continue
            try {
              const buf = await decodeAudio(cd.sourceUrl)
              const c = createClipFromSeconds({
                audioBuffer: buf,
                startTime: cd.startTime || 0,
                duration: cd.duration || buf.duration,
                offset: cd.offset || 0,
                name: cd.name || '',
              })
              clipSrcMap.set(c.id, cd.sourceUrl)
              clips.push(c)
            } catch (e) {
              console.error('Clip load:', cd.sourceUrl, e)
            }
          }
          loaded.push(
            createTrack({
              name: td.name || '',
              clips,
              volume: td.volume,
              pan: td.pan,
              muted: td.muted,
              soloed: td.soloed,
            }),
          )
        }
        while (loaded.length < 3) loaded.push(createTrack({ name: `${loaded.length + 1} Audio` }))
        setTracks(loaded)
        resetProvider()
        setBpm(p.tempo || DEFAULT_BPM)
        setProjName(p.title || 'Untitled Project')
        setProjId(p.id || null)
        dirtyRef.current = 0
        notify('Project loaded', 'success')
      } catch (e) {
        console.error('Hydrate:', e)
        notify('Load failed', 'error')
      } finally {
        hydratingRef.current = false
      }
    },
    [setTracks, resetProvider, notify],
  )

  const handleNew = useCallback(() => {
    clipSrcMap.clear()
    setProjId(null)
    setProjName('Untitled Project')
    setBpm(DEFAULT_BPM)
    setTracks(mkDefaultTracks())
    resetProvider()
    dirtyRef.current = 0
    notify('New project', 'success')
  }, [setTracks, resetProvider, notify])

  const handleDelete = useCallback(async () => {
    if (!projId || !confirm('Delete this project?')) return
    try {
      const r = await fetch(`/api/studio/projects?id=${projId}`, { method: 'DELETE' })
      if (r.ok) {
        handleNew()
        fetchProjects()
      }
    } catch {
      notify('Delete failed', 'error')
    }
  }, [projId, handleNew, fetchProjects, notify])

  // ---- export WAV ----
  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)
    notify('Exporting...', 'info')
    try {
      const result = await (exportWav as any).exportWav?.() ?? await (exportWav as any)()
      const blob = result?.blob ?? result
      if (blob instanceof Blob) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${projName.replace(/[^a-z0-9]/gi, '_')}_export.wav`
        a.click()
        URL.revokeObjectURL(a.href)
        notify('✓ Exported', 'success')
      } else {
        throw new Error('No audio blob')
      }
    } catch {
      notify('Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }, [exportWav, exporting, projName, notify])

  // ---- generation ----
  const handleGenerate = useCallback(async () => {
    if (generating || !prompt.trim()) return
    setGenerating(true)
    setGenProg(0)
    setGenStep('Preparing...')
    try {
      setGenStep('Metadata...')
      setGenProg(10)
      const [titleR, lyricsR, genreR] = await Promise.all([
        genTitle
          ? Promise.resolve({ title: genTitle })
          : fetch('/api/generate/atom-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt }),
            })
              .then((r) => r.json())
              .catch(() => ({ title: 'Untitled' })),
        genInst
          ? Promise.resolve({ lyrics: '' })
          : fetch('/api/generate/atom-lyrics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, genre: genGenre }),
            })
              .then((r) => r.json())
              .catch(() => ({ lyrics: '' })),
        genGenre
          ? Promise.resolve({ genre: genGenre })
          : fetch('/api/generate/atom-genre', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt }),
            })
              .then((r) => r.json())
              .catch(() => ({ genre: 'lofi' })),
      ])
      const title = titleR.title || 'Untitled'
      const lyrics = lyricsR.lyrics || genLyrics
      const genre = genreR.genre || genGenre || 'lofi'
      let detBpm = parseInt(genBpm) || bpm
      if (!genBpm) {
        const lp = prompt.toLowerCase()
        if (lp.includes('fast') || lp.includes('upbeat')) detBpm = 140
        else if (lp.includes('slow') || lp.includes('chill')) detBpm = 80
        else if (genre === 'techno' || genre === 'edm') detBpm = 128
        else if (genre === 'hiphop') detBpm = 90
        else if (genre === 'lofi') detBpm = 75
      }
      setGenStep('Generating...')
      setGenProg(30)
      const mR = await fetch('/api/generate/music-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          title,
          genre,
          bpm: detBpm,
          lyrics: genInst ? '' : lyrics,
          isInstrumental: genInst,
          tags: `${genre}, ${detBpm}bpm`,
        }),
      })
      if (!mR.ok) throw new Error((await mR.json().catch(() => ({}))).error || 'Failed')
      setGenProg(80)
      setGenStep('Processing...')
      const data = await mR.json()
      const audioUrl = data.audioUrl || data.url
      if (!audioUrl) throw new Error('No audio')
      await addAudio(audioUrl, title)
      await loadLibrary()
      if (data.creditsRemaining != null) setCredits(data.creditsRemaining)
      else refreshCredits()
      notify(`✓ "${title}" generated!`, 'success')
    } catch (e: any) {
      notify(e.message || 'Generation failed', 'error')
    } finally {
      setGenerating(false)
      setGenProg(0)
      setGenStep('')
    }
  }, [generating, prompt, genTitle, genGenre, genBpm, genInst, genLyrics, bpm, addAudio, loadLibrary, refreshCredits, notify])

  // ---- stem splitting ----
  const handleSplit = useCallback(
    async (url?: string) => {
      const src = url || stemAudio
      if (!src) { notify('No audio selected', 'error'); return }
      if (credits !== null && credits < 5) { notify('Need 5 credits', 'error'); return }
      setSplitting(true)
      setStemResults(null)
      notify('Splitting stems... 1-3 min', 'info')
      try {
        const r = await fetch('/api/audio/split-stems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioUrl: src }),
        })
        if (!r.ok) throw new Error((await r.json()).error || 'Failed')
        const d = await r.json()
        if (d.success && d.stems) {
          setStemResults(d.stems)
          if (d.creditsRemaining !== undefined) setCredits(d.creditsRemaining)
          else refreshCredits()
          for (const [type, sUrl] of Object.entries(d.stems) as [string, string][]) {
            await addAudio(sUrl, type.charAt(0).toUpperCase() + type.slice(1))
          }
          notify(`✓ Stems added`, 'success')
        }
      } catch (e: any) {
        notify(e.message || 'Stem split failed', 'error')
      } finally {
        setSplitting(false)
      }
    },
    [stemAudio, credits, addAudio, refreshCredits, notify],
  )

  const addResult = useCallback(
    async (url: string, title: string) => {
      await addAudio(url, title)
      await loadLibrary()
      refreshCredits()
    },
    [addAudio, loadLibrary, refreshCredits],
  )

  // ---- filtered library ----
  const filteredLib = useMemo(() => {
    if (!search.trim()) return library
    const q = search.toLowerCase()
    return library.filter(
      (i) => i.title.toLowerCase().includes(q) || (i.artist && i.artist.toLowerCase().includes(q)),
    )
  }, [library, search])

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); handleSave('manual')
      } else if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); setShowBrowser((p) => !p) }
      } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault(); setShowKeys(true)
      } else if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); handleNew()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [handleSave, handleNew])

  // ---- DnD drop from library ----
  const onTimelineDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const url = e.dataTransfer.getData('audioUrl')
      const title = e.dataTransfer.getData('title')
      if (url) await addAudio(url, title || 'Untitled')
    },
    [addAudio],
  )

  // ---- track management ----
  const addTrack = useCallback(() => {
    setTracks((p) => [...p, createTrack({ name: `${p.length + 1} Audio` })])
  }, [setTracks])

  const removeTrack = useCallback(
    (id: string) => {
      setTracks((p) => (p.length <= 1 ? p : p.filter((t) => t.id !== id)))
      dirty()
    },
    [setTracks, dirty],
  )

  // ========================================
  // RENDER
  // ========================================
  return (
    <>
      <div className="h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden select-none">
        {/* ====== HEADER ====== */}
        <div className="h-10 flex items-center px-3 gap-3 border-b border-white/[0.06] shrink-0 z-20">
          {/* Logo */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center">
              <Music2 className="w-3 h-3 text-black" />
            </div>
            <span className="text-[11px] font-semibold text-white/80 tracking-wide">STUDIO</span>
          </div>
          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Project name */}
          <input
            value={projName}
            onChange={(e) => setProjName(e.target.value)}
            onBlur={dirty}
            className="bg-transparent text-[11px] text-white/70 font-medium border-none outline-none w-40 hover:text-white focus:text-white"
          />

          {/* Project actions */}
          <div className="flex items-center gap-1">
            <button onClick={() => handleSave('manual')} className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.04]" title="Save (Ctrl+S)">
              <Save className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleNew} className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.04]" title="New">
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Project dropdown */}
            <div className="relative">
              <button onClick={() => setShowProjMenu(!showProjMenu)} className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.04]" title="Projects">
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              {showProjMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowProjMenu(false)} />
                  <div className="absolute top-8 left-0 bg-[#1a1a1a] border border-white/[0.08] rounded-md shadow-xl z-40 w-56 max-h-64 overflow-y-auto">
                    {projects.length === 0 ? (
                      <div className="px-3 py-2 text-[10px] text-white/30">No saved projects</div>
                    ) : (
                      projects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { hydrateProject(p); setShowProjMenu(false) }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[10px] hover:bg-white/[0.04] ${
                            p.id === projId ? 'text-emerald-400' : 'text-white/60'
                          }`}
                        >
                          <span className="truncate">{p.title || 'Untitled'}</span>
                          <span className="text-white/20 ml-2 shrink-0">
                            {new Date(p.updated_at || p.created_at).toLocaleDateString()}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {projId && (
              <button onClick={handleDelete} className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/[0.04]" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="w-px h-5 bg-white/[0.06]" />

          {/* BPM */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-white/30 uppercase">BPM</span>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Math.max(20, Math.min(300, parseInt(e.target.value) || DEFAULT_BPM)))}
              className="w-10 bg-white/[0.04] text-[11px] text-white/80 text-center rounded border border-white/[0.06] outline-none px-1 py-0.5"
            />
          </div>

          {/* Export */}
          <button onClick={handleExport} disabled={exporting} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] disabled:opacity-30">
            <Download className="w-3 h-3" />
            {exporting ? 'Exporting...' : 'Export'}
          </button>

          <div className="flex-1" />

          {/* Credits */}
          <div className="flex items-center gap-1.5 text-[10px]">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-white/50">{creditsLoading ? '...' : `${credits ?? 0} credits`}</span>
          </div>

          {/* Panel toggles */}
          <button
            onClick={() => setShowBrowser(!showBrowser)}
            className={`p-1 rounded ${showBrowser ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/40 hover:text-white/60'}`}
            title="Library (B)"
          >
            <Music className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className={`p-1 rounded ${showFeatures ? 'text-emerald-400 bg-emerald-400/10' : 'text-white/40 hover:text-white/60'}`}
            title="Features"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowKeys(true)} className="p-1 rounded text-white/40 hover:text-white/60" title="Shortcuts (?)">
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ====== TRANSPORT ====== */}
        <div className="h-9 flex items-center px-3 gap-2 border-b border-white/[0.06] bg-[#0d0d0d] shrink-0">
          <div className="flex items-center gap-0.5">
            <button onClick={() => ctl.seekTo(0)} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/[0.06]" title="Rewind">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => (isPlaying ? ctl.pause() : ctl.play())}
              className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={() => ctl.stop()} className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/[0.06]" title="Stop">
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Position */}
          <div className="text-[12px] font-mono text-white/70 tabular-nums min-w-[80px]">
            <AudioPosition />
          </div>
          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Zoom */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => ctl.zoomIn()} className="p-1 rounded text-white/40 hover:text-white/60 hover:bg-white/[0.04]" title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => ctl.zoomOut()} className="p-1 rounded text-white/40 hover:text-white/60 hover:bg-white/[0.04]" title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-px h-5 bg-white/[0.06]" />

          {/* Loop */}
          <button
            onClick={() => ctl.setLoopEnabled(!plState.isLoopEnabled)}
            className={`p-1 rounded ${plState.isLoopEnabled ? 'text-purple-400 bg-purple-400/10' : 'text-white/40 hover:text-white/60'}`}
            title="Loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Master Volume */}
          <div className="flex items-center gap-1 ml-auto">
            <Volume2 className="w-3 h-3 text-white/30" />
            <input
              type="range"
              min={0} max={1} step={0.01} defaultValue={1}
              onChange={(e) => ctl.setMasterVolume(parseFloat(e.target.value))}
              className="w-16 h-1 accent-emerald-400"
            />
          </div>

          <button onClick={addTrack} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/40 hover:text-white/60 hover:bg-white/[0.04]" title="Add Track">
            <Plus className="w-3 h-3" /> Track
          </button>
        </div>

        {/* ====== MAIN ====== */}
        <div className="flex-1 flex overflow-hidden">
          {/* ---- Library Sidebar ---- */}
          {showBrowser && (
            <div className="w-56 border-r border-white/[0.06] bg-[#0c0c0c] flex flex-col shrink-0">
              <div className="p-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 bg-white/[0.04] rounded px-2 py-1">
                  <Search className="w-3 h-3 text-white/30" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search library..."
                    className="bg-transparent text-[10px] text-white/70 outline-none flex-1"
                  />
                  {search && (
                    <button onClick={() => setSearch('')}>
                      <X className="w-3 h-3 text-white/30" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {libLoading ? (
                  <div className="p-4 flex justify-center">
                    <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                  </div>
                ) : filteredLib.length === 0 ? (
                  <div className="p-3 text-center">
                    <p className="text-[10px] text-white/30">{library.length === 0 ? 'No audio in library' : 'No results'}</p>
                    {library.length === 0 && (
                      <button onClick={loadLibrary} className="mt-2 text-[9px] text-emerald-400/60 hover:text-emerald-400">Reload</button>
                    )}
                  </div>
                ) : (
                  filteredLib.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('audioUrl', item.audioUrl)
                        e.dataTransfer.setData('title', item.title)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      className="px-2 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.03] cursor-grab active:cursor-grabbing group flex items-center gap-2"
                    >
                      <div className="w-7 h-7 rounded bg-white/[0.04] flex items-center justify-center shrink-0">
                        <Music className="w-3 h-3 text-white/20" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-white/70 truncate">{item.title}</div>
                        {item.artist && <div className="text-[9px] text-white/30 truncate">{item.artist}</div>}
                      </div>
                      <button
                        onClick={() => addAudio(item.audioUrl, item.title)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-emerald-400/60 hover:text-emerald-400"
                        title="Add to track"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-white/[0.06]">
                <button
                  onClick={() => setShowUpload(true)}
                  className="w-full flex items-center justify-center gap-1 text-[10px] text-white/40 hover:text-white/60 py-1 rounded hover:bg-white/[0.04]"
                >
                  <Upload className="w-3 h-3" /> Upload Audio
                </button>
              </div>
            </div>
          )}

          {/* ---- Timeline ---- */}
          <div
            className="flex-1 overflow-auto relative"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
            onDrop={onTimelineDrop}
          >
            <DndContext
              sensors={sensors}
              onDragStart={(clipDrag as any).onDragStart}
              onDragMove={(clipDrag as any).onDragMove}
              onDragEnd={(clipDrag as any).onDragEnd}
            >
              <PlaylistVisualization />
            </DndContext>
          </div>

          {/* ---- Features Panel ---- */}
          {showFeatures && (
            <div className="w-64 border-l border-white/[0.06] bg-[#0c0c0c] flex flex-col shrink-0 overflow-y-auto">
              {/* Generation */}
              <div className="p-3 border-b border-white/[0.06]">
                <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">AI Generate</div>
                <textarea
                  placeholder="Describe the music..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded text-[10px] text-white/70 p-2 resize-none h-16 outline-none focus:border-emerald-400/30 placeholder:text-white/20"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[9px] ${prompt.length > 270 ? 'text-amber-400' : 'text-white/20'}`}>
                    {prompt.length}/300
                  </span>
                  <button
                    onClick={() => setShowGen(true)}
                    disabled={generating}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30"
                  >
                    <Sparkles className="w-3 h-3" />
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </div>

              {/* Tools */}
              <div className="p-3 space-y-1">
                <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Tools</div>
                {([
                  { icon: Music2, label: 'Music', cost: 2, fn: () => setShowGen(true) },
                  { icon: Wand2, label: 'Effects', cost: 2, fn: () => setShowEffects(true) },
                  { icon: Repeat, label: 'Loops', cost: 2, fn: () => setShowLoops(true) },
                  { icon: ImageIcon, label: 'Cover Art', cost: 1, fn: () => {} },
                  { icon: Film, label: 'Video→Audio', cost: 2, fn: () => {} },
                  { icon: Scissors, label: 'Split Stems', cost: 5, fn: () => setShowStems(true) },
                  { icon: Upload, label: 'Upload', cost: 0, fn: () => setShowUpload(true) },
                ] as const).map((t) => (
                  <button
                    key={t.label}
                    onClick={t.fn}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] text-white/60 hover:text-white/80 hover:bg-white/[0.04] group"
                  >
                    <t.icon className="w-3.5 h-3.5 text-white/30 group-hover:text-emerald-400/60" />
                    <span className="flex-1 text-left">{t.label}</span>
                    {t.cost > 0 && <span className="text-[9px] text-white/20">-{t.cost}</span>}
                  </button>
                ))}
              </div>

              {/* Quick tags */}
              <div className="p-3 border-t border-white/[0.06]">
                <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Quick Tags</div>
                <div className="flex flex-wrap gap-1">
                  {['lofi chill', 'dark trap', 'smooth jazz', 'ambient', 'boom bap', 'R&B soul', 'techno', 'acoustic'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setPrompt((p) => (p ? `${p}, ${tag}` : tag))}
                      className="px-1.5 py-0.5 rounded text-[9px] text-white/30 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/50"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====== MODALS ====== */}
      <Suspense fallback={null}>
        {showGen && (
          <GenerateModal
            isOpen={showGen}
            onClose={() => setShowGen(false)}
            onGenerate={handleGenerate}
            generating={generating}
            progress={genStep}
            step={Math.ceil(genProg / 20)}
            prompt={prompt}
            setPrompt={setPrompt}
            title={genTitle}
            setTitle={setGenTitle}
            genre={genGenre}
            setGenre={setGenGenre}
            bpm={genBpm}
            setBpm={setGenBpm}
            isInstrumental={genInst}
            setIsInstrumental={setGenInst}
            lyrics={genLyrics}
            setLyrics={setGenLyrics}
          />
        )}
        {showStems && (
          <StemSplitterModal
            isOpen={showStems}
            onClose={() => { setShowStems(false); setStemResults(null); setStemAudio(null) }}
            isSplitting={splitting}
            selectedAudio={stemAudio}
            stemResults={stemResults}
            onSplit={handleSplit}
          />
        )}
        {showKeys && <KeyboardHelpModal isOpen={showKeys} onClose={() => setShowKeys(false)} />}
        {showEffects && (
          <EffectsGenerationModal
            isOpen={showEffects}
            onClose={() => setShowEffects(false)}
            userCredits={credits ?? undefined}
            onSuccess={async (url: string, prompt: string) => { setShowEffects(false); await addResult(url, `Effect: ${prompt.slice(0, 30)}`) }}
          />
        )}
        {showLoops && (
          <LoopersGenerationModal
            isOpen={showLoops}
            onClose={() => setShowLoops(false)}
            userCredits={credits ?? undefined}
            onSuccess={async (variations: any[], prompt: string) => {
              setShowLoops(false)
              if (variations.length > 0) await addResult(variations[0].url, `Loop: ${prompt.slice(0, 30)}`)
            }}
          />
        )}
        {showUpload && (
          <MediaUploadModal
            isOpen={showUpload}
            onClose={() => setShowUpload(false)}
            onSuccess={async (r: any) => {
              setShowUpload(false)
              const url = r?.url || r?.audioUrl || ''
              const name = r?.title || r?.name || 'Uploaded'
              if (url) await addResult(url, name)
            }}
          />
        )}
      </Suspense>

      {/* ====== TOAST ====== */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-3 py-2 rounded-md text-[11px] font-medium z-[100] border backdrop-blur-sm transition-opacity ${
            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300'
            : 'bg-white/[0.06] border-white/[0.08] text-white/60'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  )
}
