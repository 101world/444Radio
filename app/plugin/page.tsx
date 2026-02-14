'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Music, Sparkles, Repeat, Image as ImageIcon, Scissors, Volume2,
  Zap, Lightbulb, X, ChevronLeft, Send, Film, Layers, Edit3,
  Play, Pause, Download, Trash2, CheckCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, Upload, FileAudio, Loader2, Settings2,
  Save, FolderOpen, RefreshCw, PlusCircle, Mic, Plus, RotateCcw,
  Rocket, Square, FileText
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

interface Message {
  id: string
  type: 'user' | 'assistant' | 'generation'
  content: string
  generationType?: string
  result?: {
    url?: string
    audioUrl?: string
    imageUrl?: string
    title?: string
    prompt?: string
    lyrics?: string
  }
  stems?: Record<string, string>
  timestamp: Date
  isGenerating?: boolean
}

// ─── localStorage persistence ──────────────────────────────────
const LIBRARY_KEY = '444radio_plugin_library'
const CHAT_KEY = '444radio_plugin_chat'

function loadLibrary(): GenerationJob[] {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]') } catch { return [] }
}
function saveLibrary(jobs: GenerationJob[]) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(jobs.filter(j => j.status === 'completed' || j.status === 'failed'))) } catch {}
}
function loadChat(): Message[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return []
    return JSON.parse(raw).map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) }))
  } catch { return [] }
}
function saveChat(msgs: Message[]) {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs)) } catch {}
}

// ─── Detect JUCE host ──────────────────────────────────────────
const isJuceHost = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('host') === 'juce'

function sendToPlugin(action: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({ source: '444radio-plugin', action, ...data })
  try {
    if ((window as any).__juce__?.postMessage) { (window as any).__juce__.postMessage(payload); return }
    if (isJuceHost) { window.location.href = 'juce-bridge://' + encodeURIComponent(payload); return }
    window.parent?.postMessage(JSON.parse(payload), '*')
  } catch {}
}

