'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Music, Sparkles, Repeat, Image as ImageIcon, Scissors, Volume2,
  Zap, Lightbulb, X, ChevronLeft, Send, Film, Layers, Edit3,
  Play, Pause, Download, Trash2, CheckCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, Upload, FileAudio, Loader2
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────
interface GenerationJob {
  id: string
  type: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  prompt?: string
  title?: string
  result?: Record<string, unknown>
  error?: string
  createdAt: number
}

interface CreditInfo {
  credits: number
  totalGenerated: number
  costs: Record<string, number>
}

// ─── Detect JUCE host ──────────────────────────────────────────
const isJuceHost =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('host') === 'juce'

// ─── Plugin Bridge ─────────────────────────────────────────────
function sendToPlugin(action: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({ source: '444radio-plugin', action, ...data })
  try {
    if ((window as any).__juce__?.postMessage) {
      ;(window as any).__juce__.postMessage(payload); return
    }
    if (isJuceHost) {
      window.location.href = 'juce-bridge://' + encodeURIComponent(payload); return
    }
    window.parent?.postMessage(JSON.parse(payload), '*')
  } catch { /* not in plugin context */ }
}

// ─── Constants ─────────────────────────────────────────────────
const QUICK_TAGS = [
  'upbeat','chill','energetic','melancholic','ambient','electronic','acoustic','jazz','rock','hip-hop',
  'heavy bass','soft piano','guitar solo','synthwave','lo-fi beats','orchestral','dreamy','aggressive',
  'trap','drill','phonk','vaporwave','future bass','drum & bass','dubstep','house','techno','trance',
  'indie','folk','blues','soul','funk','disco','reggae','latin','afrobeat','k-pop','anime',
  'cinematic','epic','dark','bright','nostalgic','romantic','sad','happy','mysterious','powerful',
  'soft vocals','no vocals','female vocals','male vocals','synth lead','strings','brass','flute','violin',
]
const IDEA_GENRES = [
  'electronic','hip-hop','rock','jazz','ambient','trap','drill','phonk','house','techno',
  'lo-fi beats','synthwave','indie','folk','blues','soul','funk','reggae','latin','afrobeat',
  'orchestral','cinematic','acoustic','vaporwave','k-pop',
]
const GENRES = ['lofi','hiphop','jazz','chill','rnb','techno','pop','rock','ambient','classical','trap','drill','phonk']
const LANGUAGES = ['English','Chinese','Japanese','Korean','Spanish','French','Hindi','German','Portuguese','Arabic','Italian']
const STEM_TYPES = ['vocals','drums','bass','piano','guitar','other'] as const

// ─── Feature definitions (costs match backend CREDIT_COSTS) ────
const ALL_FEATURES = [
  { id: 'music', icon: Music, label: 'Music', desc: 'Generate AI music', color: 'cyan', cost: 2, needsFile: false, needsPrompt: true },
  { id: 'effects', icon: Sparkles, label: 'Effects', desc: 'Sound effects', color: 'purple', cost: 2, needsFile: false, needsPrompt: true },
  { id: 'loops', icon: Repeat, label: 'Loops', desc: 'Fixed BPM loops', color: 'cyan', cost: 6, needsFile: false, needsPrompt: true },
  { id: 'image', icon: ImageIcon, label: 'Cover Art', desc: 'AI album artwork', color: 'cyan', cost: 1, needsFile: false, needsPrompt: true },
  { id: 'stems', icon: Scissors, label: 'Split Stems', desc: 'Upload audio → get all stems', color: 'purple', cost: 5, needsFile: true, needsPrompt: false },
  { id: 'audio-boost', icon: Volume2, label: 'Audio Boost', desc: 'Mix & master your track', color: 'orange', cost: 1, needsFile: true, needsPrompt: false },
  { id: 'extract', icon: Layers, label: 'Extract Stem', desc: 'Extract individual stem from audio', color: 'cyan', cost: 1, needsFile: true, needsPrompt: false },
]

