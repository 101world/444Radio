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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-purple-950 text-white flex flex-col">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/20 border-b border-purple-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-black font-bold text-lg">🎵</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">444RADIO</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/library" className="px-4 py-2 text-purple-400 hover:text-purple-300">Library</Link>
          <Link href="/explore" className="px-4 py-2 text-purple-400 hover:text-purple-300">Explore</Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : message.type === 'assistant'
                    ? 'bg-slate-800/50 border border-slate-700'
                    : 'bg-slate-900/50 border border-purple-500/30'
                }`}
              >
                {/* Message Content */}
                <p className="text-sm mb-2">{message.content}</p>

                {/* Music Generation Result */}
                {message.result?.audioUrl && (
                  <div className="mt-4 bg-black/30 rounded-xl p-4 border border-purple-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-bold text-purple-400">{message.result.title}</h4>
                        <p className="text-xs text-slate-400">{message.result.prompt}</p>
                      </div>
                      <button
                        onClick={() => handlePlayPause(message.id, message.result!.audioUrl!)}
                        className="p-3 bg-purple-500 hover:bg-purple-600 rounded-full transition-colors"
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
                        <summary className="text-xs text-purple-400 cursor-pointer hover:text-purple-300">
                          View Lyrics
                        </summary>
                        <pre className="text-xs text-slate-300 mt-2 whitespace-pre-wrap">
                          {message.result.lyrics}
                        </pre>
                      </details>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleDownload(message.result!.audioUrl!, `${message.result!.title}.mp3`)}
                        className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs flex items-center justify-center gap-2"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <Link
                        href="/library"
                        className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-xs flex items-center justify-center gap-2"
                      >
                        <Layers size={14} />
                        View in Library
                      </Link>
                    </div>
                  </div>
                )}

                {/* Image Generation Result */}
                {message.result?.imageUrl && (
                  <div className="mt-4 bg-black/30 rounded-xl overflow-hidden border border-purple-500/20">
                    <img
                      src={message.result.imageUrl}
                      alt={message.result.title}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-4">
                      <h4 className="font-bold text-purple-400 mb-1">{message.result.title}</h4>
                      <p className="text-xs text-slate-400 mb-3">{message.result.prompt}</p>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(message.result!.imageUrl!, `${message.result!.title}.webp`)}
                          className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs flex items-center justify-center gap-2"
                        >
                          <Download size={14} />
                          Download
                        </button>
                        <Link
                          href="/library"
                          className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-xs flex items-center justify-center gap-2"
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
                    <Loader2 className="animate-spin" size={16} />
                    <span className="text-xs text-slate-400">Generating...</span>
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-xs text-slate-500 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-purple-500/20 bg-black/40 backdrop-blur-xl p-4">
        <div className="max-w-4xl mx-auto">
          {/* Type Selection */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSelectedType('music')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                selectedType === 'music'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-black scale-105'
                  : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:border-green-500/60'
              }`}
            >
              <Music size={16} />
              Music
            </button>
            <button
              onClick={() => setSelectedType('image')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                selectedType === 'image'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black scale-105'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60'
              }`}
            >
              <ImageIcon size={16} />
              Cover Art
            </button>
            <button
              onClick={() => setSelectedType('video')}
              disabled
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-700/30 text-slate-500 border border-slate-700/30 cursor-not-allowed flex items-center gap-2"
            >
              <Video size={16} />
              Video (Soon)
            </button>
          </div>

          {/* Input Box */}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder={
                selectedType === 'music'
                  ? 'Describe your track... (e.g., "upbeat electronic dance music with heavy bass")'
                  : selectedType === 'image'
                  ? 'Describe your cover art... (e.g., "cyberpunk album cover with neon lights")'
                  : 'Coming soon...'
              }
              disabled={isGenerating || selectedType === 'video'}
              className="flex-1 px-4 py-3 bg-slate-900/50 border border-purple-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !input.trim() || selectedType === 'video'}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Generating...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Generate
                </>
              )}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-3 text-xs text-slate-400">
            <Link href="/library" className="hover:text-purple-400">View Library</Link>
            <span>•</span>
            <Link href="/explore" className="hover:text-purple-400">Browse Explore</Link>
            <span>•</span>
            <span className="text-yellow-400">2 credits for music • 1 credit for images</span>
          </div>
        </div>
      </div>
    </div>
  )
}
