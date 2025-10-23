'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Music, Image as ImageIcon, Video, Send, Loader2, Download, Play, Pause, Layers, Type, Tag, FileText, Sparkles, Music2, Settings, Zap, X, Rocket, User, Compass, PlusCircle, Library, Globe, Check } from 'lucide-react'
import MusicGenerationModal from '../components/MusicGenerationModal'
import CombineMediaModal from '../components/CombineMediaModal'
import TwoStepReleaseModal from '../components/TwoStepReleaseModal'
import FloatingMenu from '../components/FloatingMenu'
import CreditIndicator from '../components/CreditIndicator'
import HolographicBackground from '../components/HolographicBackgroundClient'
import FloatingNavButton from '../components/FloatingNavButton'

type MessageType = 'user' | 'assistant' | 'generation'
type GenerationType = 'music' | 'image' | 'video'

interface Message {
  id: string
  type: MessageType
  content: string
  generationType?: GenerationType
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
  const [playingId, setPlayingId] = useState<string | null>(null)
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
  
  // Modal states for parameters
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showGenreModal, setShowGenreModal] = useState(false)
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [showBpmModal, setShowBpmModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)

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
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  // Fetch user credits on mount
  useEffect(() => {
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

    // Check credits before generation
    const creditsNeeded = selectedType === 'music' ? 2 : selectedType === 'image' ? 1 : 0
    if (userCredits !== null && userCredits < creditsNeeded) {
      alert(`⚡ Insufficient credits! You need ${creditsNeeded} credits but only have ${userCredits}. Visit the pricing page to get more.`)
      return
    }

    // Close any open parameter modals
    closeAllModals()

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
    try {
      // Add to active generations
      setActiveGenerations(prev => new Set(prev).add(messageId))
      
      // Update message to show it's now generating (if it was queued)
      setMessages(prev => prev.map(msg => 
        msg.id === messageId && msg.content.includes('Queued')
          ? { ...msg, content: type === 'music' ? '🎵 Generating your track...' : '🎨 Generating cover art...' }
          : msg
      ))

      let result
      
      if (type === 'music') {
        // Build prompt with optional parameters
        let fullPrompt = params.prompt
        if (params.genre) fullPrompt += ` [${params.genre}]`
        if (params.bpm) fullPrompt += ` [${params.bpm} BPM]`
        
        const titleToUse = params.customTitle || undefined
        const lyricsToUse = params.customLyrics || undefined
        const durationToUse = params.songDuration || 'medium'
        
        result = await generateMusic(fullPrompt, titleToUse, lyricsToUse, durationToUse)
      } else {
        result = await generateImage(params.prompt)
      }

      // Update credits
      if (!result.error && result.creditsRemaining !== undefined) {
        setUserCredits(result.creditsRemaining)
      }

      // Update message with result
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? {
              ...msg,
              isGenerating: false,
              content: result.error ? `❌ ${result.error}` : (type === 'music' ? '✅ Track generated!' : '✅ Cover art generated!'),
              result: result.error ? undefined : result
            }
          : msg
      ))

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
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Generation error:', error)
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

  const generateMusic = async (prompt: string, title?: string, lyrics?: string, duration: 'short' | 'medium' | 'long' = 'medium') => {
    const res = await fetch('/api/generate/music-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, title, lyrics, duration })
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

  const handlePlayPause = (messageId: string, audioUrl: string) => {
    const audio = audioRefs.current[messageId]
    
    if (!audio) {
      const newAudio = new Audio(audioUrl)
      audioRefs.current[messageId] = newAudio
      newAudio.play()
      setPlayingId(messageId)
      
      newAudio.onended = () => setPlayingId(null)
    } else {
      if (playingId === messageId) {
        audio.pause()
        setPlayingId(null)
      } else {
        audio.play()
        setPlayingId(messageId)
      }
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
      <HolographicBackground />
      
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

                {/* Music Result - Lean Design */}
                {message.result?.audioUrl && (
                  <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/20 rounded-2xl overflow-hidden group">
                    {/* Header with Play Button */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/5">
                      <button
                        onClick={() => handlePlayPause(message.id, message.result!.audioUrl!)}
                        className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30 transition-all active:scale-95"
                      >
                        {playingId === message.id ? <Pause size={20} className="text-black" /> : <Play size={20} className="text-black ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{message.result.title}</h4>
                        <p className="text-xs text-gray-400 truncate">{message.result.prompt}</p>
                      </div>
                      <button
                        onClick={() => handleOpenRelease(message.id, undefined)}
                        className="p-2.5 hover:bg-cyan-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Release"
                      >
                        <Rocket size={18} className="text-cyan-400" />
                      </button>
                    </div>

                    {/* Audio Player */}
                    <audio src={message.result.audioUrl} controls className="w-full px-4 py-3" />

                    {/* Lyrics */}
                    {message.result.lyrics && (
                      <details className="border-t border-white/5">
                        <summary className="px-4 py-2 text-xs text-cyan-400 cursor-pointer hover:bg-white/5 transition-colors">
                          Lyrics
                        </summary>
                        <pre className="px-4 pb-3 text-xs text-gray-300 whitespace-pre-wrap">
                          {message.result.lyrics}
                        </pre>
                      </details>
                    )}

                    {/* Action Buttons */}
                    <div className="flex border-t border-white/5">
                      <button
                        onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.mp3`)}
                        className="flex-1 px-4 py-3 hover:bg-white/5 text-xs text-cyan-400 flex items-center justify-center gap-2 transition-colors border-r border-white/5"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <Link
                        href="/library"
                        className="flex-1 px-4 py-3 hover:bg-white/5 text-xs text-cyan-400 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Layers size={14} />
                        Library
                      </Link>
                    </div>
                  </div>
                )}

                {/* Image Result - Lean Design */}
                {message.result?.imageUrl && (
                  <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/20 rounded-2xl overflow-hidden group">
                    {/* Image with Overlay Button */}
                    <div className="relative">
                      <img
                        src={message.result.imageUrl}
                        alt={message.result.title}
                        className="w-full aspect-square object-cover"
                      />
                      <button
                        onClick={() => handleOpenRelease(undefined, message.id)}
                        className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-cyan-500/40 backdrop-blur-xl border border-cyan-500/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Release"
                      >
                        <Rocket size={18} className="text-cyan-400" />
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-4 border-t border-white/5">
                      <h4 className="font-semibold text-white mb-1">{message.result.title}</h4>
                      <p className="text-xs text-gray-400">{message.result.prompt}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex border-t border-white/5">
                      <button
                        onClick={() => handleDownload(message.result!.imageUrl!, `${message.result!.title}.webp`)}
                        className="flex-1 px-4 py-3 hover:bg-white/5 text-xs text-cyan-400 flex items-center justify-center gap-2 transition-colors border-r border-white/5"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <Link
                        href="/library"
                        className="flex-1 px-4 py-3 hover:bg-white/5 text-xs text-cyan-400 flex items-center justify-center gap-2 transition-colors"
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

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className={`group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 ${
                customTitle || genre || customLyrics || bpm
                  ? 'bg-gradient-to-r from-cyan-600/20 via-cyan-500/20 to-cyan-400/20 border-2 border-cyan-400 scale-105'
                  : 'bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105'
              }`}
              title="Advanced Settings"
            >
              <Settings 
                size={18} 
                className={`${
                  customTitle || genre || customLyrics || bpm ? 'text-cyan-300' : 'text-cyan-400'
                } drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]`}
              />
            </button>

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

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="group relative p-2 md:p-2.5 rounded-2xl transition-all duration-300 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400/60 hover:scale-105"
                title={`Language: ${selectedLanguage}`}
              >
                <Globe 
                  size={18} 
                  className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[20px] md:h-[20px]"
                />
              </button>
              
              {/* Language Dropdown */}
              {showLanguageDropdown && (
                <div className="absolute top-full mt-2 right-0 w-48 bg-black/95 backdrop-blur-xl border-2 border-cyan-500/30 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {['English', 'Hindi', 'German', 'Spanish', 'French', 'Japanese', 'Korean', 'Portuguese', 'Italian', 'Chinese'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setSelectedLanguage(lang)
                        setShowLanguageDropdown(false)
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-all ${
                        selectedLanguage === lang
                          ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {lang}
                      {selectedLanguage === lang && (
                        <Check size={14} className="inline ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-8 bg-cyan-500/30"></div>

            {/* Credits Display */}
            <div className="hidden md:flex items-center gap-2 px-3 md:px-4 py-2.5 bg-black/40 md:bg-black/20 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl">
              <Zap size={16} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
              <span className="text-sm font-bold text-white">
                {isLoadingCredits ? '...' : userCredits}
              </span>
              <span className="text-xs text-cyan-400/60 font-mono">
                {selectedType === 'music' ? '(-2)' : selectedType === 'image' ? '(-1)' : ''}
              </span>
            </div>
          </div>

          {/* Main Prompt Box - Home Page Style */}
          <div 
            className="group relative active:scale-95 md:hover:scale-105 transition-transform duration-200"
          >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 blur-lg md:blur-xl opacity-30 md:opacity-40 group-hover:opacity-70 group-active:opacity-60 transition-opacity duration-300"></div>
            
            {/* Input Container */}
            <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/40 md:bg-black/20 backdrop-blur-xl md:backdrop-blur-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-active:border-cyan-400/60 md:group-hover:border-cyan-400/60 transition-colors duration-200 shadow-2xl">
              
              {/* Icon Based on Type */}
              {selectedType === 'music' ? (
                <Music 
                  size={20} 
                  className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[22px] md:h-[22px]" 
                />
              ) : selectedType === 'image' ? (
                <ImageIcon 
                  size={20} 
                  className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[22px] md:h-[22px]" 
                />
              ) : (
                <Video 
                  size={20} 
                  className="text-gray-600 flex-shrink-0 md:w-[22px] md:h-[22px]" 
                />
              )}
              
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

      {/* Settings Modal - 1:1 Aspect Ratio with Small Font */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowSettingsModal(false)}
          />
          
          {/* Modal Container - Square 1:1 */}
          <div className="relative w-full max-w-md aspect-square bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings size={18} className="text-cyan-400" />
                Advanced Settings
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter song title..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
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

              {/* BPM */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">BPM (Tempo)</label>
                <input
                  type="number"
                  value={bpm}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) >= 0 && parseInt(value) <= 300)) {
                      setBpm(value)
                    }
                  }}
                  placeholder="e.g., 120"
                  min="60"
                  max="200"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
                <p className="text-xs text-gray-500">Typical range: 60-200 BPM</p>
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

              {/* Lyrics */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lyrics</label>
                  <button
                    onClick={async () => {
                      try {
                        // Build API URL with description parameter
                        const params = new URLSearchParams()
                        
                        // Use the user's description/prompt for smart matching
                        if (input && input.trim()) {
                          params.append('description', input)
                        }
                        
                        const url = `/api/lyrics/random${params.toString() ? '?' + params.toString() : ''}`
                        const response = await fetch(url)
                        const data = await response.json()
                        
                        if (data.success && data.lyrics) {
                          setCustomLyrics(data.lyrics.lyrics)
                          // Optionally set genre and title if empty
                          if (!genre) setGenre(data.lyrics.genre)
                          if (!customTitle) setCustomTitle(data.lyrics.title)
                        }
                      } catch (error) {
                        console.error('Failed to fetch random lyrics:', error)
                        // Fallback to old templates if API fails
                        const lyricsTemplates = [
                          "Walking down this empty street\nNeon lights guide my way\nCity sounds beneath my feet\nAnother night, another day",
                          "Lost in the rhythm of the night\nHeartbeat syncing with the bass\nEverything just feels so right\nLiving life at my own pace",
                          "Staring at the stars above\nDreaming of a better tomorrow\nSearching for that endless love\nTrying to escape this sorrow"
                        ]
                        const randomLyrics = lyricsTemplates[Math.floor(Math.random() * lyricsTemplates.length)]
                        setCustomLyrics(randomLyrics)
                      }
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles size={12} />
                    Randomize
                  </button>
                </div>
                <textarea
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder="Enter custom lyrics..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                  rows={6}
                />
                <p className="text-xs text-gray-500">Add structure tags like [verse] [chorus]</p>
              </div>

              {/* Auto-Generate Cover Art */}
              {selectedType === 'music' && (
                <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-white">Auto-Generate Cover Art</p>
                    <p className="text-xs text-gray-500 mt-0.5">Create cover art with your music</p>
                  </div>
                  <button
                    onClick={() => setGenerateCoverArt(!generateCoverArt)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      generateCoverArt ? 'bg-cyan-500' : 'bg-white/20'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      generateCoverArt ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setShowSettingsModal(false)}
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

