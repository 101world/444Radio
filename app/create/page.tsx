'use client'

import { useState, useRef, useEffect, Suspense, lazy } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Music, Image as ImageIcon, Video, Send, Loader2, Download, Play, Pause, Layers, Type, Tag, FileText, Sparkles, Music2, Settings, Zap, X, Rocket, User, Compass, PlusCircle, Library, Globe, Check, Mic, MicOff, Edit3, Atom, Dices, Upload, RotateCcw, Repeat, Plus, Square } from 'lucide-react'

// Lazy load heavy modals for better performance
const MusicGenerationModal = lazy(() => import('../components/MusicGenerationModal'))
const EffectsGenerationModal = lazy(() => import('../components/EffectsGenerationModal'))
const LoopersGenerationModal = lazy(() => import('../components/LoopersGenerationModal'))
const CombineMediaModal = lazy(() => import('../components/CombineMediaModal'))
const TwoStepReleaseModal = lazy(() => import('../components/TwoStepReleaseModal'))
const MediaUploadModal = lazy(() => import('../components/MediaUploadModal'))
const AudioBoostModal = lazy(() => import('../components/AudioBoostModal'))
const AutotuneModal = lazy(() => import('../components/AutotuneModal'))
const DeletedChatsModal = lazy(() => import('../components/DeletedChatsModal'))
const FeaturesSidebar = lazy(() => import('../components/FeaturesSidebar'))
const MatrixConsole = lazy(() => import('../components/MatrixConsole'))
import GenerationRecovery from '../components/GenerationRecovery'
import { getLanguageHook, getSamplePromptsForLanguage, getLyricsStructureForLanguage } from '@/lib/language-hooks'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'
import { useCredits } from '../contexts/CreditsContext'

const HolographicBackground = lazy(() => import('../components/HolographicBackgroundClient'))

// Note: Cannot export metadata from 'use client' components
// Metadata is set in parent layout

type MessageType = 'user' | 'assistant' | 'generation'
type GenerationType = 'music' | 'image' | 'video' | 'effects' | 'effects'

interface Message {
  id: string
  type: MessageType
  content: string
  generationType?: GenerationType
  generationId?: string // Link to GenerationQueue item
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

function CreatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()
  const { addGeneration, updateGeneration, generations, clearCompleted } = useGenerationQueue()
  const [isMobile, setIsMobile] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  
  // Detect mobile and portrait orientation (9:16 ratio for vertical layouts)
  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isMobileDevice = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      const isPortraitMode = height > width // Portrait orientation (9:16, 9:18, etc.)
      
