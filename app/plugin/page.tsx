'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Music, Sparkles, Repeat, Image as ImageIcon, Scissors, Volume2,
  Zap, Lightbulb, X, ChevronLeft, Send
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────
interface GenerationJob {
  id: string
  type: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  prompt?: string
  result?: Record<string, unknown>
  error?: string
}

interface CreditInfo {
  credits: number
  totalGenerated: number
  costs: Record<string, number>
}

// ─── Detect JUCE host (plugin passes ?host=juce in URL) ────────
const isJuceHost =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('host') === 'juce'

// ─── Plugin Bridge (sends messages to JUCE WebView host) ───────
function sendToPlugin(action: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({ source: '444radio-plugin', action, ...data })
  try {
    // Method 1: JUCE 8+ native bridge
    if ((window as any).__juce__?.postMessage) {
      ;(window as any).__juce__.postMessage(payload)
      return
    }
    // Method 2: JUCE 7 URL scheme bridge (intercepted by pageAboutToLoad)
    if (isJuceHost) {
      window.location.href = 'juce-bridge://' + encodeURIComponent(payload)
      return
    }
    // Method 3: postMessage fallback (iframe/Electron/testing)
    window.parent?.postMessage(JSON.parse(payload), '*')
  } catch {
    /* not in plugin context */
  }
}

// ─── Quick Tags ─────────────────────────────────────────────────
const QUICK_TAGS = [
  'upbeat', 'chill', 'energetic', 'melancholic', 'ambient',
  'electronic', 'acoustic', 'jazz', 'rock', 'hip-hop',
  'heavy bass', 'soft piano', 'guitar solo', 'synthwave',
  'lo-fi beats', 'orchestral', 'dreamy', 'aggressive',
  'trap', 'drill', 'phonk', 'vaporwave', 'future bass',
  'drum & bass', 'dubstep', 'house', 'techno', 'trance',
  'indie', 'folk', 'blues', 'soul', 'funk', 'disco',
  'reggae', 'latin', 'afrobeat', 'k-pop', 'anime',
  'cinematic', 'epic', 'dark', 'bright', 'nostalgic',
  'romantic', 'sad', 'happy', 'mysterious', 'powerful',
  'soft vocals', 'no vocals', 'female vocals', 'male vocals',
  'synth lead', 'strings', 'brass', 'flute', 'violin',
]

// ─── Genre list for AI Ideas ────────────────────────────────────
const IDEA_GENRES = [
  'electronic', 'hip-hop', 'rock', 'jazz', 'ambient',
  'trap', 'drill', 'phonk', 'house', 'techno',
  'lo-fi beats', 'synthwave', 'indie', 'folk', 'blues',
  'soul', 'funk', 'reggae', 'latin', 'afrobeat',
  'orchestral', 'cinematic', 'acoustic', 'vaporwave', 'k-pop',
]