// Color helpers
const colorMap: Record<string, { border: string, bg: string, text: string, activeBorder: string, activeBg: string, activeText: string, gradient: string }> = {
  cyan: { border: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-400', activeBorder: 'border-cyan-400', activeBg: 'bg-gradient-to-r from-cyan-600/30 to-cyan-400/20', activeText: 'text-cyan-300', gradient: 'from-cyan-600 to-cyan-400' },
  purple: { border: 'border-purple-500/20', bg: 'bg-purple-500/10', text: 'text-purple-400', activeBorder: 'border-purple-400', activeBg: 'bg-gradient-to-r from-purple-600/30 to-pink-500/20', activeText: 'text-purple-300', gradient: 'from-purple-600 to-purple-400' },
  orange: { border: 'border-orange-500/20', bg: 'bg-orange-500/10', text: 'text-orange-400', activeBorder: 'border-orange-400', activeBg: 'bg-gradient-to-r from-orange-600/30 to-red-500/20', activeText: 'text-orange-300', gradient: 'from-orange-600 to-orange-400' },
  green: { border: 'border-green-500/20', bg: 'bg-green-500/10', text: 'text-green-400', activeBorder: 'border-green-400', activeBg: 'bg-gradient-to-r from-green-600/30 to-green-400/20', activeText: 'text-green-300', gradient: 'from-green-600 to-green-400' },
  pink: { border: 'border-pink-500/20', bg: 'bg-pink-500/10', text: 'text-pink-400', activeBorder: 'border-pink-400', activeBg: 'bg-gradient-to-r from-pink-600/30 to-rose-500/20', activeText: 'text-pink-300', gradient: 'from-pink-600 to-pink-400' },
  indigo: { border: 'border-indigo-500/20', bg: 'bg-indigo-500/10', text: 'text-indigo-400', activeBorder: 'border-indigo-400', activeBg: 'bg-gradient-to-r from-indigo-600/30 to-blue-400/20', activeText: 'text-indigo-300', gradient: 'from-indigo-600 to-indigo-400' },
}

function getTypeColor(type: string) {
  switch (type) {
    case 'music': return colorMap.cyan
    case 'effects': return colorMap.pink
    case 'loops': return colorMap.indigo
    case 'image': return colorMap.cyan
    case 'stems': return colorMap.purple
    case 'audio-boost': return colorMap.orange
    case 'extract': return colorMap.cyan
    default: return colorMap.cyan
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'music': return Music
    case 'effects': return Sparkles
    case 'loops': return Repeat
    case 'image': return ImageIcon
    case 'stems': return Scissors
    case 'audio-boost': return Volume2
    case 'extract': return Layers
    default: return Music
  }
}

// ═══════════════════════════════════════════════════════════════
export default function PluginPage() {
  // ─── Core state ───────────────────────────────────────────
  const [token, setToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credits, setCredits] = useState<CreditInfo | null>(null)
  const [activeTab, setActiveTab] = useState<string>('music')
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isInstrumental, setIsInstrumental] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideasView, setIdeasView] = useState<'tags' | 'type' | 'genre'>('tags')
  const [promptType, setPromptType] = useState<'song' | 'beat'>('song')
  const [view, setView] = useState<'create' | 'library'>('create')
  const [libraryFilter, setLibraryFilter] = useState<string>('all')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [showLyrics, setShowLyrics] = useState(false)
  const [autoFillStatus, setAutoFillStatus] = useState('')

  // Audio player
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)

  // Form fields — prompt-based
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState(120)
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('long')
  const [language, setLanguage] = useState('English')
  const [generateCoverArt, setGenerateCoverArt] = useState(false)
  // Effects params
  const [effectDuration, setEffectDuration] = useState(5)
  // Boost params
  const [bassBoost, setBassBoost] = useState(0)
  const [trebleBoost, setTrebleBoost] = useState(0)
  const [volumeBoost, setVolumeBoost] = useState(2)
  // Loops params
  const [loopVariations, setLoopVariations] = useState(2)
  const [loopFormat, setLoopFormat] = useState<'wav' | 'mp3'>('wav')
  // Extract stem picker
  const [extractStem, setExtractStem] = useState<string>('vocals')

  // ─── File upload ──────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ─── Audio Player ───────────────────────────────────────────
  const togglePlay = (url: string) => {
    if (playingUrl === url) {
      audioRef.current?.pause()
      setPlayingUrl(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(url)
      audioRef.current = audio
      audio.play()
      audio.onended = () => setPlayingUrl(null)
      setPlayingUrl(url)
    }
  }

  // ─── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken && urlToken.startsWith('444r_')) {
      setToken(urlToken); verifyToken(urlToken); return
    }
    const saved = localStorage.getItem('444radio_plugin_token')
    if (saved) { setToken(saved); verifyToken(saved) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verifyToken = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.ok) {
        const data = await res.json()
        setCredits(data); setIsAuthenticated(true)
        localStorage.setItem('444radio_plugin_token', t)
        sendToPlugin('authenticated', { credits: data.credits, token: t })
      } else {
        setIsAuthenticated(false); setError('Invalid token. Generate one from Settings → Plugin.')
      }
    } catch { setError('Connection failed. Check your internet.') }
  }, [baseUrl])

  const refreshCredits = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setCredits(await res.json())
    } catch {}
  }, [token, baseUrl])

  // ─── File Upload ────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return

    // Validate size
    if (file.size > 100 * 1024 * 1024) {
      setError('File must be under 100MB')
      return
    }

    setIsUploading(true)
    setError('')
    setUploadProgress('Getting upload URL...')

    try {
      // Step 1: Get presigned URL
      const presignRes = await fetch(`${baseUrl}/api/plugin/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({ error: 'Upload setup failed' }))
        throw new Error(err.error || 'Failed to get upload URL')
      }
      const { presignedUrl, publicUrl } = await presignRes.json()

      // Step 2: Upload directly to R2
      setUploadProgress(`Uploading ${(file.size / (1024 * 1024)).toFixed(1)} MB...`)
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!uploadRes.ok) throw new Error('Upload to storage failed')

      // Step 3: Wait for R2 propagation
      setUploadProgress('Processing...')
      await new Promise(r => setTimeout(r, 3000))

      setUploadedFileUrl(publicUrl)
      setUploadedFileName(file.name)
      setUploadProgress('')

      // Auto-set title from filename if empty
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
        setTitle(nameWithoutExt)
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setUploadProgress('')
    } finally {
      setIsUploading(false)
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [token, baseUrl, title])

  const clearUpload = () => {
    setUploadedFileUrl('')
    setUploadedFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── LLM Auto-fill (title/lyrics/genre from prompt) ────────
  const autoFillFromPrompt = useCallback(async (currentPrompt: string) => {
    if (!token || !currentPrompt || currentPrompt.length < 10) return

    try {
      // Auto-generate title if empty
      if (!title) {
        setAutoFillStatus('Generating title...')
        try {
          const res = await fetch(`${baseUrl}/api/generate/atom-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: currentPrompt }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data.title) setTitle(data.title)
          }
        } catch { /* non-critical */ }
      }

      // Auto-generate lyrics if vocal mode and empty
      if (!isInstrumental && !lyrics) {
        setAutoFillStatus('Generating lyrics...')
        try {
          const res = await fetch(`${baseUrl}/api/generate/atom-lyrics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: currentPrompt }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data.lyrics) setLyrics(data.lyrics)
          }
        } catch { /* non-critical */ }
      }

      // Auto-detect genre if empty
      if (!genre) {
        setAutoFillStatus('Detecting genre...')
        try {
          const res = await fetch(`${baseUrl}/api/generate/atom-genre`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: currentPrompt }),
          })
          if (res.ok) {
            const data = await res.json()
            if (data.genre) setGenre(data.genre)
          }
        } catch { /* non-critical */ }
      }

      setAutoFillStatus('')
    } catch {
      setAutoFillStatus('')
    }
  }, [token, baseUrl, title, lyrics, genre, isInstrumental])

  // ─── Generation ─────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!token || isGenerating) return
    setIsGenerating(true); setError('')

    const feature = ALL_FEATURES.find(f => f.id === activeTab)
    if (!feature) { setIsGenerating(false); return }

    // For file-based features, check that a file is uploaded
    if (feature.needsFile && !uploadedFileUrl) {
      setError('Please upload a file first')
      setIsGenerating(false)
      return
    }

    const payload: Record<string, unknown> = { type: activeTab }

    switch (activeTab) {
      case 'music': {
        // Auto-fill from LLM if fields are empty
        let finalTitle = title
        let finalLyrics = lyrics
        let finalGenre = genre

        if (!finalTitle || finalTitle.length < 3) {
          setAutoFillStatus('Auto-generating title...')
          try {
            const res = await fetch(`${baseUrl}/api/generate/atom-title`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt }),
            })
            if (res.ok) { const d = await res.json(); if (d.title) finalTitle = d.title }
          } catch {}
        }
        if (!finalTitle || finalTitle.length < 3) { setError('Title required (3+ chars)'); setIsGenerating(false); setAutoFillStatus(''); return }

        if (!prompt || prompt.length < 10) { setError('Prompt required (10+ chars)'); setIsGenerating(false); setAutoFillStatus(''); return }

        if (!isInstrumental && !finalLyrics) {
          setAutoFillStatus('Auto-generating lyrics...')
          try {
            const res = await fetch(`${baseUrl}/api/generate/atom-lyrics`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt }),
            })
            if (res.ok) { const d = await res.json(); if (d.lyrics) finalLyrics = d.lyrics }
          } catch {}
        }
        if (isInstrumental) finalLyrics = '[Instrumental]'

        if (!finalGenre) {
          setAutoFillStatus('Detecting genre...')
          try {
            const res = await fetch(`${baseUrl}/api/generate/atom-genre`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt }),
            })
            if (res.ok) { const d = await res.json(); if (d.genre) finalGenre = d.genre }
          } catch {}
        }

        setAutoFillStatus('')
        // Update state with auto-filled values
        if (finalTitle !== title) setTitle(finalTitle)
        if (finalLyrics !== lyrics) setLyrics(finalLyrics)
        if (finalGenre !== genre) setGenre(finalGenre)

        payload.title = finalTitle
        payload.prompt = prompt.slice(0, 300)
        payload.lyrics = finalLyrics || undefined
        payload.duration = duration
        payload.language = language
        payload.genre = finalGenre || undefined
        payload.bpm = bpm || undefined
        payload.generateCoverArt = generateCoverArt
        payload.bitrate = 256000
        payload.sample_rate = 44100
        payload.audio_format = 'mp3'
        break
      }
      case 'effects':
        if (!prompt) { setError('Describe the sound effect'); setIsGenerating(false); return }
        payload.prompt = prompt; payload.duration = effectDuration
        break
      case 'loops':
        if (!prompt) { setError('Describe the loop'); setIsGenerating(false); return }
        payload.prompt = prompt; payload.bpm = bpm; payload.max_duration = 8
        payload.variations = loopVariations; payload.output_format = loopFormat
        break
      case 'image':
        if (!prompt) { setError('Describe the image'); setIsGenerating(false); return }
        payload.prompt = prompt
        break
      case 'stems':
        payload.audioUrl = uploadedFileUrl
        payload.trackTitle = title || uploadedFileName || 'Split Stems'
        break
      case 'audio-boost':
        payload.audioUrl = uploadedFileUrl
        payload.trackTitle = title || uploadedFileName || 'Boosted'
        payload.bass_boost = bassBoost; payload.treble_boost = trebleBoost; payload.volume_boost = volumeBoost
        break
      case 'extract':
        payload.audioUrl = uploadedFileUrl
        payload.stem = extractStem
        payload.trackTitle = title || uploadedFileName || `${extractStem} Extract`
        break
    }

    const jobEntry: GenerationJob = {
      id: 'pending', type: activeTab, status: 'queued',
      prompt: prompt || uploadedFileName || activeTab,
      title: title || prompt?.substring(0, 40) || uploadedFileName || activeTab,
      createdAt: Date.now(),
    }
    setJobs(prev => [jobEntry, ...prev])

    try {
      const res = await fetch(`${baseUrl}/api/plugin/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'started' && msg.jobId) {
              jobEntry.id = msg.jobId; jobEntry.status = 'processing'
              setJobs(prev => [...prev])
            }
            if (msg.type === 'result') {
              if (msg.success) {
                jobEntry.status = 'completed'; jobEntry.result = msg
                if (msg.title) jobEntry.title = msg.title
                if (msg.audioUrl) sendToPlugin('import_audio', { url: msg.audioUrl, title: msg.title || title || prompt, type: activeTab, jobId: jobEntry.id })
                if (msg.stems) sendToPlugin('import_stems', { stems: msg.stems, title: title || 'Stems', jobId: jobEntry.id })
                if (msg.loops) sendToPlugin('import_loops', { loops: msg.loops, title: prompt, bpm, jobId: jobEntry.id })
                if (msg.imageUrl) sendToPlugin('cover_art', { url: msg.imageUrl })
                if (msg.creditsRemaining !== undefined) setCredits(prev => prev ? { ...prev, credits: msg.creditsRemaining } : prev)
              } else {
                jobEntry.status = 'failed'; jobEntry.error = msg.error
                setError(msg.error || 'Generation failed')
              }
              setJobs(prev => [...prev])
            }
          } catch { /* bad JSON line */ }
        }
      }
    } catch (err: any) {
      jobEntry.status = 'failed'; jobEntry.error = err.message
      setError(err.message); setJobs(prev => [...prev])
    } finally {
      setIsGenerating(false); setAutoFillStatus(''); refreshCredits()
    }
  }, [token, isGenerating, activeTab, title, prompt, lyrics, genre, bpm, duration, language, generateCoverArt, uploadedFileUrl, uploadedFileName, extractStem, isInstrumental, effectDuration, bassBoost, trebleBoost, volumeBoost, loopVariations, loopFormat, baseUrl, refreshCredits])

  // ─── Helpers ────────────────────────────────────────────────
  const addTag = (tag: string) => setPrompt(prev => (prev ? `${prev}, ${tag}` : tag))
  const generateIdea = (g: string) => {
    const moods = ['dark','uplifting','chill','energetic','melodic','dreamy','nostalgic','powerful']
    const mood = moods[Math.floor(Math.random() * moods.length)]
    const type = promptType === 'song' ? 'song with catchy vocals and lyrics' : 'instrumental beat'
    setPrompt(`${mood} ${g} ${type}, modern production, professional mix`)
    if (promptType === 'beat') setIsInstrumental(true)
    setShowIdeas(false); setIdeasView('tags')
  }

  // Clear file when switching tabs
  useEffect(() => {
    clearUpload()
    setError('')
    setAutoFillStatus('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const completedJobs = jobs.filter(j => j.status === 'completed')
  const filteredLibrary = libraryFilter === 'all' ? completedJobs : completedJobs.filter(j => j.type === libraryFilter)
  const activeFeature = ALL_FEATURES.find(f => f.id === activeTab)
  const currentCost = activeFeature?.cost ?? 0

  // Library type counts
  const typeCounts: Record<string, number> = {}
  completedJobs.forEach(j => { typeCounts[j.type] = (typeCounts[j.type] || 0) + 1 })

  // ═══════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center mb-4">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-cyan-400">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">444 RADIO</h1>
            <span className="inline-block text-[10px] bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg font-bold tracking-wider">PLUGIN</span>
            <p className="text-sm text-gray-500 pt-2">Connect your account to start creating</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">Plugin Token</label>
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="444r_..."
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                onKeyDown={e => { if (e.key === 'Enter') verifyToken(token) }} />
            </div>
            <button onClick={() => verifyToken(token)} disabled={!token}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-sm font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              Connect
            </button>
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 text-center">{error}</div>}
            <p className="text-xs text-gray-600 text-center">
              Generate a token at{' '}
              <a href="https://444radio.co.in/settings" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">Settings → Plugin</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN UI  
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileSelect} />

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-cyan-400">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="text-white font-bold text-sm">444 Radio</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <Zap size={12} className="text-cyan-400" />
            <span className="text-cyan-300 font-bold text-xs">{credits?.credits ?? 0}</span>
          </div>
          <button onClick={() => { setIsAuthenticated(false); localStorage.removeItem('444radio_plugin_token') }}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">Logout</button>
        </div>
      </div>

      {/* ─── View Toggle ──────────────────────────────────────── */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        <button onClick={() => setView('create')}
          className={`flex-1 py-2.5 text-xs font-bold text-center transition-all ${view === 'create' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
          Create
        </button>
        <button onClick={() => setView('library')}
          className={`flex-1 py-2.5 text-xs font-bold text-center transition-all relative ${view === 'library' ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5' : 'text-gray-500 hover:text-gray-300'}`}>
          Library
          {completedJobs.length > 0 && (
            <span className="absolute top-1.5 right-[30%] w-4 h-4 bg-purple-500 rounded-full text-[9px] font-bold flex items-center justify-center">{completedJobs.length}</span>
          )}
        </button>
      </div>

      {/* ═══ CREATE VIEW ═══════════════════════════════════════ */}
      {view === 'create' && (
        <div className="flex-1 overflow-y-auto">
          {/* Mode Toggle (Vocal/Inst) — only for music */}
          {activeTab === 'music' && (
            <div className="px-4 py-2.5 border-b border-white/10">
              <div className="flex gap-2">
                <button onClick={() => setIsInstrumental(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${!isInstrumental ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>Vocal
                </button>
                <button onClick={() => setIsInstrumental(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isInstrumental ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" x2="8" y1="4" y2="14"/><line x1="16" x2="16" y1="4" y2="14"/><line x1="12" x2="12" y1="4" y2="14"/>
                  </svg>Inst
                </button>
              </div>
            </div>
          )}

          {/* ─── Prompt Input (prompt-based features) ────────── */}
          {activeFeature?.needsPrompt && (
            <div className="px-4 py-3 border-b border-white/10">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder={activeTab === 'music' ? 'Describe your music style & mood...' : activeTab === 'effects' ? 'Describe the sound effect...' : activeTab === 'loops' ? 'Describe the loop...' : 'Describe the cover art...'}
                maxLength={300} rows={3}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isGenerating) { e.preventDefault(); generate() } }} />
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[10px] ${prompt.length > 270 ? 'text-red-400' : 'text-gray-600'}`}>{prompt.length}/300</span>
                <button onClick={generate} disabled={isGenerating || isUploading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  {isGenerating ? 'Creating...' : `Generate · ${currentCost} cr`}
                </button>
              </div>
              {autoFillStatus && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Loader2 size={10} className="animate-spin text-cyan-400" />
                  <span className="text-[10px] text-cyan-400">{autoFillStatus}</span>
                </div>
              )}
            </div>
          )}

          {/* ─── File Upload (file-based features) ───────────── */}
          {activeFeature?.needsFile && (
            <div className="px-4 py-3 border-b border-white/10 space-y-2">
              {!uploadedFileUrl ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed transition-all ${isUploading ? 'border-cyan-400/50 bg-cyan-500/5' : 'border-white/20 hover:border-cyan-400/50 hover:bg-cyan-500/5'}`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={24} className="text-cyan-400 animate-spin" />
                      <span className="text-xs text-cyan-400">{uploadProgress}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {activeTab === 'stems' ? 'Upload audio to split all stems' :
                         activeTab === 'extract' ? 'Upload audio to extract stem' :
                         activeTab === 'audio-boost' ? 'Upload audio to boost' :
                         'Upload file'}
                      </span>
                      <span className="text-[9px] text-gray-600">Audio or Video · Max 100MB</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 border border-cyan-500/30">
                  <FileAudio size={18} className="text-cyan-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-semibold truncate">{uploadedFileName}</p>
                    <p className="text-[9px] text-cyan-400">Ready to process</p>
                  </div>
                  <button onClick={clearUpload} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              )}

              {/* Generate button for file-based features */}
              {uploadedFileUrl && (
                <button onClick={generate} disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                  {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  {isGenerating ? 'Processing...' : `${activeFeature.label} · ${currentCost} cr`}
                </button>
              )}
            </div>
          )}

          {/* ─── Feature-specific Parameters ─────────────────── */}

          {/* MUSIC params */}
          {activeTab === 'music' && (
            <div className="px-4 py-3 border-b border-white/10 space-y-2.5">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Title <span className="text-gray-600">(auto-filled if empty)</span></label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Leave empty for AI title" maxLength={100}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Genre <span className="text-gray-600">(auto)</span></label>
                  <select value={genre} onChange={e => setGenre(e.target.value)}
                    className="w-full bg-gray-900 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="">Auto-detect</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)}
                    className="w-full bg-gray-900 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">BPM</label>
                  <input type="number" value={bpm} onChange={e => setBpm(+e.target.value)} min={60} max={200}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Duration</label>
                  <select value={duration} onChange={e => setDuration(e.target.value as 'short' | 'medium' | 'long')}
                    className="w-full bg-gray-900 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                  </select>
                </div>
              </div>
              {/* Cover art toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={generateCoverArt} onChange={e => setGenerateCoverArt(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-cyan-500" />
                <span className="text-xs text-gray-400">Generate cover art (+1 cr)</span>
              </label>
              {/* Lyrics toggle */}
              {!isInstrumental && (
                <div>
                  <button onClick={() => setShowLyrics(!showLyrics)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all w-full ${showLyrics ? 'bg-gradient-to-r from-cyan-600/20 to-cyan-400/10 border-cyan-400/50 text-cyan-300' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
                    <Edit3 size={14} />
                    <span className="flex-1 text-left">{showLyrics ? 'Lyrics' : 'Add Lyrics (auto-filled if empty)'}</span>
                    {showLyrics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showLyrics && (
                    <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
                      placeholder="Write lyrics here or leave empty — AI will generate them from your prompt"
                      rows={4} className="w-full mt-2 bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* EFFECTS params */}
          {activeTab === 'effects' && (
            <div className="px-4 py-3 border-b border-white/10">
              <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Duration (seconds)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={10} value={effectDuration} onChange={e => setEffectDuration(+e.target.value)}
                  className="flex-1 accent-purple-500" />
                <span className="text-sm font-bold text-purple-400 w-8 text-right">{effectDuration}s</span>
              </div>
            </div>
          )}

          {/* LOOPS params */}
          {activeTab === 'loops' && (
            <div className="px-4 py-3 border-b border-white/10 space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">BPM</label>
                  <input type="number" value={bpm} onChange={e => setBpm(+e.target.value)} min={60} max={200}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Variations</label>
                  <select value={loopVariations} onChange={e => setLoopVariations(+e.target.value)}
                    className="w-full bg-gray-900 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value={1}>1</option><option value={2}>2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Format</label>
                  <select value={loopFormat} onChange={e => setLoopFormat(e.target.value as 'wav' | 'mp3')}
                    className="w-full bg-gray-900 border border-white/20 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="wav">WAV</option><option value="mp3">MP3</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEMS params (Split All — no stem picker) */}
          {activeTab === 'stems' && uploadedFileUrl && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 space-y-2">
                <p className="text-xs text-purple-300 font-semibold">Split into all stems:</p>
                <div className="flex flex-wrap gap-1.5">
                  {STEM_TYPES.map(s => (
                    <span key={s} className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-lg text-[10px] text-purple-300 font-medium">
                      {s === 'vocals' ? '🎤' : s === 'drums' ? '🥁' : s === 'bass' ? '🎸' : s === 'piano' ? '🎹' : s === 'guitar' ? '🎸' : '🎵'} {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-gray-500">All stems extracted in one pass</p>
              </div>
            </div>
          )}

          {/* EXTRACT params (Individual stem picker with guitar) */}
          {activeTab === 'extract' && (
            <div className="px-4 py-3 border-b border-white/10 space-y-2.5">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-wider">Choose stem to extract</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {STEM_TYPES.map(s => (
                    <button key={s} onClick={() => setExtractStem(s)}
                      className={`px-2 py-2.5 rounded-xl text-xs font-medium border transition-all ${extractStem === s
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10'
                        : 'border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/20'}`}>
                      {s === 'vocals' ? '🎤' : s === 'drums' ? '🥁' : s === 'bass' ? '🎸' : s === 'piano' ? '🎹' : s === 'guitar' ? '🎸' : '🎵'} {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Output Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`${extractStem} extract`}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors" />
              </div>
            </div>
          )}

          {/* AUDIO BOOST params */}
          {activeTab === 'audio-boost' && uploadedFileUrl && (
            <div className="px-4 py-3 border-b border-white/10 space-y-2.5">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wider">Track Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track name"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors" />
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between"><label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Bass Boost</label><span className="text-xs text-orange-400 font-bold">{bassBoost} dB</span></div>
                  <input type="range" min={-20} max={20} value={bassBoost} onChange={e => setBassBoost(+e.target.value)} className="w-full accent-orange-500" />
                </div>
                <div>
                  <div className="flex justify-between"><label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Treble Boost</label><span className="text-xs text-orange-400 font-bold">{trebleBoost} dB</span></div>
                  <input type="range" min={-20} max={20} value={trebleBoost} onChange={e => setTrebleBoost(+e.target.value)} className="w-full accent-orange-500" />
                </div>
                <div>
                  <div className="flex justify-between"><label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Volume Boost</label><span className="text-xs text-orange-400 font-bold">{volumeBoost}</span></div>
                  <input type="range" min={0} max={10} value={volumeBoost} onChange={e => setVolumeBoost(+e.target.value)} className="w-full accent-orange-500" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Error ───────────────────────────────────────── */}
          {error && (
            <div className="mx-4 mt-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />{error}
              <button onClick={() => setError('')} className="ml-auto"><X size={12} /></button>
            </div>
          )}

          {/* ─── Ideas & Tags ────────────────────────────────── */}
          <div className="px-4 py-2.5">
            <button onClick={() => { setShowIdeas(!showIdeas); setIdeasView('tags') }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${showIdeas ? 'bg-gradient-to-r from-yellow-600/30 to-amber-400/20 border-yellow-400 text-yellow-300' : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50'}`}>
              <div className={`p-1.5 rounded-lg ${showIdeas ? 'bg-white/10' : 'bg-white/5'}`}><Lightbulb size={16} /></div>
              <div className="flex-1 text-left"><div className="text-xs font-semibold">Ideas & Tags</div><div className="text-[9px] text-gray-500">AI prompts & quick tags</div></div>
              <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">AI</span>
            </button>

            {showIdeas && (
              <div className="mt-2 space-y-2">
                {ideasView === 'tags' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white">Quick Tags</span>
                      <button onClick={() => setIdeasView('type')} className="px-2 py-0.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 rounded-lg text-[9px] font-bold text-purple-300">✨ IDEAS</button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => addTag(tag)}
                          className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-[9px] font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">{tag}</button>
                      ))}
                    </div>
                  </>
                )}
                {ideasView === 'type' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-white">✨ AI Ideas</h3>
                      <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X size={12} className="text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => { setPromptType('song'); setIdeasView('genre') }}
                        className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400/40 rounded-2xl transition-all hover:scale-105">
                        <div className="text-xl mb-1">🎤</div><div className="text-[10px] font-bold text-white">Song</div><div className="text-[8px] text-gray-400">With vocals</div>
                      </button>
                      <button onClick={() => { setPromptType('beat'); setIdeasView('genre') }}
                        className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/40 rounded-2xl transition-all hover:scale-105">
                        <div className="text-xl mb-1">🎹</div><div className="text-[10px] font-bold text-white">Beat</div><div className="text-[8px] text-gray-400">Instrumental</div>
                      </button>
                    </div>
                  </div>
                )}
                {ideasView === 'genre' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setIdeasView('type')} className="text-[9px] text-cyan-400 flex items-center gap-0.5"><ChevronLeft size={10} />Back</button>
                      <h3 className="text-[10px] font-bold text-white">🎵 Select Genre</h3>
                      <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X size={12} className="text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                      {IDEA_GENRES.map(g => (
                        <button key={g} onClick={() => generateIdea(g)}
                          className="px-1.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-xl text-[9px] font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">{g}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Feature Buttons ──────────────────────────────── */}
          <div className="px-4 pb-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1">Creation Tools</p>
            <div className="space-y-1.5">
              {ALL_FEATURES.map(f => {
                const Icon = f.icon; const isActive = activeTab === f.id
                const cs: Record<string, string> = {
                  cyan: isActive ? 'bg-gradient-to-r from-cyan-600/30 to-cyan-400/20 border-cyan-400 text-cyan-300' : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50',
                  purple: isActive ? 'bg-gradient-to-r from-purple-600/30 to-pink-500/20 border-purple-400 text-purple-300' : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50',
                  orange: isActive ? 'bg-gradient-to-r from-orange-600/30 to-red-500/20 border-orange-400 text-orange-300' : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400/50',
                }
                return (
                  <button key={f.id} onClick={() => setActiveTab(f.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${cs[f.color]}`}>
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/10' : 'bg-white/5'}`}><Icon size={16} /></div>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-semibold">{f.label}</div>
                      <div className="text-[9px] text-gray-500">{f.desc}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {f.needsFile && <Upload size={10} className="text-gray-600" />}
                      <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">{f.cost} cr</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ─── Active Jobs ─────────────────────────────────── */}
          {jobs.filter(j => j.status === 'processing' || j.status === 'queued').length > 0 && (
            <div className="px-4 pb-3">
              <div className="border-t border-white/10 pt-3">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1">In Progress</p>
                <div className="space-y-1.5">
                  {jobs.filter(j => j.status === 'processing' || j.status === 'queued').map((job, i) => (
                    <div key={`${job.id}-${i}`} className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                      <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{job.title || job.prompt?.substring(0, 30) || job.type}</p>
                        <p className="text-[9px] text-gray-500 capitalize">{job.type} · {job.status}</p>
                      </div>
                      <Clock size={12} className="text-cyan-400 animate-pulse flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ LIBRARY VIEW ══════════════════════════════════════ */}
      {view === 'library' && (
        <div className="flex-1 overflow-y-auto">
          {/* Filter tabs */}
          <div className="px-3 py-2 border-b border-white/10 flex gap-1.5 overflow-x-auto no-scrollbar">
            <button onClick={() => setLibraryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${libraryFilter === 'all' ? 'bg-white/10 text-white border border-white/20' : 'text-gray-500 hover:text-gray-300'}`}>
              All ({completedJobs.length})
            </button>
            {ALL_FEATURES.filter(f => typeCounts[f.id]).map(f => {
              const c = getTypeColor(f.id)
              return (
                <button key={f.id} onClick={() => setLibraryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${libraryFilter === f.id ? `${c.bg} ${c.activeText} border ${c.activeBorder}` : `${c.text} opacity-60 hover:opacity-100`}`}>
                  <f.icon size={10} />{f.label} ({typeCounts[f.id]})
                </button>
              )
            })}
          </div>

          {/* Library cards */}
          {filteredLibrary.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Music size={32} className="opacity-20 mb-3" />
              <p className="text-sm">No generations yet</p>
              <button onClick={() => setView('create')} className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline">Start creating</button>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-2">
              {filteredLibrary.map((job, i) => {
                const c = getTypeColor(job.type)
                const TypeIcon = getTypeIcon(job.type)
                const result = job.result || {}
                const audioSrc = (result.audioUrl as string) || (result.url as string) || ''
                const imgSrc = (result.imageUrl as string) || (result.coverArtUrl as string) || ''
                const isPlaying = playingUrl === audioSrc
                const isExpanded = expandedJob === `${job.id}-${i}`

                return (
                  <div key={`${job.id}-${i}`}
                    className={`bg-black/40 backdrop-blur-xl border ${c.border} rounded-xl overflow-hidden transition-all duration-300`}>
                    <div className="flex items-center gap-3 p-3">
                      {/* Thumbnail / Play button */}
                      {job.type === 'image' && imgSrc ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : audioSrc ? (
                        <button onClick={() => togglePlay(audioSrc)}
                          className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 border ${isPlaying ? `bg-gradient-to-br ${c.gradient} border-transparent` : `${c.bg} ${c.border}`} transition-all`}>
                          {isPlaying ? <Pause size={16} className="text-black" /> : <Play size={16} className={c.text} />}
                        </button>
                      ) : (
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg} border ${c.border}`}>
                          <TypeIcon size={18} className={c.text} />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{job.title || job.prompt?.substring(0, 35) || job.type}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border} font-bold uppercase`}>
                            {job.type === 'audio-boost' ? 'boost' : job.type}
                          </span>
                          <span className="text-[9px] text-gray-600">{new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {audioSrc && (
                          <button onClick={() => sendToPlugin('import_audio', { url: audioSrc, title: job.title || job.type, type: job.type })}
                            className={`p-1.5 rounded-lg ${c.bg} border ${c.border} transition-all`} title="Send to DAW">
                            <Download size={12} className={c.text} />
                          </button>
                        )}
                        {Boolean(result.stems) || Boolean(result.loops) ? (
                          <button onClick={() => setExpandedJob(isExpanded ? null : `${job.id}-${i}`)}
                            className={`p-1.5 rounded-lg ${c.bg} border ${c.border} transition-all`}>
                            {isExpanded ? <ChevronUp size={12} className={c.text} /> : <ChevronDown size={12} className={c.text} />}
                          </button>
                        ) : null}
                        <CheckCircle size={14} className="text-green-500 ml-1" />
                      </div>
                    </div>

                    {/* Expanded: stems */}
                    {isExpanded && Boolean(result.stems) && (
                      <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
                        {Object.entries(result.stems as Record<string, string>).map(([stemName, stemUrl]) => (
                          <div key={stemName} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                            <button onClick={() => togglePlay(stemUrl)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${playingUrl === stemUrl ? 'bg-purple-500' : 'bg-white/10'} transition-all`}>
                              {playingUrl === stemUrl ? <Pause size={10} className="text-white" /> : <Play size={10} className="text-white" />}
                            </button>
                            <span className="text-xs text-white flex-1 capitalize">{stemName}</span>
                            <button onClick={() => sendToPlugin('import_audio', { url: stemUrl, title: `${job.title} - ${stemName}`, type: 'stems' })}
                              className="p-1 rounded bg-purple-500/20 border border-purple-500/30 hover:border-purple-400"><Download size={10} className="text-purple-400" /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expanded: loops */}
                    {isExpanded && Boolean(result.loops) && (
                      <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
                        {(result.loops as Array<{ url: string; variation?: number }>).map((loop, li) => (
                          <div key={li} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                            <button onClick={() => togglePlay(loop.url)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${playingUrl === loop.url ? 'bg-indigo-500' : 'bg-white/10'} transition-all`}>
                              {playingUrl === loop.url ? <Pause size={10} className="text-white" /> : <Play size={10} className="text-white" />}
                            </button>
                            <span className="text-xs text-white flex-1">Variation {loop.variation ?? li + 1}</span>
                            <button onClick={() => sendToPlugin('import_audio', { url: loop.url, title: `${job.title} - V${loop.variation ?? li + 1}`, type: 'loops' })}
                              className="p-1 rounded bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-400"><Download size={10} className="text-indigo-400" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Failed jobs */}
          {jobs.filter(j => j.status === 'failed').length > 0 && (
            <div className="px-3 pb-3">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 px-1 pt-2 border-t border-white/5">Failed</p>
              <div className="space-y-1.5">
                {jobs.filter(j => j.status === 'failed').map((job, i) => (
                  <div key={`fail-${job.id}-${i}`} className="flex items-center gap-2.5 bg-red-500/5 rounded-xl px-3 py-2 border border-red-500/20">
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{job.title || job.prompt?.substring(0, 30) || job.type}</p>
                      <p className="text-[9px] text-red-400">{job.error?.substring(0, 50) || 'Failed'}</p>
                    </div>
                    <button onClick={() => setJobs(prev => prev.filter((_, idx) => idx !== jobs.indexOf(job)))}
                      className="p-1 rounded hover:bg-red-500/20"><Trash2 size={10} className="text-red-400" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── No-scrollbar style ──────────────────────────────── */}
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
