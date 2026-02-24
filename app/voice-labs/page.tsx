'use client'

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Mic, Volume2, Zap, Loader2, Play, Pause, Download,
  Settings2, ChevronDown, ChevronUp, Copy, AlertCircle, CheckCircle2,
  Sparkles, Globe, Music2, SlidersHorizontal, RefreshCw, Trash2, User,
  FileAudio, Hash, Type, Gauge
} from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'
import FloatingMenu from '@/app/components/FloatingMenu'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))

// ── Voice Constants ──

const SYSTEM_VOICES = [
  { id: 'Wise_Woman', name: 'Wise Woman', desc: 'Calm, authoritative female' },
  { id: 'Friendly_Person', name: 'Friendly Person', desc: 'Warm, approachable tone' },
  { id: 'Inspirational_girl', name: 'Inspirational Girl', desc: 'Uplifting, youthful female' },
  { id: 'Deep_Voice_Man', name: 'Deep Voice Man', desc: 'Rich, deep male voice' },
  { id: 'Calm_Woman', name: 'Calm Woman', desc: 'Gentle, soothing female' },
  { id: 'Casual_Guy', name: 'Casual Guy', desc: 'Relaxed, everyday male' },
  { id: 'Lively_Girl', name: 'Lively Girl', desc: 'Energetic, bright female' },
  { id: 'Patient_Man', name: 'Patient Man', desc: 'Clear, steady male' },
  { id: 'Young_Knight', name: 'Young Knight', desc: 'Bold, heroic male' },
  { id: 'Determined_Man', name: 'Determined Man', desc: 'Strong, focused male' },
  { id: 'Lovely_Girl', name: 'Lovely Girl', desc: 'Sweet, charming female' },
  { id: 'Decent_Boy', name: 'Decent Boy', desc: 'Polite, youthful male' },
  { id: 'Imposing_Manner', name: 'Imposing Manner', desc: 'Commanding, powerful' },
  { id: 'Gentle_Woman', name: 'Gentle Woman', desc: 'Soft, nurturing female' },
  { id: 'Emotional_Narrator_Woman', name: 'Emotional Narrator', desc: 'Expressive female narrator' },
  { id: 'Serious_Girl', name: 'Serious Girl', desc: 'Focused, clear female' },
]

const EMOTIONS = [
  { value: 'auto', label: 'Auto', desc: 'Let AI choose the best delivery' },
  { value: 'happy', label: 'Happy', desc: 'Joyful, upbeat tone' },
  { value: 'sad', label: 'Sad', desc: 'Somber, melancholic' },
  { value: 'angry', label: 'Angry', desc: 'Intense, forceful' },
  { value: 'fearful', label: 'Fearful', desc: 'Anxious, worried' },
  { value: 'disgusted', label: 'Disgusted', desc: 'Repulsed, disapproving' },
  { value: 'surprised', label: 'Surprised', desc: 'Astonished, amazed' },
  { value: 'calm', label: 'Calm', desc: 'Serene, peaceful' },
  { value: 'fluent', label: 'Fluent', desc: 'Smooth, natural flow' },
  { value: 'neutral', label: 'Neutral', desc: 'Flat, matter-of-fact' },
]

const SAMPLE_RATES = [
  { value: 8000, label: '8 kHz', desc: 'Telephone quality' },
  { value: 16000, label: '16 kHz', desc: 'Wideband' },
  { value: 22050, label: '22.05 kHz', desc: 'FM Radio' },
  { value: 24000, label: '24 kHz', desc: 'Standard' },
  { value: 32000, label: '32 kHz', desc: 'Default' },
  { value: 44100, label: '44.1 kHz', desc: 'CD Quality' },
]

const BITRATES = [
  { value: 32000, label: '32 kbps', desc: 'Low bandwidth' },
  { value: 64000, label: '64 kbps', desc: 'Acceptable' },
  { value: 128000, label: '128 kbps', desc: 'Standard (default)' },
  { value: 256000, label: '256 kbps', desc: 'High quality' },
]

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3', desc: 'Universal, compressed' },
  { value: 'wav', label: 'WAV', desc: 'Lossless, larger file' },
  { value: 'flac', label: 'FLAC', desc: 'Lossless, compressed' },
  { value: 'pcm', label: 'PCM', desc: 'Raw audio bytes' },
]

const CHANNELS = [
  { value: 'mono', label: 'Mono', desc: '1 channel' },
  { value: 'stereo', label: 'Stereo', desc: '2 channels' },
]

const LANGUAGES = [
  'None', 'Automatic', 'English', 'Chinese', 'Chinese,Yue', 'Cantonese',
  'Japanese', 'Korean', 'Spanish', 'French', 'Portuguese', 'German',
  'Italian', 'Russian', 'Arabic', 'Hindi', 'Tamil', 'Thai', 'Vietnamese',
  'Indonesian', 'Turkish', 'Dutch', 'Polish', 'Ukrainian', 'Romanian',
  'Greek', 'Czech', 'Finnish', 'Bulgarian', 'Danish', 'Hebrew', 'Malay',
  'Persian', 'Slovak', 'Swedish', 'Croatian', 'Filipino', 'Hungarian',
  'Norwegian', 'Slovenian', 'Catalan', 'Nynorsk', 'Afrikaans',
]

interface TrainedVoice {
  id: string
  voice_id: string
  name: string
  status: string
}

interface GenerationResult {
  id: string
  audioUrl: string
  title: string
  creditsDeducted: number
  format: string
  timestamp: number
}

export default function VoiceLabsPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { totalCredits: credits, refreshCredits } = useCredits()

  // ── Text Input ──
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')

  // ── Voice Selection ──
  const [voiceId, setVoiceId] = useState('Wise_Woman')
  const [voiceTab, setVoiceTab] = useState<'system' | 'custom'>('system')
  const [trainedVoices, setTrainedVoices] = useState<TrainedVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  // ── Core Parameters ──
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [pitch, setPitch] = useState(0)
  const [emotion, setEmotion] = useState('auto')

  // ── Advanced Parameters ──
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [englishNormalization, setEnglishNormalization] = useState(false)
  const [sampleRate, setSampleRate] = useState(32000)
  const [bitrate, setBitrate] = useState(128000)
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [channel, setChannel] = useState('mono')
  const [subtitleEnable, setSubtitleEnable] = useState(false)
  const [languageBoost, setLanguageBoost] = useState('None')

  // ── Generation State ──
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generations, setGenerations] = useState<GenerationResult[]>([])

  // ── Audio Playback ──
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // ── Token/Cost estimation ──
  const estimatedTokens = Math.ceil(text.length / 4)
  const estimatedCost = Math.max(3, Math.ceil(estimatedTokens / 1000) * 3)
  const charCount = text.length
  const hasEnoughCredits = (credits ?? 0) >= estimatedCost

  // ── Load trained voices ──
  useEffect(() => {
    loadTrainedVoices()
  }, [])

  const loadTrainedVoices = async () => {
    setLoadingVoices(true)
    try {
      const res = await fetch('/api/voice-trainings')
      if (res.ok) {
        const data = await res.json()
        setTrainedVoices((data.voices || []).filter((v: TrainedVoice) => v.status === 'ready'))
      }
    } catch (e) {
      console.error('Failed to load trained voices:', e)
    } finally {
      setLoadingVoices(false)
    }
  }

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // ── Generate TTS ──
  const handleGenerate = async () => {
    setError('')

    if (!text.trim()) {
      setError('Please enter text to generate speech.')
      return
    }

    if (text.length < 3) {
      setError('Text must be at least 3 characters.')
      return
    }

    if (text.length > 10000) {
      setError('Text must be 10,000 characters or less.')
      return
    }

    if (!hasEnoughCredits) {
      setError(`Insufficient credits. This generation requires ${estimatedCost} credits. You have ${credits ?? 0}.`)
      return
    }

    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate/voice-labs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          title: title.trim() || `Voice Generation ${new Date().toLocaleTimeString()}`,
          voice_id: voiceId,
          speed,
          volume,
          pitch,
          emotion,
          english_normalization: englishNormalization,
          sample_rate: sampleRate,
          bitrate,
          audio_format: audioFormat,
          channel,
          subtitle_enable: subtitleEnable,
          language_boost: languageBoost,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Generation failed')
      }

      const result: GenerationResult = {
        id: data.predictionId || `gen-${Date.now()}`,
        audioUrl: data.audioUrl,
        title: data.title,
        creditsDeducted: data.creditsDeducted,
        format: data.format,
        timestamp: Date.now(),
      }

      setGenerations(prev => [result, ...prev])
      refreshCredits()

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Audio playback ──
  const togglePlayback = (gen: GenerationResult) => {
    if (playingId === gen.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      return
    }

    // Stop current
    if (audioRef.current) {
      audioRef.current.pause()
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }

    const audio = new Audio(gen.audioUrl)
    audioRef.current = audio
    setPlayingId(gen.id)
    setPlaybackProgress(0)
    setPlaybackDuration(0)

    audio.onloadedmetadata = () => {
      setPlaybackDuration(audio.duration)
    }
    audio.onended = () => {
      setPlayingId(null)
      setPlaybackProgress(0)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
    audio.onerror = () => {
      setPlayingId(null)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }

    audio.play()
    progressIntervalRef.current = setInterval(() => {
      if (audio.currentTime && audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100)
      }
    }, 100)
  }

  const downloadAudio = (url: string, fileName: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getCharCountColor = () => {
    if (charCount > 10000) return 'text-red-400'
    if (charCount > 9000) return 'text-yellow-400'
    return 'text-gray-500'
  }

  const getSelectedVoiceName = () => {
    const sys = SYSTEM_VOICES.find(v => v.id === voiceId)
    if (sys) return sys.name
    const custom = trainedVoices.find(v => v.voice_id === voiceId)
    if (custom) return custom.name
    return voiceId
  }

  return (
    <div className="min-h-screen text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>
      <div className="fixed inset-0 bg-black/15 backdrop-blur-[0.5px] -z-[5] pointer-events-none" />

      <FloatingMenu />

      <main className="relative z-10 md:pl-[72px] pb-32 pt-4">
        <div className="px-4 md:px-8 max-w-4xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/create')} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.08] transition">
              <ArrowLeft size={18} className="text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                VOICE LABS
              </h1>
              <p className="text-[10px] text-gray-500 tracking-wider">444 RADIO — AI TEXT TO SPEECH</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-cyan-500/20 rounded-xl backdrop-blur-xl">
              <Zap size={12} className="text-cyan-400" />
              <span className="text-xs font-semibold text-white">{credits ?? '...'}</span>
              <span className="text-[9px] text-gray-500">credits</span>
            </div>
          </div>

          {/* ── Cost Info Banner ── */}
          <div className="bg-cyan-500/[0.06] border border-cyan-500/20 rounded-2xl p-4 mb-6 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Mic size={18} className="text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-cyan-300 font-semibold text-sm mb-0.5">Text-to-Speech Generation</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  3 credits per 1,000 input tokens (minimum 3 credits). Use system voices or your{' '}
                  <a href="/voice-training" className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-400/30">trained voice clones</a>.
                  Insert pauses with <code className="text-cyan-300 bg-cyan-500/10 px-1 rounded text-[10px]">{'<#0.5#>'}</code> markers.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── LEFT: Text + Voice + Controls ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Title */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">
                  <Type size={12} className="inline mr-1" />
                  Generation Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Podcast Intro, Audiobook Chapter 1..."
                  maxLength={200}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
              </div>

              {/* Text Input */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-gray-400 font-medium">
                    <FileAudio size={12} className="inline mr-1" />
                    Text to Speech
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono ${getCharCountColor()}`}>
                      {charCount.toLocaleString()} / 10,000
                    </span>
                    {charCount > 0 && (
                      <span className="text-[10px] text-gray-600">
                        ~{estimatedTokens.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Enter the text you want to convert to speech...
                  
Use markers like <#0.5#> to insert pauses in seconds.

Example: Hello! <#1.0#> Welcome to 444 Radio."
                  maxLength={10000}
                  rows={8}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-gray-600">
                    Tip: Use <code className="text-gray-500">{'<#0.5#>'}</code> for a 0.5s pause, <code className="text-gray-500">{'<#2.0#>'}</code> for 2s
                  </p>
                  {charCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Zap size={10} className="text-cyan-400" />
                      <span className="text-[10px] text-cyan-400 font-semibold">{estimatedCost} credits</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Voice Selection */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs text-gray-400 font-medium">
                    <User size={12} className="inline mr-1" />
                    Voice — <span className="text-white">{getSelectedVoiceName()}</span>
                  </label>
                  <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/[0.06]">
                    <button
                      onClick={() => setVoiceTab('system')}
                      className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${
                        voiceTab === 'system'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      System Voices
                    </button>
                    <button
                      onClick={() => setVoiceTab('custom')}
                      className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${
                        voiceTab === 'custom'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      My Voices {trainedVoices.length > 0 && `(${trainedVoices.length})`}
                    </button>
                  </div>
                </div>

                {voiceTab === 'system' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                    {SYSTEM_VOICES.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setVoiceId(v.id)}
                        className={`flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all text-left ${
                          voiceId === v.id
                            ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                            : 'bg-black/20 border-white/[0.06] hover:border-cyan-500/20 hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className={`text-xs font-medium ${voiceId === v.id ? 'text-cyan-300' : 'text-white/80'}`}>
                          {v.name}
                        </span>
                        <span className="text-[9px] text-gray-500 mt-0.5">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    {loadingVoices ? (
                      <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
                        <Loader2 size={14} className="animate-spin" /> Loading voices...
                      </div>
                    ) : trainedVoices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.06] rounded-xl flex items-center justify-center mb-2">
                          <User size={20} className="text-gray-600" />
                        </div>
                        <p className="text-gray-400 text-sm font-medium mb-1">No trained voices</p>
                        <p className="text-gray-600 text-xs mb-3">Clone a voice to use it here</p>
                        <a
                          href="/voice-training"
                          className="text-xs text-purple-400 hover:text-purple-300 underline decoration-purple-500/30"
                        >
                          Go to Voice Training →
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {trainedVoices.map(v => (
                          <button
                            key={v.voice_id}
                            onClick={() => setVoiceId(v.voice_id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                              voiceId === v.voice_id
                                ? 'bg-purple-500/10 border-purple-500/40 shadow-lg shadow-purple-500/5'
                                : 'bg-black/20 border-white/[0.06] hover:border-purple-500/20 hover:bg-white/[0.02]'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-purple-400" />
                            </div>
                            <div className="min-w-0">
                              <span className={`text-xs font-medium ${voiceId === v.voice_id ? 'text-purple-300' : 'text-white/80'}`}>
                                {v.name}
                              </span>
                              <span className="block text-[9px] text-gray-500 font-mono truncate">
                                ID: {v.voice_id.substring(0, 20)}...
                              </span>
                            </div>
                          </button>
                        ))}
                        <a
                          href="/voice-training"
                          className="block text-center text-[10px] text-purple-400/60 hover:text-purple-400 mt-2 transition-colors"
                        >
                          + Train a new voice
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Voice ID input */}
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <label className="text-[10px] text-gray-500 block mb-1">Or enter a Voice ID directly:</label>
                  <input
                    type="text"
                    value={voiceId}
                    onChange={e => setVoiceId(e.target.value)}
                    placeholder="Paste a voice_id..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Emotion */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
                <label className="text-xs text-gray-400 font-medium mb-2 block">
                  <Sparkles size={12} className="inline mr-1" />
                  Emotion / Delivery Style
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {EMOTIONS.map(e => (
                    <button
                      key={e.value}
                      onClick={() => setEmotion(e.value)}
                      className={`flex flex-col items-center px-2 py-2 rounded-xl border transition-all ${
                        emotion === e.value
                          ? 'bg-cyan-500/10 border-cyan-500/40'
                          : 'bg-black/20 border-white/[0.06] hover:border-cyan-500/20'
                      }`}
                    >
                      <span className={`text-[10px] font-medium ${emotion === e.value ? 'text-cyan-300' : 'text-white/70'}`}>
                        {e.label}
                      </span>
                      <span className="text-[8px] text-gray-500 mt-0.5">{e.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Parameters + Generate ── */}
            <div className="space-y-4">

              {/* Core Sliders */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl space-y-4">
                <h3 className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                  <SlidersHorizontal size={12} />
                  Voice Controls
                </h3>

                {/* Speed */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-500">Speed</label>
                    <span className="text-[10px] font-mono text-white/60">{speed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speed}
                    onChange={e => setSpeed(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5"
                  />
                  <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
                    <span>0.5x (Slow)</span>
                    <span>2.0x (Fast)</span>
                  </div>
                </div>

                {/* Volume */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-500">Volume</label>
                    <span className="text-[10px] font-mono text-white/60">{volume.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5"
                  />
                  <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
                    <span>0 (Silent)</span>
                    <span>10 (Max)</span>
                  </div>
                </div>

                {/* Pitch */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-500">Pitch</label>
                    <span className="text-[10px] font-mono text-white/60">{pitch > 0 ? '+' : ''}{pitch} st</span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={pitch}
                    onChange={e => setPitch(parseInt(e.target.value))}
                    className="w-full accent-cyan-500 h-1.5"
                  />
                  <div className="flex justify-between text-[8px] text-gray-600 mt-0.5">
                    <span>-12 (Lower)</span>
                    <span>+12 (Higher)</span>
                  </div>
                </div>
              </div>

              {/* Language */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">
                  <Globe size={12} className="inline mr-1" />
                  Language Boost
                </label>
                <select
                  value={languageBoost}
                  onChange={e => setLanguageBoost(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(148,163,184,0.5)' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.6rem center',
                    backgroundSize: '1.1em 1.1em',
                    paddingRight: '2.2rem',
                  }}
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang} value={lang}>
                      {lang === 'None' ? 'None (auto-detect)' : lang === 'Automatic' ? 'Automatic' : lang}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-gray-600 mt-1">Hint the primary language for better pronunciation</p>
              </div>

              {/* Advanced Settings */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl backdrop-blur-xl overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                    <Settings2 size={12} />
                    Advanced Settings
                  </span>
                  {showAdvanced ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>

                {showAdvanced && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">

                    {/* English Normalization */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={englishNormalization}
                        onChange={e => setEnglishNormalization(e.target.checked)}
                        className="accent-cyan-500 rounded w-3.5 h-3.5"
                      />
                      <div>
                        <span className="text-[10px] text-gray-300 group-hover:text-white transition-colors">English Normalization</span>
                        <p className="text-[8px] text-gray-600">Better number/date reading (adds slight latency)</p>
                      </div>
                    </label>

                    {/* Audio Format */}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Audio Format</label>
                      <div className="grid grid-cols-2 gap-1">
                        {AUDIO_FORMATS.map(f => (
                          <button
                            key={f.value}
                            onClick={() => setAudioFormat(f.value)}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] transition-all ${
                              audioFormat === f.value
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                                : 'bg-black/20 border-white/[0.06] text-gray-500 hover:border-cyan-500/20'
                            }`}
                          >
                            <span className="font-medium">{f.label}</span>
                            <span className="block text-[8px] text-gray-600">{f.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sample Rate */}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Sample Rate</label>
                      <select
                        value={sampleRate}
                        onChange={e => setSampleRate(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/50"
                      >
                        {SAMPLE_RATES.map(sr => (
                          <option key={sr.value} value={sr.value}>
                            {sr.label} — {sr.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Bitrate (only for MP3) */}
                    {audioFormat === 'mp3' && (
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">Bitrate (MP3 only)</label>
                        <select
                          value={bitrate}
                          onChange={e => setBitrate(Number(e.target.value))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-cyan-500/50"
                        >
                          {BITRATES.map(br => (
                            <option key={br.value} value={br.value}>
                              {br.label} — {br.desc}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Channel */}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Channel</label>
                      <div className="grid grid-cols-2 gap-1">
                        {CHANNELS.map(ch => (
                          <button
                            key={ch.value}
                            onClick={() => setChannel(ch.value)}
                            className={`px-2 py-1.5 rounded-lg border text-[10px] transition-all ${
                              channel === ch.value
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                                : 'bg-black/20 border-white/[0.06] text-gray-500 hover:border-cyan-500/20'
                            }`}
                          >
                            <span className="font-medium">{ch.label}</span>
                            <span className="block text-[8px] text-gray-600">{ch.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subtitle Enable */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={subtitleEnable}
                        onChange={e => setSubtitleEnable(e.target.checked)}
                        className="accent-cyan-500 rounded w-3.5 h-3.5"
                      />
                      <div>
                        <span className="text-[10px] text-gray-300 group-hover:text-white transition-colors">Subtitles / Timestamps</span>
                        <p className="text-[8px] text-gray-600">Return sentence-level timestamp metadata</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
                {error && (
                  <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Cost summary */}
                {charCount > 0 && (
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="text-[10px] text-gray-500 space-y-0.5">
                      <div>Characters: <span className="text-white/60">{charCount.toLocaleString()}</span></div>
                      <div>Est. tokens: <span className="text-white/60">~{estimatedTokens.toLocaleString()}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-cyan-400">{estimatedCost} credits</div>
                      <div className="text-[9px] text-gray-500">3 credits / 1K tokens</div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim() || charCount > 10000 || !hasEnoughCredits}
                  className={`w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl transition-all shadow-lg ${
                    isGenerating || !text.trim() || !hasEnoughCredits
                      ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-500 text-white hover:from-cyan-500 hover:to-blue-400 shadow-cyan-500/20'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Generating Speech...
                    </>
                  ) : (
                    <>
                      <Mic size={18} />
                      Generate — {charCount > 0 ? `${estimatedCost} Credits` : '...'}
                    </>
                  )}
                </button>

                {!hasEnoughCredits && charCount > 0 && (
                  <p className="text-red-400/80 text-[10px] text-center mt-2">
                    Need {estimatedCost - (credits ?? 0)} more credits.{' '}
                    <a href="/pricing" className="text-cyan-400 underline">Get credits →</a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Generation Results ── */}
          {generations.length > 0 && (
            <div className="mt-6">
              <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
                <Music2 size={16} className="text-cyan-400" />
                Generated Audio
                <span className="text-[10px] text-gray-500 font-normal">({generations.length})</span>
              </h2>
              <div className="space-y-2">
                {generations.map(gen => (
                  <div
                    key={gen.id}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 backdrop-blur-xl hover:border-cyan-500/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Play button */}
                      <button
                        onClick={() => togglePlayback(gen)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                          playingId === gen.id
                            ? 'bg-cyan-500/20 border border-cyan-500/40'
                            : 'bg-black/40 border border-white/[0.08] hover:border-cyan-500/30'
                        }`}
                      >
                        {playingId === gen.id
                          ? <Pause size={16} className="text-cyan-400" />
                          : <Play size={16} className="text-gray-400 group-hover:text-cyan-400 ml-0.5" />
                        }
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{gen.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>{gen.format.toUpperCase()}</span>
                          <span>•</span>
                          <span>{gen.creditsDeducted} credits</span>
                          <span>•</span>
                          <span>{new Date(gen.timestamp).toLocaleTimeString()}</span>
                        </div>

                        {/* Progress bar */}
                        {playingId === gen.id && (
                          <div className="mt-1.5 w-full bg-white/[0.06] rounded-full h-1 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-100"
                              style={{ width: `${playbackProgress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => downloadAudio(gen.audioUrl, `${gen.title}.${gen.format}`)}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                          title="Download"
                        >
                          <Download size={14} className="text-gray-500 hover:text-cyan-400" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(gen.audioUrl)
                          }}
                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                          title="Copy URL"
                        >
                          <Copy size={14} className="text-gray-500 hover:text-cyan-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
