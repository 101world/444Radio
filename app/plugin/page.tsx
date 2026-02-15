'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import Script from 'next/script'
import {
  Music, Image as ImageIcon, Send, Loader2, Download, Play, Pause,
  Sparkles, Zap, X, Rocket, PlusCircle, Globe, Mic, MicOff,
  Edit3, Dices, Upload, RotateCcw, Repeat, Plus, Square, FileText,
  Layers, Film, Scissors, Volume2, ChevronLeft, ChevronDown, ChevronUp, Lightbulb, Settings,
  RotateCw, Save, RefreshCw, AlertCircle, Compass, ExternalLink, Home,
  BookOpen, ArrowDownToLine, Pin, PinOff, Maximize2, Minimize2
} from 'lucide-react'
import { getLanguageHook, getSamplePromptsForLanguage, getLyricsStructureForLanguage } from '@/lib/language-hooks'
import PluginAudioPlayer from '@/app/components/PluginAudioPlayer'
import PluginGenerationQueue from '@/app/components/PluginGenerationQueue'
import PluginPostGenModal from '@/app/components/PluginPostGenModal'

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

// ─── Window size presets for JUCE plugin ────────────────────────
const WINDOW_SIZES = [
  { label: 'Compact', w: 480, h: 600 },
  { label: 'Default', w: 640, h: 800 },
  { label: 'Wide',    w: 900, h: 700 },
  { label: 'Full',    w: 1200, h: 900 },
] as const

