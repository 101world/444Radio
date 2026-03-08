'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import {
  Send, Loader2, Settings, Trash2, Plus, ChevronDown,
  MessageSquare, Bot, User as UserIcon, Sparkles, Volume2, Music,
  Mic, Scissors, Zap, Image as ImageIcon, Film, Copy, Check,
  RefreshCw, ArrowDown, Paperclip, X, Crown, Wrench,
  FileAudio, FileVideo, FileImage
} from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'
import dynamic from 'next/dynamic'

// Lazy-load heavy components
const ChessGame = dynamic(() => import('@/app/components/ChessGame'), { ssr: false })
const ProducerToolsPanel = dynamic(() => import('@/app/components/ProducerToolsPanel'), { ssr: false })

// ─── Types ──────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  creditCost?: number
  isStreaming?: boolean
  attachments?: MediaAttachment[]
}

interface MediaAttachment {
  type: 'image' | 'audio' | 'video'
  url: string
  name: string
  size: number
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
}

interface AssistantSettings {
  temperature: number
  top_p: number
  max_output_tokens: number
  thinking_level: 'low' | 'medium' | 'high'
}

const DEFAULT_SETTINGS: AssistantSettings = {
  temperature: 1,
  top_p: 0.95,
  max_output_tokens: 2048,
  thinking_level: 'low',
}

const STORAGE_KEY = '444radio_assistant_sessions'
const SETTINGS_KEY = '444radio_assistant_settings'

// ─── Quick prompts ──────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: Music, label: 'Help me write a song', prompt: 'Help me write a song. I want to create something unique. Can you guide me through the process on 444 Radio?', color: 'from-violet-500/20 to-indigo-500/10 border-violet-500/20 hover:border-violet-400/40' },
  { icon: Volume2, label: 'Mix & master tips', prompt: 'Give me professional mixing and mastering tips for my track. What settings should I use with 444\'s Audio Boost?', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20 hover:border-emerald-400/40' },
  { icon: Mic, label: 'Vocal production', prompt: 'I want to record and process vocals. What\'s the best workflow using 444 Radio\'s tools like Autotune and Voice Labs?', color: 'from-pink-500/20 to-rose-500/10 border-pink-500/20 hover:border-pink-400/40' },
  { icon: Sparkles, label: 'Prompt engineering', prompt: 'Teach me how to craft the best prompts for 444\'s music generation engine to get professional results.', color: 'from-amber-500/20 to-orange-500/10 border-amber-500/20 hover:border-amber-400/40' },
  { icon: Scissors, label: 'Stem splitting guide', prompt: 'How do I use 444\'s stem splitting to separate vocals, drums, bass and other instruments from a track?', color: 'from-cyan-500/20 to-sky-500/10 border-cyan-500/20 hover:border-cyan-400/40' },
  { icon: Zap, label: 'Credit optimization', prompt: 'How can I make the most of my credits on 444 Radio? What\'s the most efficient workflow?', color: 'from-yellow-500/20 to-lime-500/10 border-yellow-500/20 hover:border-yellow-400/40' },
]

