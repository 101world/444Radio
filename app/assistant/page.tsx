'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  Send, Loader2, Settings, Trash2, Plus, ChevronDown, ChevronUp,
  MessageSquare, Bot, User as UserIcon, Sparkles, Volume2, Music,
  Mic, Scissors, Zap, Image as ImageIcon, Film, Copy, Check,
  RefreshCw, ArrowDown
} from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'

// ─── Types ──────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  creditCost?: number
  isStreaming?: boolean
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
  top_k: number
  max_tokens: number
  thinking: boolean
}

const DEFAULT_SETTINGS: AssistantSettings = {
  temperature: 0.7,
  top_p: 0.95,
  top_k: 64,
  max_tokens: 4096,
  thinking: false,
}

const STORAGE_KEY = '444radio_assistant_sessions'
const SETTINGS_KEY = '444radio_assistant_settings'

// ─── Quick prompts ──────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: Music, label: 'Help me write a song', prompt: 'Help me write a song. I want to create something unique. Can you guide me through the process on 444 Radio?' },
  { icon: Volume2, label: 'Mix & master tips', prompt: 'Give me professional mixing and mastering tips for my track. What settings should I use with 444\'s Audio Boost?' },
  { icon: Mic, label: 'Vocal production', prompt: 'I want to record and process vocals. What\'s the best workflow using 444 Radio\'s tools like Autotune and Voice to Melody?' },
  { icon: Sparkles, label: 'Prompt engineering', prompt: 'Teach me how to craft the best prompts for 444\'s music generation engine to get professional results.' },
  { icon: Scissors, label: 'Stem splitting guide', prompt: 'How do I use 444\'s stem splitting to separate vocals, drums, bass and other instruments from a track?' },
  { icon: Zap, label: 'Credit optimization', prompt: 'How can I make the most of my credits on 444 Radio? What\'s the most efficient workflow?' },
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
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id)
        }
      }
      const savedSettings = localStorage.getItem(SETTINGS_KEY)
      if (savedSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) })
      }
    } catch {}
  }, [])

  // ── Persist sessions ──
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    }
  }, [sessions])

  // ── Persist settings ──
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // ── Auto-scroll ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [sessions, activeSessionId])

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
    setShowSessions(false)
    inputRef.current?.focus()
  }, [])

  // ── Delete session ──
  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId)
      if (activeSessionId === sessionId) {
        setActiveSessionId(updated[0]?.id || null)
      }
      if (updated.length === 0) {
        localStorage.removeItem(STORAGE_KEY)
      }
      return updated
    })
  }, [activeSessionId])

  // ── Copy message ──
  const copyMessage = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  // ── Send message ──
  const sendMessage = useCallback(async (overridePrompt?: string) => {
    const text = (overridePrompt || input).trim()
    if (!text || isLoading) return

    let sessionId = activeSessionId
    let currentSessions = sessions

    // Create session if needed
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

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const assistantMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    // Add user message + placeholder assistant message
    setSessions(prev =>
      prev.map(s => {
        if (s.id === sessionId) {
          const updatedMessages = [...s.messages, userMessage, assistantMessage]
          return {
            ...s,
            title: s.messages.length === 0 ? text.substring(0, 40) + (text.length > 40 ? '...' : '') : s.title,
            messages: updatedMessages,
          }
        }
        return s
      })
    )

    setInput('')
    setIsLoading(true)

    try {
      // Build message history (last 20 messages for context window)
      const session = currentSessions.find(s => s.id === sessionId)
      const history = [...(session?.messages || []), userMessage]
        .filter(m => !m.isStreaming)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          settings,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response from 444')
      }

      // Update assistant message with real content
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

      // Refresh credits
      refreshCredits()
    } catch (err: any) {
      // Update assistant message with error
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
  }, [input, isLoading, activeSessionId, sessions, settings, refreshCredits])

  // ── Retry last message ──
  const retryLast = useCallback(() => {
    if (!activeSession || activeSession.messages.length < 2) return
    // Find last user message
    const lastUserMsg = [...activeSession.messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    // Remove last assistant message
    setSessions(prev =>
      prev.map(s => {
        if (s.id === activeSessionId) {
          const msgs = [...s.messages]
          // Remove last 2 messages (user + assistant)
          if (msgs.length >= 2) msgs.splice(-2)
          return { ...s, messages: msgs }
        }
        return s
      })
    )
    // Re-send
    setTimeout(() => sendMessage(lastUserMsg.content), 100)
  }, [activeSession, activeSessionId, sendMessage])

  // ── Keyboard shortcut ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render markdown-lite ──
  const renderContent = (text: string) => {
    if (!text) return null
    // Simple markdown: bold, code blocks, inline code, headers, lists
    const lines = text.split('\n')
    const elements: React.ReactElement[] = []
    let inCodeBlock = false
    let codeContent = ''
    let codeLang = ''

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code_${i}`} className="bg-black/60 border border-cyan-500/20 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-cyan-200">
              <code>{codeContent}</code>
            </pre>
          )
          codeContent = ''
          codeLang = ''
          inCodeBlock = false
        } else {
          inCodeBlock = true
          codeLang = line.slice(3).trim()
        }
        return
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line
        return
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-sm font-bold text-cyan-300 mt-3 mb-1">{processInline(line.slice(4))}</h3>)
        return
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-base font-bold text-cyan-200 mt-3 mb-1">{processInline(line.slice(3))}</h2>)
        return
      }
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-lg font-bold text-white mt-3 mb-1">{processInline(line.slice(2))}</h1>)
        return
      }

      // Bullet lists
      if (line.match(/^\s*[-*]\s/)) {
        elements.push(
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-cyan-500 mt-0.5 flex-shrink-0">•</span>
            <span>{processInline(line.replace(/^\s*[-*]\s/, ''))}</span>
          </div>
        )
        return
      }

      // Numbered lists
      if (line.match(/^\s*\d+\.\s/)) {
        const num = line.match(/^\s*(\d+)\./)?.[1]
        elements.push(
          <div key={i} className="flex gap-2 ml-2 my-0.5">
            <span className="text-cyan-400 font-bold flex-shrink-0 min-w-[1.2em] text-right">{num}.</span>
            <span>{processInline(line.replace(/^\s*\d+\.\s/, ''))}</span>
          </div>
        )
        return
      }

      // Empty lines
      if (!line.trim()) {
        elements.push(<div key={i} className="h-2" />)
        return
      }

      // Regular text
      elements.push(<p key={i} className="my-0.5">{processInline(line)}</p>)
    })

    // Close any unclosed code block
    if (inCodeBlock && codeContent) {
      elements.push(
        <pre key="code_end" className="bg-black/60 border border-cyan-500/20 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-cyan-200">
          <code>{codeContent}</code>
        </pre>
      )
    }

    return <>{elements}</>
  }

  // Process inline markdown (bold, italic, code, links)
  const processInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let key = 0

    while (remaining.length > 0) {
      // Inline code
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/)
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={key++}>{processInline(codeMatch[1])}</span>)
        parts.push(<code key={key++} className="bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded text-xs font-mono">{codeMatch[2]}</code>)
        remaining = codeMatch[3]
        continue
      }

      // Bold
      const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/)
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>)
        parts.push(<strong key={key++} className="text-white font-semibold">{boldMatch[2]}</strong>)
        remaining = boldMatch[3]
        continue
      }

      // Just text
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }

    return <>{parts}</>
  }

  // ─── RENDER ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* ══ Sessions Sidebar (DESKTOP) ══ */}
      <div className={`hidden lg:flex flex-col w-64 border-r border-cyan-500/10 bg-black/80 ${showSessions ? '' : ''}`}>
        {/* New chat button */}
        <div className="p-3 border-b border-cyan-500/10">
          <button
            onClick={createSession}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/30 hover:to-cyan-400/20 transition-all text-sm font-semibold"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-center text-white/30 text-xs mt-6 px-3">
              No conversations yet.<br />Start a new chat to begin.
            </div>
          )}
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => { setActiveSessionId(session.id); setShowSessions(false) }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all group flex items-center gap-2 ${
                session.id === activeSessionId
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80 border border-transparent'
              }`}
            >
              <MessageSquare size={12} className="flex-shrink-0 opacity-50" />
              <span className="flex-1 truncate">{session.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                title="Delete"
              >
                <Trash2 size={10} className="text-red-400" />
              </button>
            </button>
          ))}
        </div>

        {/* Credits display */}
        <div className="p-3 border-t border-cyan-500/10">
          <div className="flex items-center gap-2 text-xs">
            <Zap size={12} className="text-cyan-400" />
            <span className="text-white/60">Credits:</span>
            <span className="text-cyan-300 font-bold">{totalCredits}</span>
          </div>
          <div className="text-[9px] text-white/30 mt-1">0.1 credit per message</div>
        </div>
      </div>

      {/* ══ Main Chat Area ══ */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* ── Header ── */}
        <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl border-b border-cyan-500/10 px-4 py-3 flex items-center gap-3">
          {/* Mobile sessions toggle */}
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <MessageSquare size={18} className="text-cyan-400" />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0">
              <Bot size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate">444 Assistant</h1>
              <p className="text-[10px] text-cyan-400/60 truncate">AI Music Production Expert</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={createSession}
              className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors text-cyan-400/60 hover:text-cyan-400"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/40 hover:bg-white/10 hover:text-white/60'}`}
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {/* ── Mobile sessions drawer ── */}
        {showSessions && (
          <div className="lg:hidden absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex flex-col">
            <div className="p-4 border-b border-cyan-500/10 flex items-center justify-between">
              <h2 className="text-sm font-bold text-cyan-300">Chat History</h2>
              <button onClick={() => setShowSessions(false)} className="text-white/40 hover:text-white">
                <ChevronDown size={18} />
              </button>
            </div>
            <div className="p-3">
              <button
                onClick={createSession}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-semibold"
              >
                <Plus size={16} />
                New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => { setActiveSessionId(session.id); setShowSessions(false) }}
                  className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    session.id === activeSessionId
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'text-white/60 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <MessageSquare size={14} className="flex-shrink-0 opacity-50" />
                  <span className="flex-1 truncate">{session.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Settings panel ── */}
        {showSettings && (
          <div className="bg-black/90 backdrop-blur-xl border-b border-cyan-500/10 px-4 py-4">
            <div className="max-w-2xl mx-auto space-y-4">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Generation Settings</h3>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Temperature</span>
                  <span className="text-cyan-300 font-mono">{settings.temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="2" step="0.05"
                  value={settings.temperature}
                  onChange={e => setSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[10px] text-white/30">Lower = more focused, Higher = more creative</p>
              </div>

              {/* Top-P */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Top P</span>
                  <span className="text-cyan-300 font-mono">{settings.top_p.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={settings.top_p}
                  onChange={e => setSettings(s => ({ ...s, top_p: parseFloat(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[10px] text-white/30">Nucleus sampling threshold</p>
              </div>

              {/* Top-K */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Top K</span>
                  <span className="text-cyan-300 font-mono">{settings.top_k}</span>
                </div>
                <input
                  type="range" min="1" max="128" step="1"
                  value={settings.top_k}
                  onChange={e => setSettings(s => ({ ...s, top_k: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[10px] text-white/30">Top K tokens to sample from</p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Max Tokens</span>
                  <span className="text-cyan-300 font-mono">{settings.max_tokens}</span>
                </div>
                <input
                  type="range" min="256" max="8192" step="256"
                  value={settings.max_tokens}
                  onChange={e => setSettings(s => ({ ...s, max_tokens: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <p className="text-[10px] text-white/30">Maximum response length</p>
              </div>

              {/* Thinking */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSettings(s => ({ ...s, thinking: !s.thinking }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    settings.thinking ? 'bg-cyan-500' : 'bg-white/20'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.thinking ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
                <div>
                  <span className="text-xs text-white/60">Extended Thinking</span>
                  <p className="text-[10px] text-white/30">Enable deep reasoning mode (slower but more thorough)</p>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={() => setSettings(DEFAULT_SETTINGS)}
                className="text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}

        {/* ── Chat messages ── */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {/* Empty state */}
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-[60vh]">
              {/* Logo */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-800 flex items-center justify-center mb-6 shadow-2xl shadow-cyan-500/30">
                <Bot size={32} className="text-white" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">444 Assistant</h2>
              <p className="text-sm text-white/40 mb-8 text-center max-w-md">
                Your AI music production expert. Ask anything about making music, mixing, mastering, or using 444 Radio&apos;s tools.
              </p>

              {/* Quick prompts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                {QUICK_PROMPTS.map((qp, i) => {
                  const Icon = qp.icon
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(qp.prompt)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-cyan-500/[0.05] transition-all text-left group"
                    >
                      <Icon size={16} className="text-cyan-500/50 group-hover:text-cyan-400 flex-shrink-0 transition-colors" />
                      <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors">{qp.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Credit info */}
              <div className="mt-8 flex items-center gap-2 text-xs text-white/20">
                <Zap size={10} />
                <span>0.1 credit per message • {totalCredits} credits available</span>
              </div>
            </div>
          )}

          {/* Messages */}
          {activeSession && activeSession.messages.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {activeSession.messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {/* Assistant avatar */}
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-cyan-500/10">
                      <Bot size={14} className="text-white" />
                    </div>
                  )}

                  {/* Message bubble */}
                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-cyan-600/20 border border-cyan-500/20 text-white'
                      : 'bg-white/[0.03] border border-white/5 text-white/90'
                  }`}>
                    {/* Content */}
                    <div className="text-sm leading-relaxed">
                      {msg.isStreaming ? (
                        <div className="flex items-center gap-2 text-cyan-400/60">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-xs">444 is thinking...</span>
                        </div>
                      ) : (
                        renderContent(msg.content)
                      )}
                    </div>

                    {/* Actions bar */}
                    {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => copyMessage(msg.id, msg.content)}
                          className="text-white/20 hover:text-cyan-400 transition-colors p-1"
                          title="Copy"
                        >
                          {copiedId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                        </button>
                        {msg.creditCost !== undefined && (
                          <span className="text-[10px] text-white/15 ml-auto">
                            -{msg.creditCost} credit
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <UserIcon size={14} className="text-white/60" />
                    </div>
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />

              {/* Retry button (show after last failed assistant message) */}
              {activeSession.messages.length >= 2 &&
                !isLoading &&
                activeSession.messages[activeSession.messages.length - 1]?.role === 'assistant' &&
                activeSession.messages[activeSession.messages.length - 1]?.content?.startsWith('⚠️') && (
                  <div className="flex justify-center">
                    <button
                      onClick={retryLast}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all text-xs text-white/50 hover:text-cyan-300"
                    >
                      <RefreshCw size={12} />
                      Retry
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 right-4 p-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all shadow-lg"
          >
            <ArrowDown size={16} />
          </button>
        )}

        {/* ── Input area ── */}
        <div className="sticky bottom-0 bg-black/95 backdrop-blur-xl border-t border-cyan-500/10 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask 444 anything about music production..."
                  className="w-full bg-white/[0.04] border border-cyan-500/15 rounded-2xl px-4 py-3 pr-12 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 resize-none transition-all"
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className={`absolute right-2 bottom-2 p-2 rounded-xl transition-all ${
                    input.trim() && !isLoading
                      ? 'bg-cyan-500 text-white hover:bg-cyan-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>

            {/* Info bar */}
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-white/15">
                Shift+Enter for new line • Enter to send
              </span>
              <span className="text-[10px] text-white/15 flex items-center gap-1">
                <Zap size={8} className="text-cyan-500/30" />
                {totalCredits} credits
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
