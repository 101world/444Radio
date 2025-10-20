'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, X } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'

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

export default function HomePage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: '👋 Hey! I\'m your AI music studio assistant. What would you like to create today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [selectedTools, setSelectedTools] = useState<Set<GenerationType>>(new Set(['music'])) // Multiple tools
  
  // Separate prompts for each workflow
  const [musicPrompt, setMusicPrompt] = useState('')
  const [coverArtPrompt, setCoverArtPrompt] = useState('')
  const [videoPrompt, setVideoPrompt] = useState('')
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [showMusicModal, setShowMusicModal] = useState(false)
  const [isActivated, setIsActivated] = useState(false) // New state for transition
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Activate chat interface when user interacts with input
  const handleActivate = () => {
    if (!isActivated) {
      setIsActivated(true)
    }
  }

  const toggleTool = (tool: GenerationType) => {
    const newTools = new Set(selectedTools)
    if (newTools.has(tool)) {
      newTools.delete(tool)
    } else {
      newTools.add(tool)
    }
    // Ensure at least one tool is selected
    if (newTools.size > 0) {
      setSelectedTools(newTools)
    }
  }

  const handleGenerate = async () => {
    if (selectedTools.size === 0) return

    // Check that each selected tool has a prompt
    const hasValidPrompts = Array.from(selectedTools).every(tool => {
      if (tool === 'music') return musicPrompt.trim()
      if (tool === 'image') return coverArtPrompt.trim()
      if (tool === 'video') return videoPrompt.trim()
      return false
    })

    if (!hasValidPrompts) return

    // Combine all prompts into a single message for the chat
    const combinedMessage = Array.from(selectedTools)
      .map(tool => {
        if (tool === 'music') return `🎵 Music: ${musicPrompt}`
        if (tool === 'image') return `🎨 Cover Art: ${coverArtPrompt}`
        if (tool === 'video') return `🎬 Video: ${videoPrompt}`
        return ''
      })
      .filter(Boolean)
      .join('\n')

    // Seamlessly redirect to create page with all prompts and selected tools
    const params = new URLSearchParams({
      combinedMessage, // Combined prompt for chat display
      musicPrompt: selectedTools.has('music') ? musicPrompt : '',
      coverArtPrompt: selectedTools.has('image') ? coverArtPrompt : '',
      videoPrompt: selectedTools.has('video') ? videoPrompt : '',
      tools: Array.from(selectedTools).join(',') // "music,image"
    })
    
    router.push(`/create?${params.toString()}`)
  }

  const handleMusicGenerated = (audioUrl: string, title: string, lyrics: string, prompt: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input || prompt,
      timestamp: new Date()
    }

    // Add result message
    const resultMessage: Message = {
      id: (Date.now() + 1).toString(),
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

    setMessages(prev => [...prev, userMessage, resultMessage, assistantMessage])
    setInput('')
    setShowMusicModal(false)
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
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Main Content Wrapper with higher z-index */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Floating Menu */}
        <FloatingMenu />

        {/* Landing View - Centered Prompt (before activation) */}
        {!isActivated && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 transition-opacity duration-500">
          {/* Welcome Text */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="flex items-center justify-center mb-6 gap-4">
              <img src="/radio-logo.svg" alt="444 Radio" className="w-20 h-20 md:w-24 md:h-24 text-cyan-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" style={{ filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.6))' }} />
              <h1 className="text-6xl md:text-8xl font-black text-white leading-tight">
                444 Radio
              </h1>
            </div>
            <p className="text-xl text-gray-400 mb-12">
              A world where music feels infinite.
            </p>
          </div>

          {/* Centered Sleek Modern Input */}
          <div className="w-full max-w-3xl mx-auto">
            {/* Type Selection Pills - Dark Cyan Theme */}
            <div className="flex gap-2 mb-4 justify-center">
              <button
                onClick={() => toggleTool('music')}
                className={`group relative px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 ${
                  selectedTools.has('music')
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                <Music size={13} className="inline mr-1.5" />
                MUSIC
                {selectedTools.has('music') && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-red-700 blur-xl opacity-50 animate-pulse"></span>
                )}
              </button>
              <button
                onClick={() => toggleTool('image')}
                className={`group relative px-5 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 ${
                  selectedTools.has('image')
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                <ImageIcon size={13} className="inline mr-1.5" />
                COVER ART
                {selectedTools.has('image') && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 blur-xl opacity-50 animate-pulse"></span>
                )}
              </button>
              <button
                disabled
                className="px-5 py-2 rounded-full text-xs font-bold tracking-wide bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed opacity-40"
              >
                <Video size={13} className="inline mr-1.5" />
                VIDEO
              </button>
            </div>

            {/* Individual Input Boxes - Dark Cyan Theme */}
            <div className="flex flex-col gap-3">
              {selectedTools.has('music') && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative flex gap-3 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-5 py-3 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
                    <Music size={18} className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <input
                      type="text"
                      value={musicPrompt}
                      onChange={(e) => setMusicPrompt(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                      placeholder="// Type your music vibe here..."
                      disabled={isGenerating}
                      style={{ fontFamily: "'Courier New', monospace" }}
                      className="flex-1 px-0 py-1 bg-transparent border-none text-white placeholder-gray-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide focus:placeholder-cyan-400 focus:text-shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all"
                    />
                  </div>
                </div>
              )}
              
              {selectedTools.has('image') && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative flex gap-3 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-5 py-3 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
                    <ImageIcon size={18} className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <input
                      type="text"
                      value={coverArtPrompt}
                      onChange={(e) => setCoverArtPrompt(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                      placeholder="// Describe your cover art vision..."
                      disabled={isGenerating}
                      style={{ fontFamily: "'Courier New', monospace" }}
                      className="flex-1 px-0 py-1 bg-transparent border-none text-white placeholder-gray-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide focus:placeholder-cyan-400 focus:text-shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all"
                    />
                  </div>
                </div>
              )}
              
              {selectedTools.has('video') && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative flex gap-3 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-5 py-3 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300">
                    <Video size={18} className="text-blue-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    <input
                      type="text"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                      placeholder="// Your video concept..."
                      disabled={isGenerating}
                      style={{ fontFamily: "'Courier New', monospace" }}
                      className="flex-1 px-0 py-1 bg-transparent border-none text-white placeholder-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide focus:placeholder-blue-500/50 focus:text-shadow-[0_0_10px_rgba(59,130,246,0.8)] transition-all"
                    />
                  </div>
                </div>
              )}
              
              {/* Send Button - Gamified Design */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedTools.size === 0 || 
                  (selectedTools.has('music') && !musicPrompt.trim()) ||
                  (selectedTools.has('image') && !coverArtPrompt.trim()) ||
                  (selectedTools.has('video') && !videoPrompt.trim())
                }
                className="group relative w-full mt-3 px-6 py-4 bg-gradient-to-r from-cyan-600 via-blue-600 to-blue-700 hover:from-cyan-500 hover:via-blue-500 hover:to-blue-600 rounded-2xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-cyan-600 flex items-center justify-center gap-3 font-bold text-sm tracking-widest shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:shadow-none overflow-hidden"
                title="Create with AI"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin-slow text-white z-10" size={20} />
                    <span className="text-white z-10">CREATING...</span>
                  </>
                ) : (
                  <>
                    <Music size={20} className="text-white z-10" />
                    <span className="text-white z-10">CREATE</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Info - Sleeker */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-600 font-mono tracking-wider">
              <span className="text-red-400">2 CR</span>
              <span className="text-gray-700">⚡</span>
              <span className="text-cyan-400">1 CR</span>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area - Shows after activation */}
      {isActivated && (
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-40 max-w-4xl mx-auto w-full animate-fade-in">
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
                    <Loader2 className="animate-spin-slow text-[#818cf8]" size={16} />
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
      )}

      {/* Fixed Bottom Input Area - Only shows when activated - MOBILE */}
      {isActivated && (
        <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 animate-slide-up">
          <div className="max-w-4xl mx-auto">
            {/* Type Selection Pills - Sleeker Mobile Design */}
            <div className="flex gap-2 mb-3 justify-center">
              <button
                onClick={() => toggleTool('music')}
                className={`group relative px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 ${
                  selectedTools.has('music')
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                <Music size={12} className="inline mr-1" />
                MUSIC
                {selectedTools.has('music') && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-red-700 blur-xl opacity-50 animate-pulse"></span>
                )}
              </button>
              <button
                onClick={() => toggleTool('image')}
                className={`group relative px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-300 ${
                  selectedTools.has('image')
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                <ImageIcon size={12} className="inline mr-1" />
                ART
                {selectedTools.has('image') && (
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 blur-xl opacity-50 animate-pulse"></span>
                )}
              </button>
              <button
                disabled
                className="px-4 py-2 rounded-full text-xs font-bold tracking-wide bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed opacity-40"
              >
                <Video size={12} className="inline mr-1" />
                VIDEO
              </button>
            </div>

            {/* Individual Input Boxes - Mobile */}
            <div className="flex flex-col gap-2">
              {selectedTools.has('music') && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative flex gap-2 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-cyan-500/20 hover:border-cyan-500/40">
                    <Music size={16} className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <input
                      type="text"
                      value={musicPrompt}
                      onChange={(e) => setMusicPrompt(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                      placeholder="// Your music vibe..."
                      disabled={isGenerating}
                      style={{ fontFamily: "'Courier New', monospace" }}
                      className="flex-1 px-0 py-1 bg-transparent border-none text-white placeholder-gray-400 focus:outline-none focus:placeholder-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide"
                    />
                  </div>
                </div>
              )}
              
              {selectedTools.has('image') && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative flex gap-2 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-cyan-500/20 hover:border-cyan-500/40">
                    <ImageIcon size={16} className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                    <input
                      type="text"
                      value={coverArtPrompt}
                      onChange={(e) => setCoverArtPrompt(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                      placeholder="// Cover art vision..."
                      disabled={isGenerating}
                      style={{ fontFamily: "'Courier New', monospace" }}
                      className="flex-1 px-0 py-1 bg-transparent border-none text-white placeholder-gray-400 focus:outline-none focus:placeholder-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide"
                    />
                  </div>
                </div>
              )}
              
              {selectedTools.has('video') && (
                <div className="group relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-300"></div>
                  <div className="relative flex gap-2 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-blue-500/20">
                    <Video size={16} className="text-blue-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                    <input
                      type="text"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                      placeholder="// Video concept..."
                      disabled={isGenerating}
                      style={{ fontFamily: "'Courier New', monospace" }}
                      className="flex-1 px-0 py-1 bg-transparent border-none text-white placeholder-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide"
                    />
                  </div>
                </div>
              )}
              
              {/* Send Button - Gamified Mobile */}
              <button
                onClick={handleGenerate}
                disabled={selectedTools.size === 0 || 
                  (selectedTools.has('music') && !musicPrompt.trim()) ||
                  (selectedTools.has('image') && !coverArtPrompt.trim()) ||
                  (selectedTools.has('video') && !videoPrompt.trim())
                }
                className="group relative w-full mt-3 px-6 py-3.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-blue-700 hover:from-cyan-500 hover:via-blue-500 hover:to-blue-600 rounded-2xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-sm tracking-widest shadow-lg shadow-cyan-500/30 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-blue-500 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                <Music size={18} className="text-white z-10" />
                <span className="text-white z-10">CREATE</span>
              </button>
            </div>

            {/* Quick Info - Mobile */}
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-600 font-mono">
              <span className="text-red-400">2 CR</span>
              <span className="text-gray-700">⚡</span>
              <span className="text-cyan-400">1 CR</span>
            </div>
          </div>
        </div>
      )}
      </div> {/* Close Main Content Wrapper */}

      {/* Music Generation Modal */}
      <MusicGenerationModal
        isOpen={showMusicModal}
        onClose={() => setShowMusicModal(false)}
        onSuccess={(audioUrl: string, prompt: string) => {
          // Extract title and lyrics from the generated music
          // This will be called after successful generation
          handleMusicGenerated(audioUrl, 'Generated Track', '', prompt)
        }}
      />
    </div>
  )
}

