'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import {
  Music, Image as ImageIcon, Send, Loader2, Download, Play, Pause,
  Sparkles, Zap, X, Rocket, PlusCircle, Globe, Mic, MicOff,
  Edit3, Dices, Upload, RotateCcw, Repeat, Plus, Square, FileText,
  Layers, Film, Scissors, Volume2, ChevronLeft, ChevronDown, ChevronUp, Lightbulb, Settings,
  RotateCw, Save, RefreshCw, AlertCircle, Compass, ExternalLink, Home,
  BookOpen, ArrowDownToLine, Pin, PinOff
} from 'lucide-react'
import { getLanguageHook, getSamplePromptsForLanguage, getLyricsStructureForLanguage } from '@/lib/language-hooks'
import PluginAudioPlayer from '@/app/components/PluginAudioPlayer'
import PluginGenerationQueue from '@/app/components/PluginGenerationQueue'
import PluginPostGenModal from '@/app/components/PluginPostGenModal'
import SplitStemsModal from '@/app/components/SplitStemsModal'
import VisualizerModal from '@/app/components/VisualizerModal'
import type { StemType, StemAdvancedParams } from '@/app/components/SplitStemsModal'

// ─── Types (mirrored from create page) ──────────────────────────
type MessageType = 'user' | 'assistant' | 'generation'
type GenerationType = 'music' | 'image' | 'video' | 'effects'

interface Message {
  id: string
  type: MessageType
  content: string
  generationType?: GenerationType | string
  generationId?: string
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
const CHAT_KEY = '444radio_plugin_chat'
const CHAT_ARCHIVES_KEY = '444radio_plugin_chat_archives'
const LIBRARY_KEY = '444radio_plugin_library'
const TOKEN_KEY = '444radio_plugin_token'
const PIN_KEY = '444radio_plugin_pinned'
const SIZE_KEY = '444radio_plugin_size'

// ─── 3 fixed window presets — no free resizing ─────────────────
const WINDOW_PRESETS = [
  { label: 'Portrait', w: 420, h: 660, icon: '▮' },
  { label: 'Square',   w: 540, h: 540, icon: '◼' },
  { label: 'Wide',     w: 720, h: 460, icon: '▬' },
] as const

// Classify current aspect ratio for adaptive layout
type LayoutMode = 'portrait' | 'square' | 'wide'
function getLayoutMode(idx: number): LayoutMode {
  if (idx === 0) return 'portrait'
  if (idx === 2) return 'wide'
  return 'square'
}

// ─── Stem display helper (same as create page) ─────────────────
function getStemDisplay(stemName: string): { label: string; color: string; emoji: string } {
  const n = stemName.toLowerCase()
  if (n.includes('vocal') || n.includes('voice')) return { label: 'Vocals', color: 'text-pink-400', emoji: '🎤' }
  if (n.includes('drum') || n.includes('percussion')) return { label: 'Drums', color: 'text-orange-400', emoji: '🥁' }
  if (n.includes('bass')) return { label: 'Bass', color: 'text-gray-300', emoji: '🎸' }
  if (n.includes('guitar')) return { label: 'Guitar', color: 'text-yellow-400', emoji: '🎸' }
  if (n.includes('piano') || n.includes('keys')) return { label: 'Piano', color: 'text-blue-400', emoji: '🎹' }
  if (n.includes('other') || n.includes('inst')) return { label: 'Other', color: 'text-gray-400', emoji: '🎶' }
  return { label: stemName, color: 'text-gray-400', emoji: '🎵' }
}

// ─── WAV conversion (same as create page) ──────────────────────
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  let pos = 0
  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2 }
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4 }
  setUint32(0x46464952)
  setUint32(length - 8)
  setUint32(0x45564157)
  setUint32(0x20746d66)
  setUint32(16)
  setUint16(1)
  setUint16(buffer.numberOfChannels)
  setUint32(buffer.sampleRate)
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels)
  setUint16(buffer.numberOfChannels * 2)
  setUint16(16)
  setUint32(0x61746164)
  setUint32(length - pos - 4)
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      let sample = buffer.getChannelData(ch)[i]
      sample = Math.max(-1, Math.min(1, sample))
      view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      pos += 2
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// ─── React Error Boundary — catches render crashes in WebView ──
import React from 'react'
class PluginErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: `${error.name}: ${error.message}` }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try { console.error('[plugin] React Error Boundary:', error, info.componentStack) } catch {}
    // Also hide fallback so we can show our own error UI
    try { const fb = document.getElementById('plugin-fallback'); if (fb) fb.style.display = 'none' } catch {}
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:'100vh',background:'#000',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{textAlign:'center',maxWidth:420}}>
            <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
            <h1 style={{fontSize:18,color:'#fff',marginBottom:8}}>Plugin failed to load</h1>
            <p style={{fontSize:12,color:'#888',marginBottom:16}}>{this.state.error}</p>
            <button onClick={() => location.reload()} style={{padding:'8px 24px',background:'#06b6d4',color:'#000',border:'none',borderRadius:8,fontWeight:'bold',cursor:'pointer'}}>
              Reload Plugin
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Quick Tags (same as create page sidebar) ──────────────────
const QUICK_TAGS = [
  'upbeat', 'chill', 'energetic', 'melancholic', 'ambient',
  'electronic', 'acoustic', 'jazz', 'rock', 'hip-hop',
  'heavy bass', 'soft piano', 'guitar solo', 'synthwave',
  'lo-fi beats', 'orchestral', 'dreamy', 'aggressive',
  'trap', 'drill', 'phonk', 'vaporwave', 'future bass',
  'drum & bass', 'dubstep', 'house', 'techno', 'trance',
  'indie', 'folk', 'blues', 'soul', 'funk', 'disco',
  'reggae', 'latin', 'afrobeat', 'k-pop', 'anime',
  'cinematic', 'epic', 'dark', 'bright', 'nostalgic',
  'romantic', 'sad', 'happy', 'mysterious', 'powerful',
  'soft vocals', 'no vocals', 'female vocals', 'male vocals',
  'male & female duet', 'trailer', 'ad', 'commercial',
  'music video', 'hollywood', 'bollywood',
  'synth lead', 'strings', 'brass', 'flute', 'violin'
]

const GENRE_OPTIONS = [
  'electronic', 'hip-hop', 'rock', 'jazz', 'ambient',
  'trap', 'drill', 'phonk', 'house', 'techno',
  'lo-fi beats', 'synthwave', 'indie', 'folk', 'blues',
  'soul', 'funk', 'reggae', 'latin', 'afrobeat',
  'orchestral', 'cinematic', 'acoustic', 'vaporwave', 'k-pop'
]

// ─── Features list (same as FeaturesSidebar) ───────────────────
const FEATURES = [
  { key: 'music', icon: Music, label: 'Music', desc: 'Generate AI music', color: 'cyan', cost: 2 },
  { key: 'effects', icon: Sparkles, label: 'Effects', desc: 'Sound effects', color: 'purple', cost: 2 },
  { key: 'loops', icon: Repeat, label: 'Loops', desc: 'Fixed BPM loops', color: 'cyan', cost: 6 },
  { key: 'image', icon: ImageIcon, label: 'Cover Art', desc: 'AI album artwork', color: 'cyan', cost: 1 },
  { key: 'video-to-audio', icon: Film, label: 'Video to Audio', desc: 'Synced SFX from video', color: 'cyan', cost: 4 },
  { key: 'stems', icon: Scissors, label: 'Split Stems', desc: 'Vocals, drums, bass & more', color: 'purple', cost: 0 },
  { key: 'audio-boost', icon: Volume2, label: 'Audio Boost', desc: 'Mix & master your track', color: 'orange', cost: 1 },
  { key: 'extract', icon: Layers, label: 'Extract', desc: 'Extract audio from video/audio', color: 'cyan', cost: 1 },
  { key: 'autotune', icon: Zap, label: 'Autotune', desc: 'Pitch correct to any key', color: 'purple', cost: 1 },
  { key: 'visualizer', icon: Film, label: 'Visualizer', desc: 'Text/Image to video', color: 'purple', cost: -1 },
  { key: 'lyrics', icon: Edit3, label: 'Lyrics', desc: 'Write & edit lyrics', color: 'cyan', cost: 0, conditionalMusic: true },
  { key: 'upload', icon: Upload, label: 'Upload', desc: 'Upload audio/video', color: 'purple', cost: 0 },
  { key: 'release', icon: Rocket, label: 'Release', desc: 'Publish to feed', color: 'cyan', cost: 0 },
]

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT — wrapped in ErrorBoundary for WebView safety
// ═══════════════════════════════════════════════════════════════
export default function PluginPage() {
  return (
    <PluginErrorBoundary>
      <PluginPageInner />
    </PluginErrorBoundary>
  )
}

