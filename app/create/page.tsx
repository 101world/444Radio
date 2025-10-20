'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { Music, Image as ImageIcon, Video, Send, Loader2, Download, Play, Pause, Layers } from 'lucide-react'

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

export default function CreatePage() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleGenerate = async () => {
    if (!input.trim() || isGenerating) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    }

    const generatingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'generation',
      content: `Generating ${selectedType}...`,
      generationType: selectedType,
      isGenerating: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage, generatingMessage])
    setInput('')
    setIsGenerating(true)

    try {
      let result
      if (selectedType === 'music') {
        result = await generateMusic(input)
      } else if (selectedType === 'image') {
        result = await generateImage(input)
      } else {
        result = { error: 'Video generation coming soon!' }
      }

      // Replace generating message with result
      setMessages(prev => prev.map(msg => 
        msg.id === generatingMessage.id 
          ? {
              ...msg,
              isGenerating: false,
              content: result.error ? `❌ ${result.error}` : `✅ ${selectedType === 'music' ? 'Track' : 'Image'} generated!`,
              result: result.error ? undefined : result
            }
          : msg
      ))

      // Add assistant response
      if (!result.error) {
        const assistantMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: selectedType === 'music' 
            ? 'Your track is ready! Want to create cover art for it? Or generate another track?'
            : 'Image generated! Want to combine it with a track?',
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
      {/* Navigation */}
      <nav className="flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-center shadow-lg">
            <span className="font-bold text-lg">🎵</span>
          </div>
          <span className="text-2xl font-bold text-white">444RADIO</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/library" className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Library</Link>
          <Link href="/explore" className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Explore</Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

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
                    : 'bg-[#1a2332]/80 border border-[#2d4a6e]/50 text-white'
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
                        className="p-3 bg-[#2d4a6e] hover:bg-[#3d5a7e] rounded-full transition-colors"
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
                        <summary className="text-xs text-[#5a8fc7] cursor-pointer hover:text-[#7aa5d7]">
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
                        className="flex-1 px-3 py-2 bg-[#2d4a6e]/30 hover:bg-[#2d4a6e]/50 border border-[#2d4a6e]/50 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
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
                          className="flex-1 px-3 py-2 bg-[#2d4a6e]/30 hover:bg-[#2d4a6e]/50 border border-[#2d4a6e]/50 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
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
                    <Loader2 className="animate-spin text-[#5a8fc7]" size={16} />
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

      {/* Fixed Bottom Input Area - Pill Shaped Glassmorphism */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          {/* Pill Container */}
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full shadow-2xl shadow-black/50 p-3">
            {/* Type Selection Pills */}
            <div className="flex gap-2 mb-3 px-3">
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

            {/* Input Box */}
            <div className="flex gap-3 items-center px-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder={
                  selectedType === 'music'
                    ? 'Describe your track...'
                    : selectedType === 'image'
                    ? 'Describe your cover art...'
                    : 'Coming soon...'
                }
                disabled={isGenerating || selectedType === 'video'}
                className="flex-1 px-0 py-3 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !input.trim() || selectedType === 'video'}
                className="p-3 bg-[#2d4a6e] hover:bg-[#3d5a7e] rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#2d4a6e] flex items-center justify-center"
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin text-white" size={20} />
                ) : (
                  <Send size={20} className="text-white" />
                )}
              </button>
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-500 px-3">
              <span className="text-[#5a8fc7]">2 credits for music</span>
              <span>•</span>
              <span className="text-[#5a8fc7]">1 credit for images</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
