'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Music, Image as ImageIcon, Video, Send, Loader2, Download, Play, Pause, Layers, Type, Tag, FileText, Sparkles, Music2, Settings, Zap, X, Rocket, User, Compass, PlusCircle, Library, Globe, Check, Mic, MicOff, Edit3, Atom, Dices } from 'lucide-react'
import MusicGenerationModal from '../components/MusicGenerationModal'
import CombineMediaModal from '../components/CombineMediaModal'
import TwoStepReleaseModal from '../components/TwoStepReleaseModal'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import HolographicBackground from '../components/HolographicBackgroundClient'
import FloatingNavButton from '../components/FloatingNavButton'
import { useEffect as useEffectOnce, useState as useStateOnce } from 'react'
import { getLanguageHook, getSamplePromptsForLanguage, getLyricsStructureForLanguage } from '@/lib/language-hooks'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'

type MessageType = 'user' | 'assistant' | 'generation'
type GenerationType = 'music' | 'image' | 'video'

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
  timestamp: Date
  isGenerating?: boolean
}

function CreatePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()
  const { addGeneration, updateGeneration, generations } = useGenerationQueue()
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
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
  const [showCombineModal, setShowCombineModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [preselectedMusicId, setPreselectedMusicId] = useState<string | undefined>()
  const [preselectedImageId, setPreselectedImageId] = useState<string | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [userCredits, setUserCredits] = useState<number | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [showBottomDock, setShowBottomDock] = useState(true)
  
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
  const [songDuration, setSongDuration] = useState<'short' | 'medium' | 'long'>('medium')
  const [generateCoverArt, setGenerateCoverArt] = useState(true)
  
  // Instrumental mode
  const [isInstrumental, setIsInstrumental] = useState(false)
  const [instrumentalDuration, setInstrumentalDuration] = useState(60) // Default 60 seconds, max 240
  const [instrumentalSteps, setInstrumentalSteps] = useState(90) // Default 90 steps (creativity/quality), range 20-150
  
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
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<unknown | null>(null)
  const [isGeneratingAtomLyrics, setIsGeneratingAtomLyrics] = useState(false)
  
  // Title validation state
  const [showTitleError, setShowTitleError] = useState(false)

  // Close all modals
  const closeAllModals = () => {
    setShowTitleModal(false)
    setShowGenreModal(false)
    setShowLyricsModal(false)
    setShowBpmModal(false)
  }

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

  // Load chat from localStorage on mount
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
  }, [])

  // Save chat to localStorage whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem('444radio-chat-messages', JSON.stringify(messages))
    } catch (error) {
      console.error('Failed to save chat to localStorage:', error)
    }
  }, [messages])

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
                      : (gen.type === 'music' ? '✅ Track generated!' : '✅ Cover art generated!'),
                    result: gen.status === 'completed' ? gen.result : undefined
                  }
                : msg
            )
          }
          
          // Fallback: Check if result already exists by URL
          if (gen.status === 'completed') {
            const messageExists = prev.some(msg => 
              msg.result?.audioUrl === gen.result?.audioUrl || 
              msg.result?.imageUrl === gen.result?.imageUrl
            )
            
            if (messageExists) {
              console.log('[Sync] Message already exists for generation:', gen.id)
              return prev
            }
          }
          
          // Fallback: Find ANY generating message of the same type (music/image)
          const hasGeneratingMessage = prev.some(msg => 
            msg.isGenerating && msg.generationType === gen.type
          )
          
          if (hasGeneratingMessage && gen.status === 'completed') {
            console.log('[Sync] Updating first generating message with completed result:', gen.id)
            // Update the FIRST generating message of this type
            let updated = false
            return prev.map(msg => {
              if (!updated && msg.isGenerating && msg.generationType === gen.type) {
                updated = true
                return {
                  ...msg,
                  isGenerating: false,
                  generationId: gen.id,
                  content: gen.type === 'music' ? '✅ Track generated!' : '✅ Cover art generated!',
                  result: gen.result
                }
              }
              return msg
            })
          }
          
          // Only add as new message if status is completed and not failed
          if (gen.status === 'completed' && gen.result && !hasGeneratingMessage) {
            console.log('[Sync] No generating message found, adding completed generation as new message:', gen.id)
            return [
              ...prev,
              {
                id: `sync_${gen.id}`,
                type: 'generation' as const,
                content: gen.type === 'music' ? '✅ Track generated!' : '✅ Cover art generated!',
                generationType: gen.type,
                generationId: gen.id,
                isGenerating: false,
                result: gen.result,
                timestamp: new Date(gen.completedAt || Date.now())
              }
            ]
          }
          
          // Return unchanged if no conditions met
          return prev
        })
      }
    })
  }, [generations])

  // Fetch user credits function
  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setUserCredits(data.credits || 0)
    } catch (error) {
      console.error('Failed to fetch credits:', error)
      setUserCredits(0)
    } finally {
      setIsLoadingCredits(false)
    }
  }

  // Fetch user credits on mount
  useEffect(() => {
    fetchCredits()
  }, [])

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

    // MANDATORY: Check for title before music generation (ONLY for regular music, NOT instrumental)
    if (selectedType === 'music' && !isInstrumental && !customTitle.trim()) {
      // Open the lyrics modal first
      setShowLyricsModal(true)
      // Open parameters section and highlight title field
      setShowTitleError(true)
      // Scroll to parameters section smoothly after modal opens
      setTimeout(() => {
        const paramsSection = document.getElementById('parameters-section')
        if (paramsSection) {
          paramsSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      // Auto-clear error after 5 seconds
      setTimeout(() => setShowTitleError(false), 5000)
      return
    }

    // Validate title length if provided (ONLY for regular music, NOT instrumental)
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

    // Check credits before generation
    const creditsNeeded = isInstrumental ? 5 : (selectedType === 'music' ? 2 : selectedType === 'image' ? 1 : 0)
    if (userCredits !== null && userCredits < creditsNeeded) {
      alert(`⚡ Insufficient credits! You need ${creditsNeeded} credits but only have ${userCredits}. Visit the pricing page to get more.`)
      return
    }

    // Close any open parameter modals
    closeAllModals()

    // For instrumental generation - Different workflow
    if (selectedType === 'music' && isInstrumental) {
      const generationId = Date.now().toString()
      const userMessage: Message = {
        id: generationId,
        type: 'user',
        content: `🎹 Generate instrumental (${instrumentalDuration}s): "${input}"`,
        timestamp: new Date()
      }

      const generatingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'generation',
        content: activeGenerations.size > 0 ? '🎹 Queued - will start soon...' : '🎹 Generating instrumental track...',
        generationType: 'music',
        isGenerating: true,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setGenerationQueue(prev => [...prev, generatingMessage.id])
      setInput('')

      // Process instrumental queue
      processInstrumentalQueue(generatingMessage.id, {
        prompt: input,
        duration: instrumentalDuration,
        steps: instrumentalSteps
      })

      return
    }

    // For music generation - Generate directly without modal
    if (selectedType === 'music') {
      const generationId = Date.now().toString()
      const userMessage: Message = {
        id: generationId,
        type: 'user',
        content: `🎵 Generate music: "${input}"`,
        timestamp: new Date()
      }

      const generatingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'generation',
        content: activeGenerations.size > 0 ? '🎵 Queued - will start soon...' : '🎵 Generating your track...',
        generationType: 'music',
        isGenerating: true,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setGenerationQueue(prev => [...prev, generatingMessage.id])
      setInput('')

      // Process queue asynchronously
      processQueue(generatingMessage.id, 'music', {
        prompt: input,
        genre,
        bpm,
        customTitle,
        customLyrics,
        songDuration
      })

      // Clear parameters after queueing
      setCustomTitle('')
      setGenre('')
      setCustomLyrics('')
      setBpm('')
      setSongDuration('medium')
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
    type: 'music' | 'image',
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
        const titleToUse = params.customTitle || undefined
        const lyricsToUse = params.customLyrics || undefined
        const durationToUse = params.songDuration || 'medium'
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
        result = await generateMusic(params.prompt, titleToUse, lyricsToUse, durationToUse, genreToUse, bpmToUse)
        console.log('[Generation] Music generation result:', result)
      } else {
        console.log('[Generation] Calling generateImage with:', params.prompt)
        result = await generateImage(params.prompt)
        console.log('[Generation] Image generation result:', result)
      }

      // Update credits
      if (!result.error && result.creditsRemaining !== undefined) {
        setUserCredits(result.creditsRemaining)
      }

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

      // Update message with result
      setMessages(prev => {
        console.log('[Generation] Updating message', messageId, 'with result:', result)
        return prev.map(msg => 
          msg.id === messageId
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
      console.error('Generation error:', error)
      
      // Update persistent queue with error
      updateGeneration(genId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? { ...msg, isGenerating: false, content: '❌ Generation failed. Please try again.' }
          : msg
      ))
    } finally {
      // Remove from queue and active generations
      setGenerationQueue(prev => prev.filter(id => id !== messageId))
      setActiveGenerations(prev => {
        const newSet = new Set(prev)
        newSet.delete(messageId)
        return newSet
      })
    }
  }

  // Instrumental queue processing function
  const processInstrumentalQueue = async (
    messageId: string,
    params: {
      prompt: string
      duration: number
      steps: number
    }
  ) => {
    console.log('[Instrumental] Starting generation:', { messageId, params })
    
    // Add to persistent generation queue
    const genId = addGeneration({
      type: 'music',
      prompt: params.prompt,
      title: `Instrumental: ${params.prompt.substring(0, 40)}`
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
      
      // Update message to generating
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, content: '🎹 Generating instrumental track...', isGenerating: true }
          : msg
      ))

      // Call instrumental API
      console.log('[Instrumental] Calling API with:', params)
      console.log('[Instrumental] API URL:', '/api/generate/instrumental')
      const response = await fetch('/api/generate/instrumental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          duration: params.duration,
          steps: params.steps
        })
      })

      console.log('[Instrumental] Response status:', response.status, response.statusText)
      const result = await response.json()
      console.log('[Instrumental] API response:', result)
      console.log('[Instrumental] Response OK?', response.ok, 'Result success?', result.success)

      if (!response.ok || !result.success) {
        console.error('[Instrumental] Generation failed:', result.error)
        throw new Error(result.error || 'Instrumental generation failed')
      }

      // Update generation queue with success
      updateGeneration(genId, {
        status: 'completed',
        progress: 100,
        result: {
          audioUrl: result.audioUrl,
          title: `Instrumental: ${params.prompt.substring(0, 40)}`
        }
      })

      // Update message with result
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              isGenerating: false,
              content: '✅ Instrumental track generated!',
              result: {
                audioUrl: result.audioUrl,
                title: `Instrumental: ${params.prompt.substring(0, 40)}`
              }
            }
          : msg
      ))

      // Refresh credits
      fetchCredits()

      // Add assistant response
      if (!result.error) {
        const assistantMessage: Message = {
          id: (Date.now() + Math.random()).toString(),
          type: 'assistant',
          content: `Your ${params.duration}s instrumental track is ready! Used 5 credits. ${result.creditsRemaining} credits remaining.`,
          timestamp: new Date()
        }
        console.log('[Instrumental] Adding assistant message:', assistantMessage)
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Instrumental generation error:', error)
      
      // Update persistent queue with error
      updateGeneration(genId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? { ...msg, isGenerating: false, content: '❌ Instrumental generation failed. Please try again.' }
          : msg
      ))
    } finally {
      // Remove from queue and active generations
      setGenerationQueue(prev => prev.filter(id => id !== messageId))
      setActiveGenerations(prev => {
        const newSet = new Set(prev)
        newSet.delete(messageId)
        return newSet
      })
    }
  }

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

  const generateMusic = async (
    prompt: string, 
    title?: string, 
    lyrics?: string, 
    duration: 'short' | 'medium' | 'long' = 'medium',
    genreParam?: string,
    bpmParam?: string
  ) => {
    // Build full prompt with genre/BPM if provided
    let fullPrompt = prompt
    if (genreParam) fullPrompt += ` [${genreParam}]`
    if (bpmParam) fullPrompt += ` [${bpmParam} BPM]`
    
    const requestBody: any = {
      prompt: fullPrompt,
      title,
      lyrics,
      duration,
      language: selectedLanguage,
      genre: genreParam,
      bpm: bpmParam ? parseInt(bpmParam) : undefined
    }

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
      body: JSON.stringify(requestBody)
    })

    const data = await res.json()
    
    if (data.success) {
      return {
        audioUrl: data.audioUrl,
        title: data.title || title || prompt.substring(0, 50),
        prompt: prompt,
        lyrics: data.lyrics || lyrics,
        creditsRemaining: data.creditsRemaining
      }
    } else {
      return { error: data.error || 'Failed to generate music' }
    }
  }

  const generateImage = async (prompt: string) => {
    const res = await fetch('/api/generate/image-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
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

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenRelease = (musicId?: string, imageId?: string) => {
    setPreselectedMusicId(musicId)
    setPreselectedImageId(imageId)
    setShowReleaseModal(true)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Holographic 3D Background */}
      {!isMobile && <HolographicBackground />}
      
      {/* Credit Indicator - Mobile Only */}
      <div className="md:hidden">
        <CreditIndicator />
      </div>
      
      {/* Floating Menu - Desktop Only */}
      <FloatingMenu />

      {/* Back to Home Button - Mobile optimized */}
      <div className="fixed top-6 left-4 md:left-6 z-50" style={{ pointerEvents: 'auto' }}>
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
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-6 pb-40 max-w-4xl mx-auto w-full scrollbar-thin scroll-smooth">
        {/* Single Glassmorphism Container */}
        <div className="relative p-4 sm:p-6 rounded-3xl backdrop-blur-sm bg-white/[0.01] border border-white/10 shadow-2xl">
          {/* Dew-like gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-cyan-500/5 rounded-3xl pointer-events-none"></div>
          
          {/* Content */}
          <div className="relative space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Message Content - No Bubble */}
              <div className={`max-w-[85%] ${message.type === 'user' ? 'items-end' : 'items-start'} space-y-2`}>
                {/* Text Message - No Background Bubble */}
                {message.content && (
                  <div className={`${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    <p className={`text-sm ${message.type === 'user' ? 'text-cyan-300' : 'text-gray-200'}`}>{message.content}</p>
                    <p className="text-xs text-gray-500 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                  </div>
                )}

                {/* Music Result - Bigger and Cooler */}
                {message.result?.audioUrl && (
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
                        className="p-2.5 hover:bg-cyan-500/20 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        title="Release"
                      >
                        <Rocket size={20} className="text-cyan-400" />
                      </button>
                    </div>

                    {/* Parameters Modal */}
                    <dialog id={`details-${message.id}`} className="backdrop:bg-black/80 bg-transparent p-0 rounded-2xl">
                      <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-cyan-500/30 rounded-2xl p-6 max-w-lg w-full">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-bold text-white">Generation Details</h3>
                          <button
                            onClick={(e) => {
                              const dialog = (e.target as HTMLElement).closest('dialog')
                              if (dialog) (dialog as HTMLDialogElement).close()
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
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
                    <div className="flex border-t border-white/10">
                      <button
                        onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.mp3`)}
                        className="flex-1 px-6 py-4 hover:bg-white/10 text-sm font-medium text-cyan-400 flex items-center justify-center gap-2 transition-colors border-r border-white/10"
                      >
                        <Download size={18} />
                        Download
                      </button>
                      <Link
                        href="/library"
                        className="flex-1 px-6 py-4 hover:bg-white/10 text-sm font-medium text-cyan-400 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Layers size={18} />
                        Library
                      </Link>
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-cyan-500/50 backdrop-blur-xl border border-cyan-500/40 rounded-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                        title="Release"
                      >
                        <Rocket size={16} className="text-cyan-400" />
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

                {/* Loading */}
                {message.isGenerating && (
                  <div className="flex items-center gap-2 px-4 py-3 backdrop-blur-xl bg-cyan-500/10 border border-cyan-400/20 rounded-2xl">
                    <Loader2 className="animate-spin text-cyan-400" size={16} />
                    <span className="text-xs text-cyan-300">Generating...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        </div>
      </div>

      {/* Fixed Bottom Dock - Home Page Style */}
      {showBottomDock && (
      <div className="fixed bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-4 md:pb-8 z-20 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 transition-all duration-300 ease-out">
        <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
          
          {/* Icon Row Above Prompt Box */}
          <div className="flex items-center justify-center gap-3 mb-3 md:mb-4">
            {/* Music Type Button */}
            <button
              onClick={() => setSelectedType('music')}
              className={`group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 ${
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

            {/* Image Type Button */}
            <button
              onClick={() => setSelectedType('image')}
              className={`group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 ${
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

            {/* Divider */}
            <div className="w-px h-8 bg-cyan-500/30"></div>

            {/* Instrumental Toggle - Only show for music */}
            {selectedType === 'music' && (
              <button
                onClick={() => setIsInstrumental(!isInstrumental)}
                className={`group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 ${
                  isInstrumental
                    ? 'bg-gradient-to-r from-purple-600/20 via-purple-500/20 to-purple-400/20 border-2 border-purple-400 scale-105'
                    : 'bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'
                }`}
                title={isInstrumental ? "Instrumental Mode (5 credits)" : "Switch to Instrumental"}
              >
                <Music2 
                  size={18} 
                  className={`${
                    isInstrumental ? 'text-purple-300' : 'text-cyan-400'
                  } drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] md:w-[20px] md:h-[20px]`}
                />
                {isInstrumental && (
                  <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-purple-500 rounded-full text-[8px] font-bold text-white">
                    {instrumentalDuration}s
                  </div>
                )}
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-8 bg-cyan-500/30"></div>

            {/* Lyrics Button - Only show for regular music, not instrumental */}
            {selectedType === 'music' && !isInstrumental && (
              <button
                onClick={() => setShowLyricsModal(true)}
                className={`group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 ${
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

            {/* Rocket Button */}
            <button
              onClick={() => handleOpenRelease()}
              className="group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105"
              title="Release to Feed"
            >
              <Rocket 
                size={18} 
                className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]"
              />
            </button>

            {/* Divider */}
            <div className="hidden md:block w-px h-8 bg-cyan-500/30"></div>

            {/* Credits Display */}
            <div className="hidden md:flex items-center gap-2 px-3 md:px-4 py-2.5 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl">
              <Zap size={16} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              <span className="text-sm font-bold text-white">
                {isLoadingCredits ? '...' : userCredits}
              </span>
              <span className="text-xs text-cyan-400/60 font-mono">
                {isInstrumental ? '(-5)' : (selectedType === 'music' ? '(-2)' : selectedType === 'image' ? '(-1)' : '')}
              </span>
            </div>
          </div>

          {/* Instrumental Duration & Creativity Sliders - Only show when instrumental mode is active */}
          {isInstrumental && selectedType === 'music' && (
            <div className="space-y-3 px-4 md:px-0">
              {/* Duration Slider */}
              <div className="space-y-2 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-400 uppercase tracking-wide flex items-center gap-2">
                    <Music2 size={14} className="text-purple-400" />
                    Duration
                  </label>
                  <span className="text-sm font-bold text-purple-300">{instrumentalDuration}s</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="240"
                  step="10"
                  value={instrumentalDuration}
                  onChange={(e) => setInstrumentalDuration(Number(e.target.value))}
                  className="w-full h-2 bg-purple-900/30 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-purple-400/60">
                  <span>10s</span>
                  <span>240s (4 min)</span>
                </div>
              </div>

              {/* Creativity/Quality Slider */}
              <div className="space-y-2 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-400 uppercase tracking-wide flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    Creativity / Quality
                  </label>
                  <span className="text-sm font-bold text-purple-300">{instrumentalSteps} steps</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="10"
                  value={instrumentalSteps}
                  onChange={(e) => setInstrumentalSteps(Number(e.target.value))}
                  className="w-full h-2 bg-purple-900/30 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-purple-400/60">
                  <span>20 (Fast)</span>
                  <span>150 (Best Quality)</span>
                </div>
              </div>

              {/* Credits Info */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg backdrop-blur-sm">
                <p className="text-xs text-purple-300/80 text-center">
                  💰 <span className="font-bold">5 credits</span> • Instrumental music based on your tags/prompt
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
              
              {/* Record Button - Small Dot/Mic */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative flex-shrink-0 p-2 rounded-full transition-all duration-300 ${
                  isRecording 
                    ? 'bg-red-500 shadow-lg shadow-red-500/50 scale-110 animate-pulse' 
                    : 'bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 hover:border-cyan-400 hover:scale-110'
                }`}
                title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
              >
                {isRecording ? (
                  <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                ) : (
                  <Mic 
                    size={14} 
                    className="text-cyan-400"
                  />
                )}
              </button>

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
                `✨ ${selectedType === 'music' ? 'Create amazing tracks' : selectedType === 'image' ? 'Generate cover art' : 'Coming soon'}`
              )}
            </span>
          </div>
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
          <div className="relative w-full max-w-md aspect-square bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
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
                            prompt: input
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

      {/* Combine Media Modal */}
      <CombineMediaModal
        isOpen={showCombineModal}
        onClose={() => setShowCombineModal(false)}
      />

      {/* Two-Step Release Modal */}
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

      {/* Floating Navigation Button */}
      <FloatingNavButton 
        showPromptToggle={true}
        onTogglePrompt={() => setShowBottomDock(!showBottomDock)}
      />
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