// ═══════════════════════════════════════════════════════════════
export default function PluginPage() {
  // ─── State ──────────────────────────────────────────────────
  const [token, setToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credits, setCredits] = useState<CreditInfo | null>(null)
  const [activeTab, setActiveTab] = useState<string>('music')
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [isInstrumental, setIsInstrumental] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideasView, setIdeasView] = useState<'tags' | 'type' | 'genre'>('tags')
  const [promptType, setPromptType] = useState<'song' | 'beat'>('song')

  // Form fields
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState(120)
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('medium')
  const [audioUrl, setAudioUrl] = useState('')
  const [stem, setStem] = useState('vocals')

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ─── Auth ───────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken && urlToken.startsWith('444r_')) {
      setToken(urlToken)
      verifyToken(urlToken)
      return
    }
    const saved = localStorage.getItem('444radio_plugin_token')
    if (saved) {
      setToken(saved)
      verifyToken(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verifyToken = useCallback(
    async (t: string) => {
      try {
        const res = await fetch(`${baseUrl}/api/plugin/credits`, {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (res.ok) {
          const data = await res.json()
          setCredits(data)
          setIsAuthenticated(true)
          localStorage.setItem('444radio_plugin_token', t)
          sendToPlugin('authenticated', { credits: data.credits, token: t })
        } else {
          setIsAuthenticated(false)
          setError('Invalid token. Generate one from Settings → Plugin.')
        }
      } catch {
        setError('Connection failed. Check your internet.')
      }
    },
    [baseUrl],
  )

  const refreshCredits = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setCredits(await res.json())
    } catch {}
  }, [token, baseUrl])

  // ─── Generation ─────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!token || isGenerating) return
    setIsGenerating(true)
    setError('')

    const payload: Record<string, unknown> = { type: activeTab }

    switch (activeTab) {
      case 'music':
        if (!title || title.length < 3) { setError('Title required (3+ chars)'); setIsGenerating(false); return }
        if (!prompt || prompt.length < 10) { setError('Prompt required (10+ chars)'); setIsGenerating(false); return }
        payload.title = title
        payload.prompt = prompt
        payload.instrumental = isInstrumental
        if (!isInstrumental && lyrics) payload.lyrics = lyrics
        payload.genre = genre || undefined
        payload.bpm = bpm
        payload.duration = duration
        payload.generateCoverArt = true
        break
      case 'effects':
        if (!prompt) { setError('Describe the sound effect'); setIsGenerating(false); return }
        payload.prompt = prompt
        payload.duration = 5
        break
      case 'loops':
        if (!prompt) { setError('Describe the loop'); setIsGenerating(false); return }
        payload.prompt = prompt
        payload.bpm = bpm
        payload.max_duration = 8
        payload.variations = 2
        payload.output_format = 'wav'
        break
      case 'stems':
        if (!audioUrl) { setError('Paste a track URL for stem extraction'); setIsGenerating(false); return }
        payload.audioUrl = audioUrl
        payload.stem = stem
        payload.trackTitle = title || 'Extracted'
        break
      case 'image':
        if (!prompt) { setError('Describe the image'); setIsGenerating(false); return }
        payload.prompt = prompt
        break
      case 'boost':
        if (!audioUrl) { setError('Paste a track URL to boost'); setIsGenerating(false); return }
        payload.audioUrl = audioUrl
        payload.trackTitle = title || 'Boosted'
        payload.bass_boost = 3
        payload.treble_boost = 2
        payload.volume_boost = 2
        break
    }

    const jobEntry: GenerationJob = {
      id: 'pending',
      type: activeTab,
      status: 'queued',
      prompt: prompt || audioUrl,
    }
    setJobs(prev => [jobEntry, ...prev])

    try {
      const res = await fetch(`${baseUrl}/api/plugin/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      // Parse NDJSON stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)

            if (msg.type === 'started' && msg.jobId) {
              jobEntry.id = msg.jobId
              jobEntry.status = 'processing'
              setJobs(prev => [...prev])
            }

            if (msg.type === 'result') {
              if (msg.success) {
                jobEntry.status = 'completed'
                jobEntry.result = msg
                if (msg.audioUrl) {
                  sendToPlugin('import_audio', {
                    url: msg.audioUrl,
                    title: msg.title || title || prompt,
                    type: activeTab,
                    jobId: jobEntry.id,
                  })
                }
                if (msg.stems) {
                  sendToPlugin('import_stems', {
                    stems: msg.stems,
                    title: title || 'Stems',
                    jobId: jobEntry.id,
                  })
                }
                if (msg.loops) {
                  sendToPlugin('import_loops', {
                    loops: msg.loops,
                    title: prompt,
                    bpm,
                    jobId: jobEntry.id,
                  })
                }
                if (msg.imageUrl) {
                  sendToPlugin('cover_art', { url: msg.imageUrl })
                }
                if (msg.creditsRemaining !== undefined) {
                  setCredits(prev =>
                    prev ? { ...prev, credits: msg.creditsRemaining } : prev,
                  )
                }
              } else {
                jobEntry.status = 'failed'
                jobEntry.error = msg.error
                setError(msg.error || 'Generation failed')
              }
              setJobs(prev => [...prev])
            }
          } catch {
            /* bad JSON line */
          }
        }
      }
    } catch (err: any) {
      jobEntry.status = 'failed'
      jobEntry.error = err.message
      setError(err.message)
      setJobs(prev => [...prev])
    } finally {
      setIsGenerating(false)
      refreshCredits()
    }
  }, [token, isGenerating, activeTab, title, prompt, lyrics, genre, bpm, duration, audioUrl, stem, isInstrumental, baseUrl, refreshCredits])

  // ─── Helpers ────────────────────────────────────────────────
  const addTag = (tag: string) =>
    setPrompt(prev => (prev ? `${prev}, ${tag}` : tag))

  const generateIdea = (selectedGenre: string) => {
    const moods = ['dark', 'uplifting', 'chill', 'energetic', 'melodic', 'dreamy', 'nostalgic', 'powerful']
    const mood = moods[Math.floor(Math.random() * moods.length)]
    const type = promptType === 'song' ? 'song with catchy vocals and lyrics' : 'instrumental beat'
    setPrompt(`${mood} ${selectedGenre} ${type}, modern production, professional mix`)
    if (promptType === 'beat') setIsInstrumental(true)
    setShowIdeas(false)
    setIdeasView('tags')
  }

  // ─── Feature definitions ────────────────────────────────────
  const features = [
    { id: 'music', icon: Music, label: 'Music', description: 'Generate AI music', color: 'cyan', cost: 2 },
    { id: 'effects', icon: Sparkles, label: 'Effects', description: 'Sound effects', color: 'purple', cost: 2 },
    { id: 'loops', icon: Repeat, label: 'Loops', description: 'Fixed BPM loops', color: 'cyan', cost: 2 },
    { id: 'image', icon: ImageIcon, label: 'Cover Art', description: 'AI album artwork', color: 'cyan', cost: 1 },
    { id: 'stems', icon: Scissors, label: 'Split Stems', description: 'Vocals, drums, bass & more', color: 'purple', cost: 5 },
    { id: 'boost', icon: Volume2, label: 'Audio Boost', description: 'Mix & master your track', color: 'orange', cost: 1 },
  ]

  const needsPrompt = ['music', 'effects', 'loops', 'image'].includes(activeTab)
  const needsUrl = ['stems', 'boost'].includes(activeTab)
  const currentCost = features.find(f => f.id === activeTab)?.cost ?? 0

  // ═══════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════════════════
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center mb-4">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-cyan-400">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">444 RADIO</h1>
            <span className="inline-block text-[10px] bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-lg font-bold tracking-wider">
              PLUGIN
            </span>
            <p className="text-sm text-gray-500 pt-2">Connect your account to start creating</p>
          </div>

          {/* Token input */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">Plugin Token</label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="444r_..."
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                onKeyDown={e => {
                  if (e.key === 'Enter') verifyToken(token)
                }}
              />
            </div>

            <button
              onClick={() => verifyToken(token)}
              disabled={!token}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-sm font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Connect
            </button>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 text-center">
                {error}
              </div>
            )}

            <p className="text-xs text-gray-600 text-center">
              Generate a token at{' '}
              <a
                href="https://444radio.co.in/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 underline"
              >
                Settings → Plugin
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN UI — matches FeaturesSidebar design
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-cyan-400">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="text-white font-bold">444 Radio</span>
          <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-lg font-bold">
            PLUGIN
          </span>
        </div>
        <button
          onClick={() => {
            setIsAuthenticated(false)
            localStorage.removeItem('444radio_plugin_token')
          }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Logout
        </button>
      </div>

      {/* ─── Credits Bar ─────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
          <Zap size={14} className="text-cyan-400" />
          <span className="text-white font-bold text-sm">
            {credits?.credits ?? 0} credits
          </span>
        </div>
      </div>

      {/* ─── Scrollable Content ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Mode Toggle */}
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex gap-2">
            <button
              onClick={() => setIsInstrumental(false)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                !isInstrumental
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              Vocal
            </button>
            <button
              onClick={() => setIsInstrumental(true)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isInstrumental
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="8" x2="8" y1="4" y2="14" />
                <line x1="16" x2="16" y1="4" y2="14" />
                <line x1="12" x2="12" y1="4" y2="14" />
              </svg>
              Inst
            </button>
          </div>
        </div>

        {/* ─── Prompt Input (prompt-based features) ──────────── */}
        {needsPrompt && (
          <div className="px-5 py-4 border-b border-white/10">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                activeTab === 'music'
                  ? 'Describe your music...'
                  : activeTab === 'effects'
                    ? 'Describe the sound effect...'
                    : activeTab === 'loops'
                      ? 'Describe the loop...'
                      : 'Describe the cover art...'
              }
              maxLength={300}
              rows={4}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                  e.preventDefault()
                  generate()
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-[10px] ${prompt.length > 270 ? 'text-red-400' : 'text-gray-600'}`}>
                {prompt.length}/300 · {currentCost} cr
              </span>
              <button
                onClick={generate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send size={12} />
                {isGenerating ? 'Creating...' : 'Generate'}
              </button>
            </div>
          </div>
        )}

        {/* ─── URL Input (stems / boost) ─────────────────────── */}
        {needsUrl && (
          <div className="px-5 py-4 border-b border-white/10 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Audio URL</label>
              <input
                value={audioUrl}
                onChange={e => setAudioUrl(e.target.value)}
                placeholder="https://media.444radio.co.in/..."
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
            <button
              onClick={generate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={12} />
              {isGenerating
                ? 'Processing...'
                : activeTab === 'stems'
                  ? `Split Stems · ${currentCost} cr`
                  : `Boost Audio · ${currentCost} cr`}
            </button>
          </div>
        )}

        {/* ─── Feature-specific Extra Fields ─────────────────── */}
        {activeTab === 'music' && (
          <div className="px-5 py-3 border-b border-white/10 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="My new track"
                maxLength={100}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Genre</label>
                <select
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  className="w-full bg-gray-900 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="">Auto</option>
                  {['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'pop', 'rock', 'ambient', 'classical'].map(
                    g => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">BPM</label>
                <input
                  type="number"
                  value={bpm}
                  onChange={e => setBpm(+e.target.value)}
                  min={60}
                  max={200}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Duration</label>
                <select
                  value={duration}
                  onChange={e => setDuration(e.target.value as 'short' | 'medium' | 'long')}
                  className="w-full bg-gray-900 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </div>

            {!isInstrumental && (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                  Lyrics <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder="Leave empty for AI-matched lyrics..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'loops' && (
          <div className="px-5 py-3 border-b border-white/10">
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">BPM</label>
            <input
              type="number"
              value={bpm}
              onChange={e => setBpm(+e.target.value)}
              min={60}
              max={200}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        )}

        {activeTab === 'stems' && (
          <div className="px-5 py-3 border-b border-white/10 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Stem type</label>
              <select
                value={stem}
                onChange={e => setStem(e.target.value)}
                className="w-full bg-gray-900 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                {['vocals', 'drums', 'bass', 'piano', 'guitar', 'other'].map(s => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Track title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Track name"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>
        )}

        {activeTab === 'boost' && (
          <div className="px-5 py-3 border-b border-white/10">
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Track title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Track name"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
        )}

        {/* ─── Error ─────────────────────────────────────────── */}
        {error && (
          <div className="mx-5 mt-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ─── Ideas & Tags ──────────────────────────────────── */}
        <div className="px-4 py-3">
          {/* Toggle button */}
          <button
            onClick={() => {
              setShowIdeas(!showIdeas)
              setIdeasView('tags')
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
              showIdeas
                ? 'bg-gradient-to-r from-yellow-600/30 to-amber-400/20 border-yellow-400 text-yellow-300'
                : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50'
            }`}
          >
            <div className={`p-2 rounded-lg ${showIdeas ? 'bg-white/10' : 'bg-white/5'}`}>
              <Lightbulb size={18} />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold">Ideas & Tags</div>
              <div className="text-[10px] text-gray-500">AI prompts & quick tags</div>
            </div>
            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">AI</span>
          </button>

          {/* Expanded panel */}
          {showIdeas && (
            <div className="mt-3 space-y-3">
              {/* Quick Tags view */}
              {ideasView === 'tags' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                      </svg>
                      Quick Tags
                    </span>
                    <button
                      onClick={() => setIdeasView('type')}
                      className="px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/40 rounded-lg text-[10px] font-bold text-purple-300 transition-all"
                    >
                      ✨ IDEAS
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {QUICK_TAGS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-[10px] font-medium text-cyan-200 hover:text-white transition-all hover:scale-105"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Type selection (Song / Beat) */}
              {ideasView === 'type' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">✨ AI Prompt Ideas</h3>
                    <button
                      onClick={() => setIdeasView('tags')}
                      className="p-1 hover:bg-white/10 rounded-lg"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">
                    What would you like to create?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setPromptType('song')
                        setIdeasView('genre')
                      }}
                      className="p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-400/40 hover:border-purple-400/60 rounded-2xl transition-all hover:scale-105"
                    >
                      <div className="text-2xl mb-1">🎤</div>
                      <div className="text-xs font-bold text-white">Song</div>
                      <div className="text-[9px] text-gray-400">With vocals & lyrics</div>
                    </button>
                    <button
                      onClick={() => {
                        setPromptType('beat')
                        setIdeasView('genre')
                      }}
                      className="p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border-2 border-cyan-400/40 hover:border-cyan-400/60 rounded-2xl transition-all hover:scale-105"
                    >
                      <div className="text-2xl mb-1">🎹</div>
                      <div className="text-xs font-bold text-white">Beat</div>
                      <div className="text-[9px] text-gray-400">Instrumental only</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Genre selection */}
              {ideasView === 'genre' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setIdeasView('type')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <ChevronLeft size={12} /> Back
                    </button>
                    <h3 className="text-xs font-bold text-white">🎵 Select Genre</h3>
                    <button
                      onClick={() => setIdeasView('tags')}
                      className="p-1 hover:bg-white/10 rounded-lg"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center">
                    Choose a style for your {promptType}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {IDEA_GENRES.map(g => (
                      <button
                        key={g}
                        onClick={() => generateIdea(g)}
                        className="px-2 py-2 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-[10px] font-medium text-cyan-200 hover:text-white transition-all hover:scale-105"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Feature Buttons ───────────────────────────────── */}
        <div className="px-4 pb-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 px-1">
            Creation Tools
          </p>
          <div className="space-y-2">
            {features.map(feature => {
              const Icon = feature.icon
              const isActive = activeTab === feature.id
              const colorStyles: Record<string, string> = {
                cyan: isActive
                  ? 'bg-gradient-to-r from-cyan-600/30 to-cyan-400/20 border-cyan-400 text-cyan-300'
                  : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50',
                purple: isActive
                  ? 'bg-gradient-to-r from-purple-600/30 to-pink-500/20 border-purple-400 text-purple-300'
                  : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50',
                orange: isActive
                  ? 'bg-gradient-to-r from-orange-600/30 to-red-500/20 border-orange-400 text-orange-300'
                  : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400/50',
              }

              return (
                <button
                  key={feature.id}
                  onClick={() => {
                    setActiveTab(feature.id)
                    setError('')
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${colorStyles[feature.color]}`}
                >
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold">{feature.label}</div>
                    <div className="text-[10px] text-gray-500">{feature.description}</div>
                  </div>
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                    -{feature.cost}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ─── Recent Jobs ───────────────────────────────────── */}
        {jobs.length > 0 && (
          <div className="px-4 pb-4">
            <div className="border-t border-white/10 pt-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 px-1">
                Recent Jobs
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {jobs.map((job, i) => (
                  <div
                    key={`${job.id}-${i}`}
                    className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          job.status === 'completed'
                            ? 'bg-green-500'
                            : job.status === 'failed' || job.status === 'cancelled'
                              ? 'bg-red-500'
                              : job.status === 'processing'
                                ? 'bg-cyan-400 animate-pulse'
                                : 'bg-gray-500'
                        }`}
                      />
                      <span className="text-xs text-gray-300 truncate">
                        {job.prompt?.substring(0, 30) || job.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-600 capitalize">{job.type}</span>
                      <span
                        className={`text-[10px] font-medium ${
                          job.status === 'completed'
                            ? 'text-green-400'
                            : job.status === 'failed'
                              ? 'text-red-400'
                              : 'text-cyan-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
