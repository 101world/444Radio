'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Video, Send, Loader2, Download, Play, Pause, Layers, Settings, Type, Tag, FileText } from 'lucide-react'
import MusicGenerationModal from '../components/MusicGenerationModal'
import CombineMediaModal from '../components/CombineMediaModal'
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Advanced parameters
  const [customLyrics, setCustomLyrics] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [generateCoverArt, setGenerateCoverArt] = useState(true)
  
  // Modal states for parameters
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [showGenreModal, setShowGenreModal] = useState(false)
  const [showLyricsModal, setShowLyricsModal] = useState(false)

  // Close all modals
  const closeAllModals = () => {
    setShowTitleModal(false)
    setShowGenreModal(false)
    setShowLyricsModal(false)
  }

  // Handle modal toggle - close others when opening one
  const toggleModal = (modalType: 'title' | 'genre' | 'lyrics') => {
    closeAllModals()
    if (modalType === 'title') setShowTitleModal(true)
    if (modalType === 'genre') setShowGenreModal(true)
    if (modalType === 'lyrics') setShowLyricsModal(true)
  }
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

    // Close any open parameter modals
    closeAllModals()

    // For music generation
    if (selectedType === 'music') {
      setShowMusicModal(true)
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

  const generateMusic = async (prompt: string) => {
    const res = await fetch('/api/generate/music-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    })

    const data = await res.json()
    
    if (data.success) {
      return {
        audioUrl: data.audioUrl,
        title: data.title || prompt.substring(0, 50),
        prompt: prompt,
        lyrics: data.lyrics
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
        prompt: prompt
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Holographic 3D Background */}
      <HolographicBackground />
      
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Back to Home Button */}
      <div className="fixed top-6 left-6 z-50" style={{ pointerEvents: 'auto' }}>
        <Link href="/" className="block">
          <button className="group flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl pointer-events-auto">
            <svg 
              className="w-4 h-4 transition-transform group-hover:-translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Home</span>
            <span className="text-xs text-gray-400 ml-1">(ESC)</span>
          </button>
        </Link>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 pb-40 max-w-4xl mx-auto w-full">
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
                    : 'bg-[#1e1b4b]/80 border border-[#4f46e5]/50 text-white'
                }`}
              >
                {/* Message Content */}
                <p className="text-sm mb-2">{message.content}</p>

                {/* Music Generation Result */}
                {message.result?.audioUrl && (
                  <div className="mt-4 bg-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-white">{message.result.title}</h4>
                        <p className="text-xs text-gray-400">{message.result.prompt}</p>
                      </div>
                      <button
                        onClick={() => handlePlayPause(message.id, message.result!.audioUrl!)}
                        className="p-3 bg-[#4f46e5] hover:bg-[#6366f1] rounded-full transition-colors"
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
                        <summary className="text-xs text-[#818cf8] cursor-pointer hover:text-[#7aa5d7]">
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
                        className="flex-1 px-3 py-2 bg-[#4f46e5]/30 hover:bg-[#4f46e5]/50 border border-[#4f46e5]/50 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                      >
                        <Layers size={14} />
                        View in Library
                      </Link>
                    </div>
                  </div>
                )}

                {/* Image Generation Result */}
                {message.result?.imageUrl && (
                  <div className="mt-4 bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden border border-white/10">
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
                          className="flex-1 px-3 py-2 bg-[#4f46e5]/30 hover:bg-[#4f46e5]/50 border border-[#4f46e5]/50 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
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
                    <Loader2 className="animate-spin text-[#818cf8]" size={16} />
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

      {/* Fixed Bottom Input Area - Rectangular Design with Glow */}
      <div className="fixed bottom-0 left-0 right-0 p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Rectangular Container with Glow Effect */}
          <div className="group relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-2xl blur-lg opacity-30 group-hover:opacity-40 transition duration-300"></div>
            <div className="relative bg-black/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-2xl">
              {/* Type Selection Pills + Release Button */}
              <div className="flex gap-2 px-5 pt-4 pb-3 items-center justify-between border-b border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedType('music')}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      selectedType === 'music'
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white border border-white/10'
                    }`}
                  >
                    <Music size={14} className="inline mr-1.5" />
                    Music
                  </button>
                  <button
                    onClick={() => setSelectedType('image')}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      selectedType === 'image'
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white border border-white/10'
                    }`}
                  >
                    <ImageIcon size={14} className="inline mr-1.5" />
                    Cover Art
                  </button>
                  <button
                    disabled
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed"
                  >
                    <Video size={14} className="inline mr-1.5" />
                    Video
                  </button>
                </div>
                
                {/* Release Button on the right */}
                <button
                  onClick={() => setShowCombineModal(true)}
                  className="px-5 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white hover:from-[#5558e3] hover:to-[#7078ef] transition-all shadow-lg"
                >
                  <Layers size={14} className="inline mr-1.5" />
                  Release
                </button>
              </div>

              {/* Integrated Input Area - Sleek Design */}
              <div className="px-5 py-4 space-y-4">
                {/* Main Prompt */}
                <div className="relative flex gap-3 items-center">
                  <Music size={18} className="text-cyan-400 flex-shrink-0" />
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
                    placeholder={
                      selectedType === 'music'
                        ? '// Describe your track...'
                        : selectedType === 'image'
                        ? '// Describe your cover art...'
                        : '// Coming soon...'
                    }
                    disabled={isGenerating || selectedType === 'video'}
                    className="flex-1 px-0 py-0 bg-transparent border-none text-white text-sm placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-none"
                    rows={1}
                    style={{ fontFamily: "'Courier New', monospace" }}
                  />
                </div>

                {/* Parameter Options + Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  {/* Left: Parameter Icons */}
                  <div className="flex items-center gap-2">
                    {/* Title */}
                    <button
                      onClick={() => showTitleModal ? closeAllModals() : toggleModal('title')}
                      className={`p-2 rounded-lg transition-all ${
                        showTitleModal ? 'bg-cyan-500 text-white' : customTitle ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                      title="Add Title"
                    >
                      <Type size={16} />
                    </button>

                    {/* Genre */}
                    <button
                      onClick={() => showGenreModal ? closeAllModals() : toggleModal('genre')}
                      className={`p-2 rounded-lg transition-all ${
                        showGenreModal ? 'bg-cyan-500 text-white' : genre ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                      title="Add Genre"
                    >
                      <Tag size={16} />
                    </button>

                    {/* Lyrics */}
                    <button
                      onClick={() => showLyricsModal ? closeAllModals() : toggleModal('lyrics')}
                      className={`p-2 rounded-lg transition-all ${
                        showLyricsModal ? 'bg-cyan-500 text-white' : customLyrics ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                      title="Add Lyrics"
                    >
                      <FileText size={16} />
                    </button>

                    {/* Auto-Generate Cover Art Toggle (for music) */}
                    {selectedType === 'music' && (
                      <button
                        onClick={() => setGenerateCoverArt(!generateCoverArt)}
                        disabled={isGenerating}
                        className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
                          generateCoverArt ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                        title={generateCoverArt ? "Auto-generate cover art enabled" : "Auto-generate cover art disabled"}
                      >
                        <ImageIcon size={16} />
                      </button>
                    )}
                  </div>

                  {/* Right: Credits + Send Button */}
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {selectedType === 'music' ? '2 credits' : selectedType === 'image' ? '1 credit' : 'N/A'}
                    </span>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !input.trim() || selectedType === 'video'}
                      className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-lg shadow-cyan-500/30"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin text-white" size={16} />
                          <span className="text-white">Creating...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} className="text-white" />
                          <span className="text-white">Create</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Popover Inputs */}
                {showTitleModal && (
                  <div className="animate-fade-in relative">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeAllModals()
                        if (e.key === 'Enter') closeAllModals()
                      }}
                      onBlur={() => setTimeout(() => setShowTitleModal(false), 150)}
                      placeholder="Enter title..."
                      className="w-full px-3 py-2 bg-white/5 border border-cyan-500/30 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                      autoFocus
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-600">Press Enter or Esc</span>
                  </div>
                )}

                {showGenreModal && (
                  <div className="animate-fade-in relative">
                    <input
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeAllModals()
                        if (e.key === 'Enter') closeAllModals()
                      }}
                      onBlur={() => setTimeout(() => setShowGenreModal(false), 150)}
                      placeholder="Enter genre (e.g., Hip-hop, Jazz)..."
                      className="w-full px-3 py-2 bg-white/5 border border-cyan-500/30 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
                      autoFocus
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-600">Press Enter or Esc</span>
                  </div>
                )}

                {showLyricsModal && (
                  <div className="animate-fade-in relative">
                    <textarea
                      value={customLyrics}
                      onChange={(e) => setCustomLyrics(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeAllModals()
                      }}
                      onBlur={() => setTimeout(() => setShowLyricsModal(false), 150)}
                      placeholder="Enter custom lyrics..."
                      className="w-full px-3 py-2 bg-white/5 border border-cyan-500/30 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                      rows={3}
                      autoFocus
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-gray-600">Press Esc to close</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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