function saveFileLocally(url: string, fileName: string, subfolder?: string) {
  sendToPlugin('save_to_local', { url, fileName: fileName.replace(/[<>:"/\\|?*]/g, '-'), folder: '444radio-generations', subfolder: subfolder || '' })
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
const MIN_PROMPT_LENGTH = 10
const MAX_PROMPT_LENGTH = 300

const BOOST_PRESETS = [
  { label: '444 Mix', bass: 3, treble: 2, volume: 4, normalize: true, noise_reduction: false },
  { label: 'Clean', bass: 0, treble: 1, volume: 2, normalize: true, noise_reduction: true },
  { label: 'Heavy', bass: 8, treble: 5, volume: 6, normalize: true, noise_reduction: false },
]

// Feature definitions — matches FeaturesSidebar exactly
const ALL_FEATURES = [
  { id: 'music',          icon: Music,     label: 'Music',          desc: 'Generate AI music',          color: 'cyan',   cost: 2,  needsFile: false },
  { id: 'effects',        icon: Sparkles,  label: 'Effects',        desc: 'Sound effects',              color: 'purple', cost: 2,  needsFile: false },
  { id: 'loops',          icon: Repeat,    label: 'Loops',          desc: 'Fixed BPM loops',            color: 'cyan',   cost: 6,  needsFile: false },
  { id: 'image',          icon: ImageIcon, label: 'Cover Art',      desc: 'AI album artwork',           color: 'cyan',   cost: 1,  needsFile: false },
  { id: 'video-to-audio', icon: Film,      label: 'Video to Audio', desc: 'Synced SFX from video',      color: 'cyan',   cost: 2,  needsFile: true  },
  { id: 'stems',          icon: Scissors,  label: 'Split Stems',    desc: 'Vocals, drums, bass & more', color: 'purple', cost: 5,  needsFile: true  },
  { id: 'audio-boost',    icon: Volume2,   label: 'Audio Boost',    desc: 'Mix & master your track',    color: 'orange', cost: 1,  needsFile: true  },
  { id: 'extract',        icon: Layers,    label: 'Extract',        desc: 'Extract individual stem',    color: 'cyan',   cost: 1,  needsFile: true  },
]

// Stem display config (matches create page exactly)
function getStemDisplay(key: string) {
  const k = key.toLowerCase()
  if (k.includes('vocal')) return { title: '🎤 Vocals', description: 'Isolated vocal track', gradient: 'from-purple-600 to-purple-400', border: 'border-purple-500/30', hover: 'hover:border-purple-400/50', hoverBg: 'hover:bg-purple-500/20', text: 'text-purple-400' }
  if (k.includes('instrumental') || k.includes('accompaniment')) return { title: '🎹 Instrumental', description: 'Music without vocals', gradient: 'from-cyan-600 to-cyan-400', border: 'border-cyan-500/30', hover: 'hover:border-cyan-400/50', hoverBg: 'hover:bg-cyan-500/20', text: 'text-cyan-400' }
  if (k.includes('drum')) return { title: '🥁 Drums', description: 'Percussion only', gradient: 'from-amber-600 to-amber-400', border: 'border-amber-500/30', hover: 'hover:border-amber-400/50', hoverBg: 'hover:bg-amber-500/20', text: 'text-amber-300' }
  if (k.includes('bass')) return { title: '🪕 Bass', description: 'Low-end bassline', gradient: 'from-emerald-600 to-emerald-400', border: 'border-emerald-500/30', hover: 'hover:border-emerald-400/50', hoverBg: 'hover:bg-emerald-500/20', text: 'text-emerald-300' }
  if (k.includes('guitar')) return { title: '🎸 Guitar', description: 'Isolated guitar', gradient: 'from-orange-600 to-orange-400', border: 'border-orange-500/30', hover: 'hover:border-orange-400/50', hoverBg: 'hover:bg-orange-500/20', text: 'text-orange-300' }
  if (k.includes('piano')) return { title: '🎹 Piano', description: 'Isolated keys', gradient: 'from-indigo-600 to-indigo-400', border: 'border-indigo-500/30', hover: 'hover:border-indigo-400/50', hoverBg: 'hover:bg-indigo-500/20', text: 'text-indigo-300' }
  return { title: `✨ ${key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ')}`, description: 'Isolated audio track', gradient: 'from-slate-600 to-slate-400', border: 'border-slate-500/30', hover: 'hover:border-slate-400/50', hoverBg: 'hover:bg-slate-500/20', text: 'text-slate-200' }
}

// ═══════════════════════════════════════════════════════════════
export default function PluginPage() {
  // ─── Auth state ───────────────────────────────────────────
  const [token, setToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credits, setCredits] = useState<CreditInfo | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [authError, setAuthError] = useState('')

  // ─── Core state ───────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<string>('music')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'assistant', content: '👋 Hey! I\'m your AI music studio assistant. What would you like to create today?', timestamp: new Date() }
  ])
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set())
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [isInstrumental, setIsInstrumental] = useState(false)

  // ─── Sidebar state ────────────────────────────────────────
  const [showFeaturesSidebar, setShowFeaturesSidebar] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideasView, setIdeasView] = useState<'tags' | 'type' | 'genre' | 'generating'>('tags')
  const [promptType, setPromptType] = useState<'song' | 'beat'>('song')

  // ─── Bottom dock state ────────────────────────────────────
  const [showAdvancedButtons, setShowAdvancedButtons] = useState(false)
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false)
  const [showIdeasFlow, setShowIdeasFlow] = useState(false)
  const [ideasStep, setIdeasStep] = useState<'type' | 'genre' | 'generating'>('type')

  // ─── Generation form state ────────────────────────────────
  const [customTitle, setCustomTitle] = useState('')
  const [customLyrics, setCustomLyrics] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [songDuration, setSongDuration] = useState<'short' | 'medium' | 'long'>('long')
  const [language, setLanguage] = useState('English')
  const [generateCoverArt, setGenerateCoverArt] = useState(false)
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [isGeneratingAtomLyrics, setIsGeneratingAtomLyrics] = useState(false)
  const [showTitleError, setShowTitleError] = useState(false)

  // ─── File upload state ────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileUrl, setUploadedFileUrl] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  // ─── Extract / Boost / Loops / Effects params ─────────────
  const [extractStem, setExtractStem] = useState<string>('vocals')
  const [bassBoost, setBassBoost] = useState(0)
  const [trebleBoost, setTrebleBoost] = useState(0)
  const [volumeBoost, setVolumeBoost] = useState(2)
  const [normalizeAudio, setNormalizeAudio] = useState(true)
  const [noiseReduction, setNoiseReduction] = useState(false)
  const [boostOutputFormat, setBoostOutputFormat] = useState('wav')
  const [boostBitrate, setBoostBitrate] = useState('320k')
  const [effectDuration, setEffectDuration] = useState(5)
  const [loopMaxDuration, setLoopMaxDuration] = useState(8)
  const [loopVariations, setLoopVariations] = useState(2)
  const [v2aQuality, setV2aQuality] = useState<'standard' | 'hq'>('standard')

  // Audio player
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ─── Scroll to bottom on new messages ─────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ─── Load persisted data on mount ─────────────────────────
  useEffect(() => {
    const savedJobs = loadLibrary()
    if (savedJobs.length > 0) setJobs(savedJobs)
    const savedChat = loadChat()
    if (savedChat.length > 0) setMessages(savedChat)
  }, [])

  // ─── Persist on changes ───────────────────────────────────
  useEffect(() => { saveLibrary(jobs) }, [jobs])
  useEffect(() => { saveChat(messages) }, [messages])

  // ─── Audio Player ─────────────────────────────────────────
  const togglePlay = (url: string) => {
    if (playingUrl === url) { audioRef.current?.pause(); setPlayingUrl(null) }
    else {
      if (audioRef.current) audioRef.current.pause()
      const audio = new Audio(url); audioRef.current = audio
      audio.play(); audio.onended = () => setPlayingUrl(null); setPlayingUrl(url)
    }
  }

  // ─── Auth ─────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken?.startsWith('444r_')) { setToken(urlToken); verifyToken(urlToken); return }
    const saved = localStorage.getItem('444radio_plugin_token')
    if (saved) { setToken(saved); verifyToken(saved) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verifyToken = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.ok) {
        const data = await res.json()
        setCredits(data); setIsAuthenticated(true); setIsLoadingCredits(false)
        localStorage.setItem('444radio_plugin_token', t)
        sendToPlugin('authenticated', { credits: data.credits, token: t })
      } else { setIsAuthenticated(false); setAuthError('Invalid token. Generate one from Settings → Plugin.') }
    } catch { setAuthError('Connection failed. Check your internet.') }
  }, [baseUrl])

  const refreshCredits = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) { const d = await res.json(); setCredits(d); setIsLoadingCredits(false) }
    } catch {}
  }, [token, baseUrl])

  // ─── File Upload ──────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    if (file.size > 100 * 1024 * 1024) { alert('File must be under 100MB'); return }
    setIsUploading(true); setUploadProgress('Getting upload URL...')
    try {
      const presignRes = await fetch(`${baseUrl}/api/plugin/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
      })
      if (!presignRes.ok) throw new Error((await presignRes.json().catch(() => ({}))).error || 'Upload setup failed')
      const { presignedUrl, publicUrl } = await presignRes.json()
      setUploadProgress(`Uploading ${(file.size / (1024 * 1024)).toFixed(1)} MB...`)
      const uploadRes = await fetch(presignedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!uploadRes.ok) throw new Error('Upload to storage failed')
      setUploadProgress('Processing...')
      await new Promise(r => setTimeout(r, 3000))
      setUploadedFileUrl(publicUrl); setUploadedFileName(file.name); setUploadProgress('')
      if (!customTitle) setCustomTitle(file.name.replace(/\.[^.]+$/, ''))
    } catch (err: unknown) {
      alert((err as Error).message || 'Upload failed'); setUploadProgress('')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [token, baseUrl, customTitle])

  const clearUpload = () => { setUploadedFileUrl(''); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = '' }

  // ─── Clear chat ───────────────────────────────────────────
  const handleClearChat = () => {
    setMessages([{ id: '1', type: 'assistant', content: '👋 Hey! I\'m your AI music studio assistant. What would you like to create today?', timestamp: new Date() }])
  }

  // ─── Tag / Idea helpers ───────────────────────────────────
  const addTag = (tag: string) => {
    const newInput = input ? `${input}, ${tag}` : tag
    setInput(newInput.slice(0, MAX_PROMPT_LENGTH))
  }

  const generateIdea = (g: string) => {
    const moods = ['dark','uplifting','chill','energetic','melodic','dreamy','nostalgic','powerful']
    const mood = moods[Math.floor(Math.random() * moods.length)]
    const type = promptType === 'song' ? 'song with catchy vocals and lyrics' : 'instrumental beat'
    setInput(`${mood} ${g} ${type}, modern production, professional mix`)
    if (promptType === 'beat') setIsInstrumental(true)
    setShowIdeas(false); setIdeasView('tags')
    setShowIdeasFlow(false); setIdeasStep('type'); setShowPromptSuggestions(false)
  }

  // ─── GENERATION — mirrors create page flow exactly ────────
  const handleGenerate = useCallback(async () => {
    if (!input.trim() || !token) return
    const trimmed = input.trim()
    if (trimmed.length < MIN_PROMPT_LENGTH) { alert(`Prompt must be at least ${MIN_PROMPT_LENGTH} characters`); return }
    if (trimmed.length > MAX_PROMPT_LENGTH) { alert(`Prompt must be ${MAX_PROMPT_LENGTH} characters or less`); return }

    // Title validation for vocal music
    if (selectedType === 'music' && !isInstrumental && customTitle.trim()) {
      if (customTitle.trim().length < 3 || customTitle.trim().length > 100) {
        setShowLyricsModal(true); setShowTitleError(true)
        setTimeout(() => setShowTitleError(false), 5000); return
      }
    }
    setShowTitleError(false)

    // ─── Handle file-based features via modals/inline ───────
    if (selectedType === 'stems' || selectedType === 'extract' || selectedType === 'audio-boost') {
      if (!uploadedFileUrl) { fileInputRef.current?.click(); return }
      return processFileFeature()
    }

    if (selectedType === 'video-to-audio') {
      if (!uploadedFileUrl) { fileInputRef.current?.click(); return }
      return processFileFeature()
    }

    // ─── Music generation flow (carbon copy of create page) ─
    if (selectedType === 'music') {
      const messageId = Date.now().toString()
      const genMsgId = (Date.now() + 1).toString()

      const userMsg: Message = {
        id: messageId, type: 'user',
        content: isInstrumental ? `🎹 Generate instrumental: "${input}"` : `🎵 Generate music: "${input}"`,
        timestamp: new Date()
      }
      const genMsg: Message = {
        id: genMsgId, type: 'generation',
        content: activeGenerations.size > 0 ? '⏳ Queued - will start soon...' : `🎵 Generating your ${isInstrumental ? 'instrumental ' : ''}track...`,
        generationType: 'music', isGenerating: true, timestamp: new Date()
      }
      setMessages(prev => [...prev, userMsg, genMsg])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))

      let originalPrompt = input
      setInput('')

      // Instrumental cleanup
      if (isInstrumental) {
        originalPrompt = originalPrompt
          .replace(/\b(vocals?|voices?|singing|singer|sung|sing|vox|choir|choral|humming|chant(?:ing)?|whisper(?:ed)?|falsetto|a\s*capella)\b/gi, '')
          .replace(/\s+/g, ' ').replace(/,\s*,+/g, ',').replace(/,\s*$/, '').replace(/^\s*,/, '').trim()
        if (!originalPrompt.toLowerCase().includes('no vocals')) {
          originalPrompt = originalPrompt.trimEnd().slice(0, 300 - 30) + ', no vocals, instrumental only'
        }
      } else {
        originalPrompt = originalPrompt.slice(0, 300)
      }

      // Smart auto-fill
      let finalTitle = customTitle, finalLyrics = customLyrics, finalGenre = genre, finalBpm = bpm
      let wasAutoFilled = false

      if (!finalTitle.trim()) {
        wasAutoFilled = true
        const autoMsg: Message = { id: (Date.now() + 2).toString(), type: 'assistant', content: '🤖 Auto-generating title...', timestamp: new Date() }
        setMessages(prev => [...prev, autoMsg])
        try {
          const res = await fetch(`${baseUrl}/api/generate/atom-title`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: originalPrompt }) })
          const d = await res.json()
          if (d.success && d.title) { finalTitle = d.title; setCustomTitle(finalTitle) }
          await new Promise(r => setTimeout(r, 10000))
        } catch { finalTitle = originalPrompt.split(' ').slice(0, 2).join(' '); setCustomTitle(finalTitle) }
      }

      if (isInstrumental) {
        finalLyrics = '[Instrumental]'; setCustomLyrics(finalLyrics)
      } else if (!finalLyrics.trim()) {
        wasAutoFilled = true
        try {
          const res = await fetch(`${baseUrl}/api/generate/atom-lyrics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: originalPrompt }) })
          const d = await res.json()
          if (d.success && d.lyrics) { finalLyrics = d.lyrics; setCustomLyrics(finalLyrics) }
          await new Promise(r => setTimeout(r, 10000))
        } catch {}
      }

      if (!finalGenre.trim()) {
        wasAutoFilled = true
        try {
          const res = await fetch(`${baseUrl}/api/generate/atom-genre`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: originalPrompt }) })
          const d = await res.json()
          if (d.success && d.genre) { finalGenre = d.genre; setGenre(finalGenre) }
          await new Promise(r => setTimeout(r, 10000))
        } catch { finalGenre = 'pop'; setGenre(finalGenre) }
      }

      if (!finalBpm.trim()) {
        const pl = originalPrompt.toLowerCase()
        if (pl.includes('fast') || pl.includes('energetic')) finalBpm = '140'
        else if (pl.includes('slow') || pl.includes('chill')) finalBpm = '80'
        else if (finalGenre.includes('electronic')) finalBpm = '128'
        else if (finalGenre.includes('hip-hop')) finalBpm = '90'
        else finalBpm = '110'
        setBpm(finalBpm); wasAutoFilled = true
      }

      if (wasAutoFilled) {
        const fields: string[] = []
        if (!customTitle.trim()) fields.push('Title')
        if (!customLyrics.trim() && !isInstrumental) fields.push('Lyrics')
        if (isInstrumental) fields.push('Instrumental Mode')
        if (!genre.trim()) fields.push(`Genre (${finalGenre})`)
        if (!bpm.trim()) fields.push(`BPM (${finalBpm})`)
        setMessages(prev => [...prev, { id: (Date.now() + 3).toString(), type: 'assistant', content: `✨ Auto-filled: ${fields.join(', ')}`, timestamp: new Date() }])
      }

      // Call plugin generate endpoint
      setIsGenerating(true)
      try {
        const payload: Record<string, unknown> = {
          type: 'music', prompt: originalPrompt, title: finalTitle, lyrics: finalLyrics,
          genre: finalGenre, bpm: finalBpm ? parseInt(finalBpm) : undefined, duration: songDuration,
          language, generateCoverArt, audio_format: 'wav',
        }
        const res = await fetch(`${baseUrl}/api/plugin/generate`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
        await processStream(res, genMsgId, 'music', finalTitle || originalPrompt)
      } catch (err: unknown) {
        setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content: `❌ ${(err as Error).message}` } : m))
      } finally {
        setIsGenerating(false)
        setActiveGenerations(prev => { const n = new Set(prev); n.delete(genMsgId); return n })
        setCustomTitle(''); setCustomLyrics(''); setGenre(''); setBpm('')
        setSongDuration('long'); setIsInstrumental(false); refreshCredits()
      }
      return
    }

    // ─── Image generation ───────────────────────────────────
    if (selectedType === 'image') {
      const userMsg: Message = { id: Date.now().toString(), type: 'user', content: `🎨 Generate cover art: "${input}"`, timestamp: new Date() }
      const genMsgId = (Date.now() + 1).toString()
      const genMsg: Message = { id: genMsgId, type: 'generation', content: '🎨 Generating your cover art...', generationType: 'image', isGenerating: true, timestamp: new Date() }
      setMessages(prev => [...prev, userMsg, genMsg])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))
      const prompt = input; setInput('')
      setIsGenerating(true)
      try {
        const res = await fetch(`${baseUrl}/api/plugin/generate`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'image', prompt }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
        await processStream(res, genMsgId, 'image', prompt)
      } catch (err: unknown) {
        setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content: `❌ ${(err as Error).message}` } : m))
      } finally {
        setIsGenerating(false); setActiveGenerations(prev => { const n = new Set(prev); n.delete(genMsgId); return n }); refreshCredits()
      }
      return
    }

    // ─── Effects generation ─────────────────────────────────
    if (selectedType === 'effects') {
      const userMsg: Message = { id: Date.now().toString(), type: 'user', content: `✨ Generate effects: "${input}"`, timestamp: new Date() }
      const genMsgId = (Date.now() + 1).toString()
      const genMsg: Message = { id: genMsgId, type: 'generation', content: '✨ Generating sound effects...', generationType: 'effects', isGenerating: true, timestamp: new Date() }
      setMessages(prev => [...prev, userMsg, genMsg])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))
      const prompt = input; setInput('')
      setIsGenerating(true)
      try {
        const res = await fetch(`${baseUrl}/api/plugin/generate`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'effects', prompt, duration: effectDuration, output_format: 'wav' }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
        await processStream(res, genMsgId, 'effects', prompt)
      } catch (err: unknown) {
        setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content: `❌ ${(err as Error).message}` } : m))
      } finally {
        setIsGenerating(false); setActiveGenerations(prev => { const n = new Set(prev); n.delete(genMsgId); return n }); refreshCredits()
      }
      return
    }

    // ─── Loops generation ───────────────────────────────────
    if (selectedType === 'loops') {
      const userMsg: Message = { id: Date.now().toString(), type: 'user', content: `🔁 Generate loop: "${input}"`, timestamp: new Date() }
      const genMsgId = (Date.now() + 1).toString()
      const genMsg: Message = { id: genMsgId, type: 'generation', content: '🔁 Generating loops...', generationType: 'loops', isGenerating: true, timestamp: new Date() }
      setMessages(prev => [...prev, userMsg, genMsg])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))
      const prompt = input; setInput('')
      setIsGenerating(true)
      try {
        const res = await fetch(`${baseUrl}/api/plugin/generate`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'loops', prompt, bpm: bpm ? parseInt(bpm) : 120, max_duration: loopMaxDuration, variations: loopVariations, output_format: 'wav' }),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
        await processStream(res, genMsgId, 'loops', prompt)
      } catch (err: unknown) {
        setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content: `❌ ${(err as Error).message}` } : m))
      } finally {
        setIsGenerating(false); setActiveGenerations(prev => { const n = new Set(prev); n.delete(genMsgId); return n }); refreshCredits()
      }
      return
    }
  }, [input, token, selectedType, isInstrumental, customTitle, customLyrics, genre, bpm, songDuration, language, generateCoverArt, uploadedFileUrl, effectDuration, loopMaxDuration, loopVariations, baseUrl, activeGenerations.size, refreshCredits])

  // ─── File-based feature processing (stems, extract, boost, v2a) ─
  const processFileFeature = useCallback(async () => {
    if (!uploadedFileUrl || !token) return
    const genMsgId = (Date.now() + 1).toString()
    const labels: Record<string, string> = { stems: '✂️ Splitting stems...', extract: '🎯 Extracting stem...', 'audio-boost': '🔊 Boosting audio...', 'video-to-audio': '🎬 Generating synced audio...' }
    const userLabels: Record<string, string> = { stems: `✂️ Split stems: "${uploadedFileName}"`, extract: `🎯 Extract ${extractStem}: "${uploadedFileName}"`, 'audio-boost': `🔊 Boost: "${uploadedFileName}"`, 'video-to-audio': `🎬 Video to Audio: "${input}"` }

    const userMsg: Message = { id: Date.now().toString(), type: 'user', content: userLabels[selectedType] || selectedType, timestamp: new Date() }
    const genMsg: Message = { id: genMsgId, type: 'generation', content: labels[selectedType] || 'Processing...', generationType: selectedType, isGenerating: true, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg, genMsg])
    setActiveGenerations(prev => new Set(prev).add(genMsgId))
    setIsGenerating(true)

    const payload: Record<string, unknown> = { type: selectedType }
    if (selectedType === 'stems') {
      payload.audioUrl = uploadedFileUrl; payload.trackTitle = customTitle || uploadedFileName; payload.output_format = 'wav'
    } else if (selectedType === 'extract') {
      payload.audioUrl = uploadedFileUrl; payload.stem = extractStem; payload.trackTitle = customTitle || `${extractStem} extract`; payload.output_format = 'wav'
    } else if (selectedType === 'audio-boost') {
      payload.audioUrl = uploadedFileUrl; payload.trackTitle = customTitle || uploadedFileName
      payload.bass_boost = bassBoost; payload.treble_boost = trebleBoost; payload.volume_boost = volumeBoost
      payload.normalize = normalizeAudio; payload.noise_reduction = noiseReduction
      payload.output_format = boostOutputFormat; payload.bitrate = boostBitrate
    } else if (selectedType === 'video-to-audio') {
      payload.videoUrl = uploadedFileUrl; payload.prompt = input; payload.quality = v2aQuality
    }

    try {
      const res = await fetch(`${baseUrl}/api/plugin/generate`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
      await processStream(res, genMsgId, selectedType, customTitle || uploadedFileName || selectedType)
    } catch (err: unknown) {
      setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content: `❌ ${(err as Error).message}` } : m))
    } finally {
      setIsGenerating(false); clearUpload(); setInput('')
      setActiveGenerations(prev => { const n = new Set(prev); n.delete(genMsgId); return n }); refreshCredits()
    }
  }, [uploadedFileUrl, uploadedFileName, token, selectedType, customTitle, extractStem, bassBoost, trebleBoost, volumeBoost, normalizeAudio, noiseReduction, boostOutputFormat, boostBitrate, v2aQuality, input, baseUrl, refreshCredits])

  // ─── NDJSON stream processor ──────────────────────────────
  const processStream = async (res: Response, genMsgId: string, genType: string, title: string) => {
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
            setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, content: `⚡ Processing...` } : m))
          }
          if (msg.type === 'result') {
            if (msg.success) {
              const result = { audioUrl: msg.audioUrl, imageUrl: msg.imageUrl, url: msg.audioUrl || msg.videoUrl, title: msg.title || title, prompt: msg.prompt, lyrics: msg.lyrics }
              const stems = msg.stems || undefined
              const content = genType === 'music' ? '✅ Track generated!' : genType === 'image' ? '✅ Image generated!' : genType === 'effects' ? '✅ Effects generated!' : genType === 'stems' ? `✅ Stems separated!` : genType === 'loops' ? '✅ Loops generated!' : '✅ Complete!'

              setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content, result, stems, generationType: genType } : m))

              // Save to jobs library
              const job: GenerationJob = { id: msg.jobId || genMsgId, type: genType, status: 'completed', title: msg.title || title, result: msg, createdAt: Date.now() }
              setJobs(prev => [job, ...prev])

              // JUCE bridge + local save
              if (msg.audioUrl) {
                const fname = `${(msg.title || title).substring(0, 60).replace(/[<>:"/\\|?*]/g, '-')}.wav`
                sendToPlugin('import_audio', { url: msg.audioUrl, title: msg.title || title, type: genType, format: 'wav' })
                saveFileLocally(msg.audioUrl, fname, genType)
              }
              if (msg.stems) {
                sendToPlugin('import_stems', { stems: msg.stems, title, format: 'wav' })
                for (const [sn, su] of Object.entries(msg.stems as Record<string, string>)) {
                  saveFileLocally(su, `${title.substring(0, 40)}-${sn}.wav`, 'stems')
                }
              }
              if (msg.imageUrl) sendToPlugin('cover_art', { url: msg.imageUrl })
              if (msg.creditsRemaining !== undefined) setCredits(prev => prev ? { ...prev, credits: msg.creditsRemaining } : prev)
            } else {
              setMessages(prev => prev.map(m => m.id === genMsgId ? { ...m, isGenerating: false, content: `❌ ${msg.error || 'Failed'}` } : m))
              const job: GenerationJob = { id: msg.jobId || genMsgId, type: genType, status: 'failed', title, error: msg.error, createdAt: Date.now() }
              setJobs(prev => [job, ...prev])
            }
          }
        } catch {}
      }
    }
  }

  // ─── Download helper ──────────────────────────────────────
  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url); const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
      URL.revokeObjectURL(a.href)
    } catch { window.open(url, '_blank') }
  }

  // ═══════════════════════════════════════════════════════════
  // LOGIN SCREEN (unchanged)
  // ═══════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center mb-4">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-cyan-400"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-sm font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed">Connect</button>
            {authError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 text-center">{authError}</div>}
            <p className="text-xs text-gray-600 text-center">Generate a token at <a href="https://444radio.co.in/settings" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">Settings → Plugin</a></p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN UI — Carbon copy of Create Page layout
  // ═══════════════════════════════════════════════════════════
  return (
    <div className={`min-h-screen bg-black text-white flex flex-col transition-all duration-300 ${showFeaturesSidebar ? 'pl-96' : ''}`}>
      <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileSelect} />

      {/* ═══ FEATURES SIDEBAR — Carbon copy of FeaturesSidebar.tsx ═══ */}
      {showFeaturesSidebar && (
        <>
          {/* Mobile backdrop */}
          <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowFeaturesSidebar(false)} />

          <div className="fixed inset-0 md:inset-auto md:left-0 md:top-0 md:h-screen md:w-96 bg-black/95 backdrop-blur-2xl md:border-r md:border-white/10 z-50 md:z-40 flex flex-col animate-slideInLeft">
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-20 border-b border-white/10">
              <div className="flex items-center gap-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-cyan-400"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>
                <span className="text-white font-bold text-lg">Features</span>
              </div>
              <button onClick={() => setShowFeaturesSidebar(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={18} className="text-gray-400" /></button>
            </div>

            {/* Credits */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <Zap size={16} className="text-cyan-400" />
                <span className="text-white font-bold text-sm">{isLoadingCredits ? '...' : credits?.credits} credits</span>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="px-5 py-3 border-b border-white/10">
              <div className="flex gap-2">
                <button onClick={() => setIsInstrumental(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${!isInstrumental ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                  Vocal
                </button>
                <button onClick={() => setIsInstrumental(true)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${isInstrumental ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" x2="8" y1="4" y2="14"/><line x1="16" x2="16" y1="4" y2="14"/><line x1="12" x2="12" y1="4" y2="14"/></svg>
                  Inst
                </button>
              </div>
            </div>

            {/* Prompt Input in Sidebar */}
            <div className="px-5 py-4 border-b border-white/10">
              <div className="relative">
                <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Describe your music..." rows={5}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }} />
                <div className="flex items-center justify-between mt-2">
                  <div className="w-6" />
                  <button onClick={() => handleGenerate()} disabled={isGenerating || !input.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                    <Send size={12} /> Generate
                  </button>
                </div>
              </div>
            </div>

            {/* Ideas & Tags Panel */}
            {showIdeas && (
              <div className="px-4 py-4 border-b border-white/10 max-h-[40vh] overflow-y-auto scrollbar-thin">
                {ideasView === 'tags' && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" /></svg>
                        <span className="text-sm font-bold text-white">Quick Tags</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIdeasView('type')} className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 hover:text-purple-200 transition-all hover:scale-105 shadow-lg shadow-purple-500/20">✨ IDEAS</button>
                        <button onClick={() => setShowIdeas(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => addTag(tag)} className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">{tag}</button>
                      ))}
                    </div>
                  </>
                )}
                {ideasView === 'type' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">✨ AI Prompt Ideas</h3>
                      <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    <p className="text-xs text-gray-400 text-center">What would you like to create?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setPromptType('song'); setIdeasView('genre') }} className="group p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-400/40 hover:border-purple-400/60 rounded-2xl transition-all hover:scale-105 shadow-lg hover:shadow-purple-500/30">
                        <div className="text-3xl mb-2">🎤</div><div className="text-sm font-bold text-white mb-1">Song</div><div className="text-[10px] text-gray-400">With vocals & lyrics</div>
                      </button>
                      <button onClick={() => { setPromptType('beat'); setIdeasView('genre') }} className="group p-5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border-2 border-cyan-400/40 hover:border-cyan-400/60 rounded-2xl transition-all hover:scale-105 shadow-lg hover:shadow-cyan-500/30">
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
                      <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center">Choose a style for your {promptType}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {IDEA_GENRES.map(g => (
                        <button key={g} onClick={() => { setIdeasView('generating'); generateIdea(g); setTimeout(() => setIdeasView('tags'), 3000) }}
                          className="px-2 py-2 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">{g}</button>
                      ))}
                    </div>
                  </div>
                )}
                {ideasView === 'generating' && (
                  <div className="space-y-4 text-center py-6">
                    <div className="relative"><div className="w-12 h-12 mx-auto border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div><div className="absolute inset-0 flex items-center justify-center"><span className="text-xl">🎨</span></div></div>
                    <div><h3 className="text-base font-bold text-white mb-1">Creating Amazing Prompt...</h3><p className="text-xs text-gray-400">AI is crafting the perfect description</p></div>
                  </div>
                )}
              </div>
            )}

            {/* Feature Buttons */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <button onClick={() => { setShowIdeas(!showIdeas); setIdeasView('tags') }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group mb-3 ${showIdeas ? 'bg-gradient-to-r from-yellow-600/30 to-amber-400/20 border-yellow-400 text-yellow-300' : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50'}`}>
                <div className={`p-2 rounded-lg ${showIdeas ? 'bg-white/10' : 'bg-white/5'}`}><Lightbulb size={18} /></div>
                <div className="flex-1 text-left"><div className="text-sm font-semibold">Ideas & Tags</div><div className="text-[10px] text-gray-500">AI prompts & quick tags</div></div>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">AI</span>
              </button>

              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 px-1">Creation Tools</p>
              <div className="space-y-2">
                {ALL_FEATURES.map(f => {
                  const Icon = f.icon
                  const isActive = selectedType === f.id
                  const colorClass: Record<string, string> = {
                    cyan: isActive ? 'bg-gradient-to-r from-cyan-600/30 to-cyan-400/20 border-cyan-400 text-cyan-300' : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50',
                    purple: isActive ? 'bg-gradient-to-r from-purple-600/30 to-pink-500/20 border-purple-400 text-purple-300' : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50',
                    orange: isActive ? 'bg-gradient-to-r from-orange-600/30 to-red-500/20 border-orange-400 text-orange-300' : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400/50',
                  }
                  return (
                    <button key={f.id} onClick={() => { setSelectedType(f.id); if (f.needsFile && !uploadedFileUrl) fileInputRef.current?.click() }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${colorClass[f.color]}`}>
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-white/10' : 'bg-white/5'}`}><Icon size={18} /></div>
                      <div className="flex-1 text-left"><div className="text-sm font-semibold">{f.label}</div><div className="text-[10px] text-gray-500">{f.desc}</div></div>
                      <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">-{f.cost}</span>
                    </button>
                  )
                })}
              </div>

              {/* Utilities */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 px-1">
                  <button onClick={handleClearChat} className="p-2.5 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-400/50 transition-all" title="New Chat"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ CHAT AREA — Glassmorphism, carbon copy ═══ */}
      <div className="chat-scroll-container flex-1 overflow-y-auto px-3 sm:px-4 md:px-8 lg:px-16 xl:px-24 py-6 pb-40 w-full scrollbar-thin scroll-smooth">
        <div className="relative p-4 sm:p-6 md:p-8 rounded-3xl backdrop-blur-sm bg-white/[0.01] border border-white/10 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-cyan-500/5 rounded-3xl pointer-events-none"></div>
          <div className="relative space-y-3 max-w-6xl mx-auto">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] md:max-w-2xl ${message.type === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                  {/* Text bubble */}
                  {message.content && (
                    <div className={`${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block px-4 py-2.5 rounded-2xl backdrop-blur-xl ${message.type === 'user'
                        ? 'bg-gradient-to-br from-cyan-500/15 via-cyan-600/10 to-blue-500/15 border border-cyan-400/40 shadow-lg shadow-cyan-500/10'
                        : 'bg-gradient-to-br from-white/8 to-white/4 border border-white/20 shadow-lg shadow-black/20'}`}>
                        <p className={`text-sm leading-relaxed break-words font-light ${message.type === 'user' ? 'text-cyan-100' : 'text-gray-200'}`}>{message.content}</p>
                      </div>
                      <p className="text-[10px] text-gray-500/80 mt-1.5 font-mono">{message.timestamp.toLocaleTimeString()}</p>
                    </div>
                  )}

                  {/* Music Result */}
                  {message.result?.audioUrl && message.generationType !== 'video' && (
                    <div className="backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/60 via-black/50 to-black/60 border-2 border-cyan-500/30 rounded-3xl overflow-hidden group hover:border-cyan-400/50 transition-all">
                      <div className="flex items-center gap-3 p-4 border-b border-white/10">
                        <button onClick={() => togglePlay(message.result!.audioUrl!)}
                          className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 hover:from-cyan-700 hover:via-cyan-600 hover:to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30 transition-all active:scale-95 hover:scale-105">
                          {playingUrl === message.result.audioUrl ? <Pause size={20} className="text-black" /> : <Play size={20} className="text-black ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0"><h4 className="text-lg font-bold text-white truncate">{message.result.title}</h4></div>
                      </div>
                      {message.result.lyrics && (
                        <details className="border-t border-white/10">
                          <summary className="px-6 py-3 text-sm text-cyan-400 cursor-pointer hover:bg-white/5 transition-colors font-medium">📝 View Lyrics</summary>
                          <pre className="px-6 pb-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{message.result.lyrics}</pre>
                        </details>
                      )}
                      <div className="flex border-t border-white/10">
                        <button onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.wav`)}
                          className="flex-1 px-4 py-4 hover:bg-white/10 text-sm font-medium text-cyan-400 flex items-center justify-center gap-2 transition-colors border-r border-white/5">
                          <Download size={18} /> WAV
                        </button>
                        <button onClick={() => { setSelectedType('stems'); setUploadedFileUrl(message.result!.audioUrl!); setUploadedFileName(message.result!.title || 'track'); setCustomTitle(message.result!.title || ''); setShowFeaturesSidebar(true) }}
                          className="flex-1 px-4 py-4 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 text-sm font-medium text-purple-400 flex items-center justify-center gap-2 transition-all">
                          <Sparkles size={18} /> Split Stems <span className="text-xs text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded-full">5</span>
                        </button>
                      </div>
                      <button onClick={() => { setSelectedType('audio-boost'); setUploadedFileUrl(message.result!.audioUrl!); setUploadedFileName(message.result!.title || 'track'); setCustomTitle(message.result!.title || ''); setShowFeaturesSidebar(true) }}
                        className="w-full px-6 py-4 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-red-500/10 border-t border-white/10 text-sm font-medium text-orange-400 flex items-center justify-center gap-2 transition-all">
                        <Zap size={18} /> Boost Audio <span className="text-xs text-orange-400/60 bg-orange-500/10 px-2 py-0.5 rounded-full">1</span>
                      </button>
                    </div>
                  )}

                  {/* Image Result */}
                  {message.result?.imageUrl && (
                    <div className="backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/60 via-black/50 to-black/60 border-2 border-cyan-500/30 rounded-2xl overflow-hidden group hover:border-cyan-400/50 transition-all max-w-xs mx-auto hover:scale-105 cursor-pointer">
                      <div className="relative" onClick={() => window.open(message.result!.imageUrl!, '_blank')}>
                        <img src={message.result.imageUrl} alt={message.result.title} className="w-full h-auto aspect-square object-cover" />
                      </div>
                      <div className="p-3 border-t border-white/10"><h4 className="text-sm font-bold text-white mb-0.5 line-clamp-1">{message.result.title}</h4></div>
                      <div className="flex border-t border-white/10">
                        <button onClick={() => handleDownload(message.result!.imageUrl!, `${message.result!.title}.webp`)}
                          className="flex-1 px-3 py-2 hover:bg-white/10 text-xs font-medium text-cyan-400 flex items-center justify-center gap-1.5 transition-colors"><Download size={14} /> Save</button>
                      </div>
                    </div>
                  )}

                  {/* Stems Result — Dynamic display matching create page exactly */}
                  {message.stems && Object.keys(message.stems).length > 0 && (
                    <div className="space-y-3 max-w-md mx-auto">
                      {Object.entries(message.stems).filter(([, url]) => url && typeof url === 'string' && url.length > 0).map(([key, url]) => {
                        const def = getStemDisplay(key)
                        return (
                          <div key={key} className={`backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/50 via-black/50 to-black/60 border-2 ${def.border} rounded-2xl overflow-hidden ${def.hover} transition-all`}>
                            <div className="p-4">
                              <div className="flex items-center gap-3">
                                <button onClick={() => togglePlay(url)}
                                  className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${def.gradient} flex items-center justify-center hover:scale-110 transition-transform`}>
                                  {playingUrl === url ? <Pause size={20} className="text-white" /> : <Play size={20} className="text-white ml-0.5" />}
                                </button>
                                <div className="flex-1"><h4 className="text-sm font-bold text-white">{def.title}</h4><p className="text-xs text-gray-400">{def.description}</p></div>
                                <button onClick={() => { setSelectedType('audio-boost'); setUploadedFileUrl(url); setUploadedFileName(def.title); setCustomTitle(def.title); setShowFeaturesSidebar(true) }}
                                  className="p-2 bg-orange-500/20 rounded-lg hover:bg-orange-500/40 transition-colors border border-orange-500/30" title="Boost this stem"><Zap size={14} className="text-orange-400" /></button>
                                <button onClick={() => handleDownload(url, `444_${key}.wav`)} className={`p-2.5 ${def.hoverBg} rounded-lg transition-colors`}><Download size={18} className={def.text} /></button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Loading */}
                  {message.isGenerating && (
                    <div className="flex items-center gap-2 px-4 py-3 backdrop-blur-xl bg-cyan-500/10 border border-cyan-400/20 rounded-2xl">
                      <Loader2 className="animate-spin text-cyan-400" size={16} />
                      <span className="text-xs text-cyan-300 flex-1">Generating...</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM DOCK — Carbon copy of Create Page ═══ */}
      {!showFeaturesSidebar && (
        <div className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-4 md:pb-8 z-20 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 transition-all duration-300 ease-out">
          <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">

            {/* Icon Row Above Prompt */}
            <div className="flex items-center gap-2 sm:gap-3 mb-3 md:mb-4 overflow-x-auto no-scrollbar px-1 sm:justify-center">
              {showAdvancedButtons && (
                <button onClick={() => setSelectedType('music')}
                  className={`flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 ${selectedType === 'music' ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/50 scale-110' : 'bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'}`} title="Generate Music">
                  <Music size={18} className={`${selectedType === 'music' ? 'text-black' : 'text-cyan-400'} drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]`} />
                  {selectedType === 'music' && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black rounded-full"></div>}
                </button>
              )}
              {showAdvancedButtons && (
                <button onClick={() => setSelectedType('effects')}
                  className={`flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 ${selectedType === 'effects' ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400 shadow-lg shadow-purple-500/50 scale-110' : 'bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 hover:border-purple-400/60 hover:scale-105'}`} title="Sound Effects">
                  <Sparkles size={18} className={`${selectedType === 'effects' ? 'text-black' : 'text-purple-400'} drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]`} />
                </button>
              )}
              {showAdvancedButtons && (
                <button onClick={() => setSelectedType('loops')}
                  className="flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105" title="Loops">
                  <Repeat size={18} className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                </button>
              )}
              {showAdvancedButtons && (
                <button onClick={() => setSelectedType('image')}
                  className={`flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 ${selectedType === 'image' ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/50 scale-110' : 'bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'}`} title="Cover Art">
                  <ImageIcon size={18} className={`${selectedType === 'image' ? 'text-black' : 'text-cyan-400'} drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]`} />
                  {selectedType === 'image' && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black rounded-full"></div>}
                </button>
              )}
              {showAdvancedButtons && <div className="flex-shrink-0 w-px h-8 bg-cyan-500/30"></div>}
              {showAdvancedButtons && selectedType === 'music' && !isInstrumental && (
                <button onClick={() => setShowLyricsModal(true)}
                  className={`flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 ${customTitle || genre || customLyrics || bpm ? 'bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 border-2 border-cyan-400 scale-105' : 'bg-black/40 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'}`} title="Lyrics & Settings">
                  <Edit3 size={18} className={`${customTitle || genre || customLyrics || bpm ? 'text-cyan-300' : 'text-cyan-400'} drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]`} />
                </button>
              )}
              {showAdvancedButtons && (
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 hover:border-purple-400/60 hover:scale-105" title="Upload Audio/Video">
                  <Upload size={18} className="text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
                </button>
              )}
              {showAdvancedButtons && (
                <button onClick={handleClearChat}
                  className="flex-shrink-0 group relative p-2.5 rounded-2xl transition-all duration-300 bg-black/40 backdrop-blur-xl border-2 border-green-500/30 hover:border-green-400/60 hover:scale-105" title="New Chat">
                  <Plus size={18} className="text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.9)]" />
                </button>
              )}
              {/* Credits Display */}
              <div className="flex-shrink-0 flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-2.5 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl">
                <Zap size={14} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                <span className="text-xs md:text-sm font-bold text-white">{isLoadingCredits ? '...' : credits?.credits}</span>
                <span className="hidden sm:inline text-xs text-cyan-400/60 font-mono">
                  {selectedType === 'music' ? '(-2)' : selectedType === 'image' ? '(-1)' : selectedType === 'effects' ? '(-2)' : ''}
                </span>
              </div>
            </div>

            {/* Instrumental mode info */}
            {isInstrumental && selectedType === 'music' && (
              <div className="px-4 md:px-0 mb-2">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg backdrop-blur-sm">
                  <p className="text-xs text-purple-300/80 text-center">💰 <span className="font-bold">2 credits</span></p>
                </div>
              </div>
            )}

            {/* Upload indicator */}
            {uploadedFileUrl && (
              <div className="flex items-center gap-2 mb-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <FileAudio size={14} className="text-cyan-400" />
                <span className="text-xs text-white truncate flex-1">{uploadedFileName}</span>
                <button onClick={clearUpload} className="p-0.5 hover:bg-white/10 rounded"><X size={12} className="text-gray-400" /></button>
              </div>
            )}

            {/* Main Prompt Box */}
            <div className="group relative active:scale-95 md:hover:scale-105 transition-transform duration-200">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 blur-xl opacity-30 group-hover:opacity-70 transition-opacity duration-300 hidden md:block"></div>
              <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/60 md:bg-black/20 backdrop-blur-sm md:backdrop-blur-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-active:border-cyan-400/60 md:group-hover:border-cyan-400/60 transition-colors duration-200 shadow-lg md:shadow-2xl">
                
                {/* Plus toggle */}
                <button onClick={() => setShowAdvancedButtons(!showAdvancedButtons)}
                  className={`relative flex-shrink-0 p-2.5 rounded-full transition-all duration-300 ${showAdvancedButtons ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50 scale-110' : 'bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 hover:border-cyan-400 hover:scale-110'}`}>
                  <PlusCircle size={16} className={`${showAdvancedButtons ? 'text-black rotate-45' : 'text-cyan-400'} transition-transform duration-300`} />
                </button>

                {/* Instrumental toggle */}
                {selectedType === 'music' && (
                  <button onClick={() => setIsInstrumental(!isInstrumental)}
                    className={`relative flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${isInstrumental ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50' : 'bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 hover:border-purple-400'}`}>
                    INST
                  </button>
                )}

                {/* Input */}
                <div className="flex-1 text-center md:text-left">
                  <input type="text" value={input} onChange={e => setInput(e.target.value)}
                    onKeyPress={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
                    placeholder={selectedType === 'music' ? 'Describe your sound...' : selectedType === 'image' ? 'Describe your cover art...' : selectedType === 'effects' ? 'Describe sound effects...' : selectedType === 'loops' ? 'Describe the loop...' : 'Describe what you want...'}
                    className="w-full bg-transparent text-sm md:text-lg font-light text-gray-200 placeholder-gray-400/60 tracking-wide focus:outline-none" />
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className="text-xs text-cyan-400/60 font-mono hidden md:block">
                      {activeGenerations.size > 0 ? `Creating (${activeGenerations.size} active)...` : 'Press Enter to create'}
                    </div>
                    <div className={`text-xs font-mono ${input.length < MIN_PROMPT_LENGTH ? 'text-red-400' : input.length > MAX_PROMPT_LENGTH ? 'text-red-400' : input.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-yellow-400' : 'text-gray-500'}`}>{input.length}/{MAX_PROMPT_LENGTH}</div>
                  </div>
                </div>

                {/* Prompt suggestions lightbulb */}
                {selectedType === 'music' && (
                  <div className="relative">
                    <button onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
                      className={`p-2.5 rounded-xl transition-all duration-300 ${showPromptSuggestions ? 'bg-yellow-500/20 border-2 border-yellow-400/60 shadow-lg shadow-yellow-500/30' : 'bg-yellow-500/10 border-2 border-yellow-500/30 hover:bg-yellow-500/20 hover:border-yellow-400/50'}`}>
                      <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" /></svg>
                    </button>
                    {showPromptSuggestions && (
                      <>
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setShowPromptSuggestions(false)} />
                        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 w-[calc(100vw-2rem)] max-w-md bg-black/95 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 p-4 z-50 max-h-[55vh] overflow-hidden flex flex-col">
                          {!showIdeasFlow ? (
                            <>
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2"><svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" /></svg><span className="text-sm font-bold text-white">Quick Tags</span></div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setShowIdeasFlow(true)} className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 transition-all hover:scale-105 shadow-lg shadow-purple-500/20">✨ IDEAS</button>
                                  <button onClick={() => setShowPromptSuggestions(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 overflow-y-auto scrollbar-thin pr-2 flex-1">
                                {QUICK_TAGS.map(tag => (
                                  <button key={tag} onClick={() => addTag(tag)} className="px-3.5 py-2 bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 hover:from-cyan-500/30 hover:to-cyan-500/40 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-sm font-medium text-cyan-200 hover:text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30">{tag}</button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              {ideasStep === 'type' && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xl font-bold text-white">✨ AI Prompt Ideas</h3>
                                    <button onClick={() => { setShowIdeasFlow(false); setIdeasStep('type') }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                                  </div>
                                  <p className="text-sm text-gray-400 text-center">What would you like to create?</p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => { setPromptType('song'); setIdeasStep('genre') }} className="group p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400/40 rounded-2xl transition-all hover:scale-105 shadow-lg">
                                      <div className="text-4xl mb-3">🎤</div><div className="text-lg font-bold text-white mb-1">Song</div><div className="text-xs text-gray-400">With vocals & lyrics</div>
                                    </button>
                                    <button onClick={() => { setPromptType('beat'); setIsInstrumental(true); setIdeasStep('genre') }} className="group p-6 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/40 rounded-2xl transition-all hover:scale-105 shadow-lg">
                                      <div className="text-4xl mb-3">🎹</div><div className="text-lg font-bold text-white mb-1">Beat</div><div className="text-xs text-gray-400">Instrumental only</div>
                                    </button>
                                  </div>
                                </div>
                              )}
                              {ideasStep === 'genre' && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between"><button onClick={() => setIdeasStep('type')} className="text-sm text-cyan-400 flex items-center gap-1">← Back</button><h3 className="text-lg font-bold text-white">🎵 Select Genre</h3><button onClick={() => { setShowIdeasFlow(false); setIdeasStep('type') }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button></div>
                                  <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto scrollbar-thin pr-2">
                                    {IDEA_GENRES.map(g => (
                                      <button key={g} onClick={() => generateIdea(g)} className="px-3 py-2.5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 border border-cyan-500/30 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">{g}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Send button */}
                <button onClick={() => handleGenerate()} disabled={!input.trim() && !uploadedFileUrl}
                  className="relative flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 hover:from-cyan-700 hover:via-cyan-600 hover:to-cyan-500 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/50 active:scale-95">
                  {activeGenerations.size > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">{activeGenerations.size}</div>}
                  {activeGenerations.size > 0 ? <Loader2 className="text-black animate-spin" size={20} /> : <Send className="text-black ml-0.5" size={20} />}
                </button>
              </div>
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-2 mt-2 text-xs md:text-sm">
              <span className="text-cyan-400/60 font-mono tracking-wider">
                {activeGenerations.size > 0 ? `⚡ ${activeGenerations.size} generation${activeGenerations.size > 1 ? 's' : ''} in progress • You can queue more`
                  : `✨ ${selectedType === 'music' ? 'Create amazing tracks' : selectedType === 'image' ? 'Generate cover art' : selectedType === 'effects' ? 'Generate Text to SFX' : selectedType === 'loops' ? 'Generate loops' : 'Process audio'}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LYRICS & SETTINGS MODAL ═══ */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowLyricsModal(false)} />
          <div className="relative w-full max-w-md max-h-[80vh] bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><Edit3 size={18} className="text-cyan-400" /> Lyrics & Settings</h3>
              <button onClick={() => setShowLyricsModal(false)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {!isInstrumental && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-red-400 uppercase tracking-wide">Lyrics *</label>
                    <button onClick={async () => {
                      if (!input?.trim()) { alert('Enter a prompt first!'); return }
                      if (isGeneratingAtomLyrics) return
                      setIsGeneratingAtomLyrics(true)
                      try {
                        const res = await fetch('/api/generate/atom-lyrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: input }) })
                        const d = await res.json()
                        if (d.success && d.lyrics) setCustomLyrics(d.lyrics)
                        else alert('Failed to generate lyrics')
                      } catch { alert('Failed to generate. Try again.') }
                      finally { setIsGeneratingAtomLyrics(false) }
                    }} disabled={isGeneratingAtomLyrics} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                      {isGeneratingAtomLyrics ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {isGeneratingAtomLyrics ? 'Generating...' : 'Create with Atom'}
                    </button>
                  </div>
                  <textarea value={customLyrics} onChange={e => setCustomLyrics(e.target.value)} placeholder="Add lyrics or leave empty for AI auto-fill..." rows={8}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50" />
                </div>
              )}
              <div className="space-y-1.5">
                <label className={`text-xs font-semibold uppercase tracking-wide ${showTitleError ? 'text-red-400' : 'text-cyan-400'}`}>Title {showTitleError && '(3-100 chars)'}</label>
                <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Leave empty for AI auto-fill..."
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none ${showTitleError ? 'border-red-500' : 'border-white/20 focus:border-cyan-500/50'}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Genre</label>
                  <select value={genre} onChange={e => setGenre(e.target.value)} className="w-full bg-gray-900 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="">Auto-detect</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">BPM</label>
                  <input type="number" value={bpm} onChange={e => setBpm(e.target.value)} placeholder="Auto" min={60} max={200}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Duration</label>
                  <select value={songDuration} onChange={e => setSongDuration(e.target.value as any)} className="w-full bg-gray-900 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50">
                    <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-900 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50">
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={generateCoverArt} onChange={e => setGenerateCoverArt(e.target.checked)} className="w-4 h-4 rounded accent-cyan-500" />
                <span className="text-sm text-gray-400">Generate cover art (+1 cr)</span>
              </label>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl px-4 py-2 text-xs text-cyan-400">⚡ Output: WAV format (DAW-ready)</div>
            </div>
          </div>
        </div>
      )}

      {/* Features sidebar toggle — when sidebar closed, show floating button */}
      {!showFeaturesSidebar && (
        <button onClick={() => setShowFeaturesSidebar(true)}
          className="fixed top-4 left-4 z-30 p-3 bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl transition-all hover:scale-110 shadow-lg shadow-cyan-500/20" title="Open Features">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-cyan-400"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/></svg>
        </button>
      )}

      <style jsx>{`
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slideInLeft { animation: slideInLeft 0.3s ease-out; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  )
}