// ─── Stem display helper (same as create page) ─────────────────
function getStemDisplay(stemName: string): { label: string; color: string; emoji: string } {
  const n = stemName.toLowerCase()
  if (n.includes('vocal') || n.includes('voice')) return { label: 'Vocals', color: 'text-pink-400', emoji: '🎤' }
  if (n.includes('drum') || n.includes('percussion')) return { label: 'Drums', color: 'text-orange-400', emoji: '🥁' }
  if (n.includes('bass')) return { label: 'Bass', color: 'text-purple-400', emoji: '🎸' }
  if (n.includes('guitar')) return { label: 'Guitar', color: 'text-yellow-400', emoji: '🎸' }
  if (n.includes('piano') || n.includes('keys')) return { label: 'Piano', color: 'text-blue-400', emoji: '🎹' }
  if (n.includes('other') || n.includes('inst')) return { label: 'Other', color: 'text-cyan-400', emoji: '🎶' }
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
  { key: 'video-to-audio', icon: Film, label: 'Video to Audio', desc: 'Synced SFX from video', color: 'cyan', cost: 2 },
  { key: 'stems', icon: Scissors, label: 'Split Stems', desc: 'Vocals, drums, bass & more', color: 'purple', cost: 5 },
  { key: 'audio-boost', icon: Volume2, label: 'Audio Boost', desc: 'Mix & master your track', color: 'orange', cost: 1 },
  { key: 'extract', icon: Layers, label: 'Extract', desc: 'Extract audio from video/audio', color: 'cyan', cost: 1 },
  { key: 'lyrics', icon: Edit3, label: 'Lyrics', desc: 'Write & edit lyrics', color: 'cyan', cost: 0, conditionalMusic: true },
  { key: 'upload', icon: Upload, label: 'Upload', desc: 'Upload audio/video', color: 'purple', cost: 0 },
  { key: 'release', icon: Rocket, label: 'Release', desc: 'Publish to feed', color: 'cyan', cost: 0 },
]

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PluginPage() {
  // ── Auth ──
  const [token, setToken] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // ── Layout ──
  const [isMobile, setIsMobile] = useState(false)
  const [showFeaturesSidebar, setShowFeaturesSidebar] = useState(false)
  const [showBottomDock, setShowBottomDock] = useState(true)

  // ── Plugin window pin & resize ──
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(PIN_KEY) === 'true'
    return false
  })
  const [windowSizeIdx, setWindowSizeIdx] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SIZE_KEY)
      return stored ? parseInt(stored, 10) : 1 // default
    }
    return 1
  })
  const [showSizeMenu, setShowSizeMenu] = useState(false)
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

  // ── Upload Media Modal (mirrors MediaUploadModal from create page) ──
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadMode, setUploadMode] = useState<'video-to-audio' | 'stem-split' | 'audio-boost' | 'extract-video' | 'extract-audio' | null>(null)
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

  // File input refs per mode (correct accept types)
  const uploadVideoRef = useRef<HTMLInputElement>(null)
  const uploadAudioRef = useRef<HTMLInputElement>(null)
  const uploadBoostRef = useRef<HTMLInputElement>(null)
  const uploadExtractVideoRef = useRef<HTMLInputElement>(null)
  const uploadExtractAudioRef = useRef<HTMLInputElement>(null)

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

  // ═══ AUTH: Extract token from URL or localStorage ═══
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken)
      setToken(urlToken)
    } else {
      const saved = localStorage.getItem(TOKEN_KEY)
      if (saved) {
        setToken(saved)
      } else {
        // No token found — stop loading so auth screen shows
        setIsLoadingCredits(false)
      }
    }
  }, [])

  // ═══ AUTH: Verify token on mount ═══
  const [authError, setAuthError] = useState<string | null>(null)
  const [needsPurchase, setNeedsPurchase] = useState(false)
  const [buyingPlugin, setBuyingPlugin] = useState(false)
  useEffect(() => {
    if (!token) {
      setIsLoadingCredits(false)
      return
    }
    setAuthError(null)
    setNeedsPurchase(false)
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

          // If denied because no purchase — keep token, show buy button
          if (res.status === 403 && errorMsg.includes('$25')) {
            setNeedsPurchase(true)
            setAuthError(errorMsg)
            setIsAuthenticated(false)
            setIsLoadingCredits(false)
          } else {
            // Clear invalid token so user can re-enter
            localStorage.removeItem(TOKEN_KEY)
            setToken(null)
            setAuthError(errorMsg)
            setIsAuthenticated(false)
            setIsLoadingCredits(false)
          }
        }
      } catch {
        setAuthError('Network error — could not reach server')
        setIsAuthenticated(false)
        setIsLoadingCredits(false)
      }
    })()
  }, [token])

  // ═══ LAYOUT: detect mobile ═══
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
          // Smart default mode based on file type
          if (isVideo) {
            setUploadMode('video-to-audio')
          } else {
            setUploadMode('stem-split')
          }
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
    sendBridgeMessage({ action: 'pin_window', pinned: next })
    showBridgeToast(next ? '📌 Window pinned — stays on top' : '📌 Window unpinned')
  }

  const setWindowSize = (idx: number) => {
    setWindowSizeIdx(idx)
    setShowSizeMenu(false)
    localStorage.setItem(SIZE_KEY, String(idx))
    const size = WINDOW_SIZES[idx]
    // Send to JUCE C++ bridge
    sendBridgeMessage({ action: 'resize_window', width: size.w, height: size.h, preset: size.label })
    // Direct window resize fallback + force CSS dimensions for WebView2
    try {
      window.resizeTo(size.w, size.h)
      document.documentElement.style.width = size.w + 'px'
      document.documentElement.style.height = size.h + 'px'
      document.body.style.width = size.w + 'px'
      document.body.style.height = size.h + 'px'
    } catch {}
    showBridgeToast(`↔ ${size.label} (${size.w}×${size.h})`)
  }

  // Send persisted pin/size state to JUCE on mount
  useEffect(() => {
    if (isInDAW) {
      if (isPinned) sendBridgeMessage({ action: 'pin_window', pinned: true })
      const size = WINDOW_SIZES[windowSizeIdx]
      sendBridgeMessage({ action: 'resize_window', width: size.w, height: size.h, preset: size.label })
      try {
        window.resizeTo(size.w, size.h)
        document.documentElement.style.width = size.w + 'px'
        document.documentElement.style.height = size.h + 'px'
        document.body.style.width = size.w + 'px'
        document.body.style.height = size.h + 'px'
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInDAW])

  const sendToDAW = (url: string, title: string, format: 'mp3' | 'wav' = 'wav') => {
    const safeName = title.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'audio'
    // Send direct R2 URL to C++ — native HTTP, no CORS issues
    sendBridgeMessage({ action: 'import_audio', url, title: safeName, format })
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
        body: JSON.stringify({ prompt })
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
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Generation failed'}` } : msg
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
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Image generation failed'}` } : msg
          ))
          refreshCredits()
        }
      } catch {
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ Generation failed.' } : msg
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
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Failed'}` } : msg
          ))
        }
      } catch {
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ Generation failed.' } : msg
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
            msg.id === genMsgId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Loops generation failed'}` } : msg
          ))
        }
      } catch {
        setMessages(prev => prev.map(msg =>
          msg.id === genMsgId ? { ...msg, isGenerating: false, content: '❌ Loops generation failed.' } : msg
        ))
      } finally {
        setActiveGenerations(prev => { const s = new Set(prev); s.delete(genMsgId); return s })
        refreshCredits()
      }
      return
    }

    // ── File-based features: trigger upload dialog ──
    if (['stems', 'audio-boost', 'extract', 'video-to-audio'].includes(selectedType as string)) {
      triggerFeatureUpload(selectedType as string)
      return
    }
  }

  // ═══ STEM SPLITTING ═══
  const handleSplitStems = async (audioUrl: string, messageId: string) => {
    if (userCredits !== null && userCredits < 5) {
      alert(`⚡ Need 5 credits for stems, have ${userCredits}.`)
      return
    }
    setIsSplittingStems(true)
    const processingId = `${messageId}-stems`
    setMessages(prev => [...prev, {
      id: processingId, type: 'assistant',
      content: '🎵 Splitting stems... This may take 1-2 minutes.',
      timestamp: new Date(), isGenerating: true
    }])
    const abort = new AbortController()
    abortControllersRef.current.set(processingId, abort)

    try {
      const res = await fetch('/api/plugin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'stems', audioUrl }),
        signal: abort.signal
      })
      let result: any = null
      await parseNDJSON(res, () => {}, (r) => { result = r }, abort.signal)

      if (result?.success && result.stems) {
        setMessages(prev => prev.map(msg =>
          msg.id === processingId ? {
            ...msg, isGenerating: false,
            content: `✅ Stems separated! Used ${result.creditsDeducted || 5} credits.`,
            stems: result.stems
          } : msg
        ))
        if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === processingId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Stem splitting failed'}` } : msg
        ))
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setMessages(prev => prev.map(msg =>
        msg.id === processingId ? { ...msg, isGenerating: false, content: '❌ Stem splitting failed.' } : msg
      ))
    } finally {
      abortControllersRef.current.delete(processingId)
      setIsSplittingStems(false)
      refreshCredits()
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
          msg.id === processingId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Boost failed'}` } : msg
        ))
      }
    } catch {
      setMessages(prev => prev.map(msg =>
        msg.id === processingId ? { ...msg, isGenerating: false, content: '❌ Boost failed.' } : msg
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
      'video-to-audio': '🎬 Generating synced audio from video...'
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
        : featureType === 'extract-video' ? 'extract'
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
        body.type = 'extract'
        body.audioUrl = publicUrl
        body.trackTitle = file.name
      } else if (featureType === 'video-to-audio') {
        body.videoUrl = publicUrl
        body.prompt = extraParams?.prompt || ''
        body.quality = extraParams?.quality || 'standard'
      } else if (featureType === 'extract') {
        body.audioUrl = publicUrl
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
              content: `✅ ${featureType === 'audio-boost' ? 'Audio boosted' : 'Processing complete'}! Used ${result.creditsDeducted || 0} credits.`,
              result: { audioUrl: result.audioUrl, title: result.title || file.name, prompt: featureType }
            } : msg
          ))
        }
        if (result.creditsRemaining !== undefined) setUserCredits(result.creditsRemaining)
      } else {
        setMessages(prev => prev.map(msg =>
          msg.id === processingId ? { ...msg, isGenerating: false, content: `❌ ${result?.error || 'Processing failed'}` } : msg
        ))
      }
    } catch (err: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === processingId ? { ...msg, isGenerating: false, content: `❌ ${err?.message || 'Processing failed'}` } : msg
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

    // Size check (100MB)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File size must be under 100MB')
      return
    }

    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')

    // Type validation per mode
    if ((mode === 'video-to-audio' || mode === 'extract-video') && !isVideo) {
      setUploadError('Please select a video file')
      return
    }
    if ((mode === 'stem-split' || mode === 'audio-boost' || mode === 'extract-audio') && !isAudio) {
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
    } else if (uploadMode === 'extract-audio') {
      extraParams.stem = extractStem
    } else if (uploadMode === 'video-to-audio') {
      extraParams.prompt = videoPrompt
      extraParams.quality = videoHQ ? 'hq' : 'standard'
    }

    // Map mode to featureType
    const featureType = uploadMode === 'stem-split' ? 'stems'
      : uploadMode === 'extract-video' ? 'extract-video'
      : uploadMode === 'extract-audio' ? 'extract-audio'
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
          // Only use server messages if they have real generation results
          // (prevents old stale chats from overriding a fresh session)
          const serverHasResults = serverMsgs.some((m: any) => m.result?.audioUrl || m.result?.imageUrl || m.result?.url)
          const localStr = localStorage.getItem(CHAT_KEY)
          const localMsgs = localStr ? JSON.parse(localStr) : []
          const localHasResults = localMsgs.some((m: any) => m.result?.audioUrl || m.result?.imageUrl || m.result?.url)
          // Only restore server chat if it has results and local doesn't, or server is strictly newer
          if (serverHasResults && !localHasResults && serverMsgs.length > localMsgs.length) {
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
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .auth-card { animation: fadeIn 0.5s ease-out; }
        `}} />
        <div className="auth-card text-center space-y-5 max-w-md w-full">
          <div className="text-5xl">🔐</div>
          <h1 className="text-2xl font-bold text-white">Connect to 444 Radio</h1>

          {/* Show auth error if token was rejected */}
          {authError && !needsPurchase && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-left">
              <p className="text-sm text-red-400 font-medium">⚠️ {authError}</p>
              <p className="text-xs text-red-400/70 mt-1">Generate a new token from Settings → Plugin tab</p>
            </div>
          )}

          {/* Plugin purchase required — $25 Razorpay button */}
          {needsPurchase && (
            <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-5 text-left space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shrink-0">
                  <Zap size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Unlock 444Radio Plugin</p>
                  <p className="text-xs text-gray-400">One-time purchase • Unlimited access forever</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1 ml-[52px]">
                <span className="text-3xl font-black text-white">$25</span>
                <span className="text-xs text-gray-500">USD • one-time</span>
              </div>
              <ul className="ml-[52px] space-y-1 text-xs text-gray-300">
                <li>✓ Unlimited AI generations in your DAW</li>
                <li>✓ WAV export + drag to timeline</li>
                <li>✓ Stem splitting, loops, SFX, cover art</li>
                <li>✓ Works in Ableton, FL Studio, Logic, Premiere Pro</li>
                <li>✓ No subscription needed</li>
              </ul>
              <button
                onClick={async () => {
                  if (buyingPlugin) return
                  setBuyingPlugin(true)
                  try {
                    const res = await fetch('/api/plugin/purchase', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` },
                    })
                    const data = await res.json()
                    if (!data.success || !data.orderId) {
                      alert(data.error || 'Could not create payment')
                      return
                    }
                    if (!(window as any).Razorpay) {
                      alert('Payment SDK loading... please try again in a moment')
                      return
                    }
                    const razorpay = new (window as any).Razorpay({
                      key: data.keyId,
                      amount: data.amount,
                      currency: data.currency,
                      name: '444Radio',
                      description: 'Plugin — Unlimited Access',
                      order_id: data.orderId,
                      handler: async (response: any) => {
                        try {
                          const verifyRes = await fetch('/api/plugin/verify-purchase', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              razorpay_order_id: response.razorpay_order_id,
                              razorpay_payment_id: response.razorpay_payment_id,
                              razorpay_signature: response.razorpay_signature,
                            }),
                          })
                          const verifyData = await verifyRes.json()
                          if (verifyData.success) {
                            alert('✅ Plugin purchased! Refreshing...')
                            window.location.reload()
                          } else {
                            alert('✅ Payment received! Access will activate within 1-2 minutes. Refresh the page.')
                          }
                        } catch {
                          alert('✅ Payment received! Refresh the page to activate.')
                        }
                      },
                      prefill: {
                        email: data.customerEmail || '',
                        name: data.customerName || '',
                      },
                      theme: { color: '#06b6d4' },
                      modal: {
                        ondismiss: () => setBuyingPlugin(false),
                      },
                    })
                    razorpay.open()
                  } catch (err: any) {
                    console.error('Purchase error:', err)
                    alert('Payment error: ' + (err.message || 'Unknown'))
                  } finally {
                    setBuyingPlugin(false)
                  }
                }}
                disabled={buyingPlugin}
                className="ml-[52px] w-[calc(100%-52px)] py-3 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {buyingPlugin ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {buyingPlugin ? 'Processing...' : 'Buy Plugin — $25'}
              </button>
              <p className="ml-[52px] text-[10px] text-gray-600">Or subscribe to Pro/Studio for plugin access included</p>
            </div>
          )}

          {/* Step 1: Get token */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">1</span>
              <p className="text-sm font-semibold text-white">Get your plugin token</p>
            </div>
            <p className="text-xs text-gray-400 ml-8">Sign in on the website → Settings → Plugin tab → Generate Token</p>
            <button
              onClick={() => window.location.href = 'https://444radio.co.in/settings?tab=plugin'}
              className="ml-8 mt-1 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black rounded-lg text-sm font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all"
            >
              Open Settings → Get Token
            </button>
          </div>

          {/* Step 2: Paste token */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">2</span>
              <p className="text-sm font-semibold text-white">Paste your token below</p>
            </div>
            <div className="flex gap-2 ml-8 mt-1">
              <input
                id="plugin-token-input"
                type="text"
                placeholder="444r_..."
                className="flex-1 px-3 py-2 bg-black/50 border border-white/20 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-cyan-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (val) { localStorage.setItem(TOKEN_KEY, val); setToken(val) }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('plugin-token-input') as HTMLInputElement
                  const val = input?.value?.trim()
                  if (val) { localStorage.setItem(TOKEN_KEY, val); setToken(val) }
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm font-semibold transition-all"
              >
                Connect
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-600">Token is saved locally — you only need to do this once per device</p>
        </div>
        {/* Razorpay SDK for $25 plugin purchase */}
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </div>
    )
  }

  if (isLoadingCredits) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-cyan-400 animate-spin" size={32} />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  //  RENDER — Carbon copy of create page layout
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className={`h-screen text-white flex flex-col relative overflow-hidden transition-all duration-300 ${showFeaturesSidebar ? 'md:pl-[420px]' : ''}`}
      style={{
        background: '#050a0f',
      }}>
      {/* ── Global ambient background glow — cyan tinted ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 90% 50% at 50% 0%, rgba(0,255,255,0.06) 0%, rgba(0,136,255,0.02) 40%, transparent 70%)',
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 40% at 80% 100%, rgba(0,255,255,0.03) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 20% 100%, rgba(0,136,255,0.03) 0%, transparent 50%)',
      }} />

      {/* Bridge action toast */}
      {bridgeToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl text-xs font-medium select-none pointer-events-none overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,30,40,0.9), rgba(5,15,25,0.95))',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(0,255,255,0.2)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.8), 0 0 20px rgba(0,255,255,0.08), inset 0 1px 0 rgba(0,255,255,0.1)',
            color: '#00ffff',
            animation: 'fadeIn 0.2s ease-out',
          }}>
          {/* Diagonal shine */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"><div style={{position:'absolute',top:'-80%',left:'-20%',width:'50%',height:'260%',background:'linear-gradient(105deg,transparent 42%,rgba(255,255,255,0.04) 47%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 53%,transparent 58%)',transform:'rotate(-15deg)'}} /></div>
          <span className="relative z-10">{bridgeToast}</span>
        </div>
      )}

      {/* Pin status bar — shows when window is pinned */}
      {isPinned && (
        <div className="flex items-center justify-center gap-2 px-3 py-1 text-[10px] select-none shrink-0"
          style={{background:'rgba(0,255,255,0.04)',borderBottom:'1px solid rgba(0,255,255,0.1)',color:'rgba(0,255,255,0.6)'}}>
          <Pin size={10} /> Window pinned — stays on top
          <button onClick={togglePin} className="ml-2 underline transition-colors" style={{color:'rgba(0,255,255,0.8)'}}>Unpin</button>
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
          <div className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-50" onClick={() => setShowFeaturesSidebar(false)} />

          <div className="fixed inset-0 md:inset-auto md:left-0 md:top-0 md:h-screen md:w-[420px] z-50 md:z-40 flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(5,18,28,0.97), rgba(3,12,20,0.98))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', borderRight: '1px solid rgba(0,255,255,0.12)', boxShadow: '4px 0 40px rgba(0,0,0,0.5), 0 0 30px rgba(0,255,255,0.03)', animation: 'slideInLeft 0.3s ease-out' }}>
            {/* Sidebar diagonal shine */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden"><div style={{position:'absolute',top:'-50%',left:'-15%',width:'45%',height:'200%',background:'linear-gradient(105deg,transparent 40%,rgba(0,255,255,0.03) 45%,rgba(255,255,255,0.06) 50%,rgba(0,255,255,0.03) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
            {/* Subtle cyan ambient overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 80% 30% at 50% 0%, rgba(0,255,255,0.04) 0%, transparent 60%)'}} />
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-20 relative z-10" style={{borderBottom:'1px solid rgba(0,255,255,0.08)'}}>
              <div className="flex items-center gap-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{color:'#00ffff',filter:'drop-shadow(0 0 8px rgba(0,255,255,0.4))'}}>
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <span className="text-white font-bold text-lg tracking-wider" style={{textShadow:'0 0 20px rgba(0,255,255,0.2)'}}>Features</span>
              </div>
              <button onClick={() => setShowFeaturesSidebar(false)} className="p-2 rounded-lg transition-colors" style={{color:'rgba(255,255,255,0.3)'}} onMouseEnter={e=>e.currentTarget.style.color='rgba(255,255,255,0.7)'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
                <X size={18} />
              </button>
            </div>

            {/* Credits */}
            <div className="px-5 py-4 relative z-10" style={{borderBottom:'1px solid rgba(0,255,255,0.08)'}}>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl relative overflow-hidden" style={{background:'linear-gradient(135deg, rgba(0,255,255,0.08), rgba(0,136,255,0.05))',border:'1px solid rgba(0,255,255,0.25)',boxShadow:'0 0 20px rgba(0,255,255,0.08), inset 0 1px 0 rgba(0,255,255,0.15)'}}>
                <Zap size={16} style={{color:'#00ffff'}} />
                <span className="text-white font-bold text-sm">{isLoadingCredits ? '...' : userCredits} credits</span>
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="px-5 py-3 relative z-10" style={{borderBottom:'1px solid rgba(0,255,255,0.08)'}}>
              <div className="flex gap-2">
                <button onClick={() => setIsInstrumental(false)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all`}
                  style={!isInstrumental ? {background:'linear-gradient(135deg, rgba(0,255,255,0.15), rgba(0,136,255,0.1))',color:'#00ffff',border:'1px solid rgba(0,255,255,0.35)',boxShadow:'0 0 20px rgba(0,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.1)'} : {background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.45)',border:'1px solid rgba(255,255,255,0.08)'}}>
                  <Mic size={14} /> Vocal
                </button>
                <button onClick={() => setIsInstrumental(true)} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all`}
                  style={isInstrumental ? {background:'linear-gradient(135deg, rgba(160,80,255,0.15), rgba(120,60,200,0.1))',color:'rgba(200,160,255,0.95)',border:'1px solid rgba(160,80,255,0.35)',boxShadow:'0 0 20px rgba(160,80,255,0.12), inset 0 1px 0 rgba(255,255,255,0.1)'} : {background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.45)',border:'1px solid rgba(255,255,255,0.08)'}}>
                  <Music size={14} /> Inst
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="px-5 py-4 relative z-10" style={{borderBottom:'1px solid rgba(0,255,255,0.08)'}}>
              <div className="relative">
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your music..."
                  className="w-full rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(0,255,255,0.12)',
                    caretColor: '#00ffff',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,255,255,0.35)'
                    e.currentTarget.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.3), 0 0 16px rgba(0,255,255,0.06)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,255,255,0.12)'
                    e.currentTarget.style.boxShadow = 'inset 0 2px 8px rgba(0,0,0,0.3)'
                  }}
                  rows={5}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
                />
                <div className="flex items-center justify-between mt-2">
                  <button onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-full transition-all ${isRecording ? 'animate-pulse' : ''}`}
                    style={isRecording ? {background:'#ff0040',color:'#fff'} : {background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <Mic size={14} />
                  </button>
                  <button onClick={handleGenerate} disabled={isGenerating || !input.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                    style={{background:'linear-gradient(135deg, #00ffff, #0088ff)',color:'#000000',boxShadow:'0 0 24px rgba(0,255,255,0.3), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)'}}>
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
                      <span className="text-sm font-bold text-white flex items-center gap-2"><Lightbulb size={14} className="text-yellow-400" /> Quick Tags</span>
                      <div className="flex gap-2">
                        <button onClick={() => setSidebarIdeasView('type')} className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 hover:text-purple-200 transition-all">✨ IDEAS</button>
                        <button onClick={() => setShowSidebarIdeas(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => setInput(prev => prev + (prev ? ', ' : '') + tag)}
                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">
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
                        className="p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400/40 rounded-2xl hover:scale-105 transition-all">
                        <div className="text-3xl mb-2">🎤</div><div className="text-sm font-bold text-white">Song</div><div className="text-[10px] text-gray-400">With vocals & lyrics</div>
                      </button>
                      <button onClick={() => { setSidebarPromptType('beat'); setSelectedPromptType('beat'); setIsInstrumental(true); setSidebarIdeasView('genre') }}
                        className="p-5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/40 rounded-2xl hover:scale-105 transition-all">
                        <div className="text-3xl mb-2">🎹</div><div className="text-sm font-bold text-white">Beat</div><div className="text-[10px] text-gray-400">Instrumental only</div>
                      </button>
                    </div>
                  </div>
                )}
                {sidebarIdeasView === 'genre' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setSidebarIdeasView('type')} className="text-xs text-cyan-400 flex items-center gap-1"><ChevronLeft size={14} /> Back</button>
                      <h3 className="text-sm font-bold text-white">🎵 Select Genre</h3>
                      <button onClick={() => setSidebarIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GENRE_OPTIONS.map(g => (
                        <button key={g} onClick={() => handleGeneratePromptIdea(g)} disabled={generatingIdea}
                          className="px-2 py-2 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all disabled:opacity-50">
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {sidebarIdeasView === 'generating' && (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 mx-auto border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
                    <h3 className="text-base font-bold text-white">Creating Amazing Prompt...</h3>
                    <p className="text-xs text-gray-400">AI is crafting the perfect description</p>
                  </div>
                )}
              </div>
            )}

            {/* Feature Buttons */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Generation Queue Notification (shows when generations are active) */}
              {activeGenerations.size > 0 && (
                <div className="mb-3 p-3 rounded-xl flex items-center gap-2 generating-glow" style={{background:'linear-gradient(135deg, rgba(0,255,255,0.08), rgba(0,136,255,0.05))',border:'1px solid rgba(0,255,255,0.3)'}}>
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  <span className="text-xs text-cyan-300 font-medium">
                    {activeGenerations.size} generation{activeGenerations.size > 1 ? 's' : ''} in progress
                  </span>
                </div>
              )}

              {/* Ideas Lightbulb */}
              <button onClick={() => { setShowSidebarIdeas(!showSidebarIdeas); setSidebarIdeasView('tags') }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-3 relative overflow-hidden"
                style={showSidebarIdeas ? {background:'linear-gradient(135deg, rgba(255,200,0,0.08), rgba(255,150,0,0.05))',border:'1px solid rgba(255,200,0,0.25)',color:'rgba(255,220,80,0.9)',boxShadow:'0 0 16px rgba(255,200,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06)'} : {background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,200,0,0.12)',color:'rgba(255,200,0,0.7)'}}>
                <div className="p-2 rounded-lg" style={{background:'rgba(255,255,255,0.03)'}}><Lightbulb size={18} /></div>
                <div className="flex-1 text-left"><div className="text-sm font-semibold">Ideas & Tags</div><div className="text-[10px] text-gray-500">AI prompts & quick tags</div></div>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">AI</span>
              </button>

              <p className="text-[10px] uppercase tracking-widest font-bold mb-3 px-1" style={{color:'rgba(255,255,255,0.2)'}}>Creation Tools</p>
              <div className="space-y-2">
                {FEATURES.filter(f => {
                  // Hide lyrics when not in music vocal mode
                  if ((f as any).conditionalMusic && (selectedType !== 'music' || isInstrumental)) return false
                  return true
                }).map(f => {
                  const Icon = f.icon
                  const isActive = f.key === selectedType || (f.key === 'lyrics' && !!(customTitle || genre || customLyrics || bpm))
                  const colorMap: Record<string, { active: React.CSSProperties; inactive: React.CSSProperties }> = {
                    cyan: {
                      active: {background:'linear-gradient(135deg, rgba(0,255,255,0.08), rgba(0,136,255,0.05))',border:'1px solid rgba(0,255,255,0.3)',color:'#00ffff',boxShadow:'0 0 20px rgba(0,255,255,0.08), inset 0 1px 0 rgba(0,255,255,0.1)'},
                      inactive: {background:'rgba(255,255,255,0.02)',border:'1px solid rgba(0,255,255,0.1)',color:'rgba(0,255,255,0.6)'},
                    },
                    purple: {
                      active: {background:'linear-gradient(135deg, rgba(160,80,255,0.08), rgba(120,60,200,0.05))',border:'1px solid rgba(160,80,255,0.3)',color:'rgba(200,160,255,0.95)',boxShadow:'0 0 20px rgba(160,80,255,0.08), inset 0 1px 0 rgba(160,80,255,0.1)'},
                      inactive: {background:'rgba(255,255,255,0.02)',border:'1px solid rgba(160,80,255,0.1)',color:'rgba(180,130,255,0.6)'},
                    },
                    orange: {
                      active: {background:'linear-gradient(135deg, rgba(255,140,0,0.08), rgba(255,100,0,0.05))',border:'1px solid rgba(255,140,0,0.3)',color:'rgba(255,200,100,0.95)',boxShadow:'0 0 20px rgba(255,140,0,0.08), inset 0 1px 0 rgba(255,140,0,0.1)'},
                      inactive: {background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,140,0,0.1)',color:'rgba(255,180,80,0.6)'},
                    },
                  }
                  return (
                    <button key={f.key} onClick={() => {
                      // File-based features: open upload modal
                      if (['stems', 'audio-boost', 'extract', 'video-to-audio'].includes(f.key)) {
                        triggerFeatureUpload(f.key)
                      } else if (f.key === 'lyrics') {
                        setShowLyricsModal(true)
                      } else if (f.key === 'upload') {
                        openUploadModal()
                      } else if (f.key === 'release') {
                        handleOpenRelease()
                      } else {
                        setSelectedType(f.key as GenerationType)
                      }
                    }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative overflow-hidden"
                      style={isActive ? colorMap[f.color].active : colorMap[f.color].inactive}>
                      <div className="p-2 rounded-lg" style={{background:'rgba(255,255,255,0.03)'}}><Icon size={18} /></div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold">{f.label}</div>
                        <div className="text-[10px]" style={{color:'rgba(255,255,255,0.35)'}}>{f.desc}</div>
                      </div>
                      {f.cost > 0 && <span className="text-[10px] px-2 py-1 rounded-full" style={{color:'rgba(255,255,255,0.25)',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.04)'}}>-{f.cost}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Utilities */}
              <div className="mt-6 pt-4" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 px-1">
                  <button onClick={() => setShowDeletedChatsModal(true)} className="p-2.5 rounded-xl transition-all" style={{border:'1px solid rgba(0,255,180,0.1)',color:'rgba(0,255,180,0.5)'}} title="Chat History">
                    <RotateCcw size={16} />
                  </button>
                  <button onClick={handleClearChat} className="p-2.5 rounded-xl transition-all" style={{border:'1px solid rgba(0,255,180,0.1)',color:'rgba(0,255,180,0.5)'}} title="New Chat">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => window.open('https://444radio.co.in/explore?host=juce', '_blank')}
                    className="p-2.5 rounded-xl transition-all" style={{border:'1px solid rgba(0,255,255,0.1)',color:'rgba(0,255,255,0.5)'}} title="Explore 444 Radio">
                    <Compass size={16} />
                  </button>
                  <button onClick={() => window.location.href = '/plugin'}
                    className="p-2.5 rounded-xl border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all" title="Plugin Home">
                    <Home size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat Header — glass morphism */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(5,18,28,0.9), rgba(3,12,20,0.92))',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            borderBottom: '1px solid rgba(0,255,255,0.1)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 20px rgba(0,255,255,0.03)',
          }}>
          {/* Glass shine sweep on header */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden"><div style={{position:'absolute',top:'-100%',left:'-15%',width:'45%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(0,255,255,0.02) 45%,rgba(255,255,255,0.06) 50%,rgba(0,255,255,0.02) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
          {/* Top edge cyan shine */}
          <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none" style={{background:'linear-gradient(90deg,transparent 5%,rgba(0,255,255,0.15) 30%,rgba(0,255,255,0.3) 50%,rgba(0,255,255,0.15) 70%,transparent 95%)'}} />
          <div className="flex items-center gap-3 relative z-10">
            <button onClick={() => setShowFeaturesSidebar(!showFeaturesSidebar)}
              className="p-2 rounded-lg transition-all" style={{color:'#00ffff'}}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            <span className="text-white font-bold text-sm tracking-wider" style={{textShadow:'0 0 20px rgba(0,255,255,0.15)'}}>444 Radio</span>
          </div>
          <div className="flex items-center gap-2">
            {/* ── Pin window toggle ── */}
            <button onClick={togglePin}
              className="p-2 rounded-lg transition-all"
              style={isPinned ? {background:'rgba(0,255,255,0.08)',color:'#00ffff'} : {color:'rgba(255,255,255,0.25)'}}
              onMouseEnter={e => { if (!isPinned) e.currentTarget.style.color = 'rgba(0,255,255,0.6)' }}
              onMouseLeave={e => { if (!isPinned) e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
              title={isPinned ? 'Unpin window (window stays on top)' : 'Pin window on screen'}>
              {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            {/* ── Resize dropdown ── */}
            <div className="relative">
              <button onClick={() => setShowSizeMenu(!showSizeMenu)}
                className="p-2 rounded-lg transition-all"
                style={{color:'rgba(255,255,255,0.25)'}}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                title="Resize plugin window">
                <Maximize2 size={15} />
              </button>
              {showSizeMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSizeMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 rounded-xl py-1 min-w-[140px] overflow-hidden"
                    style={{background:'linear-gradient(135deg, rgba(5,18,28,0.97), rgba(3,12,20,0.98))',backdropFilter:'blur(40px)',border:'1px solid rgba(0,255,255,0.12)',boxShadow:'0 16px 60px rgba(0,0,0,0.9), 0 0 16px rgba(0,255,255,0.04)'}}>
                    {/* Glass shine */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"><div style={{position:'absolute',top:'-100%',left:'-25%',width:'50%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(0,255,255,0.02) 45%,rgba(255,255,255,0.06) 50%,rgba(0,255,255,0.02) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                    {WINDOW_SIZES.map((s, i) => (
                      <button key={s.label} onClick={() => setWindowSize(i)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors relative ${i === windowSizeIdx ? 'text-cyan-400' : 'text-gray-400 hover:text-white'}`}
                        style={i === windowSizeIdx ? {background:'rgba(0,255,255,0.08)',boxShadow:'inset 0 0 20px rgba(0,255,255,0.05)'} : {}}>
                        <span className="font-medium">{s.label}</span>
                        <span className="text-[10px] text-gray-500">{s.w}×{s.h}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Library — opens in-plugin, not browser */}
            <button onClick={() => { window.location.href = '/library?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '') }}
              className="p-2 rounded-lg transition-all" title="My Library"
              style={{color:'rgba(180,130,255,0.6)'}}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(180,130,255,0.9)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(180,130,255,0.6)'}>
              <BookOpen size={16} />
            </button>
            {/* Back to Plugin Home — always visible */}
            <button onClick={() => { window.location.href = '/plugin?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '') }}
              className="p-2 rounded-lg transition-all" title="Back to Plugin Home"
              style={{color:'rgba(0,255,255,0.5)'}}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(0,255,255,0.9)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,255,255,0.5)'}>
              <Home size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.08), rgba(0,136,255,0.05))', border: '1px solid rgba(0,255,255,0.25)', boxShadow: '0 0 16px rgba(0,255,255,0.08), inset 0 1px 0 rgba(0,255,255,0.15)' }}>
              <Zap size={11} style={{color:'#00ffff'}} />
              <span className="text-xs font-bold tabular-nums" style={{color:'#00ffff'}}>{userCredits ?? '...'}</span>
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
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 chat-scroll-container" style={{ paddingBottom: showBottomDock ? '200px' : '100px' }}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 relative overflow-hidden ${
                msg.type === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
              }`}
                style={{
                  background: msg.type === 'user'
                    ? 'linear-gradient(135deg, rgba(0,255,255,0.06), rgba(0,136,255,0.03))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: msg.type === 'user'
                    ? '1px solid rgba(0,255,255,0.2)'
                    : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: msg.type === 'user'
                    ? '0 4px 24px rgba(0,0,0,0.4), 0 0 16px rgba(0,255,255,0.06), inset 0 1px 0 rgba(0,255,255,0.1)'
                    : '0 4px 20px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}>
                {/* Glass diagonal shine on each bubble */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"><div style={{position:'absolute',top:'-100%',left:msg.type==='user'?'-10%':'-30%',width:'45%',height:'300%',background:`linear-gradient(105deg,transparent 40%,${msg.type==='user'?'rgba(0,255,255,0.03)':'rgba(255,255,255,0.03)'} 45%,${msg.type==='user'?'rgba(0,255,255,0.06)':'rgba(255,255,255,0.06)'} 50%,${msg.type==='user'?'rgba(0,255,255,0.03)':'rgba(255,255,255,0.03)'} 55%,transparent 60%)`,transform:'rotate(-15deg)'}} /></div>
                {/* Text content */}
                <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>

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
                        className="w-10 h-10 flex-shrink-0 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                        {playingId === msg.id ? <Pause size={16} className="text-black" /> : <Play size={16} className="text-black ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{msg.result.title || 'AI Track'}</p>
                        {msg.result.prompt && <p className="text-xs text-gray-400 truncate">{msg.result.prompt}</p>}
                      </div>
                    </div>

                    {/* Details dialog (same as create page) */}
                    <details className="group">
                      <summary className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 cursor-pointer transition-colors">
                        <FileText size={12} /> Details
                      </summary>
                      <div className="mt-2 p-3 bg-black/40 rounded-lg space-y-2 text-xs">
                        {msg.result.title && <div><span className="text-gray-500">Title:</span> <span className="text-white">{msg.result.title}</span></div>}
                        {msg.result.prompt && <div><span className="text-gray-500">Prompt:</span> <span className="text-white">{msg.result.prompt}</span></div>}
                        {msg.result.lyrics && (
                          <details>
                            <summary className="text-gray-500 cursor-pointer hover:text-cyan-400">View Lyrics</summary>
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
                        style={{ background: 'rgba(0,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                        <Download size={12} /> MP3
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{background:'linear-gradient(135deg,rgba(0,255,255,0.1),transparent)',borderRadius:'inherit'}} />
                      </button>
                      {/* WAV Download */}
                      <button onClick={() => downloadAndToast(msg.result!.audioUrl!, msg.result!.title || 'track', 'wav')}
                        disabled={dawDownloading !== null}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all font-semibold disabled:opacity-50 relative overflow-hidden"
                        style={{ background: 'rgba(0,255,180,0.07)', border: '1px solid rgba(0,255,180,0.2)', color: 'rgba(0,255,180,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 12px rgba(0,255,180,0.06), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <Download size={12} /> WAV
                      </button>
                      {/* Split Stems */}
                      <button onClick={() => handleSplitStems(msg.result!.audioUrl!, msg.id)} disabled={isSplittingStems}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 relative overflow-hidden"
                        style={{ background: 'rgba(160,80,255,0.07)', border: '1px solid rgba(160,80,255,0.2)', color: 'rgba(200,160,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 12px rgba(160,80,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <Scissors size={12} /> Stems <span className="text-[10px]" style={{color:'rgba(255,255,255,0.35)'}}>(-5)</span>
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
                            background: 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,136,255,0.06))',
                            border: '1px solid rgba(0,255,255,0.3)',
                            color: '#00ffff',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 0 20px rgba(0,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
                          }}>
                          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl"><div style={{position:'absolute',top:'-100%',left:'-20%',width:'50%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.06) 45%,rgba(0,255,255,0.1) 50%,rgba(255,255,255,0.06) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                          <ArrowDownToLine size={12} className="relative z-10" /> <span className="relative z-10">Import to DAW</span>
                        </button>
                      )}
                      {/* Audio Boost */}
                      <button onClick={() => setShowBoostParamsFor({ audioUrl: msg.result!.audioUrl!, title: msg.result!.title || 'Track' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all relative overflow-hidden"
                        style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', color: 'rgba(255,200,100,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), 0 0 12px rgba(255,140,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <Volume2 size={12} /> Boost <span className="text-[10px]" style={{color:'rgba(255,255,255,0.35)'}}>(-1)</span>
                      </button>
                      {/* Library — opens in plugin */}
                      <button onClick={() => { window.location.href = '/library?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '') }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all relative overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <Layers size={12} /> Library
                      </button>
                    </div>
                  </div>
                )}

                {/* ── IMAGE RESULT CARD ── */}
                {msg.result?.imageUrl && !msg.result?.audioUrl && !msg.isGenerating && (
                  <div className="mt-3 space-y-3">
                    <div className="relative group rounded-xl overflow-hidden">
                      <img src={msg.result.imageUrl} alt={msg.result.title || 'Generated image'} className="w-full rounded-xl" />
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
                    <div className="flex gap-2">
                      <button onClick={() => handleDownload(msg.result!.url!, `${msg.result!.title || 'video'}.mp4`, 'mp3')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg text-xs text-purple-300 hover:text-purple-200 transition-all">
                        <Download size={12} /> Download
                      </button>
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
                            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
                            title={`Download ${display.label} WAV`}>
                            {dawDownloading === `${url}-${display.label} Stem` ? <Loader2 size={12} className="text-cyan-400 animate-spin" /> : <ArrowDownToLine size={12} className="text-cyan-400" />}
                            <span className="text-[9px] text-cyan-400/70 font-medium">WAV</span>
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

        {/* ── Glass Node Bottom Dock ── */}
        <div className="sticky bottom-0 left-0 right-0 z-30">
          {/* Toggle button */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowBottomDock(!showBottomDock)}
              className="px-5 py-1 rounded-t-xl transition-all duration-200"
              style={{
                background: 'rgba(5,18,28,0.85)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                borderTop: '1px solid rgba(0,255,255,0.1)',
                borderLeft: '1px solid rgba(0,255,255,0.06)',
                borderRight: '1px solid rgba(0,255,255,0.06)',
                color: 'rgba(0,255,255,0.3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(0,255,255,0.7)'; e.currentTarget.style.background = 'rgba(0,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(0,255,255,0.3)'; e.currentTarget.style.background = 'rgba(5,18,28,0.85)' }}
              title={showBottomDock ? 'Hide prompt bar' : 'Show prompt bar'}
            >
              {showBottomDock ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
          <div
            className={`transition-all duration-300 ease-out relative overflow-hidden ${showBottomDock ? 'max-h-[500px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}
            style={{
              background: 'linear-gradient(180deg, rgba(5,18,28,0.95), rgba(3,12,20,0.97))',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              borderTop: '1px solid rgba(0,255,255,0.1)',
              boxShadow: '0 -12px 48px rgba(0,0,0,0.7), 0 0 20px rgba(0,255,255,0.03), inset 0 1px 0 rgba(0,255,255,0.08)',
            }}
          >
          {/* Dock diagonal shine */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden"><div style={{position:'absolute',top:'-100%',left:'-10%',width:'40%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(0,255,255,0.02) 45%,rgba(255,255,255,0.05) 50%,rgba(0,255,255,0.02) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
          {/* Top edge cyan shine */}
          <div className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none" style={{background:'linear-gradient(90deg,transparent 10%,rgba(0,255,255,0.12) 40%,rgba(0,255,255,0.22) 50%,rgba(0,255,255,0.12) 60%,transparent 90%)'}} />
          <div className="pt-4 pb-4 px-4 relative z-10">
            {/* Icon Row */}
            <div className="flex items-center justify-center gap-1 mb-3 flex-wrap">
              {/* Music */}
              <button onClick={() => { setSelectedType('music'); setShowAdvancedButtons(!showAdvancedButtons) }}
                className={`p-2.5 rounded-xl transition-all duration-200 ${selectedType === 'music' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={selectedType === 'music' ? { background: 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,136,255,0.06))', border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', boxShadow: '0 0 16px rgba(0,255,255,0.12), inset 0 1px 0 rgba(0,255,255,0.1)' } : { border: '1px solid rgba(255,255,255,0.06)' }}
                title="Music"><Music size={18} /></button>
              {/* Effects */}
              <button onClick={() => setSelectedType('effects')}
                className={`p-2.5 rounded-xl transition-all duration-200 ${selectedType === 'effects' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={selectedType === 'effects' ? { background: 'linear-gradient(135deg, rgba(160,80,255,0.1), rgba(120,60,200,0.06))', border: '1px solid rgba(160,80,255,0.3)', color: 'rgba(200,160,255,0.95)', boxShadow: '0 0 16px rgba(160,80,255,0.12), inset 0 1px 0 rgba(160,80,255,0.1)' } : { border: '1px solid rgba(255,255,255,0.06)' }}
                title="Effects"><Sparkles size={18} /></button>
              {/* Loops */}
              <button onClick={() => setSelectedType('loops' as GenerationType)}
                className={`p-2.5 rounded-xl transition-all duration-200 ${(selectedType as string) === 'loops' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={(selectedType as string) === 'loops' ? { background: 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,136,255,0.06))', border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', boxShadow: '0 0 16px rgba(0,255,255,0.12), inset 0 1px 0 rgba(0,255,255,0.1)' } : { border: '1px solid rgba(255,255,255,0.06)' }}
                title="Loops"><Repeat size={18} /></button>
              {/* Image */}
              <button onClick={() => setSelectedType('image')}
                className={`p-2.5 rounded-xl transition-all duration-200 ${selectedType === 'image' ? '' : 'text-gray-600 hover:text-gray-300'}`}
                style={selectedType === 'image' ? { background: 'linear-gradient(135deg, rgba(0,255,255,0.1), rgba(0,136,255,0.06))', border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff', boxShadow: '0 0 16px rgba(0,255,255,0.12), inset 0 1px 0 rgba(0,255,255,0.1)' } : { border: '1px solid rgba(255,255,255,0.06)' }}
                title="Cover Art"><ImageIcon size={18} /></button>
              
              <div className="w-px h-6 mx-1" style={{background:'linear-gradient(to bottom, transparent, rgba(0,255,255,0.15), transparent)'}} />

              {/* Lyrics / Settings */}
              {selectedType === 'music' && !isInstrumental && (
                <button onClick={() => setShowLyricsModal(true)}
                  className="p-2.5 rounded-xl transition-all"
                  style={(customTitle || genre || customLyrics || bpm) ? {background:'rgba(0,255,255,0.06)',color:'#00ffff',border:'1px solid rgba(0,255,255,0.2)',boxShadow:'0 0 8px rgba(0,255,255,0.06)'} : {color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.04)'}}
                  title="Lyrics & Settings"><Edit3 size={18} /></button>
              )}

              {/* Upload */}
              <button onClick={() => openUploadModal()}
                className="p-2.5 rounded-xl transition-all" title="Upload Media"
                style={{color:'rgba(180,130,255,0.5)',border:'1px solid rgba(160,80,255,0.08)'}}>
                <Upload size={18} />
              </button>

              {/* New Chat */}
              <button onClick={handleClearChat}
                className="p-2.5 rounded-xl transition-all" title="New Chat"
                style={{color:'rgba(0,255,180,0.4)',border:'1px solid rgba(0,255,180,0.08)'}}>
                <Plus size={18} />
              </button>

              {/* Restore Chat */}
              <button onClick={() => setShowDeletedChatsModal(true)}
                className="p-2.5 rounded-xl transition-all" title="Chat History"
                style={{color:'rgba(0,255,180,0.4)',border:'1px solid rgba(0,255,180,0.08)'}}>
                <RotateCcw size={18} />
              </button>

              {/* Credits */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl ml-1 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(0,255,255,0.06), rgba(0,136,255,0.04))', border: '1px solid rgba(0,255,255,0.2)', boxShadow: '0 0 12px rgba(0,255,255,0.06), inset 0 1px 0 rgba(0,255,255,0.1)' }}>
                <Zap size={11} style={{color:'#00ffff'}} />
                <span className="text-xs font-bold tabular-nums" style={{color:'#00ffff'}}>{userCredits ?? '...'}</span>
                <span className="text-[10px] text-gray-500/60">
                  (-{selectedType === 'music' ? 2 : selectedType === 'image' ? 1 : selectedType === 'effects' ? 2 : (selectedType as string) === 'loops' ? 6 : 0})
                </span>
              </div>
            </div>

            {/* Instrumental mode info */}
            {isInstrumental && selectedType === 'music' && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
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
                    className="w-20 h-1 accent-purple-500" />
                  <span className="text-[10px] text-purple-300 w-5 text-center">{effectsDuration}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Guidance</label>
                  <input type="range" min={1} max={10} step={0.5} value={effectsGuidance} onChange={e => setEffectsGuidance(Number(e.target.value))}
                    className="w-16 h-1 accent-purple-500" />
                  <span className="text-[10px] text-purple-300 w-4 text-center">{effectsGuidance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Temp</label>
                  <input type="range" min={0.1} max={2} step={0.1} value={effectsTemperature} onChange={e => setEffectsTemperature(Number(e.target.value))}
                    className="w-16 h-1 accent-purple-500" />
                  <span className="text-[10px] text-purple-300 w-5 text-center">{effectsTemperature}</span>
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
                    className="w-20 h-1 accent-cyan-500" />
                  <span className="text-[10px] text-cyan-300 w-5 text-center">{loopsMaxDuration}s</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-400">Variations</label>
                  <button onClick={() => setLoopsVariations(loopsVariations === 1 ? 2 : 1)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${loopsVariations === 2 ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40' : 'bg-white/10 text-gray-400 border border-white/10'}`}>
                    {loopsVariations}x
                  </button>
                </div>
              </div>
            )}

            {/* Prompt Input Bar — Glass Node */}
            <div className="relative">
              <div className="flex items-end gap-2 rounded-2xl px-3 py-2 transition-all duration-300 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(5,18,28,0.8), rgba(3,12,20,0.85))',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  border: input.trim().length >= MIN_PROMPT_LENGTH
                    ? '1px solid rgba(0,255,255,0.3)'
                    : '1px solid rgba(0,255,255,0.1)',
                  boxShadow: input.trim().length >= MIN_PROMPT_LENGTH
                    ? '0 0 24px rgba(0,255,255,0.1), 0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,255,255,0.1), 0 0 1px rgba(0,255,255,0.4)'
                    : '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,255,255,0.05), 0 0 1px rgba(0,255,255,0.1)',
                }}>
                {/* Prompt box diagonal shine */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0"><div style={{position:'absolute',top:'-100%',left:'40%',width:'45%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(0,255,255,0.02) 45%,rgba(255,255,255,0.05) 50%,rgba(0,255,255,0.02) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                
                {/* Toggle sidebar */}
                <button onClick={() => setShowFeaturesSidebar(!showFeaturesSidebar)}
                  className="flex-shrink-0 p-1.5 rounded-full transition-colors mb-0.5 relative z-10"
                  style={{color:'rgba(255,255,255,0.3)'}}
                  onMouseEnter={e => e.currentTarget.style.color = 'rgba(0,255,255,0.6)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                  <PlusCircle size={20} />
                </button>

                {/* Record button */}
                <button onClick={isRecording ? stopRecording : startRecording}
                  className={`flex-shrink-0 p-1.5 rounded-full transition-all mb-0.5 relative z-10 ${isRecording ? 'animate-pulse' : ''}`}
                  style={isRecording ? {background:'#ff0040',color:'#ffffff'} : {color:'rgba(255,255,255,0.3)'}}
                  onMouseEnter={e => { if (!isRecording) e.currentTarget.style.color = 'rgba(255,100,100,0.7)' }}
                  onMouseLeave={e => { if (!isRecording) e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}>
                  <Mic size={18} />
                </button>

                {/* INST toggle */}
                {selectedType === 'music' && (
                  <button onClick={() => setIsInstrumental(!isInstrumental)}
                    className="flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-bold transition-all mb-0.5 relative z-10"
                    style={isInstrumental
                      ? {background:'rgba(160,80,255,0.2)',color:'rgba(180,130,255,0.9)',border:'1px solid rgba(160,80,255,0.3)'}
                      : {background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.3)',border:'1px solid rgba(255,255,255,0.06)'}}>
                    INST
                  </button>
                )}

                {/* Input */}
                <div className="flex-1 min-w-0 relative z-10">
                  <textarea value={input} onChange={(e) => setInput(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
                    placeholder={selectedType === 'music' ? 'Describe your track...' : selectedType === 'image' ? 'Describe your cover art...' : 'Describe the effect...'}
                    className="w-full bg-transparent text-white text-sm resize-none focus:outline-none min-h-[24px] max-h-[120px]"
                    style={{caretColor:'#00ffff'}}
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
                  style={showPromptSuggestions ? {background:'rgba(255,200,0,0.1)',color:'rgba(255,200,0,0.8)',border:'1px solid rgba(255,200,0,0.2)'} : {color:'rgba(255,255,255,0.3)'}}
                  onMouseEnter={e => { if (!showPromptSuggestions) e.currentTarget.style.color = 'rgba(255,200,0,0.6)' }}
                  onMouseLeave={e => { if (!showPromptSuggestions) e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}>
                  <Lightbulb size={18} />
                </button>

                {/* Send button — Cyan glow node */}
                <button onClick={handleGenerate} disabled={!input.trim() || input.trim().length < MIN_PROMPT_LENGTH}
                  className="relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-20 active:scale-90 hover:scale-110 mb-0.5 z-10"
                  style={{
                    background: 'linear-gradient(135deg, #00ffff, #0088ff)',
                    boxShadow: '0 0 28px rgba(0,255,255,0.4), 0 0 60px rgba(0,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.4)',
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
              <div className="fixed bottom-20 left-4 right-4 p-4 rounded-2xl max-h-[50vh] overflow-y-auto z-[60] relative" style={{ background: 'linear-gradient(135deg, rgba(5,18,28,0.97), rgba(3,12,20,0.98))', backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', border: '1px solid rgba(0,255,255,0.15)', boxShadow: '0 16px 60px rgba(0,0,0,0.8), 0 0 20px rgba(0,255,255,0.04)', animation: 'fadeIn 0.15s ease-out' }}>
                {/* Dropdown glass shine */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"><div style={{position:'absolute',top:'-100%',left:'-20%',width:'50%',height:'300%',background:'linear-gradient(105deg,transparent 40%,rgba(0,255,255,0.02) 45%,rgba(255,255,255,0.06) 50%,rgba(0,255,255,0.02) 55%,transparent 60%)',transform:'rotate(-15deg)'}} /></div>
                {!showIdeasFlow ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        <Lightbulb size={14} className="text-yellow-400" /> Quick Tags
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setShowIdeasFlow(true)} className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 hover:text-purple-200 transition-all">✨ IDEAS</button>
                        <button onClick={() => setShowPromptSuggestions(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => { setInput(prev => prev + (prev ? ', ' : '') + tag) }}
                          className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105">
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
                            className="p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400/40 rounded-2xl hover:scale-105 transition-all shadow-lg">
                            <div className="text-4xl mb-3">🎤</div><div className="text-lg font-bold text-white mb-1">Song</div><div className="text-xs text-gray-400">With vocals & lyrics</div>
                          </button>
                          <button onClick={() => { setSelectedPromptType('beat'); setIsInstrumental(true); setIdeasStep('genre') }}
                            className="p-6 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400/40 rounded-2xl hover:scale-105 transition-all shadow-lg">
                            <div className="text-4xl mb-3">🎹</div><div className="text-lg font-bold text-white mb-1">Beat</div><div className="text-xs text-gray-400">Instrumental only</div>
                          </button>
                        </div>
                      </div>
                    )}
                    {ideasStep === 'genre' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <button onClick={() => setIdeasStep('type')} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">← Back</button>
                          <h3 className="text-lg font-bold text-white">🎵 Select Genre</h3>
                          <button onClick={() => { setShowIdeasFlow(false); setIdeasStep('type') }} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-2">
                          {GENRE_OPTIONS.map(g => (
                            <button key={g} onClick={() => handleGeneratePromptIdea(g)} disabled={generatingIdea}
                              className="px-3 py-2.5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 border border-cyan-500/30 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105 disabled:opacity-50">
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {ideasStep === 'generating' && (
                      <div className="text-center py-8">
                        <div className="relative">
                          <div className="w-16 h-16 mx-auto border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
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
            <div className="flex items-center justify-center gap-2 mt-2 text-xs">
              <span style={{color: activeGenerations.size > 0 ? 'rgba(0,255,255,0.8)' : 'rgba(0,255,255,0.5)', textShadow: activeGenerations.size > 0 ? '0 0 12px rgba(0,255,255,0.3)' : 'none'}} className="font-mono tracking-wider">
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
          <div className="relative w-full max-w-md max-h-[80vh] md:aspect-square bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-cyan-400" /> Lyrics & Settings
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
                            body: JSON.stringify({ prompt: input })
                          })
                          const data = await res.json()
                          if (data.success && data.lyrics) setCustomLyrics(data.lyrics)
                          else alert('❌ ' + (data.error || 'Failed'))
                        } catch { alert('❌ Failed to generate lyrics.') }
                        finally { setIsGeneratingAtomLyrics(false) }
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isGeneratingAtomLyrics ? 'animate-spin' : ''}>
                        <circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="10" strokeDasharray="4 4"/>
                      </svg>
                      {isGeneratingAtomLyrics ? 'Generating...' : 'Create with Atom'}
                    </button>
                  </div>
                  <div className="relative">
                    <textarea value={customLyrics} onChange={(e) => setCustomLyrics(e.target.value)}
                      placeholder="Enter custom lyrics (required)..."
                      className="w-full px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
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
                      <Dices size={14} className="text-cyan-400" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Add structure tags like [verse] [chorus]</p>
                </div>
              )}

              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-2">
                  <Globe size={14} className="text-cyan-400" /> Language *
                </label>
                <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                  style={{ backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(34,211,238,0.6)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}>
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
                    <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <p className="text-[10px] text-cyan-300 mb-1 font-semibold">💡 Popular Genres:</p>
                      <div className="flex flex-wrap gap-1">
                        {hook.genres.slice(0, 4).map((g, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[9px] rounded">{g}</span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ACE-Step Parameters (non-English) */}
              {selectedLanguage.toLowerCase() !== 'english' && (
                <div className="space-y-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <span className="text-purple-400 font-semibold text-[10px] uppercase tracking-wide">🎵 ACE-Step Model Parameters</span>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Audio Length</span><span className="text-purple-400">{audioLengthInSeconds}s</span></label>
                    <input type="range" min="15" max="90" step="5" value={audioLengthInSeconds} onChange={e => setAudioLengthInSeconds(parseInt(e.target.value))} className="w-full accent-purple-500 h-1" />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>15s</span><span>90s</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Inference Steps</span><span className="text-purple-400">{numInferenceSteps}</span></label>
                    <input type="range" min="25" max="100" step="5" value={numInferenceSteps} onChange={e => setNumInferenceSteps(parseInt(e.target.value))} className="w-full accent-purple-500 h-1" />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>25</span><span>100</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Guidance Scale</span><span className="text-purple-400">{guidanceScale.toFixed(1)}</span></label>
                    <input type="range" min="1" max="15" step="0.5" value={guidanceScale} onChange={e => setGuidanceScale(parseFloat(e.target.value))} className="w-full accent-purple-500 h-1" />
                    <div className="flex justify-between text-[9px] text-gray-600"><span>1</span><span>15</span></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between"><span>Denoising</span><span className="text-purple-400">{denoisingStrength.toFixed(2)}</span></label>
                    <input type="range" min="0.5" max="1.0" step="0.05" value={denoisingStrength} onChange={e => setDenoisingStrength(parseFloat(e.target.value))} className="w-full accent-purple-500 h-1" />
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
                      className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-md text-[10px] text-cyan-200 hover:text-white transition-all">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Genre</label>
                <input type="text" value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. hip-hop, lo-fi, electronic..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50" />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Title</label>
                <input type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Auto-generated if empty"
                  className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all ${showTitleError ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'border-white/10'}`} />
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
                      className={`p-3 rounded-xl border text-center transition-all ${songDuration === opt.value ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}>
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
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black font-bold rounded-xl hover:from-cyan-500 hover:to-cyan-300 transition-all">
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
                <Upload size={18} className="text-purple-400" /> Upload Media
              </h3>
              <button onClick={closeUploadModal} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Mode Selector (if no mode selected yet) */}
              {!uploadMode && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Choose a processing mode:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Video to Audio */}
                    <button onClick={() => setUploadMode('video-to-audio')}
                      className="p-4 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Film size={16} className="text-cyan-400" />
                        <span className="text-sm font-bold text-white">Video to Audio</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Generate synced SFX from video</p>
                      <span className="text-[9px] text-cyan-400 mt-1 inline-block">-2 to -10 credits</span>
                    </button>

                    {/* Split Stems */}
                    <button onClick={() => setUploadMode('stem-split')}
                      className="p-4 bg-white/5 hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/40 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Scissors size={16} className="text-purple-400" />
                        <span className="text-sm font-bold text-white">Split Stems</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Separate vocals, drums, bass & more</p>
                      <span className="text-[9px] text-purple-400 mt-1 inline-block">-5 credits</span>
                    </button>

                    {/* Audio Boost */}
                    <button onClick={() => setUploadMode('audio-boost')}
                      className="p-4 bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/40 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Volume2 size={16} className="text-orange-400" />
                        <span className="text-sm font-bold text-white">Audio Boost</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Mix & master with bass/treble/volume</p>
                      <span className="text-[9px] text-orange-400 mt-1 inline-block">-1 credit</span>
                    </button>

                    {/* Extract: Video → Audio */}
                    <button onClick={() => setUploadMode('extract-video')}
                      className="p-4 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 rounded-xl transition-all text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={16} className="text-cyan-400" />
                        <span className="text-sm font-bold text-white">Extract: Video</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Extract audio track from video</p>
                      <span className="text-[9px] text-cyan-400 mt-1 inline-block">-1 credit</span>
                    </button>

                    {/* Extract: Audio → Stem */}
                    <button onClick={() => setUploadMode('extract-audio')}
                      className="p-4 bg-white/5 hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/40 rounded-xl transition-all text-left col-span-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={16} className="text-purple-400" />
                        <span className="text-sm font-bold text-white">Extract: Audio Stem</span>
                      </div>
                      <p className="text-[10px] text-gray-500">Extract specific stem (vocals, bass, drums, piano, guitar) from audio</p>
                      <span className="text-[9px] text-purple-400 mt-1 inline-block">-1 credit</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Selected mode content */}
              {uploadMode && (
                <div className="space-y-4">
                  {/* Back + mode title */}
                  <button onClick={() => { setUploadMode(null); setUploadFile(null); setUploadFilePreview(null); setUploadError('') }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
                    <ChevronLeft size={14} /> Back to modes
                  </button>

                  <div className="flex items-center gap-2">
                    {uploadMode === 'video-to-audio' && <><Film size={18} className="text-cyan-400" /><span className="font-bold text-white">Video to Audio</span></>}
                    {uploadMode === 'stem-split' && <><Scissors size={18} className="text-purple-400" /><span className="font-bold text-white">Split Stems</span></>}
                    {uploadMode === 'audio-boost' && <><Volume2 size={18} className="text-orange-400" /><span className="font-bold text-white">Audio Boost</span></>}
                    {uploadMode === 'extract-video' && <><Layers size={18} className="text-cyan-400" /><span className="font-bold text-white">Extract: Video → Audio</span></>}
                    {uploadMode === 'extract-audio' && <><Layers size={18} className="text-purple-400" /><span className="font-bold text-white">Extract: Audio Stem</span></>}
                  </div>

                  {/* File select */}
                  {!uploadFile ? (
                    <div>
                      <input ref={uploadMode === 'video-to-audio' ? uploadVideoRef : uploadMode === 'extract-video' ? uploadExtractVideoRef : uploadMode === 'stem-split' ? uploadAudioRef : uploadMode === 'audio-boost' ? uploadBoostRef : uploadExtractAudioRef}
                        type="file"
                        accept={uploadMode === 'video-to-audio' || uploadMode === 'extract-video' ? 'video/*' : 'audio/*'}
                        className="hidden"
                        onChange={(e) => handleUploadFileSelect(e, uploadMode)} />
                      <button
                        onClick={() => {
                          const ref = uploadMode === 'video-to-audio' ? uploadVideoRef : uploadMode === 'extract-video' ? uploadExtractVideoRef : uploadMode === 'stem-split' ? uploadAudioRef : uploadMode === 'audio-boost' ? uploadBoostRef : uploadExtractAudioRef
                          ref.current?.click()
                        }}
                        className="w-full py-8 border-2 border-dashed border-white/20 hover:border-cyan-500/50 rounded-xl transition-all flex flex-col items-center gap-2 text-gray-400 hover:text-white">
                        <Upload size={24} />
                        <span className="text-sm font-medium">
                          {uploadMode === 'video-to-audio' || uploadMode === 'extract-video' ? 'Select Video File' : 'Select Audio File'}
                        </span>
                        <span className="text-[10px] text-gray-500">Max 100MB</span>
                      </button>
                    </div>
                  ) : (
                    /* File preview */
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {uploadFile.type.startsWith('video/') ? <Film size={16} className="text-cyan-400 flex-shrink-0" /> : <Music size={16} className="text-purple-400 flex-shrink-0" />}
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
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-white">HQ Mode</p>
                          <p className="text-[10px] text-gray-500">Higher quality, slower generation (10 credits)</p>
                        </div>
                        <button onClick={() => setVideoHQ(!videoHQ)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${videoHQ ? 'bg-cyan-500' : 'bg-white/20'}`}>
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
                          { value: 'bass' as const, label: '🎸 Bass', active: 'bg-purple-500/20 border-purple-500/40 text-purple-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'drums' as const, label: '🥁 Drums', active: 'bg-orange-500/20 border-orange-500/40 text-orange-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'piano' as const, label: '🎹 Piano', active: 'bg-blue-500/20 border-blue-500/40 text-blue-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'guitar' as const, label: '🎸 Guitar', active: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                          { value: 'other' as const, label: '🎶 Other', active: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300', inactive: 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' },
                        ] as const).map(stem => (
                          <button key={stem.value} onClick={() => setExtractStem(stem.value)}
                            className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${extractStem === stem.value ? stem.active : stem.inactive}`}>
                            {stem.label}
                          </button>
                        ))}
                      </div>
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
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-500 hover:to-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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

      {/* ── Drag-in file overlay ── */}
      {isDraggingFileOver && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-cyan-400/60 rounded-3xl p-12 text-center space-y-3">
            <Upload size={48} className="text-cyan-400 mx-auto" />
            <p className="text-xl font-bold text-white">Drop file to process</p>
            <p className="text-sm text-gray-400">Audio or video files — stems, boost, effects & more</p>
          </div>
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

      {/* ── Global Styles (no style jsx — regular style tag) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInLeft { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,255,255,0.1), 0 0 40px rgba(0,255,255,0.05); }
          50% { box-shadow: 0 0 30px rgba(0,255,255,0.2), 0 0 60px rgba(0,255,255,0.1), 0 0 80px rgba(0,255,255,0.05); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .chat-scroll-container::-webkit-scrollbar { width: 4px; }
        .chat-scroll-container::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll-container::-webkit-scrollbar-thumb { background: rgba(0,255,255,0.15); border-radius: 4px; }
        .chat-scroll-container::-webkit-scrollbar-thumb:hover { background: rgba(0,255,255,0.3); }
        select option { background: #0a1520; color: white; }
        .generating-glow { animation: glowPulse 2s ease-in-out infinite; }
      `}} />
    </div>
  )
}
