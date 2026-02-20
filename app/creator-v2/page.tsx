'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Types
interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface GenerationState {
  isGenerating: boolean
  type: 'music' | 'image' | null
  progress: number
  status: string
  result?: {
    audioUrl?: string
    imageUrl?: string
    title?: string
  }
}

// Dev mode check
const isDev = process.env.NODE_ENV === 'development'

export default function CreatorV2Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Dev mode from URL
  const devMode = isDev && (searchParams.get('dev') === 'true' || searchParams.get('dev') === '1')
  
  // State
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generation, setGeneration] = useState<GenerationState>({
    isGenerating: false,
    type: null,
    progress: 0,
    status: ''
  })
  const [credits, setCredits] = useState<number | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(!devMode) // Auto-auth in dev mode
  
  // Generation form state
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [genre, setGenre] = useState('')
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('medium')
  const [activeTab, setActiveTab] = useState<'chat' | 'create'>('create')
  
  // Fetch credits on mount
  useEffect(() => {
    if (devMode || isAuthenticated) {
      fetchCredits()
    }
  }, [devMode, isAuthenticated])
  
  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const fetchCredits = async () => {
    try {
      const url = devMode ? '/api/credits?dev=true' : '/api/credits'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setCredits(data.credits ?? 0)
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    }
  }
  
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return
    
    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    
    try {
      const url = devMode ? '/api/plugin/chat?dev=true' : '/api/plugin/chat'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content.trim() })
      })
      
      if (res.ok) {
        const data = await res.json()
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response || data.message || 'I received your message!',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('Failed to get response')
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [devMode])
  
  const generateMusic = async () => {
    if (!title.trim() || !prompt.trim()) {
      alert('Please provide both title and prompt')
      return
    }
    
    setGeneration({
      isGenerating: true,
      type: 'music',
      progress: 0,
      status: 'Starting music generation...'
    })
    
    try {
      const url = devMode ? '/api/generate/music-only?dev=true' : '/api/generate/music-only'
      
      // Use streaming endpoint
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          prompt: prompt.trim(),
          lyrics: lyrics.trim() || undefined,
          genre: genre.trim() || undefined,
          duration,
          generateCoverArt: false
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Generation failed')
      }
      
      // Handle streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      
      if (reader) {
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)
                
                if (data.type === 'started') {
                  setGeneration(prev => ({
                    ...prev,
                    progress: 10,
                    status: 'Generating music...'
                  }))
                } else if (data.type === 'result') {
                  if (data.success) {
                    setGeneration(prev => ({
                      ...prev,
                      isGenerating: false,
                      progress: 100,
                      status: 'Complete!',
                      result: {
                        audioUrl: data.audioUrl,
                        title: data.title
                      }
                    }))
                    setCredits(data.creditsRemaining)
                    
                    // Add success message to chat
                    setMessages(prev => [...prev, {
                      role: 'assistant',
                      content: `🎵 Generated "${data.title}" successfully! [Listen](${data.audioUrl})`,
                      timestamp: new Date()
                    }])
                  } else {
                    throw new Error(data.error || 'Generation failed')
                  }
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Music generation error:', error)
      setGeneration({
        isGenerating: false,
        type: null,
        progress: 0,
        status: `Error: ${error.message}`
      })
    }
  }
  
  const generateImage = async () => {
    if (!prompt.trim()) {
      alert('Please provide a prompt')
      return
    }
    
    setGeneration({
      isGenerating: true,
      type: 'image',
      progress: 0,
      status: 'Starting image generation...'
    })
    
    try {
      const url = devMode ? '/api/generate/image-only?dev=true' : '/api/generate/image-only'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          params: {
            width: 1024,
            height: 1024,
            output_format: 'jpg',
            output_quality: 100
          }
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Generation failed')
      }
      
      const data = await res.json()
      
      if (data.success) {
        setGeneration({
          isGenerating: false,
          type: 'image',
          progress: 100,
          status: 'Complete!',
          result: {
            imageUrl: data.imageUrl
          }
        })
        setCredits(data.creditsRemaining)
        
        // Add success message to chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🎨 Generated image successfully! [View](${data.imageUrl})`,
          timestamp: new Date()
        }])
      } else {
        throw new Error(data.error || 'Generation failed')
      }
    } catch (error: any) {
      console.error('Image generation error:', error)
      setGeneration({
        isGenerating: false,
        type: null,
        progress: 0,
        status: `Error: ${error.message}`
      })
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Creator V2
            </h1>
            {devMode && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                DEV MODE
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {credits !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                <span className="text-sm text-gray-300">Credits:</span>
                <span className="font-semibold text-purple-400">{credits}</span>
              </div>
            )}
            <button
              onClick={() => router.push('/')}
              className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              Home
            </button>
          </div>
        </div>
      </header>
      
      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'create'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            🎵 Create
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'chat'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            💬 Chat
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* Left Panel - Create or Chat */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            {activeTab === 'create' ? (
              <div className="p-6 space-y-6">
                <h2 className="text-lg font-semibold">Generate Music / Image</h2>
                
                {/* Title Input */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter song title (3-100 characters)"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition"
                    maxLength={100}
                  />
                </div>
                
                {/* Prompt Input */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Prompt *</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want to generate (10-300 characters)"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition resize-none"
                    rows={3}
                    maxLength={300}
                  />
                  <p className="text-xs text-gray-500 mt-1">{prompt.length}/300</p>
                </div>
                
                {/* Genre */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Genre</label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="e.g., electronic, hip-hop, ambient"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
                
                {/* Lyrics */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Lyrics (optional)</label>
                  <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    placeholder="Leave empty for AI-generated lyrics"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition resize-none"
                    rows={4}
                  />
                </div>
                
                {/* Duration */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Duration</label>
                  <div className="flex gap-2">
                    {(['short', 'medium', 'long'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          duration === d
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Generate Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={generateMusic}
                    disabled={generation.isGenerating || !title.trim() || !prompt.trim()}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
                  >
                    {generation.isGenerating && generation.type === 'music' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      '🎵 Generate Music (2 credits)'
                    )}
                  </button>
                  <button
                    onClick={generateImage}
                    disabled={generation.isGenerating || !prompt.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
                  >
                    {generation.isGenerating && generation.type === 'image' ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      '🎨 Image (1 credit)'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Chat Interface */
              <div className="flex flex-col h-[500px]">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>Start a conversation...</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                            msg.role === 'user'
                              ? 'bg-purple-500 text-white'
                              : 'bg-white/10 text-gray-200'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs opacity-50 mt-1">
                            {msg.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 px-4 py-2 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span className="text-gray-400">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                {/* Chat Input */}
                <div className="p-4 border-t border-white/10">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      sendMessage(inputValue)
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 transition"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="px-4 py-2 bg-purple-500 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Panel - Generation Status / Preview */}
          <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">Generation Status</h2>
              
              {!generation.isGenerating && !generation.result ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <p>No active generation</p>
                </div>
              ) : generation.isGenerating ? (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                      style={{ width: `${generation.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">{generation.status}</p>
                </div>
              ) : generation.result ? (
                <div className="space-y-4">
                  <p className="text-green-400 font-medium">✓ {generation.status}</p>
                  
                  {/* Audio Preview */}
                  {generation.result.audioUrl && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <p className="text-sm text-gray-400 mb-2">Generated: {generation.result.title}</p>
                      <audio
                        controls
                        src={generation.result.audioUrl}
                        className="w-full"
                      />
                      <a
                        href={generation.result.audioUrl}
                        download
                        className="inline-block mt-2 px-4 py-2 bg-purple-500 rounded-lg text-sm font-medium hover:bg-purple-600 transition"
                      >
                        Download
                      </a>
                    </div>
                  )}
                  
                  {/* Image Preview */}
                  {generation.result.imageUrl && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <img
                        src={generation.result.imageUrl}
                        alt="Generated"
                        className="w-full rounded-lg"
                      />
                      <a
                        href={generation.result.imageUrl}
                        download
                        className="inline-block mt-2 px-4 py-2 bg-purple-500 rounded-lg text-sm font-medium hover:bg-purple-600 transition"
                      >
                        Download
                      </a>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setGeneration({ isGenerating: false, type: null, progress: 0, status: '' })}
                    className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 transition"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
      
      {/* Dev Mode Notice */}
      {devMode && (
        <div className="fixed bottom-4 left-4 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-sm text-yellow-400">
          ⚠️ Dev Mode Active - Using bypass authentication
        </div>
      )}
    </div>
  )
}