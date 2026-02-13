'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ───
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

// ─── Plugin Bridge (sends messages to JUCE WebView host) ───
function sendToPlugin(action: string, data: Record<string, unknown>) {
  // JUCE WebView uses window.postMessage to communicate with C++ host
  try {
    window.parent?.postMessage({ source: '444radio-plugin', action, ...data }, '*')
    // Also try the JUCE-specific bridge if available
    if ((window as any).__juce__?.postMessage) {
      (window as any).__juce__.postMessage(JSON.stringify({ action, ...data }))
    }
  } catch { /* not in plugin context */ }
}

export default function PluginPage() {
  const [token, setToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [credits, setCredits] = useState<CreditInfo | null>(null)
  const [activeTab, setActiveTab] = useState<'music' | 'effects' | 'loops' | 'stems' | 'image' | 'boost'>('music')
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  // Form fields
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [genre, setGenre] = useState('')
  const [bpm, setBpm] = useState(120)
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('medium')
  const [audioUrl, setAudioUrl] = useState('') // for stems/boost
  const [stem, setStem] = useState('vocals')

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  // ─── Auth ───
  useEffect(() => {
    const saved = localStorage.getItem('444radio_plugin_token')
    if (saved) {
      setToken(saved)
      verifyToken(saved)
    }
  }, [])

  const verifyToken = useCallback(async (t: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, {
        headers: { 'Authorization': `Bearer ${t}` },
      })
      if (res.ok) {
        const data = await res.json()
        setCredits(data)
        setIsAuthenticated(true)
        localStorage.setItem('444radio_plugin_token', t)
        sendToPlugin('authenticated', { credits: data.credits })
      } else {
        setIsAuthenticated(false)
        setError('Invalid token. Generate one from your 444 Radio profile.')
      }
    } catch {
      setError('Connection failed. Check your internet.')
    }
  }, [baseUrl])

  const refreshCredits = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${baseUrl}/api/plugin/credits`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) setCredits(await res.json())
    } catch {}
  }, [token, baseUrl])

  // ─── Generation ───
  const generate = useCallback(async () => {
    if (!token || isGenerating) return
    setIsGenerating(true)
    setError('')

    const payload: Record<string, unknown> = { type: activeTab }

    switch (activeTab) {
      case 'music':
        if (!title || title.length < 3) { setError('Title required (3+ chars)'); setIsGenerating(false); return }
        if (!prompt || prompt.length < 10) { setError('Prompt required (10+ chars)'); setIsGenerating(false); return }
        payload.title = title; payload.prompt = prompt; payload.lyrics = lyrics || undefined
        payload.genre = genre || undefined; payload.bpm = bpm; payload.duration = duration
        payload.generateCoverArt = true
        break

      case 'effects':
        if (!prompt) { setError('Describe the sound effect'); setIsGenerating(false); return }
        payload.prompt = prompt; payload.duration = Math.min(10, Math.max(1, bpm || 5))
        break

      case 'loops':
        if (!prompt) { setError('Describe the loop'); setIsGenerating(false); return }
        payload.prompt = prompt; payload.bpm = bpm; payload.max_duration = 8; payload.variations = 2
        payload.output_format = 'wav'
        break

      case 'stems':
        if (!audioUrl) { setError('Paste audio URL for stem extraction'); setIsGenerating(false); return }
        payload.audioUrl = audioUrl; payload.stem = stem
        payload.trackTitle = title || 'Extracted'
        break

      case 'image':
        if (!prompt) { setError('Describe the image'); setIsGenerating(false); return }
        payload.prompt = prompt
        break

      case 'boost':
        if (!audioUrl) { setError('Paste audio URL to boost'); setIsGenerating(false); return }
        payload.audioUrl = audioUrl; payload.trackTitle = title || 'Boosted'
        payload.bass_boost = 3; payload.treble_boost = 2; payload.volume_boost = 2
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
          'Authorization': `Bearer ${token}`,
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

                // Tell the JUCE plugin to import the audio
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
                  setCredits(prev => prev ? { ...prev, credits: msg.creditsRemaining } : prev)
                }
              } else {
                jobEntry.status = 'failed'
                jobEntry.error = msg.error
                setError(msg.error || 'Generation failed')
              }
              setJobs(prev => [...prev])
            }
          } catch { /* bad JSON line */ }
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
  }, [token, isGenerating, activeTab, title, prompt, lyrics, genre, bpm, duration, audioUrl, stem, baseUrl, refreshCredits])

  // ─── Login Screen ───
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">444 RADIO</h1>
            <p className="text-gray-400 mt-2">Ableton Plugin</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Plugin Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="444r_..."
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={() => verifyToken(token)}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded font-medium transition-colors"
            >
              Connect
            </button>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <p className="text-xs text-gray-500 text-center">
              Generate a token at{' '}
              <a href="https://444radio.co.in/settings" target="_blank" className="text-purple-400 underline">
                444radio.co.in/settings
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Main UI ───
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">444 RADIO</span>
          <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded">PLUGIN</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            <span className="text-purple-400 font-medium">{credits?.credits ?? 0}</span> credits
          </span>
          <button
            onClick={() => { setIsAuthenticated(false); localStorage.removeItem('444radio_plugin_token') }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-2 overflow-x-auto">
        {(['music', 'effects', 'loops', 'stems', 'image', 'boost'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setError('') }}
            className={`px-4 py-2 text-sm capitalize whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'boost' ? 'Audio Boost' : tab}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="p-4 space-y-4 max-w-2xl">
        {/* Title (music only) */}
        {activeTab === 'music' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My new track"
              maxLength={100}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}

        {/* Prompt (music, effects, loops, image) */}
        {['music', 'effects', 'loops', 'image'].includes(activeTab) && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                activeTab === 'music' ? 'Describe your track — genre, mood, vibes...' :
                activeTab === 'effects' ? 'Describe the sound effect — rain, thunder, laser...' :
                activeTab === 'loops' ? 'Describe the loop — chill beat, funky bass...' :
                'Describe the image — cover art, abstract...'
              }
              maxLength={300}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
            />
            <div className="text-right text-xs text-gray-600">{prompt.length}/300</div>
          </div>
        )}

        {/* Lyrics (music only) */}
        {activeTab === 'music' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Lyrics (optional — AI picks if empty)</label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Leave empty for AI-matched lyrics..."
              rows={4}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
        )}

        {/* Music controls */}
        {activeTab === 'music' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Genre</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white">
                <option value="">Auto</option>
                {['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'pop', 'rock', 'ambient', 'classical'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">BPM</label>
              <input type="number" value={bpm} onChange={(e) => setBpm(+e.target.value)} min={60} max={200}
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Duration</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white">
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
          </div>
        )}

        {/* BPM for loops */}
        {activeTab === 'loops' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">BPM</label>
            <input type="number" value={bpm} onChange={(e) => setBpm(+e.target.value)} min={60} max={200}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white" />
          </div>
        )}

        {/* Audio URL (stems, boost) */}
        {['stems', 'boost'].includes(activeTab) && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Audio URL</label>
            <input
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="https://media.444radio.co.in/..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}

        {/* Stem picker */}
        {activeTab === 'stems' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Stem to extract</label>
            <select value={stem} onChange={(e) => setStem(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-2 text-sm text-white">
              {['vocals', 'drums', 'bass', 'piano', 'guitar', 'other'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        )}

        {/* Title for stems/boost */}
        {['stems', 'boost'].includes(activeTab) && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Track Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Track name"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={isGenerating}
          className={`w-full py-3 rounded font-medium text-sm transition-all ${
            isGenerating
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {isGenerating ? 'Generating...' : `Generate ${activeTab === 'boost' ? 'Audio Boost' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        </button>

        {/* Credit cost hint */}
        <p className="text-center text-xs text-gray-600">
          Cost: {credits?.costs?.[activeTab === 'boost' ? 'audio_boost' : activeTab === 'loops' ? 'loops_short' : activeTab] ?? '?'} credits
        </p>
      </div>

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-3">
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Recent Jobs</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {jobs.map((job, i) => (
              <div key={`${job.id}-${i}`} className="flex items-center justify-between bg-gray-900 rounded px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    job.status === 'completed' ? 'bg-green-500' :
                    job.status === 'failed' || job.status === 'cancelled' ? 'bg-red-500' :
                    job.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-500'
                  }`} />
                  <span className="text-sm text-gray-300 truncate">{job.prompt?.substring(0, 40) || job.type}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500 capitalize">{job.type}</span>
                  <span className={`text-xs ${
                    job.status === 'completed' ? 'text-green-500' :
                    job.status === 'failed' ? 'text-red-500' :
                    'text-yellow-500'
                  }`}>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