function PluginPageInner() {
  // ── Auth ──
  const [token, setToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // ── Layout ──
  const [isMobile, setIsMobile] = useState(false)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('portrait')
  const [showFeaturesSidebar, setShowFeaturesSidebar] = useState(false)
  const [showBottomDock, setShowBottomDock] = useState(true)

  // ── Plugin window pin & resize ──
  const [isPinned, setIsPinned] = useState(() => {
    try { if (typeof window !== 'undefined') return localStorage.getItem(PIN_KEY) === 'true' } catch {}
    return false
  })
  const [windowSizeIdx, setWindowSizeIdx] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(SIZE_KEY)
        const idx = stored ? parseInt(stored, 10) : 0
        return Math.min(idx, 2) // clamp to 3 presets
      }
    } catch {}
    return 0
  })
  const [bridgeToast, setBridgeToast] = useState<string | null>(null)

  // ── Chat ──
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'assistant', content: '👋 Hey! I\'m your AI music studio assistant. What would you like to create today?', timestamp: new Date() }
  ])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Generation state ──
  const [selectedType, setSelectedType] = useState<GenerationType>('music')
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set())
  const [generationQueue, setGenerationQueue] = useState<string[]>([])

  // ── Credits ──
  const [userCredits, setUserCredits] = useState<number | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)

  // ── Prompt validation ──
  const MIN_PROMPT_LENGTH = 10
  const MAX_PROMPT_LENGTH = 300

  // ── Advanced parameters (same as create) ──
  const [customLyrics, setCustomLyrics] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [songDuration, setSongDuration] = useState<'short' | 'medium' | 'long'>('long')
  const [generateCoverArt, setGenerateCoverArt] = useState(false)
  const [isInstrumental, setIsInstrumental] = useState(false)

  // ── ACE-Step params ──
  const [audioLengthInSeconds, setAudioLengthInSeconds] = useState(45)
  const [numInferenceSteps, setNumInferenceSteps] = useState(50)
  const [guidanceScale, setGuidanceScale] = useState(7.0)
  const [denoisingStrength, setDenoisingStrength] = useState(0.8)

  // ── Modal/UI states ──
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [showAdvancedButtons, setShowAdvancedButtons] = useState(false)
  const [showDeletedChatsModal, setShowDeletedChatsModal] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<unknown | null>(null)
  const [isGeneratingAtomLyrics, setIsGeneratingAtomLyrics] = useState(false)
  const [showTitleError, setShowTitleError] = useState(false)

  // ── Prompt Ideas ──
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false)
  const [showIdeasFlow, setShowIdeasFlow] = useState(false)
  const [ideasStep, setIdeasStep] = useState<'type' | 'genre' | 'generating'>('type')
  const [selectedPromptType, setSelectedPromptType] = useState<'song' | 'beat'>('song')
  const [generatingIdea, setGeneratingIdea] = useState(false)

  // ── Sidebar Ideas ──
  const [showSidebarIdeas, setShowSidebarIdeas] = useState(false)
  const [sidebarIdeasView, setSidebarIdeasView] = useState<'tags' | 'type' | 'genre' | 'generating'>('tags')
  const [sidebarPromptType, setSidebarPromptType] = useState<'song' | 'beat'>('song')

  // ── Audio player ──
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playerTrack, setPlayerTrack] = useState<{ id: string; audioUrl: string; title?: string; prompt?: string } | null>(null)

  // ── Stem splitting ──
  const [isSplittingStems, setIsSplittingStems] = useState(false)
  // New: modal-based per-stem splitting
  const [showSplitStemsModal, setShowSplitStemsModal] = useState(false)
  const [splitStemsAudioUrl, setSplitStemsAudioUrl] = useState<string | null>(null)
  const [splitStemsTrackTitle, setSplitStemsTrackTitle] = useState<string>('')
  const [splitStemsMessageId, setSplitStemsMessageId] = useState<string | null>(null)
  const [splitStemsProcessing, setSplitStemsProcessing] = useState<'drums' | 'bass' | 'vocals' | 'guitar' | 'piano' | 'other' | 'all' | null>(null)
  const [splitStemsCompleted, setSplitStemsCompleted] = useState<Record<string, string>>({})
  const [stemPlayingId, setStemPlayingId] = useState<string | null>(null)
  const stemAudioRef = useRef<HTMLAudioElement | null>(null)

  // ── Upload Media Modal (mirrors MediaUploadModal from create page) ──
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showVisualizerModal, setShowVisualizerModal] = useState(false)
  const [uploadMode, setUploadMode] = useState<'video-to-audio' | 'stem-split' | 'audio-boost' | 'extract-video' | 'extract-audio' | 'autotune' | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFilePreview, setUploadFilePreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // Audio Boost settings (mirrors MediaUploadModal)
  const [boostBass, setBoostBass] = useState(0)
  const [boostTreble, setBoostTreble] = useState(0)
  const [boostVolume, setBoostVolume] = useState(2)
  const [boostNormalize, setBoostNormalize] = useState(true)
  const [boostNoiseReduction, setBoostNoiseReduction] = useState(false)
  const [boostFormat, setBoostFormat] = useState('mp3')
  const [boostBitrate, setBoostBitrate] = useState('192k')

  // Extract Audio stem picker
  const [extractStem, setExtractStem] = useState<'vocals' | 'bass' | 'drums' | 'piano' | 'guitar' | 'other'>('vocals')

  // Video-to-Audio settings
  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoHQ, setVideoHQ] = useState(false)

  // Autotune settings — Replicate only accepts naturals + flats (no sharps)
  const MUSICAL_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
  const [autotuneKey, setAutotuneKey] = useState('C')
  const [autotuneScale, setAutotuneScale] = useState<'maj' | 'min'>('maj')

  // File input refs per mode (correct accept types)
  const uploadVideoRef = useRef<HTMLInputElement>(null)
  const uploadAudioRef = useRef<HTMLInputElement>(null)
  const uploadBoostRef = useRef<HTMLInputElement>(null)
  const uploadExtractVideoRef = useRef<HTMLInputElement>(null)
  const uploadExtractAudioRef = useRef<HTMLInputElement>(null)
  const uploadAutotuneRef = useRef<HTMLInputElement>(null)

  // Legacy refs (kept for sidebar triggerFeatureUpload)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [fileUploadType, setFileUploadType] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Release modal ──
  const [showReleaseModal, setShowReleaseModal] = useState(false)

  // ── Effects params ──
  const [showEffectsParams, setShowEffectsParams] = useState(false)
  const [effectsDuration, setEffectsDuration] = useState(5)
  const [effectsGuidance, setEffectsGuidance] = useState(3)
  const [effectsTemperature, setEffectsTemperature] = useState(1)

  // ── Loops params ──
  const [showLoopsParams, setShowLoopsParams] = useState(false)
  const [loopsBpm, setLoopsBpm] = useState(120)
  const [loopsMaxDuration, setLoopsMaxDuration] = useState(8)
  const [loopsVariations, setLoopsVariations] = useState(2)

  // ── Boost params modal (for result card boost button) ──
  const [showBoostParamsFor, setShowBoostParamsFor] = useState<{ audioUrl: string; title: string } | null>(null)

  // ── Post-generation modal ──
  const [showPostGenModal, setShowPostGenModal] = useState(false)
  const [postGenResult, setPostGenResult] = useState<{
    audioUrl: string; imageUrl?: string; title: string; prompt?: string; lyrics?: string; messageId: string
  } | null>(null)

  // ── Chat sync ──
  const [isSyncingChat, setIsSyncingChat] = useState(false)
  const chatSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Abort controllers ──
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const pendingCancelsRef = useRef<Set<string>>(new Set())

  // ═══ DEBUG: Track loading phases for WebView diagnostics ═══
  useEffect(() => {
    try { (window as any)._pluginDebug = { ...(window as any)._pluginDebug, phase: 'react-mounted' } } catch {}
  }, [])

  // ═══ AUTH: Extract token from URL or localStorage ═══
  useEffect(() => {
    try { (window as any)._pluginDebug = { ...(window as any)._pluginDebug, phase: 'token-extraction' } } catch {}
    try {
      const params = new URLSearchParams(window.location.search)
      const urlToken = params.get('token')
      if (urlToken) {
        try { localStorage.setItem(TOKEN_KEY, urlToken) } catch {}
        setToken(urlToken)
      } else {
        let saved: string | null = null
        try { saved = localStorage.getItem(TOKEN_KEY) } catch {}
        if (saved) {
          setToken(saved)
        } else {
          // No token found — stop loading so auth screen shows
          setIsLoadingCredits(false)
        }
      }
    } catch (e) {
      console.warn('[plugin] Token extraction error:', e)
      setIsLoadingCredits(false)
    }
    // Safety timeout: if still loading after 10s, force auth screen
    const timeout = setTimeout(() => {
      setIsLoadingCredits(prev => {
        if (prev) {
          console.warn('[plugin] Loading timeout — showing auth screen')
          setAuthError('Connection timed out. Try again or regenerate your token.')
          return false
        }
        return prev
      })
    }, 10000)
    return () => clearTimeout(timeout)
  }, [])

  // ═══ AUTH: Verify token on mount ═══
  const [authError, setAuthError] = useState<string | null>(null)
  useEffect(() => {
    if (!token) {
      try { (window as any)._pluginDebug = { ...(window as any)._pluginDebug, phase: 'no-token-auth-screen' } } catch {}
      setIsLoadingCredits(false)
      return
    }
    try { (window as any)._pluginDebug = { ...(window as any)._pluginDebug, phase: 'verifying-token' } } catch {}
    setAuthError(null)
    ;(async () => {
      try {
        const res = await fetch('/api/plugin/credits', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setUserCredits(data.credits)
          setIsLoadingCredits(false)
          setIsAuthenticated(true)
          setAuthError(null)
          // Notify JUCE bridge
          try {
            (window as any).__juce__?.postMessage?.('authenticated')
          } catch {}
        } else {
          // Parse error from API for user feedback
          let errorMsg = 'Token rejected'
          try {
            const errData = await res.json()
            errorMsg = errData.error || errorMsg
          } catch {}
          console.warn('[plugin] Auth failed:', res.status, errorMsg)

          // Clear invalid token so user can re-enter
          try { localStorage.removeItem(TOKEN_KEY) } catch {}
          setToken(null)
          setAuthError(errorMsg)
          setIsAuthenticated(false)
          setIsLoadingCredits(false)
        }
      } catch {
        setAuthError('Network error — could not reach server')
        setIsAuthenticated(false)
        setIsLoadingCredits(false)
      }
    })()
  }, [token])

  // ═══ Hide HTML fallback only once React has real content (not during loading) ═══
  useEffect(() => {
    if (!isLoadingCredits) {
      const fb = document.getElementById('plugin-fallback')
      if (fb) fb.style.display = 'none'
    }
  }, [isLoadingCredits])

  // ═══ LAYOUT: detect mobile + set layout from preset ═══
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ═══ FILE DRAG-IN DETECTION: open upload modal when user drags a file into the plugin ═══
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false)
  useEffect(() => {
    let dragCounter = 0
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounter++
      if (e.dataTransfer?.types.includes('Files')) setIsDraggingFileOver(true)
    }
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter--
      if (dragCounter <= 0) { dragCounter = 0; setIsDraggingFileOver(false) }
    }
    const handleDragOver = (e: DragEvent) => { e.preventDefault() }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounter = 0
      setIsDraggingFileOver(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        const ext = file.name.toLowerCase()
        const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma|aiff)$/.test(ext)
        const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|mpeg|mpg|avi|mkv|webm|wmv)$/.test(ext)
        if (isAudio || isVideo) {
          setUploadFile(file)
          setUploadFilePreview(URL.createObjectURL(file))
          setUploadError('')
          // Don't auto-set mode — let user choose what to do with the file
          setUploadMode(null)
          setShowUploadModal(true)
        }
      }
    }
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  // ═══ CHAT: load from localStorage ═══
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Only restore if it has real content (not just the welcome message)
        if (parsed.length > 1) {
          setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })))
        }
      }
    } catch {}
  }, [])

  // ═══ CHAT: save to localStorage ═══
  useEffect(() => {
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages)) } catch {}
  }, [messages])

  // ═══ CHAT: scroll to bottom ═══
  const hasScrolledOnLoad = useRef(false)
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledOnLoad.current) {
      // First load: instant scroll (no animation) after DOM renders
      hasScrolledOnLoad.current = true
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      })
    } else if (hasScrolledOnLoad.current) {
      // Subsequent message changes: smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // ═══ CREDITS: refresh helper ═══
  const refreshCredits = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/plugin/credits', { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setUserCredits(data.credits)
      }
    } catch {}
  }, [token])

  // ═══ NEW CHAT (archive + clear) ═══
  const handleClearChat = () => {
    if (!confirm('Start a new chat? Your current session will be saved to Chat History.')) return
    try {
      const archives = localStorage.getItem(CHAT_ARCHIVES_KEY)
      const list = archives ? JSON.parse(archives) : []
      list.unshift({ id: `chat-${Date.now()}`, messages, archivedAt: new Date(), messageCount: messages.length })
      localStorage.setItem(CHAT_ARCHIVES_KEY, JSON.stringify(list.slice(0, 50)))
    } catch {}
    setMessages([
      { id: '1', type: 'assistant', content: '👋 Hey! I\'m your AI music studio assistant. What would you like to create today?', timestamp: new Date() }
    ])
  }

  // ═══ CANCEL generation ═══
  const handleCancelGeneration = (messageId: string) => {
    const controller = abortControllersRef.current.get(messageId)
    if (controller) { controller.abort(); abortControllersRef.current.delete(messageId) }
    // Mark message cancelled
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, isGenerating: false, content: '⏹ Generation cancelled.' } : msg
    ))
    setActiveGenerations(prev => { const s = new Set(prev); s.delete(messageId); return s })
    setGenerationQueue(prev => prev.filter(id => id !== messageId))
    refreshCredits()
  }

  // ═══ PLAY/PAUSE ═══
  const handlePlayPause = (messageId: string, audioUrl: string, title?: string, prompt?: string) => {
    if (playingId === messageId) {
      // Same track playing → pause (keep player visible)
      setPlayingId(null)
      return
    }
    if (playerTrack?.id === messageId && !playingId) {
      // Same track paused → resume
      setPlayingId(messageId)
      return
    }
    // Different track or no player → open new track
    setPlayerTrack({ id: messageId, audioUrl, title, prompt })
    setPlayingId(messageId)
  }

  // ═══ DAW BRIDGE HELPERS ═══
  const isInDAW = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('host') === 'juce'

  const sendBridgeMessage = (payload: Record<string, unknown>) => {
    try {
      const msg = JSON.stringify(payload)
      ;(window as any).__juce__?.postMessage?.(msg)
      window.location.href = `juce-bridge://${encodeURIComponent(msg)}`
    } catch {}
  }

  // ═══ WINDOW PIN / RESIZE HELPERS ═══
  const showBridgeToast = (msg: string) => {
    setBridgeToast(msg)
    setTimeout(() => setBridgeToast(null), 2000)
  }

  const togglePin = () => {
    const next = !isPinned
    setIsPinned(next)
    localStorage.setItem(PIN_KEY, String(next))
    // Send to JUCE bridge — multiple channel attempts for reliability
    sendBridgeMessage({ action: 'pin_window', pinned: next })
    sendBridgeMessage({ action: 'set_always_on_top', enabled: next })
    // Repeat after brief delay (some hosts need a tick)
    setTimeout(() => sendBridgeMessage({ action: 'pin_window', pinned: next }), 100)
    showBridgeToast(next ? '📌 Window pinned — stays on top' : '📌 Unpinned')
  }

  const applyPreset = (idx: number) => {
    const clamped = Math.min(idx, WINDOW_PRESETS.length - 1)
    setWindowSizeIdx(clamped)
    setLayoutMode(getLayoutMode(clamped))
    localStorage.setItem(SIZE_KEY, String(clamped))
    const p = WINDOW_PRESETS[clamped]
    sendBridgeMessage({ action: 'resize_window', width: p.w, height: p.h, preset: p.label })
    try { window.resizeTo(p.w, p.h) } catch {}
    showBridgeToast(`${p.icon} ${p.label} (${p.w}×${p.h})`)
  }

  // Cycle through presets with a single button tap
  const cyclePreset = () => {
    applyPreset((windowSizeIdx + 1) % WINDOW_PRESETS.length)
  }

  // Send persisted pin/size state to JUCE on mount
  useEffect(() => {
    // Always apply the stored preset on mount (even outside DAW for web preview)
    setLayoutMode(getLayoutMode(windowSizeIdx))
    if (isInDAW) {
      if (isPinned) sendBridgeMessage({ action: 'pin_window', pinned: true })
      const p = WINDOW_PRESETS[Math.min(windowSizeIdx, WINDOW_PRESETS.length - 1)]
      sendBridgeMessage({ action: 'resize_window', width: p.w, height: p.h, preset: p.label })
      try { window.resizeTo(p.w, p.h) } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInDAW])

  const sendToDAW = (url: string, title: string, format: 'mp3' | 'wav' = 'wav') => {
    const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'audio'
    // Send direct R2 URL to C++ — native HTTP, no CORS issues
    sendBridgeMessage({ action: 'import_audio', url, title: safeName, format })
  }

  const sendImageToDAW = (url: string, title: string) => {
    const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'image'
    sendBridgeMessage({ action: 'import_image', url, title: safeName, format: 'png' })
  }

  const sendVideoToDAW = (url: string, title: string) => {
    const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'video'
    sendBridgeMessage({ action: 'import_video', url, title: safeName, format: 'mp4' })
  }

  // ═══ PROXY FETCH — always go through same-domain proxy for CORS safety ═══
  const proxyFetch = async (url: string): Promise<Response> => {
    try {
      const u = new URL(url, window.location.origin)
      if (u.origin === window.location.origin) return await fetch(url)
    } catch {}
    return await fetch(`/api/r2/proxy?url=${encodeURIComponent(url)}`)
  }

  // ═══ Download + Toast — download file to user's machine ═══
  const [dawDownloading, setDawDownloading] = useState<string | null>(null)

  const downloadAndToast = async (sourceUrl: string, title: string, format: 'mp3' | 'wav' = 'wav') => {
    if (dawDownloading) return
    setDawDownloading(`${title}-${format}`)
    try {
      const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'audio'
      const fileName = `${safeName}.${format}`

      showBridgeToast(`⏳ Preparing ${format.toUpperCase()}...`)

      if (format === 'mp3') {
        // MP3: server-side proxy streams with Content-Disposition: attachment
        const proxyUrl = `/api/r2/proxy?url=${encodeURIComponent(sourceUrl)}&filename=${encodeURIComponent(fileName)}`
        const link = document.createElement('a')
        link.href = proxyUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        showBridgeToast(`✅ ${fileName} saved to Downloads`)
      } else {
        // WAV: proxy fetch → decode → PCM WAV → download
        const res = await proxyFetch(sourceUrl)
        if (!res.ok) throw new Error(res.status === 404 ? 'File expired — regenerate it' : `Download failed: ${res.status}`)
        const ab = await res.arrayBuffer()
        if (ab.byteLength < 1000) throw new Error('File too small — may be expired')
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const decoded = await audioCtx.decodeAudioData(ab)
        const wavBlob = audioBufferToWav(decoded)
        const blobUrl = URL.createObjectURL(wavBlob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
        showBridgeToast(`✅ ${fileName} saved — drag from Downloads into DAW timeline`)
      }
    } catch (err: any) {
      console.error('Download error:', err)
      showBridgeToast(`❌ ${err.message || 'Download failed'}`)
    } finally {
      setDawDownloading(null)
    }
  }

  const downloadForDAW = (sourceUrl: string, title: string) => downloadAndToast(sourceUrl, title, 'wav')

  // ═══ WAV EXPORT (download as file, no toast) ═══
  const [wavExporting, setWavExporting] = useState<string | null>(null)
  const exportAsWav = async (sourceUrl: string, filename: string) => {
    if (wavExporting) return
    setWavExporting(filename)
    try {
      const res = await proxyFetch(sourceUrl)
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const ab = await res.arrayBuffer()
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioCtx.decodeAudioData(ab)
      const wavBlob = audioBufferToWav(audioBuffer)
      const wavUrl = URL.createObjectURL(wavBlob)
      const link = document.createElement('a')
      link.href = wavUrl
      link.download = filename.replace(/\.\w+$/, '.wav')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(wavUrl), 5000)
    } catch (err) {
      console.error('WAV export error:', err)
      alert('WAV export failed. Try the MP3 download instead.')
    } finally {
      setWavExporting(null)
    }
  }

  // ═══ DOWNLOAD (save-to-disk flow) ═══
  const handleDownload = async (url: string, filename: string, format: 'mp3' | 'wav' = 'mp3') => {
    try {
      if (format === 'wav') {
        return exportAsWav(url, filename)
      }
      // MP3: server-side proxy with Content-Disposition — no fetch/blob needed
      const proxyUrl = `/api/r2/proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
      const link = document.createElement('a')
      link.href = proxyUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      // Notify bridge
      sendBridgeMessage({ action: 'download_complete', url, title: filename, format })
    } catch (err) {
      console.error('Download error:', err)
      alert('Download failed. Please try again.')
    }
  }

  // ═══ VOICE RECORDING (same as create) ═══
  const startRecording = async () => {
    try {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Speech recognition is not supported in your browser.')
        return
      }
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = selectedLanguage === 'English' ? 'en-US' :
        selectedLanguage === 'Spanish' ? 'es-ES' :
        selectedLanguage === 'French' ? 'fr-FR' :
        selectedLanguage === 'German' ? 'de-DE' :
        selectedLanguage === 'Italian' ? 'it-IT' :
        selectedLanguage === 'Portuguese' ? 'pt-PT' :
        selectedLanguage === 'Russian' ? 'ru-RU' :
        selectedLanguage === 'Japanese' ? 'ja-JP' :
        selectedLanguage === 'Korean' ? 'ko-KR' :
        selectedLanguage === 'Chinese' ? 'zh-CN' : 'en-US'
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) transcript += event.results[i][0].transcript
        }
        if (transcript) setInput(prev => prev + (prev ? ' ' : '') + transcript)
      }
      recognition.onerror = () => setIsRecording(false)
      recognition.onend = () => setIsRecording(false)
      recognition.start()
      setMediaRecorder(recognition)
      setIsRecording(true)
    } catch {
      alert('Could not access microphone.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      try { (mediaRecorder as any).stop() } catch {}
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  // ═══ PROMPT IDEAS (same as create) ═══
  const handleGeneratePromptIdea = async (ideaGenre: string) => {
    setGeneratingIdea(true)
    setIdeasStep('generating')
    setSidebarIdeasView('generating')
    try {
      const response = await fetch('/api/generate/prompt-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ genre: ideaGenre, promptType: selectedPromptType })
      })
      const data = await response.json()
      if (data.success && data.prompt) {
        setInput(data.prompt.slice(0, MAX_PROMPT_LENGTH))
        setShowIdeasFlow(false)
        setShowPromptSuggestions(false)
        setIdeasStep('type')
        setShowSidebarIdeas(false)
        setSidebarIdeasView('tags')
        setMessages(prev => [...prev, {
          id: Date.now().toString(), type: 'assistant',
          content: `✨ AI generated a ${ideaGenre} ${selectedPromptType} prompt for you!`,
          timestamp: new Date()
        }])
      } else {
        throw new Error(data.error)
      }
    } catch {
      alert('Failed to generate prompt idea.')
      setIdeasStep('genre')
      setSidebarIdeasView('genre')
    } finally {
      setGeneratingIdea(false)
    }
  }

  // ═══ ATOM AUTO-FILL HELPERS ═══
  const autoFillTitle = async (prompt: string): Promise<string> => {
    try {
      const res = await fetch('/api/generate/atom-title', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt })
      })
      const data = await res.json()
      if (data.success && data.title) return data.title
    } catch {}
    return prompt.split(' ').slice(0, 2).join(' ')
  }

  const autoFillLyrics = async (prompt: string): Promise<string> => {
    try {
      const res = await fetch('/api/generate/atom-lyrics', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt, language: selectedLanguage })
      })
      const data = await res.json()
      if (data.success && data.lyrics) return data.lyrics
    } catch {}
    return ''
  }

  const autoFillGenre = async (prompt: string): Promise<string> => {
    try {
      const res = await fetch('/api/generate/atom-genre', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ prompt })
      })
      const data = await res.json()
      if (data.success && data.genre) return data.genre
    } catch {}
    return 'pop'
  }

  // ═══ NDJSON STREAM PARSER ═══
  const parseNDJSON = async (
    response: Response,
    onStarted: (data: any) => void,
    onResult: (data: any) => void,
    signal?: AbortSignal
  ) => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream')
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'started') onStarted(parsed)
            else if (parsed.type === 'result') onResult(parsed)
          } catch {}
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer)
          if (parsed.type === 'started') onStarted(parsed)
          else if (parsed.type === 'result') onResult(parsed)
        } catch {}
      }
    } finally { reader.releaseLock() }
  }

  // ═══ MAIN GENERATE (full auto-fill pipeline like create page) ═══
  const handleGenerate = async () => {
    if (!input.trim() || !token) return

    // Validate prompt
    const trimmed = input.trim()
    if (trimmed.length < MIN_PROMPT_LENGTH) { alert(`❌ Prompt must be at least ${MIN_PROMPT_LENGTH} characters`); return }
    if (trimmed.length > MAX_PROMPT_LENGTH) { alert(`❌ Prompt must be ${MAX_PROMPT_LENGTH} characters or less`); return }

    // Validate title if provided
    if (selectedType === 'music' && !isInstrumental && customTitle.trim()) {
      if (customTitle.trim().length < 3 || customTitle.trim().length > 100) {
        setShowLyricsModal(true)
        setShowTitleError(true)
        setTimeout(() => setShowTitleError(false), 5000)
        return
      }
    }
    setShowTitleError(false)

    // Credit check
    const creditsNeeded = selectedType === 'music' ? 2 : selectedType === 'image' ? 1 : selectedType === 'effects' ? 2 : 0
    try {
      const res = await fetch('/api/plugin/credits', { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      const current = data.credits || 0
      const pending = activeGenerations.size * 2
      if (current - pending < creditsNeeded) {
        alert(`⚡ Insufficient credits! Need ${creditsNeeded}, have ${current} (${pending} reserved).`)
        return
      }
      setUserCredits(current)
    } catch { return }

    // Close modals
    setShowLyricsModal(false)

    // ── MUSIC GENERATION ──
    if (selectedType === 'music') {
      const messageId = Date.now().toString()
      const genMsgId = (Date.now() + 1).toString()

      const userMessage: Message = {
        id: messageId, type: 'user',
        content: isInstrumental ? `🎹 Generate instrumental: "${input}"` : `🎵 Generate music: "${input}"`,
        timestamp: new Date()
      }
      const generatingMessage: Message = {
        id: genMsgId, type: 'generation',
        content: activeGenerations.size > 0 ? '⏳ Queued - will start soon...' : `🎵 Generating your ${isInstrumental ? 'instrumental ' : ''}track...`,
        generationType: 'music', isGenerating: true, timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setGenerationQueue(prev => [...prev, genMsgId])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))

      const earlyAbort = new AbortController()
      abortControllersRef.current.set(genMsgId, earlyAbort)

      let originalPrompt = input
      setInput('')

      // Instrumental mode: strip vocal words
      if (isInstrumental) {
        originalPrompt = originalPrompt
          .replace(/\b(vocals?|voices?|singing|singer|sung|sing|vox|choir|choral|humming|chant(?:ing)?|whisper(?:ed)?|falsetto|a\s*capella|acapella)\b/gi, '')
          .replace(/\s+/g, ' ').replace(/,\s*,+/g, ',').replace(/,\s*$/, '').replace(/^\s*,/, '').trim()
        if (!originalPrompt.toLowerCase().includes('no vocals')) {
          const tag = ', no vocals, instrumental only'
          originalPrompt = originalPrompt.trimEnd().slice(0, 300 - tag.length) + tag
        }
      }
      originalPrompt = originalPrompt.slice(0, 300)

      // ── Smart auto-fill (LLM, same as create page) ──
      let finalTitle = customTitle
      let finalLyrics = customLyrics
      let finalGenre = genre
      let finalBpm = bpm
      let wasAutoFilled = false
      const wasCancelled = () => earlyAbort.signal.aborted

      // Auto-fill title
      if (!finalTitle.trim() && !wasCancelled()) {
        wasAutoFilled = true
        finalTitle = await autoFillTitle(originalPrompt)
        setCustomTitle(finalTitle)
        await new Promise(r => setTimeout(r, 10000))
      }
      if (wasCancelled()) return

      // Auto-fill lyrics
      if (isInstrumental) {
        finalLyrics = '[Instrumental]'
        setCustomLyrics(finalLyrics)
      } else if (!finalLyrics.trim() && !wasCancelled()) {
        wasAutoFilled = true
        finalLyrics = await autoFillLyrics(originalPrompt)
        setCustomLyrics(finalLyrics)
        await new Promise(r => setTimeout(r, 10000))
      }
      if (wasCancelled()) return

      // Auto-fill genre
      if (!finalGenre.trim() && !wasCancelled()) {
        wasAutoFilled = true
        finalGenre = await autoFillGenre(originalPrompt)
        setGenre(finalGenre)
        await new Promise(r => setTimeout(r, 10000))
      }
      if (wasCancelled()) return

      // Auto-fill BPM
      if (!finalBpm.trim()) {
        const pl = originalPrompt.toLowerCase()
        if (pl.includes('fast') || pl.includes('energetic') || pl.includes('upbeat')) finalBpm = '140'
        else if (pl.includes('slow') || pl.includes('chill') || pl.includes('relaxing')) finalBpm = '80'
        else if (pl.includes('medium') || pl.includes('moderate')) finalBpm = '110'
        else if (finalGenre.includes('electronic') || finalGenre.includes('edm')) finalBpm = '128'
        else if (finalGenre.includes('hip-hop') || finalGenre.includes('rap')) finalBpm = '90'
        else if (finalGenre.includes('rock')) finalBpm = '120'
        else if (finalGenre.includes('lofi') || finalGenre.includes('chill')) finalBpm = '85'
        else finalBpm = '110'
        setBpm(finalBpm)
        wasAutoFilled = true
      }

      // Show auto-fill info
      if (wasAutoFilled) {
        const fields: string[] = []
        if (!customTitle.trim()) fields.push('Title')
        if (!customLyrics.trim() && !isInstrumental) fields.push('Lyrics')
        if (isInstrumental) fields.push('Instrumental Mode')
        if (!genre.trim()) fields.push(`Genre (${finalGenre})`)
        if (!bpm.trim()) fields.push(`BPM (${finalBpm})`)
        setMessages(prev => [...prev, {
          id: (Date.now() + 2).toString(), type: 'assistant',
          content: `✨ Auto-filled: ${fields.join(', ')}`,
          timestamp: new Date()
        }])
      }

      // ── Call plugin generate API with NDJSON ──
      try {
        const body: any = {
          type: 'music',
          prompt: originalPrompt,
          title: finalTitle || originalPrompt.substring(0, 50),
          lyrics: finalLyrics || undefined,
          duration: songDuration,
          genre: finalGenre || undefined,
          bpm: finalBpm ? parseInt(finalBpm) : undefined,
          generateCoverArt,
          language: selectedLanguage,
        }
        if (selectedLanguage.toLowerCase() !== 'english') {
          body.audio_length_in_s = audioLengthInSeconds
          body.num_inference_steps = numInferenceSteps
          body.guidance_scale = guidanceScale
          body.denoising_strength = denoisingStrength
        }

        const res = await fetch('/api/plugin/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body),
          signal: earlyAbort.signal
        })

        let result: any = null
        await parseNDJSON(res,
          (started) => { /* jobId received */ },
          (r) => { result = r },
          earlyAbort.signal
        )

        if (result?.success) {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? {
              ...msg, isGenerating: false, content: '✅ Track generated!',
              result: { audioUrl: result.audioUrl, imageUrl: result.imageUrl, title: result.title || finalTitle, prompt: originalPrompt, lyrics: result.lyrics || finalLyrics }
            } : msg
          ))
          if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
          else refreshCredits()
          // Save to local library
          try {
            const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')
            lib.unshift({ id: Date.now(), type: 'music', title: result.title || finalTitle, audioUrl: result.audioUrl, imageUrl: result.imageUrl, prompt: originalPrompt, createdAt: new Date().toISOString() })
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib.slice(0, 200)))
          } catch {}
          // Show post-generation modal with download/stems/boost/release options
          setPostGenResult({
            audioUrl: result.audioUrl,
            imageUrl: result.imageUrl,
            title: result.title || finalTitle,
            prompt: originalPrompt,
            lyrics: result.lyrics || finalLyrics,
            messageId: genMsgId,
          })
          setShowPostGenModal(true)
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
          ))
          refreshCredits()
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ Generation failed. Please try again.' } : msg
        ))
        refreshCredits()
      } finally {
        abortControllersRef.current.delete(genMsgId)
        setActiveGenerations(prev => { const s = new Set(prev); s.delete(genMsgId); return s })
        setGenerationQueue(prev => prev.filter(id => id !== genMsgId))
        // Clear params for next gen
        setCustomTitle(''); setCustomLyrics(''); setGenre(''); setBpm(''); setSongDuration('long'); setIsInstrumental(false)
      }
      return
    }

    // ── IMAGE GENERATION ──
    if (selectedType === 'image') {
      const genMsgId = (Date.now() + 1).toString()
      setMessages(prev => [...prev,
        { id: Date.now().toString(), type: 'user', content: input, timestamp: new Date() },
        { id: genMsgId, type: 'generation', content: '🎨 Generating cover art...', generationType: 'image', isGenerating: true, timestamp: new Date() }
      ])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))
      const prompt = input
      setInput('')

      try {
        const res = await fetch('/api/plugin/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'image', prompt })
        })
        let result: any = null
        await parseNDJSON(res, () => {}, (r) => { result = r })

        if (result?.success) {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? {
              ...msg, isGenerating: false, content: '✅ Cover art generated!',
              result: { imageUrl: result.imageUrl, title: prompt.substring(0, 50), prompt }
            } : msg
          ))
          if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
          else refreshCredits()
          setMessages(prev => [...prev, {
            id: (Date.now() + 2).toString(), type: 'assistant',
            content: 'Cover art created! Want to combine it with a track?',
            timestamp: new Date()
          }])
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
          ))
          refreshCredits()
        }
      } catch {
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
        ))
      } finally {
        setActiveGenerations(prev => { const s = new Set(prev); s.delete(genMsgId); return s })
      }
      return
    }

    // ── EFFECTS generation via plugin API ──
    if (selectedType === 'effects') {
      const genMsgId = (Date.now() + 1).toString()
      setMessages(prev => [...prev,
        { id: Date.now().toString(), type: 'user', content: `✨ Generate effect: "${input}"`, timestamp: new Date() },
        { id: genMsgId, type: 'generation', content: '✨ Generating sound effect...', generationType: 'effects', isGenerating: true, timestamp: new Date() }
      ])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))
      const prompt = input
      setInput('')

      try {
        const res = await fetch('/api/plugin/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'effects', prompt, duration: effectsDuration, classifier_free_guidance: effectsGuidance, temperature: effectsTemperature })
        })
        let result: any = null
        await parseNDJSON(res, () => {}, (r) => { result = r })

        if (result?.success) {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? {
              ...msg, isGenerating: false, content: '✅ Effect generated!',
              result: { audioUrl: result.audioUrl, title: `SFX: ${prompt.substring(0, 40)}`, prompt }
            } : msg
          ))
          if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
          else refreshCredits()
          // Show post-generation modal
          setPostGenResult({
            audioUrl: result.audioUrl,
            title: `SFX: ${prompt.substring(0, 40)}`,
            prompt,
            messageId: genMsgId,
          })
          setShowPostGenModal(true)
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
          ))
        }
      } catch {
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
        ))
      } finally {
        setActiveGenerations(prev => { const s = new Set(prev); s.delete(genMsgId); return s })
        refreshCredits()
      }
      return
    }

    // ── LOOPS generation via plugin API ──
    if (selectedType === 'loops' as any) {
      const genMsgId = (Date.now() + 1).toString()
      setMessages(prev => [...prev,
        { id: Date.now().toString(), type: 'user', content: `🔄 Generate loops: "${input}"`, timestamp: new Date() },
        { id: genMsgId, type: 'generation', content: '🔄 Generating fixed BPM loops...', generationType: 'music', isGenerating: true, timestamp: new Date() }
      ])
      setActiveGenerations(prev => new Set(prev).add(genMsgId))
      const prompt = input
      setInput('')

      try {
        const res = await fetch('/api/plugin/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type: 'loops', prompt, bpm: loopsBpm, max_duration: loopsMaxDuration, variations: loopsVariations })
        })
        let result: any = null
        await parseNDJSON(res, () => {}, (r) => { result = r })

        if (result?.success) {
          // Loops may return multiple variations
          const variations = result.loops || result.variations || [{ url: result.audioUrl, variation: 1 }]
          // Remove generating message
          setMessages(prev => prev.filter(m => m.id !== genMsgId))
          // Add each variation
          variations.forEach((v: any, idx: number) => {
            setMessages(prev => [...prev, {
              id: `loop-${Date.now()}-${idx}`,
              type: 'assistant' as MessageType,
              content: `✅ Loop Variation ${v.variation || idx + 1} generated!`,
              result: { audioUrl: v.url || result.audioUrl, title: `Loop: ${prompt.substring(0, 40)} (v${v.variation || idx + 1})`, prompt },
              timestamp: new Date(Date.now() + idx * 1000)
            }])
          })
          if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
          else refreshCredits()
          // Show post-generation modal for the first variation
          const firstUrl = variations[0]?.url || result.audioUrl
          if (firstUrl) {
            setPostGenResult({
              audioUrl: firstUrl,
              title: `Loop: ${prompt.substring(0, 40)}`,
              prompt,
              messageId: `loop-${Date.now()}-0`,
            })
            setShowPostGenModal(true)
          }
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
          ))
        }
      } catch {
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
        ))
      } finally {
        setActiveGenerations(prev => { const s = new Set(prev); s.delete(genMsgId); return s })
        refreshCredits()
      }
      return
    }

    // ── Visualizer: open modal ──
    if ((selectedType as string) === 'visualizer') {
      setShowVisualizerModal(true)
      return
    }

    // ── File-based features: trigger upload dialog ──
    if (['stems', 'audio-boost', 'extract', 'video-to-audio', 'autotune'].includes(selectedType as string)) {
      triggerFeatureUpload(selectedType as string)
      return
    }
  }

  // ═══ STEM SPLITTING (modal-based, per-stem) ═══
  const handleSplitStems = async (audioUrl: string, messageId: string) => {
    setSplitStemsAudioUrl(audioUrl)
    setSplitStemsMessageId(messageId)
    setSplitStemsTrackTitle(
      messages.find(m => m.id === messageId)?.result?.title || 'Audio Track'
    )
    setSplitStemsCompleted({})
    setSplitStemsProcessing(null)
    setShowSplitStemsModal(true)
  }

  // Handle individual stem split from modal
  const handleSplitSingleStem = async (stem: StemType, params?: StemAdvancedParams) => {
    if (!splitStemsAudioUrl) return
    // Pricing: Core free for int16/int24 WAV; Extended always 1cr; Heat always 5cr
    const wavFormat = params?.wav_format || 'int16'
    const outputFormat = params?.output_format || 'wav'
    const isCoreFree = (params?.model || 'htdemucs') !== 'htdemucs_6s'
      && outputFormat === 'wav'
      && wavFormat !== 'float32'
    const perStemCost = isCoreFree ? 0 : 1
    const HEAT_COST = 5
    const stemCost = stem === 'all' ? HEAT_COST : perStemCost
    if (userCredits !== null && userCredits < stemCost) {
      alert(`⚡ Need ${stemCost} credit${stemCost > 1 ? 's' : ''} for stem split, have ${userCredits}.`)
      return
    }
    setSplitStemsProcessing(stem)
    setIsSplittingStems(true)

    try {
      const res = await fetch('/api/audio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: splitStemsAudioUrl,
          stem,
          ...(params && {
            model: params.model,
            output_format: params.output_format,
            mp3_bitrate: params.mp3_bitrate,
            mp3_preset: params.mp3_preset,
            wav_format: params.wav_format,
            clip_mode: params.clip_mode,
            shifts: params.shifts,
            overlap: params.overlap,
            split: params.split,
            segment: params.segment,
            jobs: params.jobs,
          }),
        }),
      })

      // Parse NDJSON stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let data: any = null

      const processLine = (line: string) => {
        if (!line.trim()) return
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'result') data = parsed
        } catch {}
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) processLine(line)
      }
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) processLine(line)
      }
      reader.releaseLock()

      if (!data || !data.success) {
        throw new Error(data?.error || 'Stem splitting failed')
      }

      if (data.creditsRemaining !== undefined) setUserCredits(data.creditsRemaining)
      refreshCredits()

      // Merge completed stems
      setSplitStemsCompleted(prev => ({ ...prev, ...data.stems }))

      // Also persist to message stems
      if (splitStemsMessageId) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === splitStemsMessageId) {
            return { ...msg, stems: { ...(msg.stems || {}), ...data.stems } }
          }
          return msg
        }))
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error('Stem split error:', err)
      alert(`❌ ${err?.message || '444 Radio locking in. Please try again.'}`)
    } finally {
      setSplitStemsProcessing(null)
      setIsSplittingStems(false)
      refreshCredits()
    }
  }

  // Play/pause stem audio in modal
  const handlePlayStemInModal = (stemKey: string, url: string, label: string) => {
    if (stemPlayingId === stemKey) {
      stemAudioRef.current?.pause()
      setStemPlayingId(null)
    } else {
      if (stemAudioRef.current) stemAudioRef.current.pause()
      const audio = new Audio(url)
      audio.onended = () => setStemPlayingId(null)
      audio.play()
      stemAudioRef.current = audio
      setStemPlayingId(stemKey)
    }
  }

  // ═══ AUDIO BOOST ═══
  const handleAudioBoost = async (audioUrl: string, title: string, params?: { bass: number; treble: number; volume: number; normalize: boolean; noiseReduction: boolean; format: string; bitrate: string }) => {
    if (userCredits !== null && userCredits < 1) {
      alert('⚡ Need 1 credit for audio boost.')
      return
    }
    const processingId = `boost-${Date.now()}`
    setMessages(prev => [...prev, {
      id: processingId, type: 'assistant',
      content: '🔊 Boosting audio... Mix & mastering your track.',
      timestamp: new Date(), isGenerating: true
    }])

    try {
      const res = await fetch('/api/plugin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          type: 'audio-boost', audioUrl,
          bass_boost: params?.bass ?? boostBass,
          treble_boost: params?.treble ?? boostTreble,
          volume_boost: params?.volume ?? boostVolume,
          normalize: params?.normalize ?? boostNormalize,
          noise_reduction: params?.noiseReduction ?? boostNoiseReduction,
          output_format: params?.format ?? boostFormat,
          bitrate: params?.bitrate ?? boostBitrate,
          trackTitle: title
        })
      })
      let result: any = null
      await parseNDJSON(res, () => {}, (r) => { result = r })

      if (result?.success) {
        setMessages(prev => prev.map(msg =>
          msg.id === processingId ? {
            ...msg, isGenerating: false,
            content: `✅ Audio boosted! Used 1 credit.`,
            result: { audioUrl: result.audioUrl, title: `${title} (Boosted)`, prompt: 'Audio Boost' }
          } : msg
        ))
        if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === processingId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
        ))
      }
    } catch {
      setMessages(prev => prev.map(msg =>
        msg.id === processingId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
      ))
    } finally { refreshCredits() }
  }

  // ═══ FILE UPLOAD HANDLER (for sidebar features: stems, boost, extract, video-to-audio) ═══
  const handleFileUploadForFeature = async (file: File, featureType: string, extraParams?: Record<string, unknown>) => {
    if (!token) return
    const processingId = `${featureType}-${Date.now()}`
    const labels: Record<string, string> = {
      'stems': '🎵 Splitting stems... This may take 1-2 minutes.',
      'audio-boost': '🔊 Boosting audio... Mix & mastering your track.',
      'extract': '🎵 Extracting audio stem...',
      'extract-video': '🎬 Extracting audio from video...',
      'video-to-audio': '🎬 Generating synced audio from video...',
      'autotune': '🎤 Autotuning audio... Pitch correcting to key.'
    }
    setMessages(prev => [...prev, {
      id: processingId, type: 'assistant',
      content: labels[featureType] || '⏳ Processing...',
      timestamp: new Date(), isGenerating: true
    }])

    try {
      // Step 1: Get presigned URL from plugin upload API
      const uploadRes = await fetch('/api/plugin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size })
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.error || 'Upload setup failed')
      }
      const { presignedUrl, publicUrl } = await uploadRes.json()

      // Step 2: PUT file directly to R2 via presigned URL
      const putRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })
      if (!putRes.ok) throw new Error('File upload to storage failed')

      // Step 3: Wait for R2 propagation (5s + 3 retries, matching create page)
      await new Promise(r => setTimeout(r, 5000))
      let accessible = false
      for (let i = 0; i < 3; i++) {
        try {
          const headRes = await fetch(publicUrl, { method: 'HEAD' })
          if (headRes.ok) { accessible = true; break }
        } catch {}
        await new Promise(r => setTimeout(r, 2000))
      }
      if (!accessible) console.warn('R2 propagation check failed, proceeding anyway')

      // Step 4: Build request body with full params (matching /api/plugin/generate expectations)
      const apiType = featureType === 'stem-split' ? 'stems'
        : featureType === 'extract-audio' ? 'extract'
        : featureType === 'extract-video' ? 'extract-video'
        : featureType
      const body: any = { type: apiType, ...(extraParams || {}) }

      if (['stems', 'stem-split'].includes(featureType)) {
        body.audioUrl = publicUrl
        body.stem = extraParams?.stem || 'vocals'
        body.trackTitle = file.name
      } else if (featureType === 'audio-boost') {
        body.audioUrl = publicUrl
        body.bass_boost = extraParams?.bass_boost ?? 0
        body.treble_boost = extraParams?.treble_boost ?? 0
        body.volume_boost = extraParams?.volume_boost ?? 2
        body.normalize = extraParams?.normalize !== false
        body.noise_reduction = extraParams?.noise_reduction === true
        body.output_format = extraParams?.output_format || 'mp3'
        body.bitrate = extraParams?.bitrate || '192k'
        body.trackTitle = file.name
      } else if (featureType === 'extract-audio') {
        body.audioUrl = publicUrl
        body.stem = extraParams?.stem || 'vocals'
        body.trackTitle = file.name
      } else if (featureType === 'extract-video') {
        body.type = 'extract-video'
        body.videoUrl = publicUrl
        body.audioUrl = publicUrl
        body.trackTitle = file.name
      } else if (featureType === 'video-to-audio') {
        body.videoUrl = publicUrl
        body.prompt = extraParams?.prompt || ''
        body.quality = extraParams?.quality || 'standard'
      } else if (featureType === 'extract') {
        body.audioUrl = publicUrl
      } else if (featureType === 'autotune') {
        body.audioUrl = publicUrl
        body.audio_file = publicUrl
        body.scale = extraParams?.scale || 'C:maj'
        body.output_format = extraParams?.output_format || 'wav'
        body.trackTitle = file.name
      }

      const res = await fetch('/api/plugin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      let result: any = null
      await parseNDJSON(res, () => {}, (r) => { result = r })

      if (result?.success) {
        if (['stems', 'stem-split', 'extract', 'extract-audio', 'extract-video'].includes(featureType) && result.stems) {
          setMessages(prev => prev.map(msg =>
            msg.id === processingId ? {
              ...msg, isGenerating: false,
              content: `✅ ${featureType === 'stems' || featureType === 'stem-split' ? 'Stems separated' : 'Audio extracted'}! Used ${result.creditsDeducted || 0} credits.`,
              stems: result.stems
            } : msg
          ))
        } else if (featureType === 'video-to-audio') {
          setMessages(prev => prev.map(msg =>
            msg.id === processingId ? {
              ...msg, isGenerating: false, generationType: 'video',
              content: `✅ Video audio generated! Used ${result.creditsDeducted || 0} credits.`,
              result: { audioUrl: result.audioUrl || result.videoUrl, url: result.videoUrl, title: result.title || file.name, prompt: extraParams?.prompt as string || 'Video to Audio' }
            } : msg
          ))
        } else {
          setMessages(prev => prev.map(msg =>
            msg.id === processingId ? {
              ...msg, isGenerating: false,
              content: `✅ ${featureType === 'audio-boost' ? 'Audio boosted' : featureType === 'autotune' ? 'Autotune complete' : 'Processing complete'}! Used ${result.creditsDeducted || 0} credits.`,
              result: { audioUrl: result.audioUrl, title: result.title || file.name, prompt: featureType }
            } : msg
          ))
        }
        if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === processingId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
        ))
      }
    } catch (err: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === processingId ? { ...msg, isGenerating: false, content: '❌ 444 Radio locking in. Please try again.' } : msg
      ))
    } finally { refreshCredits() }
  }

  // ═══ UPLOAD MODAL HELPERS ═══
  const openUploadModal = (mode?: typeof uploadMode) => {
    setShowUploadModal(true)
    setUploadMode(mode || null)
    setUploadFile(null)
    setUploadFilePreview(null)
    setUploadError('')
    setUploadProgress('')
    setIsUploading(false)
  }

  const closeUploadModal = () => {
    setShowUploadModal(false)
    setUploadMode(null)
    setUploadFile(null)
    if (uploadFilePreview) URL.revokeObjectURL(uploadFilePreview)
    setUploadFilePreview(null)
    setUploadError('')
    setUploadProgress('')
    setIsUploading(false)
  }

  const handleUploadFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: typeof uploadMode) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadMode(mode)

    // Size check (500MB)
    if (file.size > 500 * 1024 * 1024) {
      setUploadError('File size must be under 500MB')
      return
    }

    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')

    // Type validation per mode
    if ((mode === 'video-to-audio' || mode === 'extract-video') && !isVideo) {
      setUploadError('Please select a video file')
      return
    }
    if ((mode === 'stem-split' || mode === 'audio-boost' || mode === 'extract-audio' || mode === 'autotune') && !isAudio) {
      setUploadError('Please select an audio file')
      return
    }

    setUploadFile(file)
    const objectUrl = URL.createObjectURL(file)
    setUploadFilePreview(objectUrl)

    // Duration validation (async, warning only)
    const media = document.createElement(isVideo ? 'video' : 'audio') as HTMLVideoElement | HTMLAudioElement
    media.onloadedmetadata = () => {
      const duration = media.duration
      if (isVideo && duration > 5.5) {
        setUploadError(`⚠️ Video is ${duration.toFixed(1)}s. Max recommended is 5s. May be truncated.`)
      }
      if (isAudio && mode === 'stem-split' && duration > 600) {
        setUploadError(`⚠️ Audio is ${(duration / 60).toFixed(1)} min. Very long files may time out.`)
      }
    }
    media.src = objectUrl
    // Reset input
    e.target.value = ''
  }

  const handleUploadModalProcess = async () => {
    if (!uploadFile || !uploadMode || isUploading) return

    // Validate video-to-audio prompt
    if (uploadMode === 'video-to-audio' && !videoPrompt.trim()) {
      setUploadError('Please describe the sounds you want generated')
      return
    }

    // For stem-split and extract-audio: upload to R2, then open SplitStemsModal
    if (uploadMode === 'stem-split' || uploadMode === 'extract-audio') {
      setIsUploading(true)
      setUploadProgress('Uploading file...')
      try {
        // Upload via presigned URL
        const uploadRes = await fetch('/api/plugin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ fileName: uploadFile.name, fileType: uploadFile.type, fileSize: uploadFile.size })
        })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error(err.error || 'Upload setup failed')
        }
        const { presignedUrl, publicUrl } = await uploadRes.json()
        const putRes = await fetch(presignedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': uploadFile.type },
          body: uploadFile
        })
        if (!putRes.ok) throw new Error('File upload to storage failed')

        // Open SplitStemsModal with the uploaded audio URL
        const fileName = uploadFile.name?.replace(/\.[^/.]+$/, '') || 'Audio'
        closeUploadModal()
        setSplitStemsAudioUrl(publicUrl)
        setSplitStemsMessageId(`upload-stem-${Date.now()}`)
        setSplitStemsTrackTitle(fileName)
        setSplitStemsCompleted({})
        setSplitStemsProcessing(null)
        setShowSplitStemsModal(true)
      } catch (err: any) {
        setUploadError(err?.message || 'Upload failed')
      } finally {
        setIsUploading(false)
      }
      return
    }

    setIsUploading(true)
    setUploadProgress('Uploading file...')

    // Build extra params based on mode
    const extraParams: Record<string, unknown> = {}
    if (uploadMode === 'audio-boost') {
      extraParams.bass_boost = boostBass
      extraParams.treble_boost = boostTreble
      extraParams.volume_boost = boostVolume
      extraParams.normalize = boostNormalize
      extraParams.noise_reduction = boostNoiseReduction
      extraParams.output_format = boostFormat
      extraParams.bitrate = boostBitrate
    } else if (uploadMode === 'video-to-audio') {
      extraParams.prompt = videoPrompt
      extraParams.quality = videoHQ ? 'hq' : 'standard'
    } else if (uploadMode === 'autotune') {
      extraParams.scale = `${autotuneKey}:${autotuneScale}`
      extraParams.output_format = 'wav'
    }

    // Map mode to featureType
    const featureType = uploadMode === 'extract-video' ? 'extract-video'
      : uploadMode

    closeUploadModal()
    await handleFileUploadForFeature(uploadFile, featureType, extraParams)
  }

  // ═══ TRIGGER FILE UPLOAD for sidebar features (opens modal with pre-selected mode) ═══
  const triggerFeatureUpload = (featureType: string) => {
    const modeMap: Record<string, typeof uploadMode> = {
      'stems': 'stem-split',
      'audio-boost': 'audio-boost',
      'extract': 'extract-audio',
      'video-to-audio': 'video-to-audio',
      'autotune': 'autotune',
    }
    openUploadModal(modeMap[featureType] || null)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && fileUploadType) {
      handleFileUploadForFeature(file, fileUploadType)
    }
    // Reset
    e.target.value = ''
    setFileUploadType('')
  }

  // ═══ Update isGenerating from active set ═══
  useEffect(() => { setIsGenerating(activeGenerations.size > 0) }, [activeGenerations])

  // ═══ CHAT SYNC: Save to server when messages change (debounced) ═══
  const syncChatToServer = useCallback(async (msgs: Message[]) => {
    if (!token || msgs.length <= 1) return
    try {
      setIsSyncingChat(true)
      await fetch('/api/plugin/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: msgs.filter(m => !m.isGenerating) })
      })
    } catch (err) {
      console.warn('[chat-sync] Failed to sync:', err)
    } finally {
      setIsSyncingChat(false)
    }
  }, [token])

  useEffect(() => {
    if (chatSyncTimerRef.current) clearTimeout(chatSyncTimerRef.current)
    chatSyncTimerRef.current = setTimeout(() => syncChatToServer(messages), 3000)
    return () => { if (chatSyncTimerRef.current) clearTimeout(chatSyncTimerRef.current) }
  }, [messages, syncChatToServer])

  // Load synced chat on mount (after auth)
  useEffect(() => {
    if (!token || !isAuthenticated) return
    ;(async () => {
      try {
        const res = await fetch('/api/plugin/chat', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.messages && data.messages.length > 1) {
          const serverMsgs = data.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          const localStr = localStorage.getItem(CHAT_KEY)
          const localMsgs = localStr ? JSON.parse(localStr) : []
          // Adopt server messages whenever server has more content
          // This ensures website generations appear in the plugin
          if (serverMsgs.length > localMsgs.length) {
            setMessages(serverMsgs)
          }
        }
      } catch {} // server unreachable — use local
    })()
  }, [token, isAuthenticated])

  // ═══ JOB RECOVERY: On mount, fetch completed jobs that might have finished ═══
  // ═══ while the plugin was closed. Inject results into chat if not already there. ═══
  useEffect(() => {
    if (!token || !isAuthenticated) return
    ;(async () => {
      try {
        const res = await fetch('/api/plugin/jobs?status=completed&limit=20', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        if (!data.jobs || data.jobs.length === 0) return

        setMessages(prev => {
          // Collect all existing audio URLs and job references in current chat to avoid duplicates
          const existingUrls = new Set<string>()
          const existingContent = new Set<string>()
          prev.forEach(msg => {
            if (msg.result?.audioUrl) existingUrls.add(msg.result.audioUrl)
            if (msg.result?.imageUrl) existingUrls.add(msg.result.imageUrl)
            if (msg.stems) Object.values(msg.stems).forEach(u => existingUrls.add(u as string))
            existingContent.add(msg.content)
          })

          const newMessages: Message[] = []
          for (const job of data.jobs) {
            if (!job.output?.success) continue
            const output = job.output

            // Check if this job's result is already in chat
            let isDuplicate = false
            if (output.audioUrl && existingUrls.has(output.audioUrl)) isDuplicate = true
            if (output.imageUrl && existingUrls.has(output.imageUrl)) isDuplicate = true
            if (output.stems) {
              const stemUrls = Object.values(output.stems) as string[]
              if (stemUrls.some(u => existingUrls.has(u))) isDuplicate = true
            }
            if (isDuplicate) continue

            // Build recovered message based on job type
            const timestamp = new Date(job.completedAt || job.createdAt)
            if (job.type === 'music' && output.audioUrl) {
              newMessages.push({
                id: `recovered-${job.jobId}`,
                type: 'assistant',
                content: `✅ ${output.title || 'AI Track'} — recovered from previous session`,
                result: {
                  audioUrl: output.audioUrl,
                  title: output.title || 'AI Track',
                  prompt: output.prompt,
                  lyrics: output.lyrics,
                },
                timestamp,
              })
            } else if (job.type === 'image' && output.imageUrl) {
              newMessages.push({
                id: `recovered-${job.jobId}`,
                type: 'assistant',
                content: `✅ Cover art — recovered from previous session`,
                result: { imageUrl: output.imageUrl, title: output.title || 'Cover Art', prompt: output.prompt },
                timestamp,
              })
            } else if ((job.type === 'stems' || job.type === 'extract') && output.stems) {
              newMessages.push({
                id: `recovered-${job.jobId}`,
                type: 'assistant',
                content: `✅ Stems — recovered from previous session`,
                stems: output.stems,
                timestamp,
              })
            } else if (job.type === 'audio-boost' && output.audioUrl) {
              newMessages.push({
                id: `recovered-${job.jobId}`,
                type: 'assistant',
                content: `✅ Audio Boost — recovered from previous session`,
                result: { audioUrl: output.audioUrl, title: output.title || 'Boosted Audio', prompt: 'Audio Boost' },
                timestamp,
              })
            } else if (job.type === 'effects' && output.audioUrl) {
              newMessages.push({
                id: `recovered-${job.jobId}`,
                type: 'assistant',
                content: `✅ Effect — recovered from previous session`,
                result: { audioUrl: output.audioUrl, title: output.title || 'Effect', prompt: output.prompt },
                timestamp,
              })
            } else if (job.type === 'loops' && output.loops) {
              // Loops may have multiple results; pick first audio
              const firstLoop = output.loops?.[0]
              if (firstLoop?.audioUrl) {
                newMessages.push({
                  id: `recovered-${job.jobId}`,
                  type: 'assistant',
                  content: `✅ Loop — recovered from previous session`,
                  result: { audioUrl: firstLoop.audioUrl, title: firstLoop.title || 'Loop', prompt: output.prompt },
                  timestamp,
                })
              }
            }
          }

          if (newMessages.length === 0) return prev
          // Sort recovered messages by timestamp and append
          newMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          return [...prev, ...newMessages]
        })
      } catch (err) {
        console.warn('[plugin] Job recovery failed:', err)
      }
    })()
  }, [token, isAuthenticated])

  // ═══ STUCK VIDEO GENERATION RECOVERY ═══
  // Clean up stuck "Generating video..." messages that survived a tab close/reopen.
  // If a message has isGenerating + generationType==='video' and is older than 10 min, mark it as failed.
  useEffect(() => {
    setMessages(prev => {
      const TEN_MIN = 10 * 60 * 1000
      let changed = false
      const updated = prev.map(msg => {
        if (msg.isGenerating && msg.generationType === 'video' && (Date.now() - msg.timestamp.getTime() > TEN_MIN)) {
          changed = true
          return { ...msg, isGenerating: false, content: '⚠️ Video generation timed out — credits were refunded if generation failed. Try again.' }
        }
        return msg
      })
      return changed ? updated : prev
    })
  }, []) // Run once on mount

  // ═══ RELEASE: Open in browser (plugin can't host the full release modal) ═══
  const handleOpenRelease = () => {
    window.open('https://444radio.co.in/create', '_blank')
    setMessages(prev => [...prev, {
      id: `release-${Date.now()}`, type: 'assistant',
      content: '🚀 Opening 444 Radio in your browser to release your track. Select your track from the library in the Release tab on the website.',
      timestamp: new Date()
    }])
  }

  // ═══ UNAUTHENTICATED STATE ═══
  if (!isAuthenticated && !isLoadingCredits) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #050508 0%, #08080c 50%, #040406 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          .auth-card { animation: fadeIn 0.5s ease-out; }
        `}} />
        <div className="auth-card text-center space-y-5 max-w-md w-full">
          {/* Silver visualizer icon */}
          <div className="flex justify-center mb-2">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{filter:'drop-shadow(0 0 16px rgba(180,180,200,0.2))'}}>
              <circle cx="28" cy="28" r="27" stroke="url(#authRing)" strokeWidth="1.5" fill="none" />
              <rect x="12" y="22" width="3" height="12" rx="1.5" fill="url(#authBar)" />
              <rect x="18" y="16" width="3" height="24" rx="1.5" fill="url(#authBar)" />
              <rect x="24" y="10" width="3" height="36" rx="1.5" fill="url(#authBar)" />
              <rect x="30" y="14" width="3" height="28" rx="1.5" fill="url(#authBar)" />
              <rect x="36" y="18" width="3" height="20" rx="1.5" fill="url(#authBar)" />
              <rect x="42" y="22" width="3" height="12" rx="1.5" fill="url(#authBar)" />
              <defs>
                <linearGradient id="authRing" x1="0" y1="0" x2="56" y2="56">
                  <stop offset="0%" stopColor="#c0c0d0"/>
                  <stop offset="100%" stopColor="#60606a"/>
                </linearGradient>
                <linearGradient id="authBar" x1="0" y1="0" x2="0" y2="56">
                  <stop offset="0%" stopColor="#d0d0dd"/>
                  <stop offset="100%" stopColor="#70707a"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-wide" style={{color:'rgba(220,220,235,0.95)',letterSpacing:'0.05em'}}>Connect to 444 Radio</h1>

          {/* Show auth error if token was rejected */}
          {authError && (
            <div className="rounded-xl p-3 text-left" style={{background:'rgba(255,60,60,0.06)',border:'1px solid rgba(255,60,60,0.2)'}}>
              <p className="text-sm font-medium" style={{color:'rgba(255,120,120,0.9)'}}>⚠️ {authError}</p>
              <p className="text-xs mt-1" style={{color:'rgba(255,120,120,0.5)'}}>Generate a new token from Settings → Plugin tab</p>
            </div>
          )}



          {/* Step 1: Get token */}
          <div className="rounded-xl p-4 text-left space-y-2" style={{background:'rgba(200,200,220,0.03)',border:'1px solid rgba(200,200,220,0.08)'}}>
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{background:'rgba(200,200,220,0.08)',border:'1px solid rgba(200,200,220,0.2)',color:'rgba(200,200,220,0.8)'}}>1</span>
              <p className="text-sm font-semibold" style={{color:'rgba(230,230,240,0.9)'}}>Get your plugin token</p>
            </div>
            <p className="text-xs ml-8" style={{color:'rgba(160,160,180,0.6)'}}>Sign in on the website → Settings → Plugin tab → Generate Token</p>
            <button
              onClick={() => window.location.href = 'https://444radio.co.in/settings?tab=plugin'}
              className="ml-8 mt-1 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-[1.02]"
              style={{background:'linear-gradient(135deg, rgba(200,200,220,0.12), rgba(200,200,220,0.06))',border:'1px solid rgba(200,200,220,0.2)',color:'rgba(220,220,235,0.9)',boxShadow:'0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)'}}
            >
              Open Settings → Get Token
            </button>
          </div>

          {/* Step 2: Paste token */}
          <div className="rounded-xl p-4 text-left space-y-2" style={{background:'rgba(200,200,220,0.03)',border:'1px solid rgba(200,200,220,0.08)'}}>
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{background:'rgba(200,200,220,0.08)',border:'1px solid rgba(200,200,220,0.2)',color:'rgba(200,200,220,0.8)'}}>2</span>
              <p className="text-sm font-semibold" style={{color:'rgba(230,230,240,0.9)'}}>Paste your token below</p>
            </div>
            <div className="flex gap-2 ml-8 mt-1">
              <input
                id="plugin-token-input"
                type="text"
                placeholder="444r_..."
                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none transition-all"
                style={{background:'rgba(0,0,0,0.4)',border:'1px solid rgba(200,200,220,0.12)',color:'rgba(220,220,235,0.9)',caretColor:'rgba(200,200,220,0.7)'}}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(200,200,220,0.3)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(200,200,220,0.12)'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (val) { try { localStorage.setItem(TOKEN_KEY, val) } catch {}; setToken(val) }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('plugin-token-input') as HTMLInputElement
                  const val = input?.value?.trim()
                  if (val) { try { localStorage.setItem(TOKEN_KEY, val) } catch {}; setToken(val) }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02]"
                style={{background:'linear-gradient(135deg, rgba(220,220,235,0.15), rgba(200,200,220,0.08))',border:'1px solid rgba(200,200,220,0.25)',color:'rgba(220,220,235,0.9)',boxShadow:'0 2px 12px rgba(0,0,0,0.3)'}}
              >
                Connect
              </button>
            </div>
          </div>

          <p className="text-[11px]" style={{color:'rgba(120,120,140,0.5)'}}>Token is saved locally — you only need to do this once per device</p>
        </div>
      </div>
    )
  }

  if (isLoadingCredits) {
    // Return a minimal inline-styled loading screen (no Tailwind dependency)
    // This ensures no white flash if CSS hasn't loaded yet
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #050508, #08080c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(200,200,220,0.2)', borderTopColor: 'rgba(200,200,220,0.7)', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 13, color: 'rgba(160,160,180,0.6)' }}>Connecting to 444 Radio...</p>
        </div>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  //  RENDER — Carbon copy of create page layout
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="h-screen text-white flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #08080c 50%, #040406 100%)',
      }}>
      {/* ── Global ambient background — silver chrome glass ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 45% at 50% -5%, rgba(200,200,220,0.04) 0%, rgba(160,160,180,0.015) 35%, transparent 65%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 50% 35% at 85% 100%, rgba(180,180,200,0.025) 0%, transparent 50%), radial-gradient(ellipse 50% 35% at 15% 100%, rgba(200,200,220,0.02) 0%, transparent 50%)',
      }} />
      {/* Subtle grid texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(200,200,220,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(200,200,220,0.3) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      {/* Bridge action toast */}
      {bridgeToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl text-xs font-medium select-none pointer-events-none overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(12,12,16,0.92), rgba(8,8,12,0.96))',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(200,200,220,0.12)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.8), 0 0 20px rgba(200,200,220,0.04), inset 0 1px 0 rgba(200,200,220,0.08)',
            color: 'rgba(220,220,235,0.9)',
            animation: 'fadeIn 0.2s ease-out',
          }}>
          {/* Diagonal shine */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"><div style={{position:'absolute',top:'-80%',left:'-20%',width:'50%',height:'260%',background:'linear-gradient(105deg,transparent 42%,rgba(255,255,255,0.03) 47%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.03) 53%,transparent 58%)',transform:'rotate(-15deg)'}} /></div>
          <span className="relative z-10">{bridgeToast}</span>
        </div>
      )}

      {/* Pin status bar — shows when window is pinned */}
      {isPinned && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 text-[10px] select-none shrink-0"
          style={{background:'rgba(200,200,220,0.03)',borderBottom:'1px solid rgba(200,200,220,0.08)',color:'rgba(200,200,220,0.5)'}}>
          <Pin size={10} /> Window pinned — stays on top
          <button onClick={togglePin} className="ml-2 underline transition-colors" style={{color:'rgba(200,200,220,0.7)'}}>Unpin</button>
        </div>
      )}

      {/* Hidden file input for sidebar feature uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* ── Features Sidebar (desktop: docked, mobile: fullscreen overlay) ── */}
      {showFeaturesSidebar && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setShowFeaturesSidebar(false)} />

          <div className="fixed left-0 top-0 h-screen w-[280px] z-50 flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(10,10,14,0.97), rgba(6,6,10,0.99))', backdropFilter: 'blur(60px) saturate(1.2)', WebkitBackdropFilter: 'blur(60px) saturate(1.2)', borderRight: '1px solid rgba(200,200,220,0.06)', boxShadow: '4px 0 40px rgba(0,0,0,0.5), inset -1px 0 0 rgba(200,200,220,0.03)', animation: 'slideInLeft 0.2s ease-out' }}>
            {/* Subtle ambient gradient */}
            <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(200,200,220,0.02) 0%, transparent 60%)'}} />
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-12 relative z-10" style={{borderBottom:'1px solid rgba(200,200,220,0.06)'}}>
              <div className="flex items-center gap-2">
                {/* Visualizer bars icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{color:'rgba(200,200,220,0.7)'}}>
                  <rect x="4" y="14" width="3" height="6" rx="1" fill="currentColor" opacity="0.5"/>
                  <rect x="9" y="8" width="3" height="12" rx="1" fill="currentColor" opacity="0.7"/>
                  <rect x="14" y="4" width="3" height="16" rx="1" fill="currentColor"/>
                  <rect x="19" y="10" width="3" height="10" rx="1" fill="currentColor" opacity="0.6"/>
                </svg>
                <span className="font-bold text-sm tracking-wider" style={{color:'rgba(220,220,235,0.9)'}}>Features</span>
              </div>
              <button onClick={() => setShowFeaturesSidebar(false)} className="p-2 rounded-lg transition-colors" style={{color:'rgba(200,200,220,0.25)'}} onMouseEnter={e=>e.currentTarget.style.color='rgba(200,200,220,0.6)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(200,200,220,0.25)'}>
                <X size={18} />
              </button>
            </div>

            {/* Pin reminder for drag-drop */}
            {!isPinned && (
              <div className="px-4 py-2 relative z-10" style={{borderBottom:'1px solid rgba(200,200,220,0.05)'}}>
                <button onClick={togglePin} className="w-full flex items-start gap-2 px-3 py-2 rounded-lg transition-all hover:scale-[1.02]" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)'}}>
                  <Pin size={14} className="mt-0.5 shrink-0" style={{color:'rgba(200,200,220,0.6)'}} />
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[11px] font-semibold leading-tight" style={{color:'rgba(220,220,235,0.8)'}}>Pin window for drag & drop</p>
                    <p className="text-[9px] mt-0.5 leading-tight" style={{color:'rgba(200,200,220,0.35)'}}>Keeps window on top + enables file drops</p>
                  </div>
                </button>
              </div>
            )}

            {/* Credits */}
            <div className="px-4 py-2 relative z-10" style={{borderBottom:'1px solid rgba(200,200,220,0.06)'}}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)'}}>
                <Zap size={16} style={{color:'rgba(200,200,220,0.7)'}} />
                <span className="font-bold text-sm" style={{color:'rgba(220,220,235,0.9)'}}>{isLoadingCredits ? '...' : userCredits} credits</span>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="px-4 py-2 relative z-10" style={{borderBottom:'1px solid rgba(200,200,220,0.06)'}}>
              <div className="flex gap-1.5">
                <button onClick={() => setIsInstrumental(false)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all"
                  style={!isInstrumental ? {background:'linear-gradient(135deg, rgba(200,200,220,0.1), rgba(180,180,200,0.06))',color:'rgba(220,220,235,0.9)',border:'1px solid rgba(200,200,220,0.2)',boxShadow:'0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(255,255,255,0.08)'} : {background:'rgba(200,200,220,0.02)',color:'rgba(200,200,220,0.35)',border:'1px solid rgba(200,200,220,0.06)'}}>
                  <Mic size={14} /> Vocal
                </button>
                <button onClick={() => setIsInstrumental(true)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all"
                  style={isInstrumental ? {background:'linear-gradient(135deg, rgba(200,200,220,0.1), rgba(180,180,200,0.06))',color:'rgba(220,220,235,0.9)',border:'1px solid rgba(200,200,220,0.2)',boxShadow:'0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(255,255,255,0.08)'} : {background:'rgba(200,200,220,0.02)',color:'rgba(200,200,220,0.35)',border:'1px solid rgba(200,200,220,0.06)'}}>
                  <Music size={14} /> Inst
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="px-3 py-2 relative z-10" style={{borderBottom:'1px solid rgba(200,200,220,0.06)'}}>
              <div className="relative">
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your music..."
                  className="w-full rounded-lg px-3 py-2 text-xs text-white resize-none focus:outline-none transition-all"
                  style={{
                    background: 'rgba(200,200,220,0.03)',
                    border: '1px solid rgba(200,200,220,0.08)',
                    caretColor: 'rgba(200,200,220,0.7)',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(200,200,220,0.2)'
                    e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.3), 0 0 12px rgba(200,200,220,0.03)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(200,200,220,0.08)'
                    e.currentTarget.style.boxShadow = 'inset 0 2px 6px rgba(0,0,0,0.3)'
                  }}
                  rows={3}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
                />
                <div className="flex items-center justify-between mt-2">
                  <button onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-full transition-all ${isRecording ? 'animate-pulse' : ''}`}
                    style={isRecording ? {background:'#ff0040',color:'#fff'} : {background:'rgba(200,200,220,0.03)',color:'rgba(200,200,220,0.25)',border:'1px solid rgba(200,200,220,0.06)'}}>
                    <Mic size={14} />
                  </button>
                  <button onClick={handleGenerate} disabled={isGenerating || !input.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    style={{background:'linear-gradient(135deg, rgba(220,220,235,0.85), rgba(180,180,200,0.75))',color:'#000000',boxShadow:'0 0 16px rgba(200,200,220,0.12), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)'}}>
                    <Send size={12} /> Generate
                  </button>
                </div>
              </div>
            </div>

            {/* Ideas / Tags Panel */}
            {showSidebarIdeas && (
              <div className="px-4 py-4 border-b border-white/10 max-h-[40vh] overflow-y-auto">
                {sidebarIdeasView === 'tags' && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-white flex items-center gap-2"><Lightbulb size={14} style={{color:'rgba(200,200,220,0.6)'}} /> Quick Tags</span>
                      <div className="flex gap-2">
                        <button onClick={() => setSidebarIdeasView('type')} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.12)',color:'rgba(220,220,235,0.7)'}}>✨ IDEAS</button>
                        <button onClick={() => setShowSidebarIdeas(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => setInput(prev => prev + (prev ? ', ' : '') + tag)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)',color:'rgba(200,200,220,0.6)'}}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {sidebarIdeasView === 'type' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">✨ AI Prompt Ideas</h3>
                      <button onClick={() => setSidebarIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setSidebarPromptType('song'); setSelectedPromptType('song'); setSidebarIdeasView('genre') }}
                        className="p-5 rounded-2xl hover:scale-105 transition-all" style={{background:'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(200,200,220,0.02))',border:'2px solid rgba(200,200,220,0.12)'}}>
                        <div className="text-3xl mb-2">🎤</div><div className="text-sm font-bold text-white">Song</div><div className="text-[10px] text-gray-400">With vocals & lyrics</div>
                      </button>
                      <button onClick={() => { setSidebarPromptType('beat'); setSelectedPromptType('beat'); setIsInstrumental(true); setSidebarIdeasView('genre') }}
                        className="p-5 rounded-2xl hover:scale-105 transition-all" style={{background:'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(200,200,220,0.02))',border:'2px solid rgba(200,200,220,0.12)'}}>
                        <div className="text-3xl mb-2">🎹</div><div className="text-sm font-bold text-white">Beat</div><div className="text-[10px] text-gray-400">Instrumental only</div>
                      </button>
                    </div>
                  </div>
                )}
                {sidebarIdeasView === 'genre' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setSidebarIdeasView('type')} className="text-xs flex items-center gap-1" style={{color:'rgba(200,200,220,0.6)'}}><ChevronLeft size={14} /> Back</button>
                      <h3 className="text-sm font-bold text-white">🎵 Select Genre</h3>
                      <button onClick={() => setSidebarIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GENRE_OPTIONS.map(g => (
                        <button key={g} onClick={() => handleGeneratePromptIdea(g)} disabled={generatingIdea}
                          className="px-2 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)',color:'rgba(200,200,220,0.6)'}}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {sidebarIdeasView === 'generating' && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto rounded-full animate-spin mb-4" style={{border:'4px solid rgba(200,200,220,0.1)',borderTopColor:'rgba(200,200,220,0.5)'}} />
                    <h3 className="text-base font-bold text-white">Creating Amazing Prompt...</h3>
                    <p className="text-xs text-gray-400">AI is crafting the perfect description</p>
                  </div>
                )}
              </div>
            )}

            {/* Feature Buttons */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {/* Generation Queue Notification (shows when generations are active) */}
              {activeGenerations.size > 0 && (
                <div className="mb-3 p-3 rounded-xl flex items-center gap-2 generating-glow" style={{background:'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(180,180,200,0.03))',border:'1px solid rgba(200,200,220,0.15)'}}>
                  <Loader2 size={16} className="animate-spin" style={{color:'rgba(200,200,220,0.7)'}} />
                  <span className="text-xs font-medium" style={{color:'rgba(200,200,220,0.7)'}}>
                    {activeGenerations.size} generation{activeGenerations.size > 1 ? 's' : ''} in progress
                  </span>
                </div>
              )}

              {/* Ideas Lightbulb */}
              <button onClick={() => { setShowSidebarIdeas(!showSidebarIdeas); setSidebarIdeasView('tags') }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all mb-2 relative overflow-hidden"
                style={showSidebarIdeas ? {background:'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(180,180,200,0.03))',border:'1px solid rgba(200,200,220,0.15)',color:'rgba(220,220,235,0.8)',boxShadow:'0 0 16px rgba(200,200,220,0.04), inset 0 1px 0 rgba(255,255,255,0.04)'} : {background:'rgba(200,200,220,0.02)',border:'1px solid rgba(200,200,220,0.06)',color:'rgba(200,200,220,0.5)'}}>
                <div className="p-1.5 rounded-md" style={{background:'rgba(200,200,220,0.03)'}}><Lightbulb size={14} /></div>
                <div className="flex-1 text-left"><div className="text-xs font-semibold">Ideas & Tags</div></div>
                <span className="text-[10px] bg-white/5 px-2 py-1 rounded-full" style={{color:'rgba(200,200,220,0.3)'}}>AI</span>
              </button>

              <p className="text-[9px] uppercase tracking-widest font-bold mb-2 px-1" style={{color:'rgba(200,200,220,0.12)'}}>Creation Tools</p>
              <div className="space-y-1">
                {FEATURES.filter(f => {
                  // Hide lyrics when not in music vocal mode
                  if ((f as any).conditionalMusic && (selectedType !== 'music' || isInstrumental)) return false
                  return true
                }).map(f => {
                  const Icon = f.icon
                  const isActive = f.key === selectedType || (f.key === 'lyrics' && !!(customTitle || genre || customLyrics || bpm))
                  const colorMap: Record<string, { active: React.CSSProperties; inactive: React.CSSProperties }> = {
                    cyan: {
                      active: {background:'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))',border:'1px solid rgba(200,200,220,0.18)',color:'rgba(220,220,235,0.9)',boxShadow:'0 0 16px rgba(200,200,220,0.04), inset 0 1px 0 rgba(255,255,255,0.05)'},
                      inactive: {background:'rgba(200,200,220,0.015)',border:'1px solid rgba(200,200,220,0.04)',color:'rgba(200,200,220,0.4)'},
                    },
                    purple: {
                      active: {background:'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))',border:'1px solid rgba(200,200,220,0.18)',color:'rgba(220,220,235,0.9)',boxShadow:'0 0 16px rgba(200,200,220,0.04), inset 0 1px 0 rgba(255,255,255,0.05)'},
                      inactive: {background:'rgba(200,200,220,0.015)',border:'1px solid rgba(200,200,220,0.04)',color:'rgba(200,200,220,0.4)'},
                    },
                    orange: {
                      active: {background:'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))',border:'1px solid rgba(200,200,220,0.18)',color:'rgba(220,220,235,0.9)',boxShadow:'0 0 16px rgba(200,200,220,0.04), inset 0 1px 0 rgba(255,255,255,0.05)'},
                      inactive: {background:'rgba(200,200,220,0.015)',border:'1px solid rgba(200,200,220,0.04)',color:'rgba(200,200,220,0.4)'},
                    },
                  }
                  return (
                    <button key={f.key} onClick={() => {
                      // File-based features: open upload modal
                      if (['stems', 'audio-boost', 'extract', 'video-to-audio', 'autotune'].includes(f.key)) {
                        triggerFeatureUpload(f.key)
                      } else if (f.key === 'lyrics') {
                        setShowLyricsModal(true)
                      } else if (f.key === 'upload') {
                        openUploadModal()
                      } else if (f.key === 'release') {
                        handleOpenRelease()
                      } else if (f.key === 'visualizer') {
                        setShowVisualizerModal(true)
                        setShowFeaturesSidebar(false)
                      } else {
                        setSelectedType(f.key as GenerationType)
                        setShowFeaturesSidebar(false)
                      }
                    }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all relative overflow-hidden"
                      style={isActive ? colorMap[f.color].active : colorMap[f.color].inactive}>
                      <div className="p-1.5 rounded-md" style={{background:'rgba(255,255,255,0.03)'}}><Icon size={14} /></div>
                      <div className="flex-1 text-left">
                        <div className="text-xs font-semibold">{f.label}</div>
                        <div className="text-[9px]" style={{color:'rgba(200,200,220,0.25)'}}>{f.desc}</div>
                      </div>
                      {f.cost > 0 && <span className="text-[10px] px-2 py-1 rounded-full" style={{color:'rgba(200,200,220,0.2)',background:'rgba(200,200,220,0.03)',border:'1px solid rgba(200,200,220,0.04)'}}>-{f.cost}</span>}
                      {f.cost === -1 && <span className="text-[10px] px-2 py-1 rounded-full" style={{color:'rgba(200,200,220,0.3)',background:'rgba(200,200,220,0.03)',border:'1px solid rgba(200,200,220,0.06)'}}>~5+</span>}
                    </button>
                  )
                })}
              </div>

              {/* Utilities */}
              <div className="mt-3 pt-3" style={{borderTop:'1px solid rgba(200,200,220,0.05)'}}>
                <div className="flex items-center gap-1.5 px-1">
                  <button onClick={() => setShowDeletedChatsModal(true)} className="p-2 rounded-lg transition-all" style={{border:'1px solid rgba(200,200,220,0.06)',color:'rgba(200,200,220,0.35)'}} title="Chat History">
                    <RotateCcw size={14} />
                  </button>
                  <button onClick={handleClearChat} className="p-2 rounded-lg transition-all" style={{border:'1px solid rgba(200,200,220,0.06)',color:'rgba(200,200,220,0.35)'}} title="New Chat">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => window.open('https://444radio.co.in/explore?host=juce', '_blank')}
                    className="p-2 rounded-lg transition-all" style={{border:'1px solid rgba(200,200,220,0.06)',color:'rgba(200,200,220,0.35)'}} title="Explore 444 Radio">
                    <Compass size={14} />
                  </button>
                  <button onClick={() => window.location.href = '/plugin'}
                    className="p-2 rounded-lg transition-all" style={{border:'1px solid rgba(200,200,220,0.08)',color:'rgba(200,200,220,0.4)'}} title="Plugin Home">
                    <Home size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Header — chrome silver glass */}
        <div className={`shrink-0 flex items-center justify-between ${layoutMode === 'wide' ? 'px-3 py-1.5' : 'px-4 py-2.5'} relative overflow-hidden`}
          style={{
            background: 'linear-gradient(135deg, rgba(14,14,18,0.88), rgba(10,10,14,0.92))',
            backdropFilter: 'blur(60px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(60px) saturate(1.2)',
            borderBottom: '1px solid rgba(200,200,220,0.06)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}>
          {/* Chrome accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none" style={{background:'linear-gradient(90deg,transparent 10%,rgba(200,200,220,0.06) 35%,rgba(200,200,220,0.12) 50%,rgba(200,200,220,0.06) 65%,transparent 90%)'}} />
          <div className="flex items-center gap-3 relative z-10">
            <button onClick={() => setShowFeaturesSidebar(!showFeaturesSidebar)}
              className="p-2 rounded-lg transition-all" style={{color:'rgba(200,200,220,0.7)'}}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,200,220,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {/* Visualizer SVG grid icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="14" width="3" height="6" rx="1" fill="currentColor" opacity="0.5"/>
                <rect x="9" y="8" width="3" height="12" rx="1" fill="currentColor" opacity="0.7"/>
                <rect x="14" y="4" width="3" height="16" rx="1" fill="currentColor"/>
                <rect x="19" y="10" width="3" height="10" rx="1" fill="currentColor" opacity="0.6"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider" style={{color:'rgba(220,220,235,0.9)',textShadow:'0 0 20px rgba(200,200,220,0.1)'}}>444 Radio</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.1)',color:'rgba(200,200,220,0.4)'}}>PLUGIN</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 relative z-10">
            {/* ── Pin window toggle ── */}
            <button onClick={togglePin}
              className="p-1.5 rounded-lg transition-all"
              style={isPinned ? {background:'rgba(200,200,220,0.08)',color:'rgba(220,220,235,0.8)'} : {color:'rgba(200,200,220,0.2)'}}
              onMouseEnter={e => { if (!isPinned) e.currentTarget.style.color = 'rgba(200,200,220,0.5)' }}
              onMouseLeave={e => { if (!isPinned) e.currentTarget.style.color = 'rgba(200,200,220,0.2)' }}
              title={isPinned ? 'Unpin' : 'Pin on top'}>
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            {/* ── Preset cycle (tap to switch Portrait/Square/Wide) ── */}
            <button onClick={cyclePreset}
              className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-[10px] font-mono"
              style={{color:'rgba(200,200,220,0.3)',border:'1px solid rgba(200,200,220,0.06)'}}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(200,200,220,0.6)'; e.currentTarget.style.borderColor = 'rgba(200,200,220,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,200,220,0.3)'; e.currentTarget.style.borderColor = 'rgba(200,200,220,0.06)' }}
              title={`${WINDOW_PRESETS[windowSizeIdx].label} — tap to cycle`}>
              <span>{WINDOW_PRESETS[windowSizeIdx].icon}</span>
              <span className="hidden min-[460px]:inline">{WINDOW_PRESETS[windowSizeIdx].label}</span>
            </button>
            {/* Library */}
            <button onClick={() => { window.location.href = '/library?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '') }}
              className="p-1.5 rounded-lg transition-all" title="My Library"
              style={{color:'rgba(200,200,220,0.35)'}}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(200,200,220,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,200,220,0.35)'}>
              <BookOpen size={14} />
            </button>
            {/* Home */}
            <button onClick={() => { window.location.href = '/plugin?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '') }}
              className="p-1.5 rounded-lg transition-all" title="Plugin Home"
              style={{color:'rgba(200,200,220,0.35)'}}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(200,200,220,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,200,220,0.35)'}>
              <Home size={14} />
            </button>
            {/* Credits badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: 'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(180,180,200,0.03))', border: '1px solid rgba(200,200,220,0.12)' }}>
              <Zap size={10} style={{color:'rgba(200,200,220,0.7)'}} />
              <span className="text-[11px] font-bold tabular-nums" style={{color:'rgba(220,220,235,0.85)'}}>{userCredits ?? '...'}</span>
            </div>
          </div>
        </div>

        {/* ── Sleek top-of-chat audio player ── */}
        {playerTrack && (
          <PluginAudioPlayer
            track={playerTrack}
            playing={playingId === playerTrack.id}
            onClose={() => { setPlayerTrack(null); setPlayingId(null) }}
            onPlayStateChange={(p) => setPlayingId(p ? playerTrack.id : null)}
          />
        )}

        {/* Messages */}
        <div className={`flex-1 overflow-y-auto ${layoutMode === 'wide' ? 'px-3 py-3' : 'px-4 py-6'} space-y-4 chat-scroll-container`} style={{ paddingBottom: showBottomDock ? (layoutMode === 'wide' ? '160px' : '200px') : '100px' }}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 relative overflow-hidden ${
                msg.type === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
              }`}
                style={{
                  background: msg.type === 'user'
                    ? 'linear-gradient(135deg, rgba(16,16,20,0.92), rgba(12,12,16,0.95))'
                    : 'linear-gradient(135deg, rgba(12,12,16,0.88), rgba(10,10,14,0.92))',
                  border: msg.type === 'user'
                    ? '1px solid rgba(200,200,220,0.1)'
                    : '1px solid rgba(200,200,220,0.05)',
                  boxShadow: msg.type === 'user'
                    ? '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(200,200,220,0.05)'
                    : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(200,200,220,0.03)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}>
                {/* Text content */}
                <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                {/* Futuristic generation queue card */}
                {msg.isGenerating && (
                  <div className="mt-3">
                    <PluginGenerationQueue
                      jobs={[{
                        id: msg.id,
                        type: msg.generationType || 'music',
                        startedAt: msg.timestamp instanceof Date ? msg.timestamp.getTime() : Date.now(),
                        label: msg.generationType === 'image' ? 'Cover Art' : msg.generationType === 'effects' ? 'SFX' : msg.generationType === 'video' ? 'Video → Audio' : undefined,
                      }]}
                      onCancel={(id) => handleCancelGeneration(id)}
                    />
                  </div>
                )}

                {/* ── MUSIC RESULT CARD ── */}
                {msg.result?.audioUrl && !msg.isGenerating && (
                  <div className="mt-3 space-y-3">
                    {/* Play + Title */}
                    <div className="flex items-center gap-3">
                      <button onClick={() => handlePlayPause(msg.id, msg.result!.audioUrl!, msg.result!.title || 'AI Track', msg.result!.prompt)}
                        className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                        style={{background:'linear-gradient(135deg, rgba(220,220,235,0.85), rgba(180,180,200,0.7))',boxShadow:'0 2px 12px rgba(0,0,0,0.3), 0 0 12px rgba(200,200,220,0.1)'}}>
                        {playingId === msg.id ? <Pause size={16} className="text-black" /> : <Play size={16} className="text-black ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{msg.result.title || 'AI Track'}</p>
                        {msg.result.prompt && <p className="text-xs text-gray-400 truncate">{msg.result.prompt}</p>}
                      </div>
                    </div>

                    {/* Details dialog (same as create page) */}
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 cursor-pointer transition-colors">
                        <FileText size={12} /> Details
                      </summary>
                      <div className="mt-2 p-3 bg-black/40 rounded-lg space-y-2 text-xs">
                        {msg.result.title && <div><span className="text-gray-500">Title:</span> <span className="text-white">{msg.result.title}</span></div>}
                        {msg.result.prompt && <div><span className="text-gray-500">Prompt:</span> <span className="text-white">{msg.result.prompt}</span></div>}
                        {msg.result.lyrics && (
                          <details>
                            <summary className="text-gray-500 cursor-pointer hover:text-gray-200">View Lyrics</summary>
                            <pre className="mt-1 text-gray-300 whitespace-pre-wrap text-[10px] max-h-40 overflow-y-auto">{msg.result.lyrics}</pre>
                          </details>
                        )}
                      </div>
                    </details>

                    {/* Action buttons row — glass nodes */}
                    <div className="flex flex-wrap gap-1.5">
                      {/* MP3 Download */}
                      <button onClick={() => downloadAndToast(msg.result!.audioUrl!, msg.result!.title || 'track', 'mp3')}
                        disabled={dawDownloading !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 relative overflow-hidden group"
                        style={{ background: 'rgba(200,200,220,0.04)', border: '1px solid rgba(200,200,220,0.1)', color: 'rgba(220,220,235,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                        <Download size={12} /> MP3
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{background:'linear-gradient(135deg,rgba(200,200,220,0.06),transparent)',borderRadius:'inherit'}} />
                      </button>
                      {/* WAV Download */}
                      <button onClick={() => downloadAndToast(msg.result!.audioUrl!, msg.result!.title || 'track', 'wav')}
                        disabled={dawDownloading !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all font-semibold disabled:opacity-50 relative overflow-hidden"
                        style={{ background: 'rgba(200,200,220,0.06)', border: '1px solid rgba(200,200,220,0.15)', color: 'rgba(220,220,235,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 8px rgba(200,200,220,0.04), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <Download size={12} /> WAV
                      </button>
                      {/* Split Stems */}
                      <button onClick={() => handleSplitStems(msg.result!.audioUrl!, msg.id)} disabled={isSplittingStems}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 relative overflow-hidden"
                        style={{ background: 'rgba(200,200,220,0.04)', border: '1px solid rgba(200,200,220,0.1)', color: 'rgba(200,200,220,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                        <Scissors size={12} /> Stems <span className="text-[10px]" style={{color:'rgba(200,200,220,0.3)'}}>(-1)</span>
                      </button>
                      {/* Import to DAW — sends URL to C++ for native timeline import */}
                      {isInDAW && (
                        <button onClick={() => {
                          const title = msg.result!.title || 'AI Track'
                          const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'audio'
                          sendBridgeMessage({ action: 'import_audio', url: msg.result!.audioUrl!, title: safeName, format: 'wav' })
                          showBridgeToast(`✅ Importing to timeline — ${safeName}.wav`)
                        }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all font-semibold relative overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(220,220,235,0.08), rgba(200,200,220,0.04))',
                            border: '1px solid rgba(200,200,220,0.2)',
                            color: 'rgba(220,220,235,0.9)',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
                          }}>
                          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"><div style={{position:'absolute',top:'-100%',left:'-20%',width:'50%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.04) 45%,rgba(200,200,220,0.06) 50%,rgba(255,255,255,0.04) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                          <ArrowDownToLine size={12} className="relative z-10" /> <span className="relative z-10">Import to DAW</span>
                        </button>
                      )}
                      {/* Audio Boost */}
                      <button onClick={() => setShowBoostParamsFor({ audioUrl: msg.result!.audioUrl!, title: msg.result!.title || 'Track' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all relative overflow-hidden"
                        style={{ background: 'rgba(200,200,220,0.04)', border: '1px solid rgba(200,200,220,0.1)', color: 'rgba(200,200,220,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                        <Volume2 size={12} /> Boost <span className="text-[10px]" style={{color:'rgba(200,200,220,0.3)'}}>(-1)</span>
                      </button>
                      {/* Library — opens in plugin */}
                      <button onClick={() => { window.location.href = '/library?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '') }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all relative overflow-hidden"
                        style={{ background: 'rgba(200,200,220,0.03)', border: '1px solid rgba(200,200,220,0.08)', color: 'rgba(200,200,220,0.5)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                        <Layers size={12} /> Library
                      </button>
                    </div>
                  </div>
                )}

                {/* ── IMAGE RESULT CARD ── */}
                {msg.result?.imageUrl && !msg.result?.audioUrl && !msg.isGenerating && (
                  <div className="mt-3 space-y-3">
                    <div className="relative group rounded-xl overflow-hidden" style={{maxWidth: layoutMode === 'wide' ? '320px' : layoutMode === 'square' ? '280px' : '100%'}}>
                      <img src={msg.result.imageUrl} alt={msg.result.title || 'Generated image'} className="w-full rounded-xl" style={{maxHeight: layoutMode === 'wide' ? '240px' : '360px', objectFit: 'cover'}} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-white text-sm font-medium bg-black/60 px-3 py-1.5 rounded-full">🔍 Click to expand</span>
                      </div>
                    </div>
                    {msg.result.prompt && <p className="text-xs text-gray-400">{msg.result.prompt}</p>}
                    <div className="flex gap-2">
                      <a href={msg.result.imageUrl} download={`${msg.result.title || 'cover-art'}.jpg`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition-all">
                        <Download size={12} /> Save
                      </a>
                      {isInDAW && (
                        <button onClick={() => sendImageToDAW(msg.result!.imageUrl!, msg.result!.title || 'cover-art')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all" style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.12)',color:'rgba(200,200,220,0.7)'}}>
                          <Download size={12} /> Import to Premiere
                        </button>
                      )}
                      <button onClick={() => window.open('https://444radio.co.in/library?host=juce', '_blank')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition-all">
                        <Layers size={12} /> Library
                      </button>
                    </div>
                  </div>
                )}

                {/* ── VIDEO RESULT CARD (same as create page) ── */}
                {msg.generationType === 'video' && msg.result?.url && !msg.isGenerating && (
                  <div className="mt-3 space-y-3">
                    <div className="relative rounded-xl overflow-hidden bg-black">
                      <video
                        src={msg.result.url}
                        controls
                        playsInline
                        className="w-full aspect-video object-contain rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => handleDownload(msg.result!.url!, `${msg.result!.title || 'video'}.mp4`, 'mp3')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all" style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.12)',color:'rgba(200,200,220,0.7)'}}>
                        <Download size={12} /> Download MP4
                      </button>
                      {isInDAW ? (
                        <button onClick={() => sendVideoToDAW(msg.result!.url!, msg.result!.title || 'video')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))',
                            border: '1px solid rgba(200,200,220,0.2)',
                            color: 'rgba(220,220,235,0.8)',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 0 20px rgba(200,200,220,0.05), inset 0 1px 0 rgba(255,255,255,0.1)',
                          }}>
                          <ArrowDownToLine size={12} /> Import to DAW
                        </button>
                      ) : (
                        <button onClick={async () => {
                          try {
                            const safeName = (msg.result!.title || 'video').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'video'
                            const resp = await fetch(msg.result!.url!)
                            const blob = await resp.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${safeName}.mp4`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            setTimeout(() => URL.revokeObjectURL(url), 5000)
                            showBridgeToast?.('✅ Downloaded! Drag the .mp4 file into your Premiere Pro timeline')
                          } catch { showBridgeToast?.('❌ Download failed — try the direct download button') }
                        }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative overflow-hidden group"
                          style={{
                            background: 'linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,80,0,0.06))',
                            border: '1px solid rgba(255,140,0,0.35)',
                            color: '#ffb347',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 0 16px rgba(255,140,0,0.08), inset 0 1px 0 rgba(255,255,255,0.08)',
                          }}>
                          <Film size={12} /> Import to Premiere
                        </button>
                      )}
                      <button onClick={() => window.open('https://444radio.co.in/library?tab=videos&host=juce', '_blank')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white transition-all">
                        <Layers size={12} /> Library
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEMS RESULT CARD ── */}
                {msg.stems && Object.keys(msg.stems).length > 0 && !msg.isGenerating && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(msg.stems).map(([name, url]) => {
                      const display = getStemDisplay(name)
                      return (
                        <div key={name} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                          <span className="text-lg">{display.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-bold ${display.color}`}>{display.label}</span>
                          </div>
                          <button onClick={() => handlePlayPause(`stem-${name}-${msg.id}`, url as string, `${display.label} Stem`)}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            {playingId === `stem-${name}-${msg.id}` ? <Pause size={12} className="text-white" /> : <Play size={12} className="text-white" />}
                          </button>
                          <button onClick={() => handleDownload(url as string, `${name}.wav`, 'wav')}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <Download size={12} className="text-white" />
                          </button>
                          {/* Download stem WAV for DAW */}
                          <button
                            onClick={() => downloadForDAW(url as string, `${display.label} Stem`)}
                            disabled={dawDownloading !== null}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                            style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.1)'}}
                            title={`Download ${display.label} WAV`}>
                            {dawDownloading === `${url}-${display.label} Stem` ? <Loader2 size={12} className="animate-spin" style={{color:'rgba(200,200,220,0.6)'}} /> : <ArrowDownToLine size={12} style={{color:'rgba(200,200,220,0.6)'}} />}
                            <span className="text-[9px] font-medium" style={{color:'rgba(200,200,220,0.45)'}}>WAV</span>
                          </button>
                          <button onClick={() => setShowBoostParamsFor({ audioUrl: url as string, title: display.label })}
                            className="p-1.5 bg-orange-500/10 hover:bg-orange-500/20 rounded-full transition-colors" title="Boost this stem">
                            <Volume2 size={12} className="text-orange-400" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Silver Glass Bottom Dock ── */}
        <div className="sticky bottom-0 left-0 right-0 z-30">
          {/* Toggle button */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowBottomDock(!showBottomDock)}
              className="px-5 py-1 rounded-t-xl transition-all duration-200"
              style={{
                background: 'rgba(8,8,12,0.88)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderTop: '1px solid rgba(200,200,220,0.08)',
                borderLeft: '1px solid rgba(200,200,220,0.04)',
                borderRight: '1px solid rgba(200,200,220,0.04)',
                color: 'rgba(200,200,220,0.25)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(200,200,220,0.6)'; e.currentTarget.style.background = 'rgba(200,200,220,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(200,200,220,0.25)'; e.currentTarget.style.background = 'rgba(8,8,12,0.88)' }}
              title={showBottomDock ? 'Hide prompt bar' : 'Show prompt bar'}
            >
              {showBottomDock ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
          <div
            className={`transition-all duration-300 ease-out relative overflow-hidden ${showBottomDock ? 'max-h-[500px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
            style={{
              background: 'linear-gradient(180deg, rgba(10,10,14,0.95), rgba(6,6,10,0.98))',
              backdropFilter: 'blur(60px) saturate(1.1)',
              WebkitBackdropFilter: 'blur(60px) saturate(1.1)',
              borderTop: '1px solid rgba(200,200,220,0.04)',
              boxShadow: '0 -12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,200,220,0.03)',
            }}
          >
          {/* Top edge subtle accent */}
          <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none" style={{background:'linear-gradient(90deg,transparent 10%,rgba(200,200,220,0.06) 40%,rgba(200,200,220,0.1) 50%,rgba(200,200,220,0.06) 60%,transparent 90%)'}} />
          <div className="pt-3 pb-3 px-3 relative z-10">
            {/* Icon Row */}
            <div className={`flex items-center justify-center gap-1 mb-2 ${layoutMode === 'wide' ? 'gap-0.5' : 'gap-1'} flex-wrap`}>
              {/* Music */}
              <button onClick={() => { setSelectedType('music'); setShowAdvancedButtons(!showAdvancedButtons) }}
                className={`p-2.5 rounded-xl transition-all duration-200 ${selectedType === 'music' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={selectedType === 'music' ? { background: 'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))', border: '1px solid rgba(200,200,220,0.2)', color: 'rgba(220,220,235,0.9)', boxShadow: '0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(200,200,220,0.08)' } : { border: '1px solid rgba(200,200,220,0.04)' }}
                title="Music"><Music size={18} /></button>
              {/* Effects */}
              <button onClick={() => setSelectedType('effects')}
                className={`p-2.5 rounded-xl transition-all duration-200 ${selectedType === 'effects' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={selectedType === 'effects' ? { background: 'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))', border: '1px solid rgba(200,200,220,0.2)', color: 'rgba(220,220,235,0.9)', boxShadow: '0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(200,200,220,0.08)' } : { border: '1px solid rgba(200,200,220,0.04)' }}
                title="Effects"><Sparkles size={18} /></button>
              {/* Loops */}
              <button onClick={() => setSelectedType('loops' as GenerationType)}
                className={`p-2.5 rounded-xl transition-all duration-200 ${(selectedType as string) === 'loops' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={(selectedType as string) === 'loops' ? { background: 'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))', border: '1px solid rgba(200,200,220,0.2)', color: 'rgba(220,220,235,0.9)', boxShadow: '0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(200,200,220,0.08)' } : { border: '1px solid rgba(200,200,220,0.04)' }}
                title="Loops"><Repeat size={18} /></button>
              {/* Image */}
              <button onClick={() => setSelectedType('image')}
                className={`p-2.5 rounded-xl transition-all duration-200 ${selectedType === 'image' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={selectedType === 'image' ? { background: 'linear-gradient(135deg, rgba(200,200,220,0.08), rgba(180,180,200,0.04))', border: '1px solid rgba(200,200,220,0.2)', color: 'rgba(220,220,235,0.9)', boxShadow: '0 0 16px rgba(200,200,220,0.06), inset 0 1px 0 rgba(200,200,220,0.08)' } : { border: '1px solid rgba(200,200,220,0.04)' }}
                title="Cover Art"><ImageIcon size={18} /></button>
              
              <div className="w-px h-6 mx-1" style={{background:'linear-gradient(to bottom, transparent, rgba(200,200,220,0.1), transparent)'}} />

              {/* Lyrics / Settings */}
              {selectedType === 'music' && !isInstrumental && (
                <button onClick={() => setShowLyricsModal(true)}
                  className="p-2.5 rounded-xl transition-all"
                  style={(customTitle || genre || customLyrics || bpm) ? {background:'rgba(200,200,220,0.06)',color:'rgba(220,220,235,0.8)',border:'1px solid rgba(200,200,220,0.15)',boxShadow:'0 0 8px rgba(200,200,220,0.04)'} : {color:'rgba(200,200,220,0.25)',border:'1px solid rgba(200,200,220,0.04)'}}
                  title="Lyrics & Settings"><Edit3 size={18} /></button>
              )}

              {/* Upload */}
              <button onClick={() => openUploadModal()}
                className="p-2.5 rounded-xl transition-all" title="Upload Media"
                style={{color:'rgba(200,200,220,0.35)',border:'1px solid rgba(200,200,220,0.06)'}}>
                <Upload size={18} />
              </button>

              {/* New Chat */}
              <button onClick={handleClearChat}
                className="p-2.5 rounded-xl transition-all" title="New Chat"
                style={{color:'rgba(200,200,220,0.3)',border:'1px solid rgba(200,200,220,0.06)'}}>
                <Plus size={18} />
              </button>

              {/* Restore Chat */}
              <button onClick={() => setShowDeletedChatsModal(true)}
                className="p-2.5 rounded-xl transition-all" title="Chat History"
                style={{color:'rgba(200,200,220,0.3)',border:'1px solid rgba(200,200,220,0.06)'}}>
                <RotateCcw size={18} />
              </button>

              {/* Credits */}
              <div className={`flex items-center gap-1 ${layoutMode === 'wide' ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-xl ml-1 relative overflow-hidden`}
                style={{ background: 'linear-gradient(135deg, rgba(200,200,220,0.05), rgba(180,180,200,0.03))', border: '1px solid rgba(200,200,220,0.12)', boxShadow: '0 0 12px rgba(200,200,220,0.03), inset 0 1px 0 rgba(200,200,220,0.06)' }}>
                <Zap size={11} style={{color:'rgba(200,200,220,0.6)'}} />
                <span className="text-xs font-bold tabular-nums" style={{color:'rgba(220,220,235,0.8)'}}>{userCredits ?? '...'}</span>
                <span className="text-[10px]" style={{color:'rgba(200,200,220,0.3)'}}>
                  (-{selectedType === 'music' ? 2 : selectedType === 'image' ? 1 : selectedType === 'effects' ? 2 : (selectedType as string) === 'loops' ? 6 : 0})
                </span>
              </div>
            </div>

            {/* Instrumental mode info */}
            {isInstrumental && selectedType === 'music' && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs px-3 py-1 rounded-full" style={{color:'rgba(200,200,220,0.6)',background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)'}}>
                  🎹 Instrumental Mode — No vocals will be generated
                </span>
              </div>
            )}

            {/* ── Effects Params Panel ── */}
            {selectedType === 'effects' && (
              <div className="flex items-center justify-center gap-4 mb-2 flex-wrap px-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Duration</label>
                  <input type="range" min={1} max={10} value={effectsDuration} onChange={e => setEffectsDuration(Number(e.target.value))}
                    className="w-20 h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                  <span className="text-[10px] w-5 text-center" style={{color:'rgba(200,200,220,0.6)'}}>{effectsDuration}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Guidance</label>
                  <input type="range" min={1} max={10} step={0.5} value={effectsGuidance} onChange={e => setEffectsGuidance(Number(e.target.value))}
                    className="w-16 h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                  <span className="text-[10px] w-4 text-center" style={{color:'rgba(200,200,220,0.6)'}}>{effectsGuidance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Temp</label>
                  <input type="range" min={0.1} max={2} step={0.1} value={effectsTemperature} onChange={e => setEffectsTemperature(Number(e.target.value))}
                    className="w-16 h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                  <span className="text-[10px] w-5 text-center" style={{color:'rgba(200,200,220,0.6)'}}>{effectsTemperature}</span>
                </div>
              </div>
            )}

            {/* ── Loops Params Panel ── */}
            {(selectedType as string) === 'loops' && (
              <div className="flex items-center justify-center gap-4 mb-2 flex-wrap px-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">BPM</label>
                  <input type="number" min={60} max={300} value={loopsBpm} onChange={e => setLoopsBpm(Number(e.target.value))}
                    className="w-14 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-[11px] text-white text-center" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Duration</label>
                  <input type="range" min={1} max={20} value={loopsMaxDuration} onChange={e => setLoopsMaxDuration(Number(e.target.value))}
                    className="w-20 h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                  <span className="text-[10px] w-5 text-center" style={{color:'rgba(200,200,220,0.6)'}}>{loopsMaxDuration}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Variations</label>
                  <button onClick={() => setLoopsVariations(loopsVariations === 1 ? 2 : 1)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${loopsVariations === 2 ? '' : 'bg-white/10 text-gray-400 border border-white/10'}`}
                    style={loopsVariations === 2 ? {background:'rgba(200,200,220,0.12)',color:'rgba(220,220,235,0.8)',border:'1px solid rgba(200,200,220,0.2)'} : {}}>
                    {loopsVariations}x
                  </button>
                </div>
              </div>
            )}

            {/* Prompt Input Bar — Chrome Silver Glass */}
            <div className="relative">
              <div className={`flex items-end gap-2 rounded-2xl ${layoutMode === 'wide' ? 'px-2 py-1.5' : 'px-3 py-2'} transition-all duration-300 relative overflow-hidden`}
                style={{
                  background: 'linear-gradient(135deg, rgba(14,14,18,0.8), rgba(10,10,14,0.85))',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  border: input.trim().length >= MIN_PROMPT_LENGTH
                    ? '1px solid rgba(200,200,220,0.15)'
                    : '1px solid rgba(200,200,220,0.05)',
                  boxShadow: input.trim().length >= MIN_PROMPT_LENGTH
                    ? '0 0 20px rgba(200,200,220,0.04), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)',
                }}>
                {/* Prompt box diagonal shine */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0"><div style={{position:'absolute',top:'-100%',left:'40%',width:'45%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(200,200,220,0.015) 45%,rgba(255,255,255,0.035) 50%,rgba(200,200,220,0.015) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                
                {/* Toggle sidebar */}
                <button onClick={() => setShowFeaturesSidebar(!showFeaturesSidebar)}
                  className="flex-shrink-0 p-1.5 rounded-full transition-colors mb-0.5 relative z-10"
                  style={{color:'rgba(200,200,220,0.25)'}}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(200,200,220,0.5)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,200,220,0.25)'}>
                  <PlusCircle size={20} />
                </button>

                {/* Record button */}
                <button onClick={isRecording ? stopRecording : startRecording}
                  className={`flex-shrink-0 p-1.5 rounded-full transition-all mb-0.5 relative z-10 ${isRecording ? 'animate-pulse' : ''}`}
                  style={isRecording ? {background:'#ff0040',color:'#ffffff'} : {color:'rgba(200,200,220,0.25)'}}
                  onMouseEnter={e => { if (!isRecording) e.currentTarget.style.color = 'rgba(255,100,100,0.6)' }}
                  onMouseLeave={e => { if (!isRecording) e.currentTarget.style.color = 'rgba(200,200,220,0.25)' }}>
                  <Mic size={18} />
                </button>

                {/* INST toggle */}
                {selectedType === 'music' && (
                  <button onClick={() => setIsInstrumental(!isInstrumental)}
                    className="flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-bold transition-all mb-0.5 relative z-10"
                    style={isInstrumental
                      ? {background:'rgba(200,200,220,0.1)',color:'rgba(220,220,235,0.8)',border:'1px solid rgba(200,200,220,0.2)'}
                      : {background:'rgba(200,200,220,0.03)',color:'rgba(200,200,220,0.25)',border:'1px solid rgba(200,200,220,0.06)'}}>
                    INST
                  </button>
                )}

                {/* Input */}
                <div className="flex-1 min-w-0 relative z-10">
                  <textarea value={input} onChange={(e) => setInput(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                    placeholder={selectedType === 'music' ? 'Describe your track...' : selectedType === 'image' ? 'Describe your cover art...' : 'Describe the effect...'}
                    className="w-full bg-transparent text-white text-sm resize-none focus:outline-none min-h-[24px] max-h-[120px]"
                    style={{caretColor:'rgba(200,200,220,0.7)'}}
                    rows={1}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = 'auto'
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                    }}
                  />
                  {/* Character counter */}
                  {input.length > 0 && (
                    <div className={`text-right text-[10px] mt-0.5 ${
                      input.trim().length < MIN_PROMPT_LENGTH ? 'text-red-400' :
                      input.length > 270 ? 'text-yellow-400' : ''
                    }`} style={input.trim().length >= MIN_PROMPT_LENGTH && input.length <= 270 ? {color:'rgba(255,255,255,0.2)'} : {}}>
                      {input.length}/{MAX_PROMPT_LENGTH}
                    </div>
                  )}
                </div>

                {/* Prompt suggestions */}
                <button onClick={() => { setShowPromptSuggestions(!showPromptSuggestions); setShowIdeasFlow(false); setIdeasStep('type') }}
                  className="flex-shrink-0 p-1.5 rounded-full transition-all mb-0.5 relative z-10"
                  style={showPromptSuggestions ? {background:'rgba(200,200,220,0.08)',color:'rgba(220,220,235,0.7)',border:'1px solid rgba(200,200,220,0.15)'} : {color:'rgba(200,200,220,0.25)'}}
                  onMouseEnter={e => { if (!showPromptSuggestions) e.currentTarget.style.color = 'rgba(200,200,220,0.5)' }}
                  onMouseLeave={e => { if (!showPromptSuggestions) e.currentTarget.style.color = 'rgba(200,200,220,0.25)' }}>
                  <Lightbulb size={18} />
                </button>

                {/* Send button — frosted silver node */}
                <button onClick={handleGenerate} disabled={!input.trim() || input.trim().length < MIN_PROMPT_LENGTH}
                  className="relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-20 active:scale-90 hover:scale-110 mb-0.5 z-10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(200,200,220,0.7), rgba(160,160,180,0.6))',
                    boxShadow: '0 0 20px rgba(200,200,220,0.15), 0 0 50px rgba(200,200,220,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
                  }}>
                  {activeGenerations.size > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">{activeGenerations.size}</div>
                  )}
                  {activeGenerations.size > 0 ? <Loader2 className="text-black animate-spin" size={18} /> : <Send className="text-black ml-0.5" size={18} />}
                </button>
              </div>
            </div>

            {/* Prompt Suggestions Dropdown — fixed position so it's not clipped by dock containers */}
            {showPromptSuggestions && (
              <div className="fixed bottom-20 left-4 right-4 p-4 rounded-2xl max-h-[50vh] overflow-y-auto z-[60] relative" style={{ background: 'linear-gradient(135deg, rgba(8,8,15,0.97), rgba(5,5,10,0.98))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(200,200,220,0.1)', boxShadow: '0 16px 60px rgba(0,0,0,0.8), 0 0 20px rgba(200,200,220,0.02)', animation: 'fadeIn 0.15s ease-out' }}>
                {/* Dropdown glass shine */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"><div style={{position:'absolute',top:'-100%',left:'-20%',width:'50%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(200,200,220,0.01) 45%,rgba(255,255,255,0.04) 50%,rgba(200,200,220,0.01) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                {!showIdeasFlow ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        <Lightbulb size={14} style={{color:'rgba(200,200,220,0.6)'}} /> Quick Tags
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setShowIdeasFlow(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.12)',color:'rgba(220,220,235,0.7)'}}>✨ IDEAS</button>
                        <button onClick={() => setShowPromptSuggestions(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => { setInput(prev => prev + (prev ? ', ' : '') + tag) }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                          style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)',color:'rgba(200,200,220,0.6)'}}
                          onMouseEnter={e => {e.currentTarget.style.background='rgba(200,200,220,0.1)';e.currentTarget.style.borderColor='rgba(200,200,220,0.25)';e.currentTarget.style.color='rgba(255,255,255,0.9)'}}
                          onMouseLeave={e => {e.currentTarget.style.background='rgba(200,200,220,0.04)';e.currentTarget.style.borderColor='rgba(200,200,220,0.1)';e.currentTarget.style.color='rgba(200,200,220,0.6)'}}>
                          {tag}
                        </button>
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
                          <button onClick={() => { setSelectedPromptType('song'); setIdeasStep('genre') }}
                            className="p-6 rounded-2xl hover:scale-105 transition-all shadow-lg" style={{background:'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(200,200,220,0.02))',border:'2px solid rgba(200,200,220,0.12)'}}>
                            <div className="text-4xl mb-3">🎤</div><div className="text-lg font-bold text-white mb-1">Song</div><div className="text-xs text-gray-400">With vocals & lyrics</div>
                          </button>
                          <button onClick={() => { setSelectedPromptType('beat'); setIsInstrumental(true); setIdeasStep('genre') }}
                            className="p-6 rounded-2xl hover:scale-105 transition-all shadow-lg" style={{background:'linear-gradient(135deg, rgba(200,200,220,0.06), rgba(200,200,220,0.02))',border:'2px solid rgba(200,200,220,0.12)'}}>
                            <div className="text-4xl mb-3">🎹</div><div className="text-lg font-bold text-white mb-1">Beat</div><div className="text-xs text-gray-400">Instrumental only</div>
                          </button>
                        </div>
                      </div>
                    )}
                    {ideasStep === 'genre' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <button onClick={() => setIdeasStep('type')} className="text-sm flex items-center gap-1" style={{color:'rgba(200,200,220,0.6)'}}>← Back</button>
                          <h3 className="text-lg font-bold text-white">🎵 Select Genre</h3>
                          <button onClick={() => { setShowIdeasFlow(false); setIdeasStep('type') }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-2">
                          {GENRE_OPTIONS.map(g => (
                            <button key={g} onClick={() => handleGeneratePromptIdea(g)} disabled={generatingIdea}
                              className="px-3 py-2.5 rounded-xl text-xs font-medium transition-all hover:scale-105 disabled:opacity-50"
                              style={{background:'linear-gradient(135deg, rgba(200,200,220,0.04), rgba(200,200,220,0.08))',border:'1px solid rgba(200,200,220,0.1)',color:'rgba(200,200,220,0.6)'}}
                              onMouseEnter={e => {e.currentTarget.style.borderColor='rgba(200,200,220,0.25)';e.currentTarget.style.color='rgba(255,255,255,0.9)'}}
                              onMouseLeave={e => {e.currentTarget.style.borderColor='rgba(200,200,220,0.1)';e.currentTarget.style.color='rgba(200,200,220,0.6)'}}>
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {ideasStep === 'generating' && (
                      <div className="text-center py-8">
                        <div className="relative">
                          <div className="w-16 h-16 mx-auto rounded-full animate-spin" style={{border:'4px solid rgba(200,200,220,0.1)',borderTopColor:'rgba(200,200,220,0.5)'}} />
                          <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl">🎨</span></div>
                        </div>
                        <h3 className="text-xl font-bold text-white mt-4 mb-2">Creating Amazing Prompt...</h3>
                        <p className="text-sm text-gray-400">AI is crafting the perfect description</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Quick Info */}
            <div className={`flex items-center justify-center gap-2 ${layoutMode === 'wide' ? 'mt-1' : 'mt-2'} text-xs`}>
              <span style={{color: activeGenerations.size > 0 ? 'rgba(200,200,220,0.7)' : 'rgba(200,200,220,0.35)', textShadow: activeGenerations.size > 0 ? '0 0 12px rgba(200,200,220,0.15)' : 'none'}} className="font-mono tracking-wider">
                {activeGenerations.size > 0
                  ? `⚡ ${activeGenerations.size} generation${activeGenerations.size > 1 ? 's' : ''} in progress`
                  : `✨ ${selectedType === 'music' ? 'Create amazing tracks' : selectedType === 'image' ? 'Generate cover art' : selectedType === 'effects' ? 'Generate Text to SFX' : 'Coming soon'}`}
              </span>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ── Lyrics & Settings Modal (same as create page) ── */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowLyricsModal(false)} />
          <div className="relative w-full max-w-md max-h-[80vh] md:aspect-square bg-black/90 backdrop-blur-2xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{borderColor:'rgba(200,200,220,0.15)'}}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 size={18} style={{color:'rgba(200,200,220,0.6)'}} /> Lyrics & Settings
              </h3>
              <button onClick={() => setShowLyricsModal(false)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div id="parameters-section" className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Lyrics (hidden in instrumental) */}
              {!isInstrumental && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-red-400 uppercase tracking-wide">Lyrics *</label>
                    <button type="button" disabled={isGeneratingAtomLyrics}
                      onClick={async (e) => {
                        e.preventDefault()
                        if (!input.trim()) { alert('⚠️ Enter a prompt first!'); return }
                        if (isGeneratingAtomLyrics) return
                        setIsGeneratingAtomLyrics(true)
                        try {
                          const res = await fetch('/api/generate/atom-lyrics', {
                            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ prompt: input, language: selectedLanguage })
                          })
                          const data = await res.json()
                          if (data.success && data.lyrics) setCustomLyrics(data.lyrics)
                          else alert('❌ ' + (data.error || 'Failed'))
                        } catch { alert('❌ Failed to generate lyrics.') }
                        finally { setIsGeneratingAtomLyrics(false) }
                      }}
                      className="text-xs flex items-center gap-1 disabled:opacity-50" style={{color:'rgba(200,200,220,0.5)'}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isGeneratingAtomLyrics ? 'animate-spin' : ''}>
                        <circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="10" strokeDasharray="4 4"/>
                      </svg>
                      {isGeneratingAtomLyrics ? 'Generating...' : 'Create with Atom'}
                    </button>
                  </div>
                  <div className="relative">
                    <textarea value={customLyrics} onChange={(e) => setCustomLyrics(e.target.value)}
                      placeholder="Enter custom lyrics (required)..."
                      className="w-full px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none"
                      rows={6} />
                    {/* Dice */}
                    <button type="button" onClick={async (e) => {
                      e.preventDefault()
                      try {
                        const hook = getLanguageHook(selectedLanguage.toLowerCase())
                        if (hook && selectedLanguage.toLowerCase() !== 'english') {
                          setCustomLyrics(getLyricsStructureForLanguage(selectedLanguage.toLowerCase()))
                          if (hook.genres.length > 0 && !genre) setGenre(hook.genres[Math.floor(Math.random() * hook.genres.length)])
                        } else {
                          const params = new URLSearchParams()
                          if (input.trim()) params.append('description', input)
                          const res = await fetch(`/api/lyrics/random${params.toString() ? '?' + params : ''}`)
                          const data = await res.json()
                          if (data.success && data.lyrics) {
                            setCustomLyrics(data.lyrics.lyrics)
                            if (!genre) setGenre(data.lyrics.genre)
                            if (!customTitle) setCustomTitle(data.lyrics.title)
                          } else {
                            setCustomLyrics("[verse]\nWalking down this empty street\nNeon lights guide my way\n\n[chorus]\nLost in the rhythm of the night")
                          }
                        }
                      } catch {
                        setCustomLyrics("[verse]\nStaring at the stars above\nDreaming of tomorrow\n\n[chorus]\nHold me close, don't let me go")
                      }
                    }} className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/40 hover:bg-black/60 opacity-30 hover:opacity-100 transition-all" title="Randomize lyrics">
                      <Dices size={14} style={{color:'rgba(200,200,220,0.5)'}} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Add structure tags like [verse] [chorus]</p>
                </div>
              )}

              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-2">
                  <Globe size={14} style={{color:'rgba(200,200,220,0.5)'}} /> Language *
                </label>
                <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 appearance-none cursor-pointer"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(200,200,220,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}>
                  <option value="English">English</option>
                  <option value="chinese">中文 Chinese</option>
                  <option value="japanese">日本語 Japanese</option>
                  <option value="korean">한국어 Korean</option>
                  <option value="spanish">Español Spanish</option>
                  <option value="french">Français French</option>
                  <option value="hindi">हिन्दी Hindi</option>
                  <option value="german">Deutsch German</option>
                  <option value="portuguese">Português Portuguese</option>
                  <option value="arabic">العربية Arabic</option>
                  <option value="italian">Italiano Italian</option>
                </select>
                {(() => {
                  const hook = getLanguageHook(selectedLanguage.toLowerCase())
                  return hook && (
                    <div className="p-2 rounded-lg" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.08)'}}>
                      <p className="text-[10px] mb-1 font-semibold" style={{color:'rgba(200,200,220,0.6)'}}>💡 Popular Genres:</p>
                      <div className="flex flex-wrap gap-1">
                        {hook.genres.slice(0, 4).map((g, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[9px] rounded" style={{background:'rgba(200,200,220,0.06)',color:'rgba(200,200,220,0.6)'}}>{g}</span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ACE-Step Parameters (non-English) */}
              {selectedLanguage.toLowerCase() !== 'english' && (
                <div className="space-y-3 p-3 rounded-lg" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.08)'}}>
                  <span className="font-semibold text-[10px] uppercase tracking-wide" style={{color:'rgba(200,200,220,0.6)'}}>🎵 ACE-Step Model Parameters</span>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Audio Length</span><span style={{color:'rgba(200,200,220,0.6)'}}>{audioLengthInSeconds}s</span></label>
                    <input type="range" min="15" max="90" step="5" value={audioLengthInSeconds} onChange={e => setAudioLengthInSeconds(parseInt(e.target.value))} className="w-full h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>15s</span><span>90s</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Inference Steps</span><span style={{color:'rgba(200,200,220,0.6)'}}>{numInferenceSteps}</span></label>
                    <input type="range" min="25" max="100" step="5" value={numInferenceSteps} onChange={e => setNumInferenceSteps(parseInt(e.target.value))} className="w-full h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>25</span><span>100</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Guidance Scale</span><span style={{color:'rgba(200,200,220,0.6)'}}>{guidanceScale.toFixed(1)}</span></label>
                    <input type="range" min="1" max="15" step="0.5" value={guidanceScale} onChange={e => setGuidanceScale(parseFloat(e.target.value))} className="w-full h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>1</span><span>15</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Denoising</span><span style={{color:'rgba(200,200,220,0.6)'}}>{denoisingStrength.toFixed(2)}</span></label>
                    <input type="range" min="0.5" max="1.0" step="0.05" value={denoisingStrength} onChange={e => setDenoisingStrength(parseFloat(e.target.value))} className="w-full h-1" style={{accentColor:'rgba(200,200,220,0.5)'}} />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>0.5</span><span>1.0</span></div>
                  </div>
                </div>
              )}

              {/* Quick Tags in Modal */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Prompt Tags</label>
                <div className="flex flex-wrap gap-1">
                  {['upbeat', 'chill', 'energetic', 'melancholic', 'ambient', 'electronic', 'acoustic', 'jazz', 'rock', 'hip-hop', 'heavy bass', 'soft piano', 'synthwave', 'lo-fi beats', 'dreamy', 'trap', 'drill', 'phonk'].map(tag => (
                    <button key={tag} onClick={() => setInput(prev => prev + (prev ? ', ' : '') + tag)}
                      className="px-2 py-1 rounded-md text-[10px] transition-all" style={{background:'rgba(200,200,220,0.04)',border:'1px solid rgba(200,200,220,0.1)',color:'rgba(200,200,220,0.6)'}}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Genre</label>
                <input type="text" value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. hip-hop, lo-fi, electronic..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30" />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Title</label>
                <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Auto-generated if empty"
                  className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30 transition-all ${showTitleError ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'border-white/10'}`} />
                {showTitleError && <p className="text-xs text-red-400">Title must be 3-100 characters</p>}
              </div>

              {/* Song Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Song Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'short' as const, label: 'Short', size: '~60-90s' },
                    { value: 'medium' as const, label: 'Medium', size: '~90-150s' },
                    { value: 'long' as const, label: 'Long', size: '~150-240s' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setSongDuration(opt.value)}
                      className={`p-3 rounded-xl border text-center transition-all ${songDuration === opt.value ? 'border text-white' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}
                      style={songDuration === opt.value ? {background:'rgba(200,200,220,0.08)',borderColor:'rgba(200,200,220,0.2)',color:'rgba(220,220,235,0.9)'} : {}}>
                      <div className="text-sm font-bold">{opt.label}</div>
                      <div className="text-[10px] text-gray-500">{opt.size}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
              <button onClick={() => setShowLyricsModal(false)}
                className="w-full py-3 font-bold rounded-xl transition-all"
                style={{background:'linear-gradient(135deg, rgba(200,200,220,0.15), rgba(180,180,200,0.1))',color:'rgba(255,255,255,0.9)',border:'1px solid rgba(200,200,220,0.15)'}}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat History Modal ── */}
      {showDeletedChatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDeletedChatsModal(false)} />
          <div className="relative w-full max-w-md max-h-[70vh] bg-black/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2"><RotateCcw size={18} className="text-green-400" /> Chat History</h3>
              <button onClick={() => setShowDeletedChatsModal(false)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(() => {
                try {
                  const archives = JSON.parse(localStorage.getItem(CHAT_ARCHIVES_KEY) || '[]')
                  if (archives.length === 0) return <p className="text-center text-gray-500 text-sm py-8">No chat history yet.</p>
                  return archives.map((archive: any, idx: number) => (
                    <button key={archive.id || idx}
                      onClick={() => {
                        const restored = archive.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
                        // Archive current first
                        try {
                          if (messages.length > 1) {
                            const list = JSON.parse(localStorage.getItem(CHAT_ARCHIVES_KEY) || '[]')
                            list.unshift({ id: `chat-${Date.now()}`, messages, archivedAt: new Date(), messageCount: messages.length })
                            localStorage.setItem(CHAT_ARCHIVES_KEY, JSON.stringify(list.slice(0, 50)))
                          }
                        } catch {}
                        setMessages(restored)
                        setShowDeletedChatsModal(false)
                      }}
                      className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white font-medium">{archive.messageCount} messages</span>
                        <span className="text-[10px] text-gray-500">{new Date(archive.archivedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {archive.messages?.find((m: any) => m.type === 'user')?.content || 'Chat session'}
                      </p>
                    </button>
                  ))
                } catch { return <p className="text-center text-gray-500 text-sm py-8">Error loading history.</p> }
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Media Modal (mirrors create page's MediaUploadModal) ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeUploadModal} />
          <div className="relative w-full max-w-lg max-h-[85vh] bg-black/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload size={18} style={{color:'rgba(200,200,220,0.6)'}} /> Upload Media
              </h3>
              <button onClick={closeUploadModal} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Mode Selector (if no mode selected yet) */}
              {!uploadMode && (
                <div className="space-y-3">
                  {/* Show file preview if already dropped */}
                  {uploadFile && (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {uploadFile.type.startsWith('video/') ? <Film size={16} style={{color:'rgba(200,200,220,0.6)'}} className="flex-shrink-0" /> : <Music size={16} style={{color:'rgba(200,200,220,0.6)'}} className="flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{uploadFile.name}</p>
                            <p className="text-[10px] text-gray-500">{(uploadFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                          </div>
                        </div>
                        <button onClick={() => { setUploadFile(null); if (uploadFilePreview) URL.revokeObjectURL(uploadFilePreview); setUploadFilePreview(null) }}
                          className="p-1 hover:bg-white/10 rounded-lg"><X size={14} className="text-gray-400" /></button>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-gray-400">Choose what to do{uploadFile ? ` with ${uploadFile.name.slice(0, 30)}` : ''}:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Video to Audio — video files only */}
                    {(!uploadFile || uploadFile.type.startsWith('video/')) && (
                    <button onClick={() => setUploadMode('video-to-audio')}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Film size={16} style={{color:'rgba(200,200,220,0.6)'}} />
                        <span className="text-sm font-bold text-white">Video to Audio</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Generate synced SFX from video</p>
                      <span className="text-[9px] mt-1 inline-block" style={{color:'rgba(200,200,220,0.45)'}}>-2 to -10 credits</span>
                    </button>
                    )}

                    {/* Split Stems — audio files only */}
                    {(!uploadFile || uploadFile.type.startsWith('audio/')) && (
                    <button onClick={() => setUploadMode('stem-split')}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Scissors size={16} style={{color:'rgba(200,200,220,0.6)'}} />
                        <span className="text-sm font-bold text-white">Split Stems</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Separate vocals, drums, bass & more</p>
                      <span className="text-[9px] mt-1 inline-block" style={{color:'rgba(200,200,220,0.45)'}}>-5 credits</span>
                    </button>
                    )}

                    {/* Audio Boost — audio files only */}
                    {(!uploadFile || uploadFile.type.startsWith('audio/')) && (
                    <button onClick={() => setUploadMode('audio-boost')}
                      className="p-4 bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/40 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Volume2 size={16} className="text-orange-400" />
                        <span className="text-sm font-bold text-white">Audio Boost</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Mix & master with bass/treble/volume</p>
                      <span className="text-[9px] text-orange-400 mt-1 inline-block">-1 credit</span>
                    </button>
                    )}

                    {/* Extract: Video → Audio — video files only */}
                    {(!uploadFile || uploadFile.type.startsWith('video/')) && (
                    <button onClick={() => setUploadMode('extract-video')}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={16} style={{color:'rgba(200,200,220,0.6)'}} />
                        <span className="text-sm font-bold text-white">Extract: Video</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Extract audio track from video</p>
                      <span className="text-[9px] mt-1 inline-block" style={{color:'rgba(200,200,220,0.45)'}}>-1 credit</span>
                    </button>
                    )}

                    {/* Extract: Audio → Stem — audio files only */}
                    {(!uploadFile || uploadFile.type.startsWith('audio/')) && (
                    <button onClick={() => setUploadMode('extract-audio')}
                      className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={16} style={{color:'rgba(200,200,220,0.6)'}} />
                        <span className="text-sm font-bold text-white">Extract: Audio Stem</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Extract specific stem (vocals, bass, drums, piano, guitar) from audio</p>
                      <span className="text-[9px] mt-1 inline-block" style={{color:'rgba(200,200,220,0.45)'}}>-1 credit</span>
                    </button>
                    )}

                    {/* Autotune — audio files only */}
                    {(!uploadFile || uploadFile.type.startsWith('audio/')) && (
                    <button onClick={() => setUploadMode('autotune')}
                      className="p-4 bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/40 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Mic size={16} className="text-violet-400" />
                        <span className="text-sm font-bold text-white">Autotune</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Pitch correct vocals to any musical key & scale</p>
                      <span className="text-[9px] text-violet-400 mt-1 inline-block">-1 credit</span>
                    </button>
                    )}
                  </div>
                </div>
              )}

              {/* Selected mode content */}
              {uploadMode && (
                <div className="space-y-4">
                  {/* Back + mode title */}
                  <button onClick={() => { setUploadMode(null); setUploadError('') }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
                    <ChevronLeft size={14} /> Back to modes
                  </button>

                  <div className="flex items-center gap-2">
                    {uploadMode === 'video-to-audio' && <><Film size={18} style={{color:'rgba(200,200,220,0.6)'}} /><span className="font-bold text-white">Video to Audio</span></>}
                    {uploadMode === 'stem-split' && <><Scissors size={18} style={{color:'rgba(200,200,220,0.6)'}} /><span className="font-bold text-white">Split Stems</span></>}
                    {uploadMode === 'audio-boost' && <><Volume2 size={18} className="text-orange-400" /><span className="font-bold text-white">Audio Boost</span></>}
                    {uploadMode === 'extract-video' && <><Layers size={18} style={{color:'rgba(200,200,220,0.6)'}} /><span className="font-bold text-white">Extract: Video → Audio</span></>}
                    {uploadMode === 'extract-audio' && <><Layers size={18} style={{color:'rgba(200,200,220,0.6)'}} /><span className="font-bold text-white">Extract: Audio Stem</span></>}
                    {uploadMode === 'autotune' && <><Mic size={18} className="text-violet-400" /><span className="font-bold text-white">Autotune</span></>}
                  </div>

                  {/* File select */}
                  {!uploadFile ? (
                    <div>
                      <input ref={uploadMode === 'video-to-audio' ? uploadVideoRef : uploadMode === 'extract-video' ? uploadExtractVideoRef : uploadMode === 'stem-split' ? uploadAudioRef : uploadMode === 'audio-boost' ? uploadBoostRef : uploadMode === 'autotune' ? uploadAutotuneRef : uploadExtractAudioRef}
                        type="file"
                        accept={uploadMode === 'video-to-audio' || uploadMode === 'extract-video' ? 'video/*' : 'audio/*'}
                        className="hidden"
                        onChange={(e) => handleUploadFileSelect(e, uploadMode)} />
                      <button
                        onClick={() => {
                          const ref = uploadMode === 'video-to-audio' ? uploadVideoRef : uploadMode === 'extract-video' ? uploadExtractVideoRef : uploadMode === 'stem-split' ? uploadAudioRef : uploadMode === 'audio-boost' ? uploadBoostRef : uploadMode === 'autotune' ? uploadAutotuneRef : uploadExtractAudioRef
                          ref.current?.click()
                        }}
                        className="w-full py-8 border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl transition-all flex flex-col items-center gap-2 text-gray-400 hover:text-white">
                        <Upload size={24} />
                        <span className="text-sm font-medium">
                          {uploadMode === 'video-to-audio' || uploadMode === 'extract-video' ? 'Select Video File' : 'Select Audio File'}
                        </span>
                        <span className="text-[10px] text-gray-500">Max 500MB</span>
                      </button>
                    </div>
                  ) : (
                    /* File preview */
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {uploadFile.type.startsWith('video/') ? <Film size={16} style={{color:'rgba(200,200,220,0.6)'}} className="flex-shrink-0" /> : <Music size={16} style={{color:'rgba(200,200,220,0.6)'}} className="flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{uploadFile.name}</p>
                            <p className="text-[10px] text-gray-500">{(uploadFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                          </div>
                        </div>
                        <button onClick={() => { setUploadFile(null); if (uploadFilePreview) URL.revokeObjectURL(uploadFilePreview); setUploadFilePreview(null); setUploadError('') }}
                          className="p-1 hover:bg-white/10 rounded-lg"><X size={14} className="text-gray-400" /></button>
                      </div>
                      {/* Audio/Video preview */}
                      {uploadFilePreview && (
                        <div className="mt-2">
                          {uploadFile.type.startsWith('video/') ? (
                            <video src={uploadFilePreview} controls className="w-full max-h-32 rounded-lg" />
                          ) : (
                            <audio src={uploadFilePreview} controls className="w-full" />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Mode-specific settings ── */}

                  {/* Video to Audio: prompt + HQ toggle */}
                  {uploadMode === 'video-to-audio' && uploadFile && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sound Description *</label>
                        <textarea value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)}
                          placeholder="Describe the sounds you want (e.g. 'footsteps on gravel, birds chirping, wind')"
                          rows={3}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-white">HQ Mode</p>
                          <p className="text-[10px] text-gray-500">Higher quality, slower generation (10 credits)</p>
                        </div>
                        <button onClick={() => setVideoHQ(!videoHQ)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${videoHQ ? 'bg-white/40' : 'bg-white/20'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${videoHQ ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Audio Boost: sliders + toggles */}
                  {uploadMode === 'audio-boost' && uploadFile && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                            <span>Bass Boost</span><span className="text-orange-400">{boostBass > 0 ? '+' : ''}{boostBass} dB</span>
                          </label>
                          <input type="range" min="-10" max="10" step="1" value={boostBass} onChange={e => setBoostBass(parseInt(e.target.value))}
                            className="w-full accent-orange-500 h-1" />
                          <div className="flex justify-between text-[9px] text-gray-600"><span>-10</span><span>0</span><span>+10</span></div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                            <span>Treble Boost</span><span className="text-orange-400">{boostTreble > 0 ? '+' : ''}{boostTreble} dB</span>
                          </label>
                          <input type="range" min="-10" max="10" step="1" value={boostTreble} onChange={e => setBoostTreble(parseInt(e.target.value))}
                            className="w-full accent-orange-500 h-1" />
                          <div className="flex justify-between text-[9px] text-gray-600"><span>-10</span><span>0</span><span>+10</span></div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                            <span>Volume Boost</span><span className="text-orange-400">{boostVolume}x</span>
                          </label>
                          <input type="range" min="1" max="5" step="0.5" value={boostVolume} onChange={e => setBoostVolume(parseFloat(e.target.value))}
                            className="w-full accent-orange-500 h-1" />
                          <div className="flex justify-between text-[9px] text-gray-600"><span>1x</span><span>3x</span><span>5x</span></div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => setBoostNormalize(!boostNormalize)}
                          className={`flex-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${boostNormalize ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                          Normalize {boostNormalize ? '✓' : ''}
                        </button>
                        <button onClick={() => setBoostNoiseReduction(!boostNoiseReduction)}
                          className={`flex-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${boostNoiseReduction ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                          Noise Reduction {boostNoiseReduction ? '✓' : ''}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-400">Format</label>
                          <select value={boostFormat} onChange={e => setBoostFormat(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500/50">
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                            <option value="flac">FLAC</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-gray-400">Bitrate</label>
                          <select value={boostBitrate} onChange={e => setBoostBitrate(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500/50">
                            <option value="128k">128k</option>
                            <option value="192k">192k</option>
                            <option value="256k">256k</option>
                            <option value="320k">320k</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extract Audio: stem picker */}
                  {uploadMode === 'extract-audio' && uploadFile && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Select Stem to Extract</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: 'vocals' as const, label: '🎤 Vocals', active: 'bg-pink-500/20 border-pink-500/40 text-pink-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'bass' as const, label: '🎸 Bass', active: 'border text-white', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'drums' as const, label: '🥁 Drums', active: 'bg-orange-500/20 border-orange-500/40 text-orange-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'piano' as const, label: '🎹 Piano', active: 'bg-blue-500/20 border-blue-500/40 text-blue-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'guitar' as const, label: '🎸 Guitar', active: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'other' as const, label: '🎶 Other', active: 'border text-white', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                        ] as const).map(stem => (
                          <button key={stem.value} onClick={() => setExtractStem(stem.value)}
                            className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${extractStem === stem.value ? stem.active : stem.inactive}`}>
                            {stem.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Autotune: key & scale picker */}
                  {uploadMode === 'autotune' && uploadFile && (
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Key & Scale</label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {MUSICAL_KEYS.map((k) => (
                          <button key={k} onClick={() => setAutotuneKey(k)}
                            className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                              autotuneKey === k
                                ? 'bg-violet-500 text-black shadow-lg shadow-violet-500/30'
                                : 'bg-white/5 text-gray-300 hover:bg-violet-500/20 hover:text-violet-300 border border-white/10'
                            }`}>
                            {k}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setAutotuneScale('maj')}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                            autotuneScale === 'maj' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                          }`}>
                          Major (Happy)
                        </button>
                        <button onClick={() => setAutotuneScale('min')}
                          className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                            autotuneScale === 'min' ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                          }`}>
                          Minor (Dark)
                        </button>
                      </div>
                      <p className="text-[10px] text-violet-400">Selected: {autotuneKey}:{autotuneScale} · 1 credit</p>
                    </div>
                  )}

                  {/* Error display */}
                  {uploadError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-300">{uploadError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer: Process button */}
            {uploadMode && uploadFile && (
              <div className="px-5 py-4 border-t border-white/10">
                <button onClick={handleUploadModalProcess} disabled={isUploading || (uploadMode === 'video-to-audio' && !videoPrompt.trim())}
                  className="w-full py-3 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{background:'linear-gradient(135deg, rgba(200,200,220,0.15), rgba(180,180,200,0.1))',color:'rgba(255,255,255,0.9)',border:'1px solid rgba(200,200,220,0.15)'}}>
                  {isUploading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><Zap size={16} /> Process File</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Audio Boost Params Modal ── */}
      {showBoostParamsFor && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowBoostParamsFor(null)}>
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-6 w-[380px] max-w-[90vw] space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-orange-300 flex items-center gap-2"><Volume2 size={18} /> Audio Boost</h3>
              <button onClick={() => setShowBoostParamsFor(null)} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-400 truncate">Track: {showBoostParamsFor.title}</p>

            {/* Bass Boost */}
            <div className="space-y-1">
              <label className="text-xs text-gray-300 flex justify-between"><span>Bass Boost</span><span className="text-orange-400">{boostBass} dB</span></label>
              <input type="range" min={-10} max={10} value={boostBass} onChange={e => setBoostBass(Number(e.target.value))} className="w-full accent-orange-500 h-1.5" />
            </div>

            {/* Treble Boost */}
            <div className="space-y-1">
              <label className="text-xs text-gray-300 flex justify-between"><span>Treble Boost</span><span className="text-orange-400">{boostTreble} dB</span></label>
              <input type="range" min={-10} max={10} value={boostTreble} onChange={e => setBoostTreble(Number(e.target.value))} className="w-full accent-orange-500 h-1.5" />
            </div>

            {/* Volume Boost */}
            <div className="space-y-1">
              <label className="text-xs text-gray-300 flex justify-between"><span>Volume Boost</span><span className="text-orange-400">{boostVolume}</span></label>
              <input type="range" min={0} max={10} step={0.5} value={boostVolume} onChange={e => setBoostVolume(Number(e.target.value))} className="w-full accent-orange-500 h-1.5" />
            </div>

            {/* Toggles row */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={boostNormalize} onChange={e => setBoostNormalize(e.target.checked)} className="accent-orange-500" /> Normalize
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input type="checkbox" checked={boostNoiseReduction} onChange={e => setBoostNoiseReduction(e.target.checked)} className="accent-orange-500" /> Noise Reduction
              </label>
            </div>

            {/* Format & Bitrate */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-gray-400">Format</label>
                <select value={boostFormat} onChange={e => setBoostFormat(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="mp3">MP3</option><option value="wav">WAV</option>
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs text-gray-400">Bitrate</label>
                <select value={boostBitrate} onChange={e => setBoostBitrate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white">
                  <option value="128k">128k</option><option value="192k">192k</option><option value="320k">320k</option>
                </select>
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={() => {
                handleAudioBoost(showBoostParamsFor.audioUrl, showBoostParamsFor.title, {
                  bass: boostBass, treble: boostTreble, volume: boostVolume,
                  normalize: boostNormalize, noiseReduction: boostNoiseReduction,
                  format: boostFormat, bitrate: boostBitrate
                });
                setShowBoostParamsFor(null);
              }}
              className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <Volume2 size={14} /> Apply Boost <span className="text-xs opacity-70">(-1 credit)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Drag-in file overlay — futuristic silver ── */}
      {isDraggingFileOver && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none" style={{background:'radial-gradient(ellipse at center, rgba(0,0,0,0.92), rgba(0,0,0,0.97))',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)'}}>
          {/* Animated ring */}
          <div className="relative w-48 h-48 mb-6">
            <div className="absolute inset-0 rounded-full" style={{border:'2px solid rgba(200,200,220,0.15)',animation:'spin 8s linear infinite'}} />
            <div className="absolute inset-3 rounded-full" style={{border:'1px dashed rgba(200,200,220,0.25)',animation:'spin 12s linear infinite reverse'}} />
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Visualizer SVG icon */}
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{filter:'drop-shadow(0 0 20px rgba(200,210,230,0.3))'}}>
                <rect x="6" y="24" width="4" height="16" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar1 0.8s ease-in-out infinite alternate'}} />
                <rect x="14" y="16" width="4" height="32" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar2 0.6s ease-in-out infinite alternate'}} />
                <rect x="22" y="8" width="4" height="48" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar3 0.7s ease-in-out infinite alternate'}} />
                <rect x="30" y="12" width="4" height="40" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar2 0.5s ease-in-out infinite alternate'}} />
                <rect x="38" y="6" width="4" height="52" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar1 0.9s ease-in-out infinite alternate'}} />
                <rect x="46" y="16" width="4" height="32" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar3 0.55s ease-in-out infinite alternate'}} />
                <rect x="54" y="22" width="4" height="20" rx="2" fill="url(#dropGrad)" style={{animation:'eqBar2 0.75s ease-in-out infinite alternate'}} />
                <defs>
                  <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="64">
                    <stop offset="0%" stopColor="#e0e0e8" />
                    <stop offset="100%" stopColor="#808090" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold tracking-wide" style={{color:'rgba(220,220,235,0.95)',textShadow:'0 0 30px rgba(200,200,220,0.2)'}}>Drop to Process</p>
          <p className="text-sm mt-2" style={{color:'rgba(180,180,200,0.6)'}}>Audio & video up to 500 MB — stems, boost, effects & more</p>
          {!isPinned && (
            <div className="mt-6 px-5 py-2.5 rounded-xl" style={{background:'rgba(200,200,220,0.06)',border:'1px solid rgba(200,200,220,0.15)'}}>
              <p className="text-xs text-center leading-relaxed" style={{color:'rgba(200,200,220,0.7)'}}>
                <Pin size={10} className="inline mr-1" style={{position:'relative',top:'1px'}} /> Pin window to enable drag & drop from DAW
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Post-Generation Modal (downloads, stems, boost, release) ── */}
      <PluginPostGenModal
        isOpen={showPostGenModal}
        onClose={() => setShowPostGenModal(false)}
        result={postGenResult}
        token={token}
        userCredits={userCredits}
        isInDAW={isInDAW}
        onBridgeDownload={(url, title, format) => {
          // Download to user's machine (same as inline buttons)
          downloadAndToast(url, title, format)
        }}
        onSplitStems={(audioUrl, messageId) => {
          setShowPostGenModal(false)
          handleSplitStems(audioUrl, messageId)
        }}
        onAudioBoost={(audioUrl, title) => {
          setShowPostGenModal(false)
          setShowBoostParamsFor({ audioUrl, title })
        }}
        onCreditsChange={(credits) => setUserCredits(credits)}
        onPlayPause={(messageId, audioUrl, title, prompt) => handlePlayPause(messageId, audioUrl, title, prompt)}
        playingId={playingId}
      />

      {/* ── Split Stems Modal — per-stem isolation with WAV output ── */}
      <SplitStemsModal
        isOpen={showSplitStemsModal}
        onClose={() => {
          setShowSplitStemsModal(false)
          if (stemAudioRef.current) { stemAudioRef.current.pause(); stemAudioRef.current = null }
          setStemPlayingId(null)
        }}
        audioUrl={splitStemsAudioUrl || ''}
        trackTitle={splitStemsTrackTitle}
        onSplitStem={handleSplitSingleStem}
        processingStem={splitStemsProcessing}
        completedStems={splitStemsCompleted}
        onPlayStem={handlePlayStemInModal}
        playingId={stemPlayingId}
        onImportToDAW={isInDAW ? (url, title) => {
          const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'stem'
          sendBridgeMessage({ action: 'import_audio', url, title: safeName, format: 'wav' })
          showBridgeToast(`✅ Importing ${safeName}.wav to DAW`)
        } : undefined}
        isInDAW={isInDAW}
        userCredits={userCredits}
      />

      {/* ── Visualizer Modal — Text/Image to Video ── */}
      <VisualizerModal
        isOpen={showVisualizerModal}
        onClose={() => setShowVisualizerModal(false)}
        userCredits={userCredits ?? undefined}
        initialPrompt={input}
        authToken={token ?? undefined}
        onGenerationStart={(prompt: string, generationId: string) => {
          const userMsgId = Date.now().toString()
          const genMsgId = (Date.now() + 1).toString()
          setMessages(prev => [...prev,
            { id: userMsgId, type: 'user' as MessageType, content: `🎬 Generate video: "${prompt}"`, timestamp: new Date() },
            { id: genMsgId, type: 'generation' as MessageType, content: '🎬 Generating video...', generationType: 'video', generationId, isGenerating: true, timestamp: new Date() }
          ])
          setInput('')
        }}
        onSuccess={(videoUrl: string, prompt: string, mediaId: string | null) => {
          setMessages(prev => {
            let idx = -1
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].isGenerating && prev[i].generationType === 'video') { idx = i; break }
            }
            if (idx === -1) return prev
            const updated = [...prev]
            updated[idx] = { ...updated[idx], isGenerating: false, content: '✅ Video generated!', result: { url: videoUrl, title: `Visualizer: ${prompt.substring(0, 40)}`, prompt } }
            return updated
          })
          // Save to local plugin library (same as music)
          try {
            const lib = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')
            lib.unshift({ id: Date.now(), type: 'video', title: `Visualizer: ${prompt.substring(0, 40)}`, videoUrl, audioUrl: videoUrl, prompt, mediaId, createdAt: new Date().toISOString() })
            localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib.slice(0, 200)))
          } catch {}
          refreshCredits()
        }}
      />

      {/* ── Global Styles (no style jsx — regular style tag) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes eqBar1 { 0%, 100% { height: 8px; } 50% { height: 20px; } }
        @keyframes eqBar2 { 0%, 100% { height: 14px; } 50% { height: 6px; } }
        @keyframes eqBar3 { 0%, 100% { height: 10px; } 50% { height: 22px; } }
        /* Scrollbar styling */
        .chat-scroll-container::-webkit-scrollbar { width: 4px; }
        .chat-scroll-container::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll-container::-webkit-scrollbar-thumb { background: rgba(200,200,220,0.1); border-radius: 4px; }
        .chat-scroll-container::-webkit-scrollbar-thumb:hover { background: rgba(200,200,220,0.2); }
        select option { background: #080810; color: white; }
        .generating-glow { box-shadow: 0 0 20px rgba(200,200,220,0.06), 0 0 40px rgba(200,200,220,0.03); }

        /* ═══ Universal responsive plugin sizing ═══ */
        html, body { 
          width: 100% !important; 
          height: 100% !important; 
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        * { box-sizing: border-box; }
        /* GPU-accelerate the chat scroll for smooth scrolling */
        .chat-scroll-container { will-change: scroll-position; contain: layout style; }
        @media (max-height: 550px) {
          .chat-scroll-container { font-size: 13px; }
        }
        @media (max-width: 500px) {
          .chat-scroll-container { font-size: 13px; }
        }
        img, video { max-width: 100%; height: auto; }
      `}} />
    </div>
  )
}