      setIsMobile(isMobileDevice)
      setIsPortrait(isPortraitMode)
    }
    
    checkLayout() // Check on mount
    window.addEventListener('resize', checkLayout) // Check on resize/orientation change
    
    return () => window.removeEventListener('resize', checkLayout)
  }, [])
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: '👋 Hey! I\'m your AI music studio assistant. What would you like to create today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [selectedType, setSelectedType] = useState<GenerationType>('music')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showMusicModal, setShowMusicModal] = useState(false)
  const [showEffectsModal, setShowEffectsModal] = useState(false)
  const [showLoopersModal, setShowLoopersModal] = useState(false)
  const [showCombineModal, setShowCombineModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false)
  const [showAudioBoostModal, setShowAudioBoostModal] = useState(false)
  const [showAutotuneModal, setShowAutotuneModal] = useState(false)
  const [boostAudioUrl, setBoostAudioUrl] = useState('')
  const [boostTrackTitle, setBoostTrackTitle] = useState('')
  const [preselectedMusicId, setPreselectedMusicId] = useState<string | undefined>()
  const [preselectedImageId, setPreselectedImageId] = useState<string | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPromptSuggestions, setShowPromptSuggestions] = useState(false)
  const [showIdeasFlow, setShowIdeasFlow] = useState(false)
  const [ideasStep, setIdeasStep] = useState<'type' | 'genre' | 'generating'>('type')
  const [selectedPromptType, setSelectedPromptType] = useState<'song' | 'beat'>('song')
  const [generatingIdea, setGeneratingIdea] = useState(false)
  const [userCredits, setUserCredits] = useState<number | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [showBottomDock, setShowBottomDock] = useState(true)
  const [showTopNav, setShowTopNav] = useState(true)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)
  
  // Generation queue system
  const [generationQueue, setGenerationQueue] = useState<string[]>([])
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set())
  
  // Validation constants
  const MIN_PROMPT_LENGTH = 10
  const MAX_PROMPT_LENGTH = 300
  
  // Advanced parameters
  const [customLyrics, setCustomLyrics] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [songDuration, setSongDuration] = useState<'short' | 'medium' | 'long'>('long')
  const [generateCoverArt, setGenerateCoverArt] = useState(false)
  
  // Instrumental mode (LLM approach - no API parameters needed)
  const [isInstrumental, setIsInstrumental] = useState(false)
  
  // ACE-Step parameters (for non-English)
  const [audioLengthInSeconds, setAudioLengthInSeconds] = useState(45)
  const [numInferenceSteps, setNumInferenceSteps] = useState(50)
  const [guidanceScale, setGuidanceScale] = useState(7.0)
  const [denoisingStrength, setDenoisingStrength] = useState(0.8)
  
  // Modal states for parameters
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showGenreModal, setShowGenreModal] = useState(false)
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [showBpmModal, setShowBpmModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showAdvancedButtons, setShowAdvancedButtons] = useState(false)
  const [showDeletedChatsModal, setShowDeletedChatsModal] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<unknown | null>(null)
  const [isGeneratingAtomLyrics, setIsGeneratingAtomLyrics] = useState(false)
  
  // Stem splitting state
  const [isSplittingStems, setIsSplittingStems] = useState(false)
  const [splitStemsMessageId, setSplitStemsMessageId] = useState<string | null>(null)

  // Abort controllers for cancellable generations
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  // Replicate prediction IDs for server-side cancellation
  const predictionIdsRef = useRef<Map<string, string>>(new Map())
  // Message IDs pending cancellation (cancel clicked before prediction ID arrived)
  const pendingCancelsRef = useRef<Set<string>>(new Set())
  
  // Features sidebar state
  const [showFeaturesSidebar, setShowFeaturesSidebar] = useState(false)
  
  // Title validation state
  const [showTitleError, setShowTitleError] = useState(false)

  // Close all modals
  const closeAllModals = () => {
    setShowTitleModal(false)
    setShowGenreModal(false)
    setShowLyricsModal(false)
    setShowBpmModal(false)
  }

  // Listen for features sidebar toggle from DockedSidebar
  useEffect(() => {
    const handler = () => setShowFeaturesSidebar(prev => !prev)
    window.addEventListener('toggle-features-sidebar', handler)
    return () => window.removeEventListener('toggle-features-sidebar', handler)
  }, [])

  // Auto-open Ideas flow from URL param
  useEffect(() => {
    if (searchParams.get('ideas') === 'true') {
      setShowPromptSuggestions(true)
      setShowIdeasFlow(true)
    }
  }, [searchParams])

  // Handle modal toggle - close others when opening one
  const toggleModal = (modalType: 'title' | 'genre' | 'lyrics' | 'bpm') => {
    closeAllModals()
    if (modalType === 'title') setShowTitleModal(true)
    if (modalType === 'genre') setShowGenreModal(true)
    if (modalType === 'lyrics') setShowLyricsModal(true)
    if (modalType === 'bpm') setShowBpmModal(true)
  }
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Check if browser supports speech recognition
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.')
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript
          }
        }
        if (transcript) {
          setInput(prev => prev + (prev ? ' ' : '') + transcript)
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access in your browser settings.')
        }
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.start()
      setMediaRecorder(recognition)
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mediaRecorder as any).stop()
      } catch (e) {
        console.error('Error stopping recording:', e)
      }
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load chat from localStorage on mount, then try server sync
  useEffect(() => {
    try {
      const savedChat = localStorage.getItem('444radio-chat-messages')
      if (savedChat) {
        const parsedMessages = JSON.parse(savedChat)
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsedMessages.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(messagesWithDates)
      }
    } catch (error) {
      console.error('Failed to load chat from localStorage:', error)
    }
    // Also try loading from server (for plugin<->website sync)
    fetch('/api/chat/messages').then(r => r.json()).then(data => {
      if (data.success && data.messages && data.messages.length > 0) {
        const localCount = JSON.parse(localStorage.getItem('444radio-chat-messages') || '[]').length
        // Use server data if it has more messages (plugin may have synced)
        if (data.messages.length > localCount) {
          const serverMessages = data.messages.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setMessages(serverMessages)
        }
      }
    }).catch(() => {/* ignore fetch errors */})
  }, [])

  // Save chat to localStorage + debounced server sync whenever messages change
  const chatSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    try {
      localStorage.setItem('444radio-chat-messages', JSON.stringify(messages))
    } catch (error) {
      console.error('Failed to save chat to localStorage:', error)
    }
    // Debounced server sync (3s after last message change)
    if (chatSyncTimerRef.current) clearTimeout(chatSyncTimerRef.current)
    chatSyncTimerRef.current = setTimeout(() => {
      if (messages.length <= 1) return // Don't sync just the welcome message
      const syncPayload = messages.map(m => ({
        type: m.type,
        content: m.content,
        generationType: m.generationType || null,
        generationId: m.generationId || null,
        result: m.result || null,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
      }))
      fetch('/api/chat/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: syncPayload })
      }).catch(() => {/* ignore sync errors */})
    }, 3000)
  }, [messages])

  // Centralized clear-chat handler: archive → reset messages → purge completed generations
  const handleClearChat = () => {
    if (!confirm('Start a new chat? Your current session will be saved to Chat History.')) return
    try {
      const archives = localStorage.getItem('444radio-chat-archives')
      const archiveList = archives ? JSON.parse(archives) : []
      const newArchive = {
        id: `chat-${Date.now()}`,
        messages,
        archivedAt: new Date(),
        messageCount: messages.length
      }
      archiveList.unshift(newArchive)
      localStorage.setItem('444radio-chat-archives', JSON.stringify(archiveList.slice(0, 50)))
      localStorage.removeItem('444radio-chat-backup')
    } catch (error) {
      console.error('Failed to archive chat:', error)
    }
    // Reset messages to welcome
    setMessages([{
      id: '1',
      type: 'assistant',
      content: '\u{1F44B} Hey! I\'m your AI music studio assistant. What would you like to create today?',
      timestamp: new Date()
    }])
    // Purge completed/failed generations so the sync effect doesn't restore them
    clearCompleted()
  }

  // Cancel an in-progress generation
  const handleCancelGeneration = (messageId: string) => {
    // Abort the active fetch (this also causes the server to detect disconnect via request.signal)
    const controller = abortControllersRef.current.get(messageId)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(messageId)
    }
    // Cancel the Replicate prediction server-side (fire and forget)
    const predictionId = predictionIdsRef.current.get(messageId)
    if (predictionId) {
      fetch('/api/generate/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictionId })
      }).catch(() => {}) // best-effort
      predictionIdsRef.current.delete(messageId)
    } else {
      // Prediction ID not received yet — mark for deferred cancellation
      pendingCancelsRef.current.add(messageId)
    }
    // Mark message as cancelled
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, isGenerating: false, content: '⏹ Generation cancelled.' }
        : msg
    ))
    // Update generation queue item if linked
    const msg = messages.find(m => m.id === messageId)
    if (msg?.generationId) {
      updateGeneration(msg.generationId, { status: 'failed', error: 'Cancelled by user' })
    }
    // Clean up active generations set
    setActiveGenerations(prev => {
      const next = new Set(prev)
      next.delete(messageId)
      return next
    })
    setGenerationQueue(prev => prev.filter(id => id !== messageId))
    // Re-check if any still active
    refreshCredits()
  }

  // Sync generation queue results with messages on mount and when generations change
  useEffect(() => {
    console.log('[Sync] Checking generation queue for completed generations:', generations.length)
    
    // Check if any generations completed while user was away or during generation
    generations.forEach(gen => {
      if ((gen.status === 'completed' || gen.status === 'failed') && gen.result) {
        setMessages(prev => {
          // First, try to find message by generationId (exact match)
          const messageByGenId = prev.find(msg => msg.generationId === gen.id)
          
          if (messageByGenId) {
            // Check if already updated
            if (!messageByGenId.isGenerating && messageByGenId.result && gen.status === 'completed') {
              console.log('[Sync] Message already updated for generation:', gen.id)
              return prev
            }
            
            // Update the exact message
            console.log('[Sync] Updating message by generationId:', gen.id, 'status:', gen.status)
            return prev.map(msg =>
              msg.generationId === gen.id
                ? {
                    ...msg,
                    isGenerating: false,
                    content: gen.status === 'failed' 
                      ? `❌ ${gen.error || 'Generation failed'}` 
                      : (gen.type === 'music' ? '✅ Track generated!' : 
                         gen.type === 'effects' ? '✅ Effects generated!' : 
                         gen.type === 'image' ? '✅ Image generated!' : 
                         gen.type === 'stem-split' ? `✅ Stems separated successfully! Used ${gen.result?.creditsUsed || 0} credits.` :
                         '✅ Generation complete!'),
                    result: gen.status === 'completed' ? gen.result : undefined,
                    stems: gen.type === 'stem-split' && gen.result?.stems ? gen.result.stems : undefined
                  }
                : msg
            )
          }
          
          // If no message found but generation completed, create a new message
          // This handles cases where user switched tabs before message was created
          // SKIP for loopers (they have variations array) - already handled by onSuccess
          if (gen.status === 'completed' && !messageByGenId && !gen.result?.variations) {
            console.log('[Sync] Creating new message for completed generation:', gen.id)
            const newMessage: Message = {
              id: `restored-${gen.id}`,
              type: 'assistant',
              generationId: gen.id,
              content: gen.type === 'music' ? '✅ Track generated!' : 
                       gen.type === 'effects' ? '✅ Effects generated!' : 
                       gen.type === 'image' ? '✅ Image generated!' : 
                       gen.type === 'stem-split' ? `✅ Stems separated successfully! Used ${gen.result?.creditsUsed || 0} credits.` :
                       '✅ Generation complete!',
              timestamp: new Date(gen.completedAt || gen.startedAt),
              isGenerating: false,
              result: gen.result,
              stems: gen.type === 'stem-split' && gen.result?.stems ? gen.result.stems : undefined
            }
            return [...prev, newMessage]
          }
          
          return prev
        })
      }
    })
  }, [generations])

  // Fetch user credits function — synced from shared context
  const { credits: contextCredits, refreshCredits } = useCredits()

  // Sync credits from shared context (removes mount-time fetch)
  useEffect(() => {
    if (contextCredits !== null) {
      setUserCredits(contextCredits)
      setIsLoadingCredits(false)
    }
  }, [contextCredits])

  // Auto-hide top nav after 2 seconds or on interaction
  useEffect(() => {
    const hideTimer = setTimeout(() => {
      if (!hasInteracted) {
        setShowTopNav(false)
      }
    }, 2000)

    return () => clearTimeout(hideTimer)
  }, [])

  // Handle scroll to show/hide top nav
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (!target) return

      const currentScrollY = target.scrollTop || 0
      
      // Scrolling up - show nav
      if (currentScrollY < lastScrollY && currentScrollY > 0) {
        setShowTopNav(true)
      }
      // Scrolling down - hide nav
      else if (currentScrollY > lastScrollY) {
        setShowTopNav(false)
        setHasInteracted(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    const chatArea = document.querySelector('.chat-scroll-container')
    if (chatArea) {
      chatArea.addEventListener('scroll', handleScroll)
      return () => chatArea.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  // Handle ESC key to show nav and return to home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTopNav(true)
        // Optional: navigate to home after showing nav
        router.push('/')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router])

  // Hide top nav when user interacts with input
  const handleInputFocus = () => {
    setShowTopNav(false)
    setHasInteracted(true)
  }

  // Handle mobile keyboard - adjust viewport height
  useEffect(() => {
    // Set CSS variable for mobile viewport height that accounts for keyboard
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);

    return () => {
      window.removeEventListener('resize', setViewportHeight);
      window.removeEventListener('orientationchange', setViewportHeight);
    };
  }, []);

  // Read URL parameters and display combined message in chat
  useEffect(() => {
    const combinedMessage = searchParams.get('combinedMessage')
    const musicPrompt = searchParams.get('musicPrompt')
    const coverArtPrompt = searchParams.get('coverArtPrompt')
    const videoPrompt = searchParams.get('videoPrompt')
    const toolsParam = searchParams.get('tools')

    if (combinedMessage && toolsParam) {
      // Add combined message to chat
      const newMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: combinedMessage, // Shows "🎵 Music: X\n🎨 Cover Art: Y"
        timestamp: new Date()
      }
      setMessages(prev => [...prev, newMessage])

      // Parse tools
      const tools = toolsParam.split(',') as GenerationType[]
      
      // Set first tool as selected
      if (tools.length > 0) {
        setSelectedType(tools[0])
        
        // Auto-open modal for first tool with its specific prompt
        if (tools[0] === 'music' && musicPrompt) {
          setInput(musicPrompt)
          setShowMusicModal(true)
        } else if (tools[0] === 'image' && coverArtPrompt) {
          setInput(coverArtPrompt)
          handleGenerate()
        } else if (tools[0] === 'video' && videoPrompt) {
          setInput(videoPrompt)
          // Open video modal when ready
        }
        
        // TODO: After first workflow completes, process remaining tools
      }
    }
  }, [searchParams])

  // ESC key handler to go back to home page (only if no modals are open)
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showMusicModal && !showCombineModal) {
        router.push('/')
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router, showMusicModal, showCombineModal])

  // Validate prompt length
  const validatePrompt = (prompt: string): { valid: boolean; error?: string } => {
    const trimmed = prompt.trim()
    if (trimmed.length < MIN_PROMPT_LENGTH) {
      return { valid: false, error: `Prompt must be at least ${MIN_PROMPT_LENGTH} characters` }
    }
    if (trimmed.length > MAX_PROMPT_LENGTH) {
      return { valid: false, error: `Prompt must be ${MAX_PROMPT_LENGTH} characters or less` }
    }
    return { valid: true }
  }

  const handleGenerate = async () => {
    if (!input.trim()) return

    // Validate prompt length
    const validation = validatePrompt(input)
    if (!validation.valid) {
      alert(`❌ ${validation.error}`)
      return
    }

    // Validate title length if provided (ONLY for regular music, NOT instrumental)
    // Note: Title is now auto-generated if not provided, so we only validate if user enters it
    if (selectedType === 'music' && !isInstrumental && customTitle.trim()) {
      const titleLength = customTitle.trim().length
      if (titleLength < 3) {
        setShowLyricsModal(true)
        setShowTitleError(true)
        setTimeout(() => {
          const paramsSection = document.getElementById('parameters-section')
          if (paramsSection) {
            paramsSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        setTimeout(() => setShowTitleError(false), 5000)
        return
      }
      if (titleLength > 100) {
        setShowLyricsModal(true)
        setShowTitleError(true)
        setTimeout(() => {
          const paramsSection = document.getElementById('parameters-section')
          if (paramsSection) {
            paramsSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        setTimeout(() => setShowTitleError(false), 5000)
        return
      }
    }

    // Clear title error if validation passed
    setShowTitleError(false)

    // Check credits before generation AND prevent multiple simultaneous generations
    const creditsNeeded = selectedType === 'music' ? 2 : selectedType === 'image' ? 1 : selectedType === 'effects' ? 2 : 0
    
    // Fetch fresh credits to prevent race conditions
    const freshCreditsRes = await fetch('/api/credits')
    const freshCreditsData = await freshCreditsRes.json()
    const currentCredits = freshCreditsData.credits || 0
    
    // Also check if there are active generations that haven't deducted credits yet
    const pendingCredits = activeGenerations.size * (selectedType === 'music' ? 2 : selectedType === 'effects' ? 2 : 1)
    const availableCredits = currentCredits - pendingCredits
    
    console.log('[Credit Check]', { currentCredits, pendingCredits, availableCredits, creditsNeeded })
    
    if (availableCredits < creditsNeeded) {
      alert(`⚡ Insufficient credits! You need ${creditsNeeded} credits but only have ${currentCredits} available (${pendingCredits} reserved for active generations). Visit the pricing page to get more.`)
      return
    }
    
    // Update local credits state
    setUserCredits(currentCredits)

    // Close any open parameter modals
    closeAllModals()

    // Standard generation workflow (including instrumental via LLM)
    if (selectedType === 'music') {
      const generationId = Date.now().toString()
      const userMessage: Message = {
        id: generationId,
        type: 'user',
        content: isInstrumental ? `🎹 Generate instrumental: "${input}"` : `🎵 Generate music: "${input}"`,
        timestamp: new Date()
      }

      const generatingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'generation',
        content: activeGenerations.size > 0 ? '� Queued - will start soon...' : `🎵 Generating your ${isInstrumental ? 'instrumental ' : ''}track...`,
        generationType: 'music',
        isGenerating: true,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setGenerationQueue(prev => [...prev, generatingMessage.id])
      setActiveGenerations(prev => new Set(prev).add(generatingMessage.id))
      
      // Create abort controller early so cancel works even during auto-fill
      const earlyAbortController = new AbortController()
      abortControllersRef.current.set(generatingMessage.id, earlyAbortController)
      
      // Store original prompt before clearing input
      let originalPrompt = input
      setInput('')

      // If instrumental mode, strip any vocal-related words and ensure "no vocals" tag
      if (isInstrumental) {
        // Strip vocal-related words that might have slipped in from AI-generated prompts
        // Use word boundaries (\b) to avoid matching inside other words (e.g. 'hum' in 'thumping')
        originalPrompt = originalPrompt
          .replace(/\b(vocals?|voices?|singing|singer|sung|sing|vox|vocoder|choir|choral|humming|chant(?:ing)?|whisper(?:ed)?|falsetto|a\s*capella|acapella)\b/gi, '')
          .replace(/\b(vocal\s*chops?|vocal\s*samples?|vocal\s*harmon(?:y|ies)|vocal\s*m[eé]lod(?:y|ie|ía)s?)\b/gi, '')
          .replace(/\b(rich|lush|soaring|ethereal|warm|smooth|soulful|lead|backing)\s+vocals?\b/gi, '')
          .replace(/\s+/g, ' ')
          .replace(/,\s*,+/g, ',')
          .replace(/,\s*$/, '')
          .replace(/^\s*,/, '')
          .trim()

        if (!originalPrompt.toLowerCase().includes('no vocals')) {
          const tag = ', no vocals, instrumental only'
          originalPrompt = originalPrompt.trimEnd().slice(0, 300 - tag.length) + tag
        } else {
          originalPrompt = originalPrompt.slice(0, 300)
        }
        console.log('🎹 Instrumental mode: cleaned prompt:', originalPrompt)
      } else {
        originalPrompt = originalPrompt.slice(0, 300)
      }

      // Smart auto-fill: If user hasn't filled mandatory fields, auto-generate them
      let finalTitle = customTitle
      let finalLyrics = customLyrics
      let finalGenre = genre
      let finalBpm = bpm
      let wasAutoFilled = false

      // Helper: check if user cancelled during auto-fill
      const wasCancelled = () => earlyAbortController.signal.aborted

      // Auto-generate missing fields based on prompt using LLM
      if (!finalTitle.trim() && !wasCancelled()) {
        console.log('🤖 Auto-generating natural title from prompt...')
        wasAutoFilled = true
        try {
          const titleResponse = await fetch('/api/generate/atom-title', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: originalPrompt })
          })
          const titleData = await titleResponse.json()
          console.log('🔍 [TITLE DEBUG] Raw atom-title API response:', titleData)
          if (titleData.success && titleData.title) {
            finalTitle = titleData.title
            console.log('🔍 [TITLE DEBUG] finalTitle set to:', finalTitle)
            setCustomTitle(finalTitle)
            console.log('✅ Auto-generated title:', finalTitle)
          }
          // Rate limit safety: wait 10s before next API call
          await new Promise(resolve => setTimeout(resolve, 10000))
        } catch (error) {
          console.error('❌ Auto-title generation failed:', error)
          // Fallback: use first few words
          finalTitle = originalPrompt.split(' ').slice(0, 2).join(' ')
          setCustomTitle(finalTitle)
        }
      }

      // Handle lyrics based on instrumental mode
      if (wasCancelled()) {
        // User cancelled during auto-fill, abort early
        return
      }
      if (isInstrumental) {
        // For instrumental mode, set lyrics to [Instrumental]
        finalLyrics = '[Instrumental]'
        setCustomLyrics(finalLyrics)
        console.log('🎹 Instrumental mode: setting lyrics to [Instrumental]')
      } else if (!finalLyrics.trim()) {
        // Only auto-generate lyrics if not in instrumental mode and no lyrics provided
        console.log('🤖 Auto-generating lyrics from prompt...')
        wasAutoFilled = true
        try {
          const lyricsResponse = await fetch('/api/generate/atom-lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: originalPrompt, language: selectedLanguage })
          })
          const lyricsData = await lyricsResponse.json()
          if (lyricsData.success && lyricsData.lyrics) {
            finalLyrics = lyricsData.lyrics
            setCustomLyrics(finalLyrics)
            console.log('✅ Auto-generated lyrics:', finalLyrics.substring(0, 100) + '...')
          }
          // Rate limit safety: wait 10s before next API call
          await new Promise(resolve => setTimeout(resolve, 10000))
        } catch (error) {
          console.error('❌ Auto-lyrics generation failed:', error)
        }
      }

      // Auto-detect genre using LLM if not provided
      if (!finalGenre.trim() && !wasCancelled()) {
        console.log('🤖 Auto-detecting genre from prompt...')
        wasAutoFilled = true
        try {
          const genreResponse = await fetch('/api/generate/atom-genre', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: originalPrompt })
          })
          const genreData = await genreResponse.json()
          if (genreData.success && genreData.genre) {
            finalGenre = genreData.genre
            setGenre(finalGenre)
            console.log('✅ Auto-detected genre:', finalGenre)
          }
          // Rate limit safety: wait 10s before music generation
          await new Promise(resolve => setTimeout(resolve, 10000))
        } catch (error) {
          console.error('❌ Auto-genre detection failed:', error)
          // Fallback to pop
          finalGenre = 'pop'
          setGenre(finalGenre)
        }
      }

      // Bail out if user cancelled during auto-fill
      if (wasCancelled()) {
        return
      }

      // Auto-detect BPM from prompt if not provided
      if (!finalBpm.trim()) {
        const promptLower = originalPrompt.toLowerCase()
        if (promptLower.includes('fast') || promptLower.includes('energetic') || promptLower.includes('upbeat')) finalBpm = '140'
        else if (promptLower.includes('slow') || promptLower.includes('chill') || promptLower.includes('relaxing')) finalBpm = '80'
        else if (promptLower.includes('medium') || promptLower.includes('moderate')) finalBpm = '110'
        else {
          // BPM based on genre
          if (finalGenre.includes('electronic') || finalGenre.includes('edm')) finalBpm = '128'
          else if (finalGenre.includes('hip-hop') || finalGenre.includes('rap')) finalBpm = '90'
          else if (finalGenre.includes('rock')) finalBpm = '120'
          else if (finalGenre.includes('lofi') || finalGenre.includes('chill')) finalBpm = '85'
          else finalBpm = '110' // Default moderate BPM
        }
        setBpm(finalBpm)
        wasAutoFilled = true
        console.log('🥁 Auto-detected BPM:', finalBpm)
      }

      // Show user what was auto-filled
      if (wasAutoFilled) {
        const autoFilledFields: string[] = []
        if (!customTitle.trim()) autoFilledFields.push('Title')
        if (!customLyrics.trim() && !isInstrumental) autoFilledFields.push('Lyrics')
        if (isInstrumental) autoFilledFields.push('Instrumental Mode')
        if (!genre.trim()) autoFilledFields.push(`Genre (${finalGenre})`)
        if (!bpm.trim()) autoFilledFields.push(`BPM (${finalBpm})`)
        
        const autoFillMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: `✨ Auto-filled: ${autoFilledFields.join(', ')}`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, autoFillMessage])
      }

      // Process queue asynchronously with auto-filled or user-provided values
      processQueue(generatingMessage.id, 'music', {
        prompt: originalPrompt,
        genre: finalGenre,
        bpm: finalBpm,
        customTitle: finalTitle,
        customLyrics: finalLyrics,
        songDuration
      })

      // Clear parameters so the next generation gets fresh auto-filled values
      setCustomTitle('')
      setCustomLyrics('')
      setGenre('')
      setBpm('')
      setSongDuration('long')
      setIsInstrumental(false)
      return
    }

    // For sound effects generation
    if (selectedType === 'effects') {
      setShowEffectsModal(true)
      return
    }

    // For cover art/image generation
    if (selectedType === 'image') {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: input,
        timestamp: new Date()
      }

      const generatingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'generation',
        content: activeGenerations.size > 0 ? '🎨 Queued - will start soon...' : '🎨 Generating cover art...',
        generationType: 'image',
        isGenerating: true,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setGenerationQueue(prev => [...prev, generatingMessage.id])
      setInput('')

      // Process queue asynchronously
      processQueue(generatingMessage.id, 'image', { prompt: input })
      return
    }
  }

  // Queue processing function
  const processQueue = async (
    messageId: string,
    type: 'music' | 'image' | 'effects',
    params: {
      prompt: string
      genre?: string
      bpm?: string
      customTitle?: string
      customLyrics?: string
      songDuration?: 'short' | 'medium' | 'long'
    }
  ) => {
    console.log('[Generation] Starting generation:', { messageId, type, params })
    
    // Reuse abort controller if already created (e.g. during auto-fill in handleGenerate),
    // otherwise create a new one (for image/effects or other callers)
    let abortController = abortControllersRef.current.get(messageId)
    if (!abortController) {
      abortController = new AbortController()
      abortControllersRef.current.set(messageId, abortController)
    }
    
    // If already aborted (cancelled during auto-fill), bail out immediately
    if (abortController.signal.aborted) {
      console.log('[Generation] Already cancelled before processQueue started:', messageId)
      return
    }
    
    // Add to persistent generation queue
    const genId = addGeneration({
      type: type,
      prompt: params.prompt,
      title: params.customTitle || params.prompt.substring(0, 50)
    })
    
    // Link the message to the generation queue item
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, generationId: genId } : msg
    ))
    
    try {
      // Add to active generations
      setActiveGenerations(prev => new Set(prev).add(messageId))
      
      // Update generation queue status
      updateGeneration(genId, { status: 'generating', progress: 10 })
      
      // Update message to show it's now generating (if it was queued)
      setMessages(prev => prev.map(msg => 
        msg.id === messageId && msg.content.includes('Queued')
          ? { ...msg, content: type === 'music' ? '🎵 Generating your track...' : '🎨 Generating cover art...' }
          : msg
      ))

      let result
      
      if (type === 'music') {
        // ALWAYS provide a title - use custom title or first 50 chars of prompt
        const titleToUse = params.customTitle || params.prompt.substring(0, 50)
        const lyricsToUse = params.customLyrics || undefined
        const durationToUse = params.songDuration || 'long'
        const genreToUse = params.genre || undefined
        const bpmToUse = params.bpm || undefined
        
        console.log('[Generation] Calling generateMusic with:', { 
          prompt: params.prompt, 
          titleToUse, 
          lyricsToUse, 
          durationToUse,
          genreToUse,
          bpmToUse
        })
        console.log('🔍 [TITLE DEBUG] Title being sent to generateMusic:', titleToUse)
        result = await generateMusic(params.prompt, titleToUse, lyricsToUse, durationToUse, genreToUse, bpmToUse, abortController.signal, messageId)
        console.log('[Generation] Music generation result:', result)
      } else {
        console.log('[Generation] Calling generateImage with:', params.prompt)
        result = await generateImage(params.prompt, abortController.signal)
        console.log('[Generation] Image generation result:', result)
      }

      // Update credits — optimistic local update + context refresh
      if (!result.error && result.creditsRemaining !== undefined) {
        console.log('[Generation] Updating credits from', userCredits, 'to', result.creditsRemaining)
        setUserCredits(result.creditsRemaining)
      }
      // Always refresh context so the shared CreditsContext stays in sync
      refreshCredits()
      window.dispatchEvent(new Event('credits:refresh'))

      // Update persistent generation queue with result
      if (result.error) {
        updateGeneration(genId, {
          status: 'failed',
          error: result.error
        })
      } else {
        updateGeneration(genId, {
          status: 'completed',
          result: {
            audioUrl: 'audioUrl' in result ? result.audioUrl : undefined,
            imageUrl: 'imageUrl' in result ? result.imageUrl : undefined,
            title: result.title,
            lyrics: 'lyrics' in result ? result.lyrics : undefined
          }
        })
      }

      // Update message with result - mark as NOT generating
      setMessages(prev => {
        console.log('[Generation] Updating message', messageId, 'with result:', result)
        return prev.map(msg => 
          msg.id === messageId || msg.generationId === genId
            ? {
                ...msg,
                isGenerating: false,
                content: result.error ? `❌ ${result.error}` : (type === 'music' ? '✅ Track generated!' : '✅ Cover art generated!'),
                result: result.error ? undefined : result
              }
            : msg
        )
      })

      // Add assistant response
      if (!result.error) {
        const assistantMessage: Message = {
          id: (Date.now() + Math.random()).toString(),
          type: 'assistant',
          content: type === 'music' 
            ? 'Your track is ready! Want to create cover art for it? Or generate another track?'
            : 'Cover art created! Want to combine it with a track?',
          timestamp: new Date()
        }
        console.log('[Generation] Adding assistant message:', assistantMessage)
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      // If aborted by user, don't overwrite the cancel message
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('[Generation] Aborted by user:', messageId)
        return
      }
      
      console.error('Generation error:', error)
      
      // Update persistent queue with error
      updateGeneration(genId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      // Mark message as failed and NOT generating
      setMessages(prev => prev.map(msg => 
        msg.id === messageId || msg.generationId === genId
          ? { ...msg, isGenerating: false, content: '❌ Generation failed. Please try again.' }
          : msg
      ))
      
      // Refetch credits in case of error
      refreshCredits()
      window.dispatchEvent(new Event('credits:refresh'))
    } finally {
      // Clean up abort controller
      abortControllersRef.current.delete(messageId)
      // Remove from queue and active generations
      console.log('[Generation] Cleaning up generation', messageId)
      setGenerationQueue(prev => prev.filter(id => id !== messageId))
      setActiveGenerations(prev => {
        const newSet = new Set(prev)
        newSet.delete(messageId)
        console.log('[Generation] Active generations after cleanup:', newSet.size)
        return newSet
      })
    }
  }

  // Instrumental queue processing function
  // Legacy isGenerating based on active generations
  useEffect(() => {
    setIsGenerating(activeGenerations.size > 0)
  }, [activeGenerations])

  // Video coming soon handler (kept separate)
  const handleVideoPrompt = () => {
  }

  const handleMusicGenerationStart = (prompt: string) => {
    // Close modal immediately
    setShowMusicModal(false)
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `🎵 Generate music: "${prompt}"`,
      timestamp: new Date()
    }

    // Add generating message
    const generatingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'generation',
      content: '🎵 Generating your track...',
      generationType: 'music',
      timestamp: new Date(),
      isGenerating: true
    }

    setMessages(prev => [...prev, userMessage, generatingMessage])
  }

  const handleMusicGenerated = (audioUrl: string, title: string, lyrics: string, prompt: string) => {
    // Update the generating message with the result
    setMessages(prev => {
      const updated = [...prev]
      const lastGeneratingIndex = updated.findLastIndex(m => m.isGenerating && m.generationType === 'music')
      
      if (lastGeneratingIndex !== -1) {
        // Replace generating message with result
        updated[lastGeneratingIndex] = {
          id: updated[lastGeneratingIndex].id,
          type: 'generation',
          content: '✅ Track generated!',
          generationType: 'music',
          result: {
            audioUrl,
            title,
            lyrics,
            prompt
          },
          timestamp: new Date()
        }
        
        // Add assistant response
        const assistantMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: 'Your track is ready! Want to create cover art for it? Or generate another track?',
          timestamp: new Date()
        }
        
        return [...updated, assistantMessage]
      }
      
      return updated
    })
    
    setInput('')
  }

  const handleGeneratePromptIdea = async (genre: string) => {
    setGeneratingIdea(true)
    setIdeasStep('generating')

    try {
      const response = await fetch('/api/generate/prompt-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre,
          promptType: selectedPromptType
        })
      })

      const data = await response.json()

      if (data.success && data.prompt) {
        // Insert generated prompt into input box
        setInput(data.prompt.slice(0, MAX_PROMPT_LENGTH))
        
        // Close modals
        setShowIdeasFlow(false)
        setShowPromptSuggestions(false)
        setIdeasStep('type')
        
        // Show success message
        const successMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: `✨ AI generated a ${genre} ${selectedPromptType} prompt for you! Feel free to edit it or hit create!`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, successMessage])
      } else {
        throw new Error(data.error || 'Failed to generate prompt')
      }
    } catch (error) {
      console.error('Prompt generation error:', error)
      alert('Failed to generate prompt idea. Please try again.')
      setIdeasStep('genre')
    } finally {
      setGeneratingIdea(false)
    }
  }

  const generateMusic = async (
    prompt: string, 
    title?: string, 
    lyrics?: string, 
    duration: 'short' | 'medium' | 'long' = 'long',
    genreParam?: string,
    bpmParam?: string,
    signal?: AbortSignal,
    messageId?: string
  ) => {
    console.log('🔍 [TITLE DEBUG] generateMusic called with title:', title)
    
    // Genre/BPM are sent as separate fields — don't bloat the prompt string
    // Replicate model limit is 300 chars for prompt
    const requestBody: any = {
      prompt: prompt.slice(0, 300),
      title,
      lyrics: lyrics, // Pass lyrics as-is (either regular lyrics or [Instrumental])
      duration,
      language: selectedLanguage,
      genre: genreParam,
      bpm: bpmParam ? parseInt(bpmParam) : undefined,
      generateCoverArt
    }

    console.log('🔍 [TITLE DEBUG] Request body being sent to music-only API:', JSON.stringify(requestBody, null, 2))

    // Add ACE-Step parameters for non-English languages
    if (selectedLanguage.toLowerCase() !== 'english') {
      requestBody.audio_length_in_s = audioLengthInSeconds
      requestBody.num_inference_steps = numInferenceSteps
      requestBody.guidance_scale = guidanceScale
      requestBody.denoising_strength = denoisingStrength
    }

    const res = await fetch('/api/generate/music-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal
    })

    // Parse NDJSON stream: first line = {type:'started', predictionId}, last line = result
    const reader = res.body?.getReader()
    if (!reader) {
      return { error: 'No response stream' }
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let resultData: any = null

    try {
      while (true) {
        // Explicit signal check each iteration to ensure cancel always works
        if (signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete last line in buffer

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'started' && parsed.predictionId && messageId) {
              // Store prediction ID for cancellation
              predictionIdsRef.current.set(messageId, parsed.predictionId)
              console.log('[Cancel] Stored prediction ID:', parsed.predictionId, 'for message:', messageId)
              // If cancel was requested before ID arrived, fire it now
              if (pendingCancelsRef.current.has(messageId)) {
                pendingCancelsRef.current.delete(messageId)
                fetch('/api/generate/cancel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ predictionId: parsed.predictionId })
                }).catch(() => {})
                predictionIdsRef.current.delete(messageId)
                console.log('[Cancel] Deferred cancel fired for:', parsed.predictionId)
              }
            } else if (parsed.type === 'result') {
              resultData = parsed
            }
          } catch {
            console.warn('[NDJSON] Failed to parse line:', line)
          }
        }
      }
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer)
          if (parsed.type === 'result') resultData = parsed
          else if (parsed.type === 'started' && parsed.predictionId && messageId) {
            predictionIdsRef.current.set(messageId, parsed.predictionId)
          }
        } catch { /* ignore */ }
      }
    } finally {
      reader.releaseLock()
      if (messageId) predictionIdsRef.current.delete(messageId)
    }

    if (!resultData) {
      return { error: 'No result received from generation' }
    }
    
    if (resultData.success) {
      return {
        audioUrl: resultData.audioUrl,
        imageUrl: resultData.imageUrl,
        title: resultData.title || title || prompt.substring(0, 50),
        prompt: prompt,
        lyrics: resultData.lyrics || lyrics,
        creditsRemaining: resultData.creditsRemaining
      }
    } else {
      return { error: resultData.error || 'Failed to generate music' }
    }
  }

  const generateImage = async (prompt: string, signal?: AbortSignal) => {
    const res = await fetch('/api/generate/image-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal
    })

    const data = await res.json()
    
    if (data.success) {
      return {
        imageUrl: data.imageUrl,
        title: prompt.substring(0, 50),
        prompt: prompt,
        creditsRemaining: data.creditsRemaining
      }
    } else {
      return { error: data.error || 'Failed to generate image' }
    }
  }

  const handlePlayPause = (messageId: string, audioUrl: string, title: string = 'Generated Track') => {
    const track = {
      id: messageId,
      audioUrl: audioUrl,
      title: title,
      artist: 'AI Generated'
    }
    
    // If this track is already playing, toggle pause/play
    if (currentTrack?.id === messageId) {
      togglePlayPause()
    } else {
      // Play the new track
      playTrack(track)
    }
  }

  const handleDownload = async (url: string, filename: string, format: 'mp3' | 'wav' = 'mp3') => {
    try {
      if (format === 'mp3') {
        // MP3: redirect-style download via /api/download
        const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        // WAV: proxy fetch → decode → convert to PCM WAV → download
        const res = await fetch(`/api/r2/proxy?url=${encodeURIComponent(url)}`)
        if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        const wavBlob = audioBufferToWav(audioBuffer)
        const wavObjUrl = URL.createObjectURL(wavBlob)
        
        const link = document.createElement('a')
        link.href = wavObjUrl
        link.download = filename.replace('.mp3', '.wav')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(wavObjUrl)
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Download failed. Please try again.')
    }
  }

  // Handle stem splitting
  const handleSplitStems = async (audioUrl: string, messageId: string) => {
    // Check credits before splitting (stem splitting costs 5 credits)
    if (userCredits !== null && userCredits < 5) {
      alert(`⚡ Insufficient credits! You need 5 credits to split stems but only have ${userCredits}. Visit the pricing page to get more.`)
      return
    }

    setIsSplittingStems(true)
    setSplitStemsMessageId(messageId)

    // Add to GenerationQueue instead of localStorage
    const genId = addGeneration({
      type: 'stem-split',
      prompt: `Stem split: ${audioUrl}`,
      title: 'Stem Separation'
    })

    // Update to generating
    updateGeneration(genId, { status: 'generating' })

    // Add "processing" message linked to generation
    const processingMessage: Message = {
      id: `${messageId}-stems-processing`,
      type: 'assistant',
      content: '🎵 Splitting stems... This may take 1-2 minutes.',
      timestamp: new Date(),
      isGenerating: true,
      generationId: genId
    }
    setMessages(prev => [...prev, processingMessage])

    // Create abort controller for stem split
    const abortController = new AbortController()
    abortControllersRef.current.set(processingMessage.id, abortController)

    try {
      const response = await fetch('/api/audio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl }),
        signal: abortController.signal
      })

      // Parse NDJSON stream for prediction ID and result
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let data: any = null

      const processLine = (line: string) => {
        if (!line.trim()) return
        try {
          const parsed = JSON.parse(line)
          if (parsed.type === 'started' && parsed.predictionId) {
            predictionIdsRef.current.set(processingMessage.id, parsed.predictionId)
            console.log('[StemSplit] Stored prediction ID:', parsed.predictionId)
            if (pendingCancelsRef.current.has(processingMessage.id)) {
              pendingCancelsRef.current.delete(processingMessage.id)
              fetch('/api/generate/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictionId: parsed.predictionId })
              }).catch(() => {})
              predictionIdsRef.current.delete(processingMessage.id)
            }
          } else if (parsed.type === 'result') {
            data = parsed
          } else if (parsed.type === 'progress') {
            console.log('[StemSplit] Progress:', parsed.status, `${parsed.elapsed}s`)
          }
        } catch (e) {
          console.warn('[StemSplit] NDJSON parse skip:', (e as Error).message?.substring(0, 80))
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) processLine(line)
      }
      // Process any remaining buffer lines
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) processLine(line)
      }
      reader.releaseLock()

      if (!data || !data.success) {
        throw new Error(data?.error || 'Stem splitting failed')
      }

      // Update credits — optimistic local + context refresh
      if (data.creditsRemaining !== undefined) {
        setUserCredits(data.creditsRemaining)
      }
      refreshCredits()
      window.dispatchEvent(new Event('credits:refresh'))

      // Update GenerationQueue with success
      updateGeneration(genId, {
        status: 'completed',
        result: {
          stems: data.stems,
          creditsUsed: data.creditsUsed,
          creditsRemaining: data.creditsRemaining
        }
      })

      // Update UI message
      setMessages(prev => prev.map(msg =>
        msg.id === processingMessage.id
          ? {
              ...msg,
              content: `✅ Stems separated successfully! Used ${data.creditsUsed || 0} credits. ${data.creditsRemaining || 0} credits remaining.`,
              isGenerating: false,
              stems: data.stems || {}
            }
          : msg
      ))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('[StemSplit] Aborted by user')
        return
      }
      console.error('Stem splitting error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to split stems. Please try again.'
      
      // Update GenerationQueue with error
      updateGeneration(genId, {
        status: 'failed',
        error: errorMessage
      })
      
      setMessages(prev => prev.map(msg =>
        msg.id === processingMessage.id
          ? { ...msg, content: `❌ ${errorMessage}`, isGenerating: false }
          : msg
      ))
    } finally {
      abortControllersRef.current.delete(processingMessage.id)
      predictionIdsRef.current.delete(processingMessage.id)
      setIsSplittingStems(false)
      setSplitStemsMessageId(null)
      
      // Safety: ensure the processing message is never stuck in "generating" state
      // This catches edge cases where stream closes without a result line
      setMessages(prev => {
        const msg = prev.find(m => m.id === processingMessage.id)
        if (msg && msg.isGenerating) {
          console.warn('[StemSplit] Processing message still in generating state — forcing completion')
          return prev.map(m =>
            m.id === processingMessage.id
              ? { ...m, isGenerating: false, content: m.content.startsWith('❌') ? m.content : '✅ Stem split complete — check your Library > Stems tab.' }
              : m
          )
        }
        return prev
      })
    }
  }

  // Convert AudioBuffer to WAV blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length * buffer.numberOfChannels * 2 + 44
    const arrayBuffer = new ArrayBuffer(length)
    const view = new DataView(arrayBuffer)
    const channels: Float32Array[] = []
    let offset = 0
    let pos = 0

    // Write WAV header
    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2 }
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4 }

    setUint32(0x46464952) // "RIFF"
    setUint32(length - 8) // file length - 8
    setUint32(0x45564157) // "WAVE"
    setUint32(0x20746d66) // "fmt " chunk
    setUint32(16) // length = 16
    setUint16(1) // PCM (uncompressed)
    setUint16(buffer.numberOfChannels)
    setUint32(buffer.sampleRate)
    setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels) // avg. bytes/sec
    setUint16(buffer.numberOfChannels * 2) // block-align
    setUint16(16) // 16-bit
    setUint32(0x61746164) // "data" - chunk
    setUint32(length - pos - 4) // chunk length

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    while (pos < length) {
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(pos, sample, true)
        pos += 2
      }
      offset++
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' })
  }

  const handleOpenRelease = (musicId?: string, imageId?: string) => {
    setPreselectedMusicId(musicId)
    setPreselectedImageId(imageId)
    setShowReleaseModal(true)
  }

  return (
    <div className={`min-h-screen bg-black text-white flex flex-col transition-all duration-300 ${showFeaturesSidebar ? 'md:pl-[464px]' : 'md:pl-20'} md:pr-28`}>
      {/* Features Sidebar */}
      <Suspense fallback={null}>
        <FeaturesSidebar
          isOpen={showFeaturesSidebar}
          onClose={() => setShowFeaturesSidebar(false)}
          selectedType={selectedType}
          isInstrumental={isInstrumental}
          isRecording={isRecording}
          showAdvancedButtons={showAdvancedButtons}
          userCredits={userCredits}
          isLoadingCredits={isLoadingCredits}
          customTitle={customTitle}
          genre={genre}
          customLyrics={customLyrics}
          bpm={bpm}
          onSelectType={(type) => setSelectedType(type as GenerationType)}
          onShowEffects={() => setShowEffectsModal(true)}
          onShowLoopers={() => setShowLoopersModal(true)}
          onShowLyrics={() => setShowLyricsModal(true)}
          onShowUpload={() => setShowMediaUploadModal(true)}
          onShowVideoToAudio={() => setShowMediaUploadModal(true)}
          onShowStemSplit={() => setShowMediaUploadModal(true)}
          onShowAudioBoost={() => setShowMediaUploadModal(true)}
          onShowExtract={() => setShowMediaUploadModal(true)}
          onShowAutotune={() => setShowAutotuneModal(true)}
          onOpenRelease={() => handleOpenRelease()}
          onTagClick={(tag: string) => {
            const newInput = input ? `${input}, ${tag}` : tag
            setInput(newInput.slice(0, MAX_PROMPT_LENGTH))
          }}
          onGenerateIdea={(genre: string, type: 'song' | 'beat') => {
            setSelectedPromptType(type)
            // When selecting "Beat" in Ideas flow, auto-enable instrumental mode
            if (type === 'beat') {
              setIsInstrumental(true)
            }
            handleGeneratePromptIdea(genre)
          }}
          isGeneratingIdea={generatingIdea}
          onClearChat={handleClearChat}
          onShowDeletedChats={() => setShowDeletedChatsModal(true)}
          onToggleInstrumental={() => setIsInstrumental(!isInstrumental)}
          onToggleRecording={isRecording ? stopRecording : startRecording}
          onSubmitPrompt={handleGenerate}
          promptText={input}
          onPromptChange={setInput}
          isGenerating={isGenerating}
        />
      </Suspense>
      {/* Holographic 3D Background */}
      {!isMobile && <HolographicBackground />}
      
      {/* Credit Indicator - Mobile Only with fade transition */}
      <div 
        className={`md:hidden transition-opacity duration-500 ${
          showTopNav ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
      </div>
      


      {/* Back to Home Button - Mobile optimized with fade transition */}
      <div 
        className={`fixed top-6 left-4 md:left-6 z-50 transition-opacity duration-500 ${
          showTopNav ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        style={{ pointerEvents: showTopNav ? 'auto' : 'none' }}
      >
        <Link href="/" className="block">
          <button className="group flex items-center gap-2 px-3 md:px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl pointer-events-auto">
            <svg 
              className="w-4 h-4 transition-transform group-hover:-translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium hidden md:inline">Home</span>
            <span className="text-xs text-gray-400 ml-1 hidden lg:inline">(ESC)</span>
          </button>
        </Link>
      </div>

      {/* Chat Area - Glassmorphism Effect */}
      <div className="chat-scroll-container flex-1 overflow-y-auto px-3 sm:px-4 md:px-8 lg:px-16 xl:px-24 py-6 pb-40 w-full scrollbar-thin scroll-smooth">
        {/* Single Glassmorphism Container - Full Width */}
        <div className="relative p-4 sm:p-6 md:p-8 rounded-3xl backdrop-blur-sm bg-white/[0.01] border border-white/10 shadow-2xl">
          {/* Dew-like gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-cyan-500/5 rounded-3xl pointer-events-none"></div>
          
          {/* Content - Symmetrical Layout */}
          <div className="relative space-y-3 max-w-6xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Message Content - Compact & Aligned */}
              <div className={`max-w-[75%] md:max-w-2xl ${message.type === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                {/* Text Message - Sleeker Bubble */}
                {message.content && (
                  <div className={`${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block px-4 py-2.5 rounded-2xl backdrop-blur-xl ${
                      message.type === 'user' 
                        ? 'bg-gradient-to-br from-cyan-500/15 via-cyan-600/10 to-blue-500/15 border border-cyan-400/40 shadow-lg shadow-cyan-500/10' 
                        : 'bg-gradient-to-br from-white/8 to-white/4 border border-white/20 shadow-lg shadow-black/20'
                    }`}>
                      <p className={`text-sm leading-relaxed break-words font-light ${
                        message.type === 'user' ? 'text-cyan-100' : 'text-gray-200'
                      }`}>{message.content}</p>
                    </div>
                    <p className="text-[10px] text-gray-500/80 mt-1.5 font-mono">{message.timestamp.toLocaleTimeString()}</p>
                  </div>
                )}

                {/* Music Result - Bigger and Cooler */}
                {message.result?.audioUrl && message.generationType !== 'video' && (
                  <div className="backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/60 via-black/50 to-black/60 border-2 border-cyan-500/30 rounded-3xl overflow-hidden group hover:border-cyan-400/50 transition-all">
                    {/* Header with Smaller Play Button */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/10">
                      <button
                        onClick={() => handlePlayPause(message.id, message.result!.audioUrl!, message.result!.title || 'Generated Track')}
                        className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 hover:from-cyan-700 hover:via-cyan-600 hover:to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30 transition-all active:scale-95 hover:scale-105"
                      >
                        {currentTrack?.id === message.id && isPlaying ? <Pause size={20} className="text-black" /> : <Play size={20} className="text-black ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-white truncate">{message.result.title}</h4>
                      </div>
                      <button
                        onClick={() => {
                          const detailsModal = document.getElementById(`details-${message.id}`)
                          if (detailsModal) {
                            (detailsModal as HTMLDialogElement).showModal()
                          }
                        }}
                        className="p-2.5 hover:bg-cyan-500/20 rounded-xl transition-colors"
                        title="View Details"
                      >
                        <FileText size={20} className="text-cyan-400" />
                      </button>
                      <button
                        onClick={() => handleOpenRelease(message.id, undefined)}
                        className="p-2.5 hover:bg-cyan-500/20 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                        title="Release"
                      >
                        <Rocket size={20} className="text-cyan-400" />
                      </button>
                    </div>

                    {/* Parameters Modal */}
                    <dialog id={`details-${message.id}`} className="backdrop:bg-black/80 bg-transparent p-0 rounded-2xl mx-4 md:mx-auto">
                      <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-cyan-500/30 rounded-2xl p-4 md:p-6 max-w-lg w-[calc(100vw-3rem)] md:w-full">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-white">Generation Details</h3>
                          <button
                            onClick={(e) => {
                              const dialog = (e.target as HTMLElement).closest('dialog')
                              if (dialog) (dialog as HTMLDialogElement).close()
                            }}
                            className="p-2.5 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <X size={20} className="text-gray-400" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-cyan-400 font-semibold">Title</label>
                            <p className="text-white mt-1">{message.result.title}</p>
                          </div>
                          {message.result.prompt && (
                            <div>
                              <label className="text-xs text-cyan-400 font-semibold">Prompt</label>
                              <p className="text-gray-300 mt-1 text-sm">{message.result.prompt}</p>
                            </div>
                          )}
                          {message.result.lyrics && (
                            <div>
                              <label className="text-xs text-cyan-400 font-semibold">Lyrics</label>
                              <pre className="text-gray-300 mt-1 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto bg-black/40 p-3 rounded-lg">{message.result.lyrics}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </dialog>
                    {/* Lyrics - Collapsed by default */}
                    {message.result.lyrics && (
                      <details className="border-t border-white/10">
                        <summary className="px-6 py-3 text-sm text-cyan-400 cursor-pointer hover:bg-white/5 transition-colors font-medium">
                          📝 View Lyrics
                        </summary>
                        <pre className="px-6 pb-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {message.result.lyrics}
                        </pre>
                      </details>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col border-t border-white/10">
                      <div className="flex">
                        <div className="flex-1 flex border-r border-white/10">
                          <button
                            onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.mp3`, 'mp3')}
                            className="flex-1 px-4 py-4 hover:bg-white/10 text-sm font-medium text-cyan-400 flex items-center justify-center gap-2 transition-colors border-r border-white/5"
                            title="Download MP3"
                          >
                            <Download size={18} />
                            MP3
                          </button>
                          <button
                            onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.mp3`, 'wav')}
                            className="flex-1 px-4 py-4 hover:bg-white/10 text-sm font-medium text-cyan-300 flex items-center justify-center gap-2 transition-colors"
                            title="Download WAV (High Quality)"
                          >
                            <Download size={18} />
                            WAV
                          </button>
                        </div>
                        <Link
                          href="/library"
                          className="flex-1 px-6 py-4 hover:bg-white/10 text-sm font-medium text-cyan-400 flex items-center justify-center gap-2 transition-colors"
                        >
                          <Layers size={18} />
                          Library
                        </Link>
                      </div>
                      <button
                        onClick={() => handleSplitStems(message.result!.audioUrl!, message.id)}
                        className="w-full px-6 py-4 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 border-t border-white/10 text-sm font-medium text-purple-400 flex items-center justify-center gap-2 transition-all"
                        title="Split audio into vocals and instrumental"
                      >
                        <Sparkles size={18} />
                        <span>Split Stems</span>
                        <span className="text-xs text-purple-400/60 bg-purple-500/10 px-2 py-0.5 rounded-full">5</span>
                      </button>
                      <button
                        onClick={() => {
                          setBoostAudioUrl(message.result!.audioUrl!)
                          setBoostTrackTitle(message.result!.title || 'Generated Track')
                          setShowAudioBoostModal(true)
                        }}
                        className="w-full px-6 py-4 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-red-500/10 border-t border-white/10 text-sm font-medium text-orange-400 flex items-center justify-center gap-2 transition-all"
                        title="Mix & master your track"
                      >
                        <Zap size={18} />
                        <span>Boost Audio</span>
                        <span className="text-xs text-orange-400/60 bg-orange-500/10 px-2 py-0.5 rounded-full">1</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Image Result - Bigger and Cooler */}
                {message.result?.imageUrl && (
                  <div className="backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/60 via-black/50 to-black/60 border-2 border-cyan-500/30 rounded-2xl overflow-hidden group hover:border-cyan-400/50 transition-all max-w-xs mx-auto hover:scale-105 cursor-pointer">
                    {/* Image - Click to Expand */}
                    <div 
                      className="relative"
                      onClick={() => window.open(message.result!.imageUrl!, '_blank')}
                    >
                      <img
                        src={message.result.imageUrl}
                        alt={message.result.title}
                        className="w-full h-auto aspect-square object-cover"
                      />
                      {/* Expand Hint */}
                      <div className="absolute inset-0 bg-black/0 md:group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <div className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-black/80 backdrop-blur-md rounded-full p-3">
                            <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenRelease(undefined, message.id)
                        }}
                        className="absolute top-2 right-2 p-2.5 bg-black/70 hover:bg-cyan-500/50 backdrop-blur-xl border border-cyan-500/40 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100 hover:scale-110"
                        title="Release"
                      >
                        <Rocket size={18} className="text-cyan-400" />
                      </button>
                    </div>

                    {/* Info - Compact */}
                    <div className="p-3 border-t border-white/10">
                      <h4 className="text-sm font-bold text-white mb-0.5 line-clamp-1">{message.result.title}</h4>
                      <p className="text-[10px] text-gray-500 italic line-clamp-1">{message.result.prompt}</p>
                    </div>

                    {/* Action Buttons - Compact */}
                    <div className="flex border-t border-white/10">
                      <button
                        onClick={() => handleDownload(message.result!.imageUrl!, `${message.result!.title}.webp`)}
                        className="flex-1 px-3 py-2 hover:bg-white/10 text-xs font-medium text-cyan-400 flex items-center justify-center gap-1.5 transition-colors border-r border-white/10"
                      >
                        <Download size={14} />
                        Save
                      </button>
                      <Link
                        href="/library"
                        className="flex-1 px-3 py-2 hover:bg-white/10 text-xs font-medium text-cyan-400 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Layers size={14} />
                        Library
                      </Link>
                    </div>
                  </div>
                )}

                {/* Video Result - With Synced Audio */}
                {message.generationType === 'video' && message.result?.url && (
                  <div className="backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/60 via-black/50 to-black/60 border-2 border-purple-500/30 rounded-2xl overflow-hidden group hover:border-purple-400/50 transition-all max-w-md mx-auto">
                    {/* Video Player */}
                    <div className="relative aspect-video bg-black">
                      <video
                        src={message.result.url}
                        controls
                        className="w-full h-full object-contain"
                        playsInline
                      />
                    </div>

                    {/* Info */}
                    <div className="p-4 border-t border-white/10">
                      <h4 className="text-lg font-bold text-white mb-1">{message.result.title || 'Video with Synced Audio'}</h4>
                      {message.result.prompt && (
                        <p className="text-sm text-purple-300/70 italic">&quot;{message.result.prompt}&quot;</p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex border-t border-white/10">
                      <button
                        onClick={() => handleDownload(message.result!.url!, `${message.result!.title || 'video'}.mp4`)}
                        className="flex-1 px-4 py-3 hover:bg-white/10 text-sm font-medium text-purple-400 flex items-center justify-center gap-2 transition-colors border-r border-white/10"
                      >
                        <Download size={16} />
                        Download
                      </button>
                      <Link
                        href="/library?tab=videos"
                        className="flex-1 px-4 py-3 hover:bg-white/10 text-sm font-medium text-purple-400 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Layers size={16} />
                        Library
                      </Link>
                    </div>
                  </div>
                )}

                {/* Stems Result - Dynamic Display for All Stems */}
                {message.stems && Object.keys(message.stems).length > 0 && (
                  <div className="space-y-3 max-w-md mx-auto">
                    {Object.entries(message.stems)
                      .filter(([key, url]) => url && typeof url === 'string' && url.length > 0)
                      .map(([key, url]) => {
                        // Dynamic stem type detection
                        const getStemDisplay = (stemKey: string) => {
                          const k = stemKey.toLowerCase()
                          if (k.includes('vocal')) return {
                            title: '🎤 Vocals',
                            description: 'Isolated vocal track',
                            gradient: 'from-purple-600 to-purple-400',
                            border: 'border-purple-500/30',
                            hover: 'hover:border-purple-400/50',
                            hoverBg: 'hover:bg-purple-500/20',
                            text: 'text-purple-400'
                          }
                          if (k.includes('instrumental') || k.includes('accompaniment')) return {
                            title: '🎹 Instrumental',
                            description: 'Music without vocals',
                            gradient: 'from-cyan-600 to-cyan-400',
                            border: 'border-cyan-500/30',
                            hover: 'hover:border-cyan-400/50',
                            hoverBg: 'hover:bg-cyan-500/20',
                            text: 'text-cyan-400'
                          }
                          if (k.includes('drum')) return {
                            title: '🥁 Drums',
                            description: 'Percussion only',
                            gradient: 'from-amber-600 to-amber-400',
                            border: 'border-amber-500/30',
                            hover: 'hover:border-amber-400/50',
                            hoverBg: 'hover:bg-amber-500/20',
                            text: 'text-amber-300'
                          }
                          if (k.includes('bass')) return {
                            title: '🪕 Bass',
                            description: 'Low-end bassline',
                            gradient: 'from-emerald-600 to-emerald-400',
                            border: 'border-emerald-500/30',
                            hover: 'hover:border-emerald-400/50',
                            hoverBg: 'hover:bg-emerald-500/20',
                            text: 'text-emerald-300'
                          }
                          if (k.includes('guitar')) return {
                            title: '🎸 Guitar',
                            description: 'Isolated guitar',
                            gradient: 'from-orange-600 to-orange-400',
                            border: 'border-orange-500/30',
                            hover: 'hover:border-orange-400/50',
                            hoverBg: 'hover:bg-orange-500/20',
                            text: 'text-orange-300'
                          }
                          if (k.includes('piano')) return {
                            title: '🎹 Piano',
                            description: 'Isolated keys',
                            gradient: 'from-indigo-600 to-indigo-400',
                            border: 'border-indigo-500/30',
                            hover: 'hover:border-indigo-400/50',
                            hoverBg: 'hover:bg-indigo-500/20',
                            text: 'text-indigo-300'
                          }
                          // Default for "other" or unknown stems
                          return {
                            title: `✨ ${key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]/g, ' ')}`,
                            description: 'Isolated audio track',
                            gradient: 'from-slate-600 to-slate-400',
                            border: 'border-slate-500/30',
                            hover: 'hover:border-slate-400/50',
                            hoverBg: 'hover:bg-slate-500/20',
                            text: 'text-slate-200'
                          }
                        }

                        const def = getStemDisplay(key)
                        return (
                        <div
                          key={key}
                          className={`backdrop-blur-sm md:backdrop-blur-xl bg-gradient-to-br from-black/50 via-black/50 to-black/60 border-2 ${def.border} rounded-2xl overflow-hidden ${def.hover} transition-all`}
                        >
                          <div className="p-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  if (!url) return
                                  const track = {
                                    id: `${message.id}-${key}`,
                                    title: def.title,
                                    artist: 'Stem Split',
                                    artworkUrl: '',
                                    audioUrl: url,
                                    userId: ''
                                  }
                                  playTrack(track)
                                }}
                                className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${def.gradient} flex items-center justify-center hover:scale-110 transition-transform`}
                              >
                                {currentTrack?.audioUrl === url && isPlaying ? (
                                  <Pause size={20} className="text-white" />
                                ) : (
                                  <Play size={20} className="text-white ml-0.5" />
                                )}
                              </button>
                              <div className="flex-1">
                                <h4 className="text-sm font-bold text-white">{def.title}</h4>
                                <p className="text-xs text-gray-400">{def.description}</p>
                              </div>
                              <button
                                onClick={() => {
                                  if (!url) return
                                  setBoostAudioUrl(url)
                                  setBoostTrackTitle(def.title)
                                  setShowAudioBoostModal(true)
                                }}
                                className="p-2 bg-orange-500/20 rounded-lg hover:bg-orange-500/40 transition-colors border border-orange-500/30"
                                title="Boost this stem"
                              >
                                <Zap size={14} className="text-orange-400" />
                              </button>
                              <button
                                onClick={() => {
                                  if (!url) return
                                  // Create clean filename with "444 - " prefix
                                  const stemName = key.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
                                  const filename = `444_${stemName}.mp3`
                                  handleDownload(url, filename, 'mp3')
                                }}
                                className={`p-2.5 ${def.hoverBg} rounded-lg transition-colors`}
                              >
                                <Download size={18} className={def.text} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )})}
                  </div>
                )}

                {/* Loading with cancel */}
                {message.isGenerating && (
                  <div className="flex items-center gap-2 px-4 py-3 backdrop-blur-xl bg-cyan-500/10 border border-cyan-400/20 rounded-2xl">
                    <Loader2 className="animate-spin text-cyan-400" size={16} />
                    <span className="text-xs text-cyan-300 flex-1">Generating...</span>
                    <button
                      onClick={() => handleCancelGeneration(message.id)}
                      className="p-2.5 -m-1 rounded-lg hover:bg-white/10 active:bg-red-500/20 transition-colors opacity-60 hover:opacity-100"
                      title="Cancel"
                    >
                      <Square size={14} className="text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        </div>
      </div>

      {/* Fixed Bottom Dock - Home Page Style (hidden when Features Sidebar is open) */}
      {showBottomDock && !showFeaturesSidebar && (
      <div className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-4 md:pb-8 z-20 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 transition-all duration-300 ease-out">
        <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
          
          {/* Icon Row Above Prompt Box — scrollable on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3 md:mb-4 overflow-x-auto no-scrollbar px-1 sm:justify-center">
            {/* Music Type Button - Hidden by default */}
            {showAdvancedButtons && (
            <button
              onClick={() => setSelectedType('music')}
              className={`flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 ${
                selectedType === 'music'
                  ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/50 scale-110'
                  : 'bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'
              }`}
              title="Generate Music"
            >
              <Music 
                size={18} 
                className={`${
                  selectedType === 'music' ? 'text-black' : 'text-cyan-400'
                } drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]`}
              />
              {selectedType === 'music' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black rounded-full"></div>
              )}
            </button>
            )}

            {/* Effects Type Button - Hidden by default */}
            {showAdvancedButtons && (
            <button
              onClick={() => setShowEffectsModal(true)}
              className="flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-purple-500/30 hover:border-purple-400/60 hover:scale-105"
              title="Generate Sound Effects"
            >
              <Sparkles 
                size={18} 
                className="text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>
            )}

            {/* Loopers Button - Hidden by default */}
            {showAdvancedButtons && (
            <button
              onClick={() => setShowLoopersModal(true)}
              className="flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105"
              title="Generate Fixed BPM Loops"
            >
              <Repeat 
                size={18} 
                className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>
            )}

            {/* Image Type Button - Hidden by default */}
            {showAdvancedButtons && (
            <button
              onClick={() => setSelectedType('image')}
              className={`flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 ${
                selectedType === 'image'
                  ? 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 shadow-lg shadow-cyan-500/50 scale-110'
                  : 'bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'
              }`}
              title="Generate Cover Art"
            >
              <ImageIcon 
                size={18} 
                className={`${
                  selectedType === 'image' ? 'text-black' : 'text-cyan-400'
                } drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]`}
              />
              {selectedType === 'image' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black rounded-full"></div>
              )}
            </button>
            )}

            {/* Divider - Only show when advanced buttons are visible */}
            {showAdvancedButtons && <div className="flex-shrink-0 w-px h-8 bg-cyan-500/30"></div>}

            {/* Lyrics Button - Only show for regular music, not instrumental - Hidden by default */}
            {showAdvancedButtons && selectedType === 'music' && !isInstrumental && (
              <button
                onClick={() => setShowLyricsModal(true)}
                className={`flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 ${
                  customTitle || genre || customLyrics || bpm
                    ? 'bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 border-2 border-cyan-400 scale-105'
                    : 'bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'
                }`}
                title="Lyrics & Settings"
              >
                <Edit3 
                  size={18} 
                  className={`${
                    customTitle || genre || customLyrics || bpm ? 'text-cyan-300' : 'text-cyan-400'
                  } drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]`}
                />
              </button>
            )}

            {/* Rocket Button - Hidden by default */}
            {showAdvancedButtons && (
            <button
              onClick={() => handleOpenRelease()}
              className="flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105"
              title="Release to Feed"
            >
              <Rocket 
                size={18} 
                className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>
            )}

            {/* Upload Button - New for Audio/Video Processing */}
            {showAdvancedButtons && (
            <button
              onClick={() => setShowMediaUploadModal(true)}
              className="flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-purple-500/30 hover:border-purple-400/60 hover:scale-105"
              title="Upload Audio/Video"
            >
              <Upload 
                size={18} 
                className="text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>
            )}

            {/* New Chat Button */}
            {showAdvancedButtons && (
            <button
              onClick={handleClearChat}
              className="flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-green-500/30 hover:border-green-400/60 hover:scale-105"
              title="New Chat"
            >
              <Plus 
                size={18} 
                className="text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>
            )}

            {/* Restore Chat Button - Opens archived chats modal */}
            {showAdvancedButtons && (
            <button
              onClick={() => setShowDeletedChatsModal(true)}
              className="flex-shrink-0 group relative p-2.5 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-green-500/30 hover:border-green-400/60 hover:scale-105"
              title="Chat History"
            >
              <RotateCcw 
                size={18} 
                className="text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>
            )}

            {/* Credits Display - Always Visible */}
            <div className="flex-shrink-0 flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-2 md:py-2.5 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl">
              <Zap size={14} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] md:w-[16px] md:h-[16px]" />
              <span className="text-xs md:text-sm font-bold text-white">
                {isLoadingCredits ? '...' : userCredits}
              </span>
              <span className="hidden sm:inline text-xs text-cyan-400/60 font-mono">
                {selectedType === 'music' ? '(-2)' : selectedType === 'image' ? '(-1)' : selectedType === 'effects' ? '(-2)' : ''}
              </span>
            </div>
          </div>

          {/* Instrumental Mode: Using LLM approach - no parameters needed */}
          {isInstrumental && selectedType === 'music' && (
            <div className="space-y-3 px-4 md:px-0">
              {/* Credits Info */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg backdrop-blur-sm">
                <p className="text-xs text-purple-300/80 text-center">
                  💰 <span className="font-bold">2 credits</span>
                </p>
              </div>
            </div>
          )}

          {/* Main Prompt Box - Home Page Style */}
          <div 
            className="group relative active:scale-95 md:hover:scale-105 transition-transform duration-200"
          >
            {/* Glow Effect - Simplified for mobile */}
            {!isMobile && <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 blur-lg md:blur-xl opacity-30 md:opacity-40 group-hover:opacity-70 group-active:opacity-60 transition-opacity duration-300"></div>}
            
            {/* Input Container */}
            <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/60 md:bg-black/20 backdrop-blur-sm md:backdrop-blur-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-active:border-cyan-400/60 md:group-hover:border-cyan-400/60 transition-colors duration-200 shadow-lg md:shadow-2xl">
              
              {/* Toggle Advanced Buttons - Plus Icon */}
              <button
                onClick={() => setShowAdvancedButtons(!showAdvancedButtons)}
                className={`relative flex-shrink-0 p-2.5 rounded-full transition-all duration-300 ${
                  showAdvancedButtons
                    ? 'bg-cyan-500 shadow-lg shadow-cyan-500/50 scale-110'
                    : 'bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 hover:border-cyan-400 hover:scale-110'
                }`}
                title={showAdvancedButtons ? 'Hide Options' : 'Show Options'}
              >
                <PlusCircle 
                  size={16} 
                  className={`${showAdvancedButtons ? 'text-black rotate-45' : 'text-cyan-400'} transition-transform duration-300`}
                />
              </button>

              {/* Record Button - Small Dot/Mic */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative flex-shrink-0 p-2.5 rounded-full transition-all duration-300 ${
                  isRecording 
                    ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110 animate-pulse' 
                    : 'bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 hover:border-cyan-400 hover:scale-110'
                }`}
                title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
              >
                {isRecording ? (
                  <div className="w-3 h-3 bg-white rounded-full"></div>
                ) : (
                  <Mic 
                    size={16} 
                    className="text-cyan-400"
                  />
                )}
              </button>

              {/* Instrumental Toggle Button - New Position */}
              {selectedType === 'music' && (
                <button
                  onClick={() => setIsInstrumental(!isInstrumental)}
                  className={`relative flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                    isInstrumental
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
                      : 'bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 hover:border-purple-400'
                  }`}
                  title={isInstrumental ? 'Switch to Vocal Mode' : 'Switch to Instrumental Mode'}
                >
                  INST
                </button>
              )}

              {/* Input Field */}
              <div className="flex-1 text-center md:text-left">
                <input
                  ref={(el) => {
                    if (el) {
                      // Store input ref for keyboard control
                      (window as unknown as Record<string, HTMLInputElement>).__createPageInput = el;
                    }
                  }}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={handleInputFocus}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      // Close keyboard by blurring input
                      if (e.currentTarget) {
                        e.currentTarget.blur()
                      }
                      // Small delay to let keyboard close before generating
                      setTimeout(() => {
                        handleGenerate()
                      }, 100)
                    }
                  }}
                  placeholder={
                    selectedType === 'music'
                      ? 'Describe your sound...'
                      : selectedType === 'image'
                      ? 'Describe your cover art...'
                      : selectedType === 'effects'
                      ? 'Describe sound effects (up to 10s)...'
                      : 'Coming soon...'
                  }
                  disabled={selectedType === 'video'}
                  className="w-full bg-transparent text-sm md:text-lg font-light text-gray-200 placeholder-gray-400/60 tracking-wide focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="text-xs text-cyan-400/60 font-mono hidden md:block">
                    {activeGenerations.size > 0 ? `Creating (${activeGenerations.size} active)...` : 'Press Enter to create'}
                  </div>
                  <div className={`text-xs font-mono ${
                    input.length < MIN_PROMPT_LENGTH ? 'text-red-400' :
                    input.length > MAX_PROMPT_LENGTH ? 'text-red-400' :
                    input.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-yellow-400' :
                    'text-gray-500'
                  }`}>
                    {input.length}/{MAX_PROMPT_LENGTH}
                  </div>
                </div>
              </div>

              {/* Prompt Suggestions Button - Only for music */}
              {selectedType === 'music' && (
                <div className="relative">
                  <button
                    onClick={() => setShowPromptSuggestions(!showPromptSuggestions)}
                    className={`p-2.5 rounded-xl transition-all duration-300 ${
                      showPromptSuggestions
                        ? 'bg-yellow-500/20 border-2 border-yellow-400/60 shadow-lg shadow-yellow-500/30'
                        : 'bg-yellow-500/10 border-2 border-yellow-500/30 hover:bg-yellow-500/20 hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-500/20'
                    }`}
                    title="Prompt Suggestions"
                  >
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                    </svg>
                  </button>

                  {/* Suggestions Dropdown */}
                  {showPromptSuggestions && (
                    <>
                      {/* Backdrop to close dropdown - Click outside to close */}
                      <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in-fast"
                        onClick={() => setShowPromptSuggestions(false)}
                      />
                      
                      {/* Dropdown panel - Responsive positioning: Fixed center for portrait, right-aligned for desktop */}
                      <div className={
                        isPortrait 
                          ? 'fixed left-1/2 -translate-x-1/2 bottom-24 w-[calc(100vw-2rem)] max-w-md bg-black/95 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 p-4 z-50 animate-fade-in-fast max-h-[55vh] overflow-hidden flex flex-col' 
                          : 'absolute left-full bottom-0 ml-3 w-[420px] bg-black/95 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 p-5 z-50 animate-fade-in-fast max-h-[70vh] overflow-hidden flex flex-col'
                      }>
                        
                        {/* Show IDEAS flow or Quick Tags */}
                        {!showIdeasFlow ? (
                          <>
                            {/* Header for Quick Tags */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                                </svg>
                                <span className="text-sm font-bold text-white">Quick Tags</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setShowIdeasFlow(true)}
                                  className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 hover:text-purple-200 transition-all hover:scale-105 shadow-lg shadow-purple-500/20"
                                >
                                  ✨ IDEAS
                                </button>
                                <button
                                  onClick={() => setShowPromptSuggestions(false)}
                                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                  <X className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Quick Tags */}
                            <div className="flex flex-wrap gap-2 overflow-y-auto scrollbar-thin pr-2 flex-1">
                              {/* Language mini-dropdown at top of tags */}
                              <div className="w-full mb-1">
                                <select
                                  value={selectedLanguage}
                                  onChange={(e) => {
                                    setSelectedLanguage(e.target.value)
                                    // Also append language as tag if non-English
                                    if (e.target.value !== 'English') {
                                      const langTag = e.target.value.toLowerCase()
                                      if (!input.toLowerCase().includes(langTag)) {
                                        const newInput = input ? `${input}, ${langTag}` : langTag
                                        setInput(newInput.slice(0, MAX_PROMPT_LENGTH))
                                      }
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 bg-white/5 border border-cyan-500/30 rounded-lg text-cyan-200 text-xs focus:outline-none focus:border-cyan-400/60 transition-all appearance-none cursor-pointer"
                                  style={{
                                    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(34,211,238,0.6)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.4rem center',
                                    backgroundSize: '1.2em 1.2em',
                                    paddingRight: '2rem'
                                  }}
                                >
                                  <option value="English">🌐 Language: English</option>
                                  <option value="chinese">🌐 中文 Chinese</option>
                                  <option value="japanese">🌐 日本語 Japanese</option>
                                  <option value="korean">🌐 한국어 Korean</option>
                                  <option value="spanish">🌐 Español Spanish</option>
                                  <option value="french">🌐 Français French</option>
                                  <option value="hindi">🌐 हिन्दी Hindi</option>
                                  <option value="german">🌐 Deutsch German</option>
                                  <option value="portuguese">🌐 Português Portuguese</option>
                                  <option value="arabic">🌐 العربية Arabic</option>
                                  <option value="italian">🌐 Italiano Italian</option>
                                  <option value="tamil">🌐 தமிழ் Tamil</option>
                                  <option value="telugu">🌐 తెలుగు Telugu</option>
                                  <option value="punjabi">🌐 ਪੰਜਾਬੀ Punjabi</option>
                                  <option value="russian">🌐 Русский Russian</option>
                                  <option value="turkish">🌐 Türkçe Turkish</option>
                                </select>
                              </div>
                              {[
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
                                'male & female duet',
                                'synth lead', 'strings', 'brass', 'flute', 'violin',
                                'trailer', 'ad', 'commercial', 'music video',
                                'hollywood', 'bollywood',
                              ].map((tag, idx) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const newInput = input ? `${input}, ${tag}` : tag
                                    setInput(newInput.slice(0, MAX_PROMPT_LENGTH))
                                  }}
                                  style={{ animationDelay: `${idx * 15}ms` }}
                                  className="px-3.5 py-2 bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 hover:from-cyan-500/30 hover:to-cyan-500/40 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-sm font-medium text-cyan-200 hover:text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 animate-slide-in-up"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            {/* IDEAS Flow inside same dropdown */}
                            {ideasStep === 'type' && (
                              <div className="space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-xl font-bold text-white">✨ AI Prompt Ideas</h3>
                                  <button
                                    onClick={() => {
                                      setShowIdeasFlow(false)
                                      setIdeasStep('type')
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                  >
                                    <X className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                                <p className="text-sm text-gray-400 text-center">What would you like to create?</p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <button
                                    onClick={() => {
                                      setSelectedPromptType('song')
                                      setIdeasStep('genre')
                                    }}
                                    className="group p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-400/40 hover:border-purple-400/60 rounded-2xl transition-all hover:scale-105 shadow-lg hover:shadow-purple-500/30"
                                  >
                                    <div className="text-4xl mb-3">🎤</div>
                                    <div className="text-lg font-bold text-white mb-1">Song</div>
                                    <div className="text-xs text-gray-400">With vocals & lyrics</div>
                                  </button>
                                  
                                  <button
                                    onClick={() => {
                                      setSelectedPromptType('beat')
                                      setIsInstrumental(true)
                                      setIdeasStep('genre')
                                    }}
                                    className="group p-6 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border-2 border-cyan-400/40 hover:border-cyan-400/60 rounded-2xl transition-all hover:scale-105 shadow-lg hover:shadow-cyan-500/30"
                                  >
                                    <div className="text-4xl mb-3">🎹</div>
                                    <div className="text-lg font-bold text-white mb-1">Beat</div>
                                    <div className="text-xs text-gray-400">Instrumental only</div>
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {ideasStep === 'genre' && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <button
                                    onClick={() => setIdeasStep('type')}
                                    className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                  >
                                    ← Back
                                  </button>
                                  <h3 className="text-lg font-bold text-white">🎵 Select Genre</h3>
                                  <button
                                    onClick={() => {
                                      setShowIdeasFlow(false)
                                      setIdeasStep('type')
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                                  >
                                    <X className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                                <p className="text-xs text-gray-400 text-center">Choose a style for your {selectedPromptType}</p>
                                
                                <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto scrollbar-thin pr-2">
                                  {[
                                    'electronic', 'hip-hop', 'rock', 'jazz', 'ambient',
                                    'trap', 'drill', 'phonk', 'house', 'techno',
                                    'lo-fi beats', 'synthwave', 'indie', 'folk', 'blues',
                                    'soul', 'funk', 'reggae', 'latin', 'afrobeat',
                                    'orchestral', 'cinematic', 'acoustic', 'vaporwave', 'k-pop'
                                  ].map((genre) => (
                                    <button
                                      key={genre}
                                      onClick={() => handleGeneratePromptIdea(genre)}
                                      disabled={generatingIdea}
                                      className="px-3 py-2.5 bg-gradient-to-br from-cyan-500/10 to-cyan-500/20 hover:from-cyan-500/30 hover:to-cyan-500/40 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {genre}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {ideasStep === 'generating' && (
                              <div className="space-y-6 text-center py-8">
                                <div className="relative">
                                  <div className="w-16 h-16 mx-auto border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl">🎨</span>
                                  </div>
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-white mb-2">Creating Amazing Prompt...</h3>
                                  <p className="text-sm text-gray-400">AI is crafting the perfect description</p>
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

              {/* Create Button */}
              <button
                onClick={() => {
                  // Close keyboard if open
                  const input = (window as unknown as Record<string, HTMLInputElement>).__createPageInput;
                  if (input) {
                    input.blur();
                  }
                  // Small delay to let keyboard close
                  setTimeout(() => {
                    handleGenerate();
                  }, 100);
                }}
                disabled={!input.trim() || selectedType === 'video'}
                className="relative flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 hover:from-cyan-700 hover:via-cyan-600 hover:to-cyan-500 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/50 active:scale-95"
              >
                {activeGenerations.size > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {activeGenerations.size}
                  </div>
                )}
                {activeGenerations.size > 0 ? (
                  <Loader2 className="text-black animate-spin" size={20} />
                ) : (
                  <Send className="text-black ml-0.5" size={20} />
                )}
              </button>
            </div>
          </div>
          
          {/* Quick Info - Below the bar */}
          <div className="flex items-center justify-center gap-2 mt-2 text-xs md:text-sm">
            <span className="text-cyan-400/60 font-mono tracking-wider">
              {activeGenerations.size > 0 ? (
                `⚡ ${activeGenerations.size} generation${activeGenerations.size > 1 ? 's' : ''} in progress • You can queue more`
              ) : (
                `✨ ${selectedType === 'music' ? 'Create amazing tracks' : selectedType === 'image' ? 'Generate cover art' : selectedType === 'effects' ? 'Generate Text to SFX' : 'Coming soon'}`
              )}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Matrix GPU Console - Shown when Features Sidebar is open */}
      {showFeaturesSidebar && (
        <div className="hidden md:block fixed bottom-0 left-[464px] right-0 h-36 z-20 bg-gradient-to-t from-black via-black/95 to-transparent">
          <div className="h-full border-t border-cyan-500/20">
            <Suspense fallback={<div className="h-full bg-black" />}>
              <MatrixConsole isGenerating={activeGenerations.size > 0} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Lyrics & Settings Modal - Comprehensive */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowLyricsModal(false)}
          />
          
          {/* Modal Container - Square 1:1 */}
          <div className="relative w-full max-w-md max-h-[80vh] md:aspect-square bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-cyan-400" />
                Lyrics & Settings
              </h3>
              <button
                onClick={() => setShowLyricsModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div id="parameters-section" className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Lyrics - FIRST & MANDATORY (Hidden in instrumental mode) */}
              {!isInstrumental && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-red-400 uppercase tracking-wide">Lyrics *</label>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      
                      if (!input || !input.trim()) {
                        alert('⚠️ Please enter a prompt first!')
                        return
                      }

                      if (isGeneratingAtomLyrics) return

                      try {
                        setIsGeneratingAtomLyrics(true)

                        // Call Atom API to generate lyrics
                        const response = await fetch('/api/generate/atom-lyrics', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            prompt: input,
                            language: selectedLanguage
                          })
                        })

                        const result = await response.json()

                        if (result.success && result.lyrics) {
                          setCustomLyrics(result.lyrics)
                        } else {
                          alert('❌ Failed to generate lyrics: ' + (result.error || 'Unknown error'))
                        }
                      } catch (error) {
                        console.error('Atom lyrics generation error:', error)
                        alert('❌ Failed to generate lyrics. Please try again.')
                      } finally {
                        setIsGeneratingAtomLyrics(false)
                      }
                    }}
                    disabled={isGeneratingAtomLyrics}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Atom size={12} className={isGeneratingAtomLyrics ? 'animate-spin' : ''} />
                    {isGeneratingAtomLyrics ? 'Generating...' : 'Create with Atom'}
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    id="custom-lyrics"
                    name="customLyrics"
                    value={customLyrics}
                    onChange={(e) => setCustomLyrics(e.target.value)}
                    placeholder="Enter custom lyrics (required)..."
                    className="w-full px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                    rows={6}
                    required
                  />
                  {/* Dice Button - Bottom Right */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      try {
                        // Check if we have language-specific structure
                        const languageHook = getLanguageHook(selectedLanguage.toLowerCase())
                        
                        if (languageHook && selectedLanguage.toLowerCase() !== 'english') {
                          // Use language-specific lyrics structure
                          const structure = getLyricsStructureForLanguage(selectedLanguage.toLowerCase())
                          setCustomLyrics(structure)
                          
                          // Also set a sample genre if available
                          if (languageHook.genres.length > 0 && !genre) {
                            setGenre(languageHook.genres[Math.floor(Math.random() * languageHook.genres.length)])
                          }
                        } else {
                          // English: Try API first, fallback to templates
                          const params = new URLSearchParams()
                          if (input && input.trim()) {
                            params.append('description', input)
                          }
                          const url = `/api/lyrics/random${params.toString() ? '?' + params.toString() : ''}`
                          const response = await fetch(url)
                          const data = await response.json()
                          
                          if (data.success && data.lyrics) {
                            setCustomLyrics(data.lyrics.lyrics)
                            if (!genre) setGenre(data.lyrics.genre)
                            if (!customTitle) setCustomTitle(data.lyrics.title)
                          } else {
                            // Fallback templates for English
                            const lyricsTemplates = [
                              "[verse]\nWalking down this empty street\nNeon lights guide my way\nCity sounds beneath my feet\nAnother night, another day\n\n[chorus]\nLost in the rhythm of the night\nHeartbeat syncing with the bass\nEverything just feels so right\nLiving life at my own pace",
                              "[verse]\nStaring at the stars above\nDreaming of a better tomorrow\nSearching for that endless love\nTrying to escape this sorrow\n\n[chorus]\nHold me close, don't let me go\nIn this moment, we'll take it slow\nFeel the music, let it flow\nThis is all we need to know"
                            ]
                            const randomLyrics = lyricsTemplates[Math.floor(Math.random() * lyricsTemplates.length)]
                            setCustomLyrics(randomLyrics)
                          }
                        }
                      } catch (error) {
                        console.error('Failed to fetch random lyrics:', error)
                        // Ultimate fallback
                        const lyricsTemplates = [
                          "[verse]\nWalking down this empty street\nNeon lights guide my way\n\n[chorus]\nLost in the rhythm of the night",
                          "[verse]\nStaring at the stars above\nDreaming of tomorrow\n\n[chorus]\nHold me close, don't let me go"
                        ]
                        const randomLyrics = lyricsTemplates[Math.floor(Math.random() * lyricsTemplates.length)]
                        setCustomLyrics(randomLyrics)
                      }
                    }}
                    className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/40 hover:bg-black/60 opacity-30 hover:opacity-100 transition-all duration-200"
                    title="Randomize lyrics"
                  >
                    <Dices size={14} className="text-cyan-400" />
                  </button>
                </div>
                <p className="text-xs text-gray-500">Add structure tags like [verse] [chorus]</p>
              </div>
              )}

              {/* Language Selector - DROPDOWN */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-2">
                  <Globe size={14} className="text-cyan-400" />
                  Language *
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-red-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all appearance-none cursor-pointer"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(34,211,238,0.6)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.5rem center',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
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
                
                {/* Language-specific genre suggestions */}
                {(() => {
                  const languageHook = getLanguageHook(selectedLanguage.toLowerCase())
                  return languageHook && (
                    <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <p className="text-[10px] text-cyan-300 mb-1 font-semibold">💡 Popular Genres:</p>
                      <div className="flex flex-wrap gap-1">
                        {languageHook.genres.slice(0, 4).map((g, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[9px] rounded">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* ACE-Step Parameters (only for non-English) */}
              {selectedLanguage.toLowerCase() !== 'english' && (
                <div className="space-y-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-400 font-semibold text-[10px] uppercase tracking-wide">🎵 ACE-Step Model Parameters</span>
                  </div>

                  {/* Audio Length */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                      <span>Audio Length</span>
                      <span className="text-purple-400">{audioLengthInSeconds}s</span>
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="90"
                      step="5"
                      value={audioLengthInSeconds}
                      onChange={(e) => setAudioLengthInSeconds(parseInt(e.target.value))}
                      className="w-full accent-purple-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600">
                      <span>15s</span>
                      <span>90s</span>
                    </div>
                  </div>

                  {/* Inference Steps */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                      <span>Quality (Steps)</span>
                      <span className="text-purple-400">{numInferenceSteps}</span>
                    </label>
                    <input
                      type="range"
                      min="25"
                      max="100"
                      step="5"
                      value={numInferenceSteps}
                      onChange={(e) => setNumInferenceSteps(parseInt(e.target.value))}
                      className="w-full accent-purple-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600">
                      <span>25 (Fast)</span>
                      <span>100 (Best)</span>
                    </div>
                  </div>

                  {/* Guidance Scale */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                      <span>Prompt Adherence</span>
                      <span className="text-purple-400">{guidanceScale.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.5"
                      value={guidanceScale}
                      onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600">
                      <span>1 (Creative)</span>
                      <span>15 (Precise)</span>
                    </div>
                  </div>

                  {/* Denoising Strength */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-gray-400 flex justify-between">
                      <span>Audio Clarity</span>
                      <span className="text-purple-400">{denoisingStrength.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1"
                      step="0.05"
                      value={denoisingStrength}
                      onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-gray-600">
                      <span>0.5 (Softer)</span>
                      <span>1.0 (Cleaner)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Prompt Suggestion Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">💡 Quick Tags</label>
                <div className="p-2.5 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'upbeat', 'chill', 'energetic', 'melancholic', 'ambient',
                      'electronic', 'acoustic', 'jazz', 'rock', 'hip-hop',
                      'heavy bass', 'soft piano', 'guitar solo', 'synthwave',
                      'lo-fi beats', 'orchestral', 'dreamy', 'aggressive',
                      'trailer', 'ad', 'commercial', 'music video',
                      'hollywood', 'bollywood', 'male & female duet',
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const newInput = input ? `${input}, ${tag}` : tag
                          setInput(newInput.slice(0, 300))
                        }}
                        className="px-2 py-0.5 bg-white/10 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 rounded text-xs text-white/80 hover:text-cyan-300 transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Genre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Genre</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g., Hip-hop, Jazz, Rock"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter song title... (Required)"
                  required
                  minLength={3}
                  maxLength={100}
                  className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none transition-all ${
                    showTitleError
                      ? 'border-red-500 animate-pulse ring-2 ring-red-500/50'
                      : customTitle.trim().length >= 3
                      ? 'border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.5)]'
                      : customTitle.trim().length > 0 && customTitle.trim().length < 3
                      ? 'border-red-500/50 focus:border-red-500'
                      : 'border-white/10 focus:border-cyan-500/50'
                  }`}
                />
                {customTitle.trim().length > 0 && customTitle.trim().length < 3 && (
                  <p className="text-xs text-red-400">Title must be at least 3 characters</p>
                )}
              </div>

              {/* Song Duration */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Song Length</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSongDuration('short')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      songDuration === 'short'
                        ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-bold">Short</div>
                    <div className="text-[10px] opacity-60">~60-90s</div>
                  </button>
                  <button
                    onClick={() => setSongDuration('medium')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      songDuration === 'medium'
                        ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-bold">Medium</div>
                    <div className="text-[10px] opacity-60">~90-150s</div>
                  </button>
                  <button
                    onClick={() => setSongDuration('long')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      songDuration === 'long'
                        ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-bold">Long</div>
                    <div className="text-[10px] opacity-60">~150-240s</div>
                  </button>
                </div>
                <p className="text-xs text-gray-500">Longer songs use extended lyrics structures (verses, chorus, bridge)</p>
              </div>

            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setShowLyricsModal(false)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Music Generation Modal */}
      <Suspense fallback={null}>
        <MusicGenerationModal
          isOpen={showMusicModal}
          onClose={() => setShowMusicModal(false)}
          initialPrompt={input}
          onGenerationStart={(prompt: string) => {
            handleMusicGenerationStart(prompt)
          }}
          onSuccess={(audioUrl: string, prompt: string) => {
            // Extract title and lyrics from the generated music
            // This will be called after successful generation
            handleMusicGenerated(audioUrl, 'Generated Track', '', prompt)
          }}
        />
      </Suspense>

      {/* Effects Generation Modal */}
      <Suspense fallback={null}>
        <EffectsGenerationModal
          isOpen={showEffectsModal}
          onClose={() => setShowEffectsModal(false)}
          userCredits={userCredits || 0}
          initialPrompt={input}
          onGenerationStart={(prompt: string, generationId: string) => {
          // Add user message and generating message
          const userMsgId = Date.now().toString()
          const genMsgId = (Date.now() + 1).toString()
          
          const userMessage: Message = {
            id: userMsgId,
            type: 'user',
            content: `🎨 Generate sound effects: "${prompt}"`,
            timestamp: new Date()
          }
          
          const generatingMessage: Message = {
            id: genMsgId,
            type: 'generation',
            content: '🎨 Generating sound effects...',
            generationType: 'effects',
            generationId: generationId, // Link to generation queue
            isGenerating: true,
            timestamp: new Date()
          }
          
          setMessages(prev => [...prev, userMessage, generatingMessage])
          setInput('')
        }}
        onSuccess={(audioUrl: string, prompt: string) => {
          // Handle successful effects generation
          // The GenerationQueue will update the message automatically
        }}
        />
      </Suspense>

      {/* Loopers Generation Modal */}
      <Suspense fallback={null}>
        <LoopersGenerationModal
          isOpen={showLoopersModal}
          onClose={() => setShowLoopersModal(false)}
          userCredits={userCredits || 0}
          initialPrompt={input}
          onGenerationStart={(prompt: string, generationId: string) => {
          // Add user message and generating message
          const userMsgId = Date.now().toString()
          const genMsgId = (Date.now() + 1).toString()
          
          const userMessage: Message = {
            id: userMsgId,
            type: 'user',
            content: `🔄 Generate loops: "${prompt}"`,
            timestamp: new Date()
          }
          
          const generatingMessage: Message = {
            id: genMsgId,
            type: 'generation',
            content: '🔄 Generating fixed BPM loops...',
            generationType: 'music',
            generationId: generationId, // Link to generation queue
            isGenerating: true,
            timestamp: new Date()
          }
          
          setMessages(prev => [...prev, userMessage, generatingMessage])
          setInput('')
        }}
        onSuccess={(variations: Array<{ url: string; variation: number }>, prompt: string) => {
          console.log('[Looper Success] Adding variations to chat:', variations.length)
          // Add both variations to chat with proper Message structure
          setMessages(prev => {
            console.log('[Looper Success] Current messages:', prev.length)
            
            // Find and remove ONLY the most recent generating message for loopers
            // Search from the END to find the last one
            let lastGeneratingIndex = -1
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].isGenerating && prev[i].generationType === 'music') {
                lastGeneratingIndex = i
                break
              }
            }
            
            let withoutGenerating = prev
            if (lastGeneratingIndex !== -1) {
              console.log('[Looper Success] Removing generating message at index:', lastGeneratingIndex)
              withoutGenerating = [
                ...prev.slice(0, lastGeneratingIndex),
                ...prev.slice(lastGeneratingIndex + 1)
              ]
            }
            
            // Add variations as separate messages with timestamps AFTER all existing messages
            // Use baseTime that's guaranteed to be AFTER the last message
            const lastMsgTime = withoutGenerating.length > 0 
              ? Math.max(...withoutGenerating.map(m => m.timestamp.getTime()))
              : Date.now()
            const baseTime = Math.max(lastMsgTime + 1000, Date.now()) // At least 1 second after last message
            
            const successMessages: Message[] = variations.map((v, index) => ({
              id: `loop-${baseTime}-${index}-${Math.random()}`,
              type: 'assistant',
              content: `✅ Loop Variation ${v.variation} generated!`,
              result: {
                audioUrl: v.url,
                title: `Loop: ${prompt.substring(0, 40)} (v${v.variation})`,
                prompt: prompt
              },
              timestamp: new Date(baseTime + (index * 2000)) // 2 seconds apart for guaranteed ordering
            }))
            
            console.log('[Looper Success] Adding variations at timestamps:', successMessages.map(m => m.timestamp.toISOString()))
            return [...withoutGenerating, ...successMessages]
          })
        }}
      />
      </Suspense>

      {/* Combine Media Modal */}
      <Suspense fallback={null}>
        <CombineMediaModal
          isOpen={showCombineModal}
          onClose={() => setShowCombineModal(false)}
        />
      </Suspense>

      {/* Two-Step Release Modal */}
      <Suspense fallback={null}>
        <TwoStepReleaseModal
          isOpen={showReleaseModal}
          onClose={() => {
            setShowReleaseModal(false)
            setPreselectedMusicId(undefined)
            setPreselectedImageId(undefined)
          }}
          preselectedMusic={preselectedMusicId}
          preselectedImage={preselectedImageId}
        />
      </Suspense>

      {/* Media Upload Modal - New for Audio/Video Processing */}
      <Suspense fallback={null}>
        <MediaUploadModal
          isOpen={showMediaUploadModal}
          onClose={() => setShowMediaUploadModal(false)}
          onStart={(type) => {
            // Add processing message when stem splitting starts
            if (type === 'stem-split') {
              const processingMessage: Message = {
                id: `stem-split-${Date.now()}`,
                type: 'assistant',
                content: '🎵 Splitting stems... This may take 1-2 minutes. Separating vocals, drums, bass, and other instruments.',
                timestamp: new Date(),
                isGenerating: true
              }
              setMessages(prev => [...prev, processingMessage])
              // Close the modal so user sees the chat
              setShowMediaUploadModal(false)
            }
            if (type === 'audio-boost') {
              const processingMessage: Message = {
                id: `audio-boost-${Date.now()}`,
                type: 'assistant',
                content: '🔊 Boosting audio... Mix & mastering your track.',
                timestamp: new Date(),
                isGenerating: true
              }
              setMessages(prev => [...prev, processingMessage])
              setShowMediaUploadModal(false)
            }
            if (type === 'extract-video') {
              const processingMessage: Message = {
                id: `extract-video-${Date.now()}`,
                type: 'assistant',
                content: '🎬 Extracting audio from video... This should only take a moment.',
                timestamp: new Date(),
                isGenerating: true
              }
              setMessages(prev => [...prev, processingMessage])
              setShowMediaUploadModal(false)
            }
            if (type === 'extract-audio') {
              const processingMessage: Message = {
                id: `extract-audio-${Date.now()}`,
                type: 'assistant',
                content: '🎵 Extracting stem from audio... This may take 1-2 minutes.',
                timestamp: new Date(),
                isGenerating: true
              }
              setMessages(prev => [...prev, processingMessage])
              setShowMediaUploadModal(false)
            }
            if (type === 'autotune') {
              const processingMessage: Message = {
                id: `autotune-${Date.now()}`,
                type: 'assistant',
                content: '🎤 Autotuning audio... Pitch correcting to key.',
                timestamp: new Date(),
                isGenerating: true
              }
              setMessages(prev => [...prev, processingMessage])
              setShowMediaUploadModal(false)
            }
          }}
          onError={(errorMessage) => {
            // Remove processing message
            setMessages(prev => prev.filter(msg => !msg.isGenerating))
            
            // Show error in chat
            const errorMsg: Message = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `❌ Error: ${errorMessage}`,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
          }}
          onSuccess={(result) => {
            // Remove processing message
            setMessages(prev => prev.filter(msg => !msg.isGenerating))
            
            // Handle stem splitting results
            if (result.stems) {
              const stemMessage: Message = {
                id: Date.now().toString(),
                type: 'generation',
                content: `✅ Stems separated successfully! Used ${result.creditsUsed || 5} credits. ${result.creditsRemaining || 0} credits remaining.`,
                generationType: 'music',
                stems: result.stems,
                timestamp: new Date()
              }
              setMessages(prev => [...prev, stemMessage])
            } else if (result.type === 'audio-boost') {
              // Handle audio boost results
              const boostMessage: Message = {
                id: Date.now().toString(),
                type: 'generation',
                content: `✅ Audio boosted successfully! Used ${result.creditsUsed || 1} credit. ${result.creditsRemaining || 0} credits remaining.`,
                generationType: 'music',
                result: {
                  audioUrl: result.audioUrl,
                  title: 'Boosted Audio',
                  prompt: `Audio Boost: bass=${result.settings?.bass_boost}dB, treble=${result.settings?.treble_boost}dB, vol=${result.settings?.volume_boost}x`
                },
                timestamp: new Date()
              }
              setMessages(prev => [...prev, boostMessage])
            } else if (result.extractType === 'video-to-audio') {
              // Handle video→audio extraction
              const extractMessage: Message = {
                id: Date.now().toString(),
                type: 'generation',
                content: `✅ Audio extracted from video! Used ${result.creditsUsed || 1} credit. ${result.creditsRemaining || 0} credits remaining.`,
                generationType: 'music',
                result: {
                  audioUrl: result.audioUrl,
                  title: result.title || 'Extracted Audio',
                  prompt: 'Video → Audio Extraction'
                },
                timestamp: new Date()
              }
              setMessages(prev => [...prev, extractMessage])
            } else if (result.extractType === 'audio-stem') {
              // Handle audio stem extraction (may have multiple stems)
              const stemList = result.extracts?.map((ex: any) => ex.stemType || 'stem').join(', ') || result.stem || 'stem'
              const extractMessage: Message = {
                id: Date.now().toString(),
                type: 'generation',
                content: `✅ Stem extracted successfully! (${stemList}) Used ${result.creditsUsed || 1} credit. ${result.creditsRemaining || 0} credits remaining.`,
                generationType: 'music',
                result: {
                  audioUrl: result.extracts?.[0]?.audioUrl || result.audioUrl,
                  title: result.extracts?.[0]?.title || result.title || `${stemList} Extract`,
                  prompt: `Audio Stem Extraction: ${stemList}`
                },
                stems: result.extracts?.map((ex: any) => ({
                  name: ex.stemType || 'extract',
                  url: ex.audioUrl
                })),
                timestamp: new Date()
              }
              setMessages(prev => [...prev, extractMessage])
            } else if (result.type === 'autotune') {
              // Handle autotune results
              const autotuneMessage: Message = {
                id: Date.now().toString(),
                type: 'generation',
                content: `✅ Autotuned successfully! Key: ${result.scale || 'auto'}. Used 1 credit. ${result.creditsRemaining || 0} credits remaining.`,
                generationType: 'music',
                result: {
                  audioUrl: result.audioUrl,
                  title: result.title || 'Autotuned Audio',
                  prompt: `Autotune: ${result.scale || 'auto'}`
                },
                timestamp: new Date()
              }
              setMessages(prev => [...prev, autotuneMessage])
            } else {
              // Handle video-to-audio results
              const resultMessage: Message = {
                id: Date.now().toString(),
                type: 'generation',
                content: '✅ Processing complete!',
                generationType: 'video',
                result: {
                  url: result.videoUrl,
                  title: result.prompt,
                  prompt: result.prompt
                },
                timestamp: new Date()
              }
              setMessages(prev => [...prev, resultMessage])
            }
            
            // Update credits — optimistic + context refresh
            if (result.creditsRemaining !== undefined) {
              setUserCredits(result.creditsRemaining)
            }
            refreshCredits()
            window.dispatchEvent(new Event('credits:refresh'))
          }}
        />
      </Suspense>

      {/* Audio Boost Modal - For boosting generated tracks */}
      <Suspense fallback={null}>
        <AudioBoostModal
          isOpen={showAudioBoostModal}
          onClose={() => {
            setShowAudioBoostModal(false)
            setBoostAudioUrl('')
            setBoostTrackTitle('')
          }}
          audioUrl={boostAudioUrl}
          trackTitle={boostTrackTitle}
          onSuccess={(result) => {
            setShowAudioBoostModal(false)
            // Add boosted audio result to chat
            const boostMessage: Message = {
              id: Date.now().toString(),
              type: 'generation',
              content: `✅ Audio boosted! Used ${result.creditsUsed || 1} credit. ${result.creditsRemaining || 0} credits remaining.`,
              generationType: 'music',
              result: {
                audioUrl: result.audioUrl,
                title: boostTrackTitle ? `${boostTrackTitle} (Boosted)` : 'Boosted Audio',
                prompt: `Audio Boost: bass=${result.settings?.bass_boost}dB, treble=${result.settings?.treble_boost}dB, vol=${result.settings?.volume_boost}x`
              },
              timestamp: new Date()
            }
            setMessages(prev => [...prev, boostMessage])
            // Update credits — optimistic + context refresh
            if (result.creditsRemaining !== undefined) {
              setUserCredits(result.creditsRemaining)
            }
            refreshCredits()
            window.dispatchEvent(new Event('credits:refresh'))
          }}
          onError={(errorMessage) => {
            const errorMsg: Message = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `❌ Audio Boost Error: ${errorMessage}`,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
          }}
        />
      </Suspense>

      {/* Autotune Modal - Dedicated futuristic autotune experience */}
      <Suspense fallback={null}>
        <AutotuneModal
          isOpen={showAutotuneModal}
          onClose={() => setShowAutotuneModal(false)}
          onStart={() => {
            // Add processing message to chat
            const processingMessage: Message = {
              id: `autotune-modal-${Date.now()}`,
              type: 'assistant',
              content: '🎤 Autotuning audio... Pitch correcting to key.',
              timestamp: new Date(),
              isGenerating: true
            }
            setMessages(prev => [...prev, processingMessage])
            setShowAutotuneModal(false)
          }}
          onSuccess={(result) => {
            // Remove processing message
            setMessages(prev => prev.filter(msg => !msg.isGenerating))
            // Add result to chat
            const autotuneMessage: Message = {
              id: Date.now().toString(),
              type: 'generation',
              content: `✅ Autotuned successfully! Key: ${result.scale || 'auto'}. Used 1 credit. ${result.creditsRemaining || 0} credits remaining.`,
              generationType: 'music',
              result: {
                audioUrl: result.audioUrl,
                title: result.title || 'Autotuned Audio',
                prompt: `Autotune: ${result.scale || 'auto'}`
              },
              timestamp: new Date()
            }
            setMessages(prev => [...prev, autotuneMessage])
            // Update credits
            if (result.creditsRemaining !== undefined) {
              setUserCredits(result.creditsRemaining)
            }
            refreshCredits()
            window.dispatchEvent(new Event('credits:refresh'))
          }}
          onError={(errorMessage) => {
            setMessages(prev => prev.filter(msg => !msg.isGenerating))
            const errorMsg: Message = {
              id: Date.now().toString(),
              type: 'assistant',
              content: `❌ Autotune Error: ${errorMessage}`,
              timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMsg])
          }}
        />
      </Suspense>

      {/* Chat History Modal */}
      <Suspense fallback={null}>
        <DeletedChatsModal
          isOpen={showDeletedChatsModal}
          onClose={() => setShowDeletedChatsModal(false)}
          onRestore={(chat) => {
            // Archive current chat if it has real content
            try {
              if (messages.length > 1) {
                const archives = localStorage.getItem('444radio-chat-archives')
                const archiveList = archives ? JSON.parse(archives) : []
                archiveList.unshift({
                  id: `chat-${Date.now()}`,
                  messages,
                  archivedAt: new Date(),
                  messageCount: messages.length
                })
                localStorage.setItem('444radio-chat-archives', JSON.stringify(archiveList.slice(0, 50)))
              }
            } catch (error) {
              console.error('Failed to archive current chat:', error)
            }
            // Load the selected history chat and clear stale generations
            setMessages(chat.messages)
            clearCompleted()
            setShowDeletedChatsModal(false)
          }}
          onDelete={(chatId) => {
            console.log('Chat deleted from history:', chatId)
          }}
        />
      </Suspense>

      {/* Generation Recovery UI for stuck generations */}
      <GenerationRecovery />
    </div>
  )
}

export default function CreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <CreatePageContent />
    </Suspense>
  )
}