// ═══════════════════════════════════════════════════════════════
//  444 ASSISTANT PAGE
// ═══════════════════════════════════════════════════════════════
export default function AssistantPage() {
  const { user } = useUser()
  const { totalCredits, refreshCredits } = useCredits()

  // ── State ──
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSessions, setShowSessions] = useState(false)
  const [settings, setSettings] = useState<AssistantSettings>(DEFAULT_SETTINGS)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // ── Media attachments ──
  const [pendingAttachments, setPendingAttachments] = useState<MediaAttachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Tools ──
  const [showChess, setShowChess] = useState(false)
  const [showProducerTools, setShowProducerTools] = useState(false)
  const [activeChessGameId, setActiveChessGameId] = useState<string | null>(null)

  // ── Auto-open chess from URL param (e.g. /assistant?chess=gameId) ──
  const searchParams = useSearchParams()
  useEffect(() => {
    const chessParam = searchParams.get('chess')
    if (chessParam) {
      setActiveChessGameId(chessParam)
      setShowChess(true)
    }
  }, [searchParams])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Load from localStorage ──
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEY)
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions) as ChatSession[]
        setSessions(parsed.map(s => ({
          ...s,
          createdAt: new Date(s.createdAt),
          messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        })))
        if (parsed.length > 0) setActiveSessionId(parsed[0].id)
      }
      const savedSettings = localStorage.getItem(SETTINGS_KEY)
      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) })
    } catch {}
  }, [])

  // ── Persist sessions ──
  useEffect(() => {
    if (sessions.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  }, [sessions])

  // ── Persist settings ──
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // ── Auto-scroll ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [sessions, activeSessionId, scrollToBottom])

  // ── Scroll detection ──
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
  }, [])

  // ── Active session ──
  const activeSession = sessions.find(s => s.id === activeSessionId) || null

  // ── Create new session ──
  const createSession = useCallback(() => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setInput('')
    setPendingAttachments([])
    setShowSessions(false)
    inputRef.current?.focus()
  }, [])

  // ── Delete session ──
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId)
      if (activeSessionId === sessionId) setActiveSessionId(updated[0]?.id || null)
      if (updated.length === 0) localStorage.removeItem(STORAGE_KEY)
      return updated
    })
  }, [activeSessionId])

  // ── Copy message ──
  const copyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // ── File upload handler ──
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newAttachments: MediaAttachment[] = []

    for (const file of Array.from(files)) {
      let type: 'image' | 'audio' | 'video'
      if (file.type.startsWith('image/')) type = 'image'
      else if (file.type.startsWith('audio/')) type = 'audio'
      else if (file.type.startsWith('video/')) type = 'video'
      else continue

      const maxSize = type === 'image' ? 7 * 1024 * 1024 : 50 * 1024 * 1024
      if (file.size > maxSize) {
        alert(`${file.name} is too large. Max ${type === 'image' ? '7MB' : '50MB'}.`)
        continue
      }

      try {
        // Upload to R2 via upload endpoint
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', type === 'audio' ? 'audio-files' : type === 'video' ? 'videos' : 'images')

        const res = await fetch('/api/upload/assistant-media', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          newAttachments.push({ type, url: data.url, name: file.name, size: file.size })
        }
      } catch {
        // Upload failed silently — could add toast
      }
    }

    setPendingAttachments(prev => [...prev, ...newAttachments])
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeAttachment = useCallback((idx: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // ── Send message ──
  const sendMessage = useCallback(async (overridePrompt?: string) => {
    const text = (overridePrompt || input).trim()
    if (!text || isLoading) return

    let sessionId = activeSessionId
    let currentSessions = sessions

    if (!sessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: text.substring(0, 40) + (text.length > 40 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
      }
      currentSessions = [newSession, ...sessions]
      setSessions(currentSessions)
      sessionId = newSession.id
      setActiveSessionId(sessionId)
    }

    const attachments = [...pendingAttachments]

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined,
    }

    const assistantMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setSessions(prev =>
      prev.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            title: s.messages.length === 0 ? text.substring(0, 40) + (text.length > 40 ? '...' : '') : s.title,
            messages: [...s.messages, userMessage, assistantMessage],
          }
        }
        return s
      })
    )

    setInput('')
    setPendingAttachments([])
    setIsLoading(true)

    try {
      const session = currentSessions.find(s => s.id === sessionId)
      const history = [...(session?.messages || []), userMessage]
        .filter(m => !m.isStreaming)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const requestBody: Record<string, any> = {
        messages: history,
        settings: {
          temperature: settings.temperature,
          top_p: settings.top_p,
          max_output_tokens: settings.max_output_tokens,
          thinking_level: settings.thinking_level,
        },
      }

      // Add media
      const imageUrls = attachments.filter(a => a.type === 'image').map(a => a.url)
      const audioUrl = attachments.find(a => a.type === 'audio')?.url
      const videoUrls = attachments.filter(a => a.type === 'video').map(a => a.url)
      if (imageUrls.length > 0) requestBody.images = imageUrls
      if (audioUrl) requestBody.audio = audioUrl
      if (videoUrls.length > 0) requestBody.videos = videoUrls

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to get response from 444')

      setSessions(prev =>
        prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: data.message, isStreaming: false, creditCost: data.creditCost }
                  : m
              ),
            }
          }
          return s
        })
      )
      refreshCredits()
    } catch (err: any) {
      setSessions(prev =>
        prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: `⚠️ ${err.message || 'Something went wrong. Please try again.'}`, isStreaming: false }
                  : m
              ),
            }
          }
          return s
        })
      )
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, activeSessionId, sessions, settings, refreshCredits, pendingAttachments])

  // ── Retry ──
  const retryLast = useCallback(() => {
    if (!activeSession || activeSession.messages.length < 2) return
    const lastUserMsg = [...activeSession.messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          const msgs = [...s.messages]
          if (msgs.length >= 2) msgs.splice(-2)
          return { ...s, messages: msgs }
        }
        return s
      })
    )
    setTimeout(() => sendMessage(lastUserMsg.content), 100)
  }, [activeSession, activeSessionId, sendMessage])

  // ── Keyboard ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Render markdown ──
  const renderContent = (text: string) => {
    if (!text) return null
    const lines = text.split('\n')
    const elements: React.ReactElement[] = []
    let inCodeBlock = false
    let codeContent = ''

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code_${i}`} className="bg-black/40 border border-white/[0.06] rounded-xl p-3 my-2 overflow-x-auto text-xs font-mono text-emerald-300/80">
              <code>{codeContent}</code>
            </pre>
          )
          codeContent = ''
          inCodeBlock = false
        } else { inCodeBlock = true }
        return
      }
      if (inCodeBlock) { codeContent += (codeContent ? '\n' : '') + line; return }
      if (line.startsWith('### ')) { elements.push(<h3 key={i} className="text-sm font-bold text-white/90 mt-3 mb-1">{processInline(line.slice(4))}</h3>); return }
      if (line.startsWith('## ')) { elements.push(<h2 key={i} className="text-base font-bold text-white/90 mt-3 mb-1">{processInline(line.slice(3))}</h2>); return }
      if (line.startsWith('# ')) { elements.push(<h1 key={i} className="text-lg font-bold text-white mt-3 mb-1">{processInline(line.slice(2))}</h1>); return }
      if (line.match(/^\s*[-*]\s/)) {
        elements.push(
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-white/25 mt-0.5 flex-shrink-0">•</span>
            <span>{processInline(line.replace(/^\s*[-*]\s/, ''))}</span>
          </div>
        )
        return
      }
      if (line.match(/^\s*\d+\.\s/)) {
        const num = line.match(/^\s*(\d+)\./)?.[1]
        elements.push(
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-white/35 font-bold flex-shrink-0 min-w-[1.2em] text-right">{num}.</span>
            <span>{processInline(line.replace(/^\s*\d+\.\s/, ''))}</span>
          </div>
        )
        return
      }
      if (!line.trim()) { elements.push(<div key={i} className="h-2" />); return }
      elements.push(<p key={i} className="my-0.5">{processInline(line)}</p>)
    })
    if (inCodeBlock && codeContent) {
      elements.push(
        <pre key="code_end" className="bg-black/40 border border-white/[0.06] rounded-xl p-3 my-2 overflow-x-auto text-xs font-mono text-emerald-300/80">
          <code>{codeContent}</code>
        </pre>
      )
    }
    return <>{elements}</>
  }

  const processInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0
    while (remaining.length > 0) {
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/)
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={key++}>{processInline(codeMatch[1])}</span>)
        parts.push(<code key={key++} className="bg-white/[0.08] text-white/80 px-1.5 py-0.5 rounded text-xs font-mono">{codeMatch[2]}</code>)
        remaining = codeMatch[3]; continue
      }
      const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/)
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>)
        parts.push(<strong key={key++} className="text-white font-semibold">{boldMatch[2]}</strong>)
        remaining = boldMatch[3]; continue
      }
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
    return <>{parts}</>
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // ─── RENDER ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex md:pl-14">
      {/* Ambient Glow Overlays — matches Create page */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[120px] bg-cyan-500/[0.03]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[100px] bg-teal-500/[0.025]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[150px] bg-cyan-400/[0.015]" />
      </div>

      {/* ══ Sessions Sidebar (DESKTOP) ══ */}
      <div className="hidden lg:flex flex-col w-60 border-r border-white/[0.06] bg-black/80 backdrop-blur-xl relative z-10">
        <div className="p-3 border-b border-white/[0.06]">
          <button
            onClick={createSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:text-white transition-all text-sm font-medium"
          >
            <Plus size={15} /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <div className="text-center text-white/20 text-xs mt-6 px-3">No conversations yet.</div>
          )}
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => { setActiveSessionId(session.id); setShowSessions(false) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all group flex items-center gap-2 ${
                session.id === activeSessionId
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
              }`}
            >
              <MessageSquare size={11} className="flex-shrink-0 opacity-40" />
              <span className="flex-1 truncate">{session.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
              >
                <Trash2 size={10} className="text-red-400" />
              </button>
            </button>
          ))}
        </div>

        {/* Tools + Credits */}
        <div className="p-3 border-t border-white/[0.06] space-y-2">
          <div className="flex gap-1.5">
            <button onClick={() => setShowProducerTools(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all text-[10px] font-medium">
              <Wrench size={11} /> Tools
            </button>
            <button onClick={() => setShowChess(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all text-[10px] font-medium">
              <Crown size={11} /> Chess
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs px-1">
            <Zap size={11} className="text-white/30" />
            <span className="text-white/30">Credits:</span>
            <span className="text-white/60 font-semibold">{totalCredits}</span>
          </div>
          <div className="text-[9px] text-white/15 px-1">1 credit per message</div>
        </div>
      </div>

      {/* ══ Main Chat Area ══ */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* ── Header ── */}
        <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => setShowSessions(!showSessions)} className="lg:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors">
            <MessageSquare size={17} className="text-white/40" />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-white/70" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white/90 truncate">444 Assistant</h1>
              <p className="text-[10px] text-white/25 truncate">AI Music Production Expert</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Zap size={10} className="text-white/30" />
            <span className="text-xs font-semibold text-white/50">{totalCredits}</span>
          </div>

          <div className="flex items-center gap-0.5">
            <button onClick={() => setShowProducerTools(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/50" title="Producer Tools">
              <Wrench size={15} />
            </button>
            <button onClick={() => setShowChess(true)} className="lg:hidden p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/50" title="Chess">
              <Crown size={15} />
            </button>
            <button onClick={createSession} className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/50" title="New Chat">
              <Plus size={15} />
            </button>
            <button onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white/10 text-white/70' : 'text-white/30 hover:bg-white/[0.06] hover:text-white/50'}`}
              title="Settings">
              <Settings size={15} />
            </button>
          </div>
        </header>

        {/* ── Mobile sessions drawer ── */}
        {showSessions && (
          <div className="lg:hidden absolute inset-0 z-30 bg-black/98 backdrop-blur-xl flex flex-col">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/70">Chat History</h2>
              <button onClick={() => setShowSessions(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-3">
              <button onClick={createSession} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60 text-sm font-medium">
                <Plus size={15} /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => { setActiveSessionId(session.id); setShowSessions(false) }}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    session.id === activeSessionId ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:bg-white/[0.04]'
                  }`}
                >
                  <MessageSquare size={13} className="flex-shrink-0 opacity-40" />
                  <span className="flex-1 truncate">{session.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Settings panel ── */}
        {showSettings && (
          <div className="bg-black/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-4">
            <div className="max-w-2xl mx-auto space-y-4">
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Model Settings</h3>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Temperature</span>
                  <span className="text-white/70 font-mono text-[11px]">{settings.temperature.toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="2" step="0.05" value={settings.temperature}
                  onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70" />
                <p className="text-[10px] text-white/20">Lower = focused, Higher = creative (0–2)</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Top P</span>
                  <span className="text-white/70 font-mono text-[11px]">{settings.top_p.toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={settings.top_p}
                  onChange={e => setSettings(s => ({ ...s, top_p: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70" />
                <p className="text-[10px] text-white/20">Nucleus sampling threshold (0–1)</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Max Output Tokens</span>
                  <span className="text-white/70 font-mono text-[11px]">{settings.max_output_tokens.toLocaleString()}</span>
                </div>
                <input type="range" min="256" max="65535" step="256" value={settings.max_output_tokens}
                  onChange={e => setSettings(s => ({ ...s, max_output_tokens: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70" />
                <p className="text-[10px] text-white/20">Maximum response length (256–65,535)</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-white/50">Thinking Level</span>
                <div className="flex gap-1.5">
                  {(['low', 'medium', 'high'] as const).map(level => (
                    <button key={level} onClick={() => setSettings(s => ({ ...s, thinking_level: level }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        settings.thinking_level === level
                          ? 'bg-white/10 border border-white/20 text-white'
                          : 'bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/60'
                      }`}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/20">Depth of reasoning — higher = slower but more thorough</p>
              </div>

              <button onClick={() => setSettings(DEFAULT_SETTINGS)} className="text-xs text-white/25 hover:text-white/50 transition-colors">
                Reset to defaults
              </button>
            </div>
          </div>
        )}

        {/* ── Chat messages ── */}
        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-[60vh]">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-5">
                <Bot size={28} className="text-white/50" />
              </div>
              <h2 className="text-lg font-semibold text-white/80 mb-1">444 Assistant</h2>
              <p className="text-sm text-white/25 mb-8 text-center max-w-md">
                Ask anything about music production, mixing, mastering, or 444 Radio. Attach images, audio, or video.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {QUICK_PROMPTS.map((qp, i) => {
                  const Icon = qp.icon
                  return (
                    <button key={i} onClick={() => sendMessage(qp.prompt)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${qp.color} border transition-all text-left group`}>
                      <Icon size={15} className="text-white/40 group-hover:text-white/60 flex-shrink-0 transition-colors" />
                      <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors">{qp.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 flex items-center gap-4 text-[10px] text-white/15">
                <span className="flex items-center gap-1"><FileImage size={10} /> Images</span>
                <span className="flex items-center gap-1"><FileAudio size={10} /> Audio</span>
                <span className="flex items-center gap-1"><FileVideo size={10} /> Video</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Zap size={8} /> 1 credit/msg</span>
              </div>
            </div>
          )}

          {activeSession && activeSession.messages.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {activeSession.messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot size={13} className="text-white/50" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-white/[0.08] border border-white/[0.08] text-white/90'
                      : 'bg-transparent text-white/80'
                  }`}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[10px]">
                            {att.type === 'image' ? <FileImage size={10} className="text-blue-400/70" /> :
                             att.type === 'audio' ? <FileAudio size={10} className="text-emerald-400/70" /> :
                             <FileVideo size={10} className="text-purple-400/70" />}
                            <span className="text-white/40 truncate max-w-[120px]">{att.name}</span>
                            <span className="text-white/20">{formatSize(att.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm leading-relaxed">
                      {msg.isStreaming ? (
                        <div className="flex items-center gap-2 text-white/30">
                          <Loader2 size={13} className="animate-spin" />
                          <span className="text-xs">444 is thinking...</span>
                        </div>
                      ) : renderContent(msg.content)}
                    </div>

                    {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                        <button onClick={() => copyMessage(msg.id, msg.content)} className="text-white/15 hover:text-white/40 transition-colors p-1" title="Copy">
                          {copiedId === msg.id ? <Check size={11} className="text-emerald-400/70" /> : <Copy size={11} />}
                        </button>
                        {msg.creditCost !== undefined && (
                          <span className="text-[10px] text-white/10 ml-auto">-{msg.creditCost} credit</span>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <UserIcon size={13} className="text-white/40" />
                    </div>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />

              {activeSession.messages.length >= 2 && !isLoading &&
                activeSession.messages[activeSession.messages.length - 1]?.role === 'assistant' &&
                activeSession.messages[activeSession.messages.length - 1]?.content?.startsWith('⚠️') && (
                  <div className="flex justify-center">
                    <button onClick={retryLast} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all text-xs text-white/40 hover:text-white/60">
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {showScrollBtn && (
          <button onClick={scrollToBottom} className="absolute bottom-28 right-4 p-2 rounded-full bg-white/[0.08] border border-white/[0.1] text-white/40 hover:bg-white/[0.12] transition-all">
            <ArrowDown size={14} />
          </button>
        )}

        {/* ── Input area ── */}
        <div className="sticky bottom-0 bg-black/90 backdrop-blur-xl border-t border-white/[0.06] px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[10px]">
                    {att.type === 'image' ? <FileImage size={10} className="text-blue-400/70" /> :
                     att.type === 'audio' ? <FileAudio size={10} className="text-emerald-400/70" /> :
                     <FileVideo size={10} className="text-purple-400/70" />}
                    <span className="text-white/50 truncate max-w-[100px]">{att.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-white/20 hover:text-red-400/70 transition-colors"><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-all flex-shrink-0"
                title="Attach image, audio, or video">
                {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*" multiple onChange={handleFileSelect} className="hidden" />

              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask 444 anything about music production..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 pr-12 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-white/15 resize-none transition-all"
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                  }}
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
                  className={`absolute right-2 bottom-2 p-2 rounded-xl transition-all ${
                    input.trim() && !isLoading
                      ? 'bg-white/90 text-black hover:bg-white'
                      : 'bg-white/[0.05] text-white/15 cursor-not-allowed'
                  }`}>
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-white/15">Shift+Enter for new line · Enter to send</span>
              <span className="text-[10px] text-white/15 flex items-center gap-1"><Zap size={7} /> {totalCredits} credits</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Tool Overlays ═══ */}
      {showChess && <ChessGame isOpen={showChess} onClose={() => { setShowChess(false); setActiveChessGameId(null); }} currentUserId={user?.id} activeGameId={activeChessGameId ?? undefined} />}
      {showProducerTools && <ProducerToolsPanel isOpen={showProducerTools} onClose={() => setShowProducerTools(false)} />}
    </div>
  )
}
