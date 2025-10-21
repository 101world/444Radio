'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Music, Image as ImageIcon, Video, Send, Loader2, Download, Play, Pause, Layers, Type, Tag, FileText, Sparkles, Music2, Settings, Zap, X, Rocket } from 'lucide-react'
import MusicGenerationModal from '../components/MusicGenerationModal'
import CombineMediaModal from '../components/CombineMediaModal'
import TwoStepReleaseModal from '../components/TwoStepReleaseModal'
import FloatingMenu from '../components/FloatingMenu'
import HolographicBackground from '../components/HolographicBackgroundClient'

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
  
  // Advanced parameters
  const [customLyrics, setCustomLyrics] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [generateCoverArt, setGenerateCoverArt] = useState(true)
  
  // Modal states for parameters
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showGenreModal, setShowGenreModal] = useState(false)
  const [showLyricsModal, setShowLyricsModal] = useState(false)
  const [showBpmModal, setShowBpmModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

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

  const handleGenerate = async () => {
    if (!input.trim() || isGenerating) return

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
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: `🎵 Generate music: "${input}"`,
        timestamp: new Date()
      }

      const generatingMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'generation',
        content: '🎵 Generating your track...',
        generationType: 'music',
        isGenerating: true,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setInput('')
      setIsGenerating(true)

      try {
        // 🎯 SMART DEFAULTS LOGIC:
        // - If user provides custom settings → Use them
        // - If user only uses text input → API generates defaults automatically
        // This allows quick generation OR detailed customization
        
        // Build prompt with optional parameters (only if user specified)
        let fullPrompt = input
        if (genre) fullPrompt += ` [${genre}]`
        if (bpm) fullPrompt += ` [${bpm} BPM]`
        
        // Use custom title if provided, otherwise API will generate from prompt
        const titleToUse = customTitle || undefined
        
        // Use custom lyrics if provided, otherwise API generates defaults from prompt
        const lyricsToUse = customLyrics || undefined
        
        const result = await generateMusic(fullPrompt, titleToUse, lyricsToUse)

        // Update credits if generation was successful
        if (!result.error && result.creditsRemaining !== undefined) {
          setUserCredits(result.creditsRemaining)
        }

        // Replace generating message with result
        setMessages(prev => prev.map(msg => 
          msg.id === generatingMessage.id 
            ? {
                ...msg,
                isGenerating: false,
                content: result.error ? `❌ ${result.error}` : `✅ Track generated!`,
                result: result.error ? undefined : result
              }
            : msg
        ))

        // Add assistant response
        if (!result.error) {
          const assistantMessage: Message = {
            id: (Date.now() + 2).toString(),
            type: 'assistant',
            content: 'Your track is ready! Want to create cover art for it? Or generate another track?',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, assistantMessage])
        }

        // Clear parameters after generation
        setCustomTitle('')
        setGenre('')
        setCustomLyrics('')
        setBpm('')
      } catch (error) {
        console.error('Generation error:', error)
        setMessages(prev => prev.map(msg => 
          msg.id === generatingMessage.id 
            ? { ...msg, isGenerating: false, content: '❌ Generation failed. Please try again.' }
            : msg
        ))
      } finally {
        setIsGenerating(false)
      }
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
        content: `🎨 Generating cover art...`,
        generationType: 'image',
        isGenerating: true,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, userMessage, generatingMessage])
      setInput('')
      setIsGenerating(true)

      try {
        const result = await generateImage(input)

        // Update credits if generation was successful
        if (!result.error && result.creditsRemaining !== undefined) {
          setUserCredits(result.creditsRemaining)
        }

        // Replace generating message with result
        setMessages(prev => prev.map(msg => 
          msg.id === generatingMessage.id 
            ? {
                ...msg,
                isGenerating: false,
                content: result.error ? `❌ ${result.error}` : `✅ Cover art generated!`,
                result: result.error ? undefined : result
              }
            : msg
        ))

        // Add assistant response
        if (!result.error) {
          const assistantMessage: Message = {
            id: (Date.now() + 2).toString(),
            type: 'assistant',
            content: 'Cover art created! Want to combine it with a track?',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, assistantMessage])
        }
      } catch (error) {
        console.error('Generation error:', error)
        setMessages(prev => prev.map(msg => 
          msg.id === generatingMessage.id 
            ? { ...msg, isGenerating: false, content: '❌ Generation failed. Please try again.' }
            : msg
        ))
      } finally {
        setIsGenerating(false)
      }
      return
    }

    // Video coming soon
    if (selectedType === 'video') {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: input,
        timestamp: new Date()
      }
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '🎬 Video generation coming soon!',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage, assistantMessage])
      setInput('')
    }
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

  const generateMusic = async (prompt: string, title?: string, lyrics?: string) => {
    const res = await fetch('/api/generate/music-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, title, lyrics })
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
      
      {/* Floating Menu */}
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

      {/* Chat Area with Holographic Board */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-40 max-w-4xl mx-auto w-full scrollbar-thin scroll-smooth">
        {/* Holographic Chat Board */}
        <div className="min-h-full bg-gradient-to-br from-cyan-500/5 via-transparent to-cyan-400/5 backdrop-blur-sm border border-cyan-500/10 rounded-3xl p-4 md:p-6 shadow-2xl">
          <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 backdrop-blur-xl ${
                  message.type === 'user'
                    ? 'bg-white/10 border border-white/20 text-white'
                    : message.type === 'assistant'
                    ? 'bg-white/5 border border-white/10 text-gray-300'
                    : 'bg-cyan-950/80 border border-cyan-500/50 text-white'
                }`}
              >
                {/* Message Content */}
                <p className="text-sm mb-2">{message.content}</p>

                {/* Music Generation Result */}
                {message.result?.audioUrl && (
                  <div className="mt-4 bg-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10 relative group">
                    {/* Rocket Icon - Top Right */}
                    <button
                      onClick={() => handleOpenRelease(message.id, undefined)}
                      className="absolute top-3 right-3 p-2 bg-cyan-500/20 hover:bg-cyan-500/40 backdrop-blur-xl border border-cyan-500/30 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                      title="Release to Feed"
                    >
                      <Rocket size={16} className="text-cyan-400" />
                    </button>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 pr-12">
                        <h4 className="font-bold text-white">{message.result.title}</h4>
                        <p className="text-xs text-gray-400">{message.result.prompt}</p>
                      </div>
                      <button
                        onClick={() => handlePlayPause(message.id, message.result!.audioUrl!)}
                        className="p-3 bg-cyan-500 hover:bg-cyan-600 rounded-full transition-colors"
                      >
                        {playingId === message.id ? <Pause size={20} /> : <Play size={20} />}
                      </button>
                    </div>
                    
                    {/* Audio Player */}
                    <audio
                      src={message.result.audioUrl}
                      controls
                      className="w-full"
                    />

                    {/* Lyrics */}
                    {message.result.lyrics && (
                      <details className="mt-3">
                        <summary className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300">
                          View Lyrics
                        </summary>
                        <pre className="text-xs text-gray-300 mt-2 whitespace-pre-wrap">
                          {message.result.lyrics}
                        </pre>
                      </details>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.mp3`)}
                        className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <Link
                        href="/library"
                        className="flex-1 px-3 py-2 bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-500/50 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                      >
                        <Layers size={14} />
                        View in Library
                      </Link>
                    </div>
                  </div>
                )}

                {/* Image Generation Result */}
                {message.result?.imageUrl && (
                  <div className="mt-4 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden border border-white/10 relative group">
                    {/* Rocket Icon - Top Right over Image */}
                    <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenRelease(undefined, message.id)}
                        className="p-2 bg-cyan-500/20 hover:bg-cyan-500/40 backdrop-blur-xl border border-cyan-500/30 rounded-lg transition-all"
                        title="Release to Feed"
                      >
                        <Rocket size={16} className="text-cyan-400" />
                      </button>
                    </div>

                    <img
                      src={message.result.imageUrl}
                      alt={message.result.title}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-4">
                      <h4 className="font-bold text-white mb-1">{message.result.title}</h4>
                      <p className="text-xs text-gray-400 mb-3">{message.result.prompt}</p>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(message.result!.imageUrl!, `${message.result!.title}.webp`)}
                          className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <Download size={14} />
                          Download
                        </button>
                        <Link
                          href="/library"
                          className="flex-1 px-3 py-2 bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-500/50 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                        >
                          <Layers size={14} />
                          View in Library
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading Indicator */}
                {message.isGenerating && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="animate-spin text-cyan-400" size={16} />
                    <span className="text-xs text-gray-400">Generating...</span>
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-xs text-gray-600 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Fixed Bottom Unified Composer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="group relative">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition duration-300"></div>
            
            {/* Main Composer Container */}
            <div className="relative bg-black/70 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              
              {/* Unified Bottom Bar */}
              <div className="flex items-center gap-3 px-4 py-3">
                
                {/* Left: Type Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedType('music')}
                    className={`p-2.5 rounded-xl transition-all ${
                      selectedType === 'music'
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                    title="Music"
                  >
                    <Music size={18} />
                  </button>
                  <button
                    onClick={() => setSelectedType('image')}
                    className={`p-2.5 rounded-xl transition-all ${
                      selectedType === 'image'
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/50'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                    title="Cover Art"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <button
                    disabled
                    className="p-2.5 rounded-xl bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-50"
                    title="Video (Coming Soon)"
                  >
                    <Video size={18} />
                  </button>
                </div>

                {/* Center: Text Input */}
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleGenerate()
                      }
                    }}
                    placeholder={
                      selectedType === 'music'
                        ? 'Describe your track...'
                        : selectedType === 'image'
                        ? 'Describe your cover art...'
                        : 'Coming soon...'
                    }
                    disabled={isGenerating || selectedType === 'video'}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  />
                </div>

                {/* Right: Rocket + Settings + Credits + Create Button */}
                <div className="flex items-center gap-2">
                  {/* Rocket Button */}
                  <button
                    onClick={() => handleOpenRelease()}
                    className="p-2.5 rounded-xl transition-all bg-white/5 text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/30 border border-white/5"
                    title="Release to Feed"
                  >
                    <Rocket size={18} />
                  </button>

                  {/* Settings Button */}
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className={`p-2.5 rounded-xl transition-all ${
                      customTitle || genre || customLyrics || bpm
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                    title="Advanced Settings"
                  >
                    <Settings size={18} />
                  </button>

                  {/* Credits Display */}
                  <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                    <Zap size={14} className="text-cyan-400" />
                    <span className="text-xs text-white font-medium">
                      {isLoadingCredits ? '...' : userCredits}
                    </span>
                    <span className="text-xs text-gray-500">
                      {selectedType === 'music' ? '(-2)' : selectedType === 'image' ? '(-1)' : ''}
                    </span>
                  </div>

                  {/* Create Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !input.trim() || selectedType === 'video'}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold shadow-lg shadow-cyan-500/30 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span className="hidden sm:inline">Creating...</span>
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        <span className="hidden sm:inline">Create</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

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

              {/* Lyrics */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lyrics</label>
                  <button
                    onClick={() => {
                      const lyricsTemplates = [
                        "Walking down this empty street\nNeon lights guide my way\nCity sounds beneath my feet\nAnother night, another day",
                        "Lost in the rhythm of the night\nHeartbeat syncing with the bass\nEverything just feels so right\nLiving life at my own pace",
                        "Staring at the stars above\nDreaming of a better tomorrow\nSearching for that endless love\nTrying to escape this sorrow"
                      ]
                      const randomLyrics = lyricsTemplates[Math.floor(Math.random() * lyricsTemplates.length)]
                      setCustomLyrics(randomLyrics)
                    }}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <Sparkles size={12} />
                    Generate
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

