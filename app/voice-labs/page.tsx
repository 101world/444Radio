'use client'

import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  Mic, MicOff, Zap, Loader2, Play, Pause, Download,
  Settings2, ChevronDown, ChevronUp, Copy, AlertCircle, CheckCircle2,
  SlidersHorizontal,  Trash2, User,
  Type, Plus, MessageSquare, Upload, Send,
  ChevronLeft, ChevronRight, Edit3, PanelLeft, Info
} from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'
import FloatingMenu from '@/app/components/FloatingMenu'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))

// ── Constants ──

const SYSTEM_VOICES = [
  { id: 'Wise_Woman', name: 'Wise Woman', desc: 'Calm, authoritative female' },
  { id: 'Friendly_Person', name: 'Friendly Person', desc: 'Warm, approachable' },
  { id: 'Inspirational_girl', name: 'Inspirational Girl', desc: 'Uplifting, youthful' },
  { id: 'Deep_Voice_Man', name: 'Deep Voice Man', desc: 'Rich, deep male' },
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
  { id: 'Emotional_Narrator_Woman', name: 'Emotional Narrator', desc: 'Expressive narrator' },
  { id: 'Serious_Girl', name: 'Serious Girl', desc: 'Focused, clear female' },
]

const EMOTIONS = [
  { value: 'auto', label: 'Auto' }, { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' }, { value: 'angry', label: 'Angry' },
  { value: 'fearful', label: 'Fearful' }, { value: 'disgusted', label: 'Disgusted' },
  { value: 'surprised', label: 'Surprised' }, { value: 'calm', label: 'Calm' },
  { value: 'fluent', label: 'Fluent' }, { value: 'neutral', label: 'Neutral' },
]

const SAMPLE_RATES = [8000, 16000, 22050, 24000, 32000, 44100]
const BITRATES = [32000, 64000, 128000, 256000]
const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'pcm']
const CHANNELS = ['mono', 'stereo']
const LANGUAGES = [
  'None', 'Automatic', 'English', 'Chinese', 'Japanese', 'Korean', 'Spanish',
  'French', 'Portuguese', 'German', 'Italian', 'Russian', 'Arabic', 'Hindi',
  'Tamil', 'Thai', 'Vietnamese', 'Indonesian', 'Turkish', 'Dutch', 'Polish',
  'Ukrainian', 'Romanian', 'Greek', 'Czech', 'Finnish', 'Bulgarian', 'Danish',
  'Hebrew', 'Malay', 'Persian', 'Slovak', 'Swedish', 'Croatian', 'Filipino',
  'Hungarian', 'Norwegian', 'Slovenian', 'Catalan', 'Nynorsk', 'Afrikaans',
]

const TRAIN_COST = 120

interface TrainedVoice {
  id: string
  voice_id: string
  name: string
  preview_url: string | null
  status: string
  created_at: string
}

interface Session {
  id: string
  title: string
  voice_id: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface ChatMessage {
  id: string
  text: string
  voice_id: string
  audio_url: string | null
  credits_cost: number
  settings: Record<string, unknown>
  status: 'generating' | 'completed' | 'failed'
  created_at: string
}

export default function VoiceLabsPage() {
  const { user } = useUser()
  const router = useRouter()
  const { totalCredits: credits, refreshCredits } = useCredits()

  // ── Character meter (cumulative usage toward next 1K billing) ──
  const [charMeter, setCharMeter] = useState(0)

  // ── Docked sidebar + ESC visibility ──
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [showEscHint, setShowEscHint] = useState(true)

  // ── Left Panel State ──
  const [leftTab, setLeftTab] = useState<'voices' | 'train' | 'sessions'>('voices')
  const [leftOpen, setLeftOpen] = useState(true)

  // ── Voice Selection ──
  const [voiceId, setVoiceId] = useState('Wise_Woman')
  const [voiceSubTab, setVoiceSubTab] = useState<'system' | 'custom'>('system')
  const [trainedVoices, setTrainedVoices] = useState<TrainedVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  // ── Training Form ──
  const [trainName, setTrainName] = useState('')
  const [trainFile, setTrainFile] = useState<File | null>(null)
  const [trainFileUrl, setTrainFileUrl] = useState('')
  const [noiseReduction, setNoiseReduction] = useState(false)
  const [volumeNormalization, setVolumeNormalization] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [trainError, setTrainError] = useState('')
  const [trainSuccess, setTrainSuccess] = useState('')
  const [isRecordingMic, setIsRecordingMic] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const trainFileInputRef = useRef<HTMLInputElement>(null)

  // ── Sessions ──
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // ── Chat Messages ──
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  // ── TTS Params ──
  const [text, setText] = useState('')
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const [pitch, setPitch] = useState(0)
  const [emotion, setEmotion] = useState('auto')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [englishNormalization, setEnglishNormalization] = useState(false)
  const [sampleRate, setSampleRate] = useState(32000)
  const [bitrate, setBitrate] = useState(128000)
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [channel, setChannel] = useState('mono')
  const [subtitleEnable, setSubtitleEnable] = useState(false)
  const [languageBoost, setLanguageBoost] = useState('None')

  // ── Generation ──
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  // ── Playback ──
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Activity Tracking (admin analytics) ──
  const inputStartTimeRef = useRef<number | null>(null)
  const keystrokeCountRef = useRef(0)
  const pasteCountRef = useRef(0)
  const deleteCountRef = useRef(0)
  const revisionCountRef = useRef(0)
  const inputIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTextLengthRef = useRef(0)
  const pageOpenTimeRef = useRef(Date.now())

  // ── Computed: meter-aware cost ──
  // New meter after this generation
  const charsToAdd = text.trim().length
  const projectedMeter = charMeter + charsToAdd
  const estimatedCost = Math.floor(projectedMeter / 1000) * 3
  const hasEnoughCredits = (credits ?? 0) >= estimatedCost || charsToAdd === 0
  const meterAfter = projectedMeter % 1000
  const selectedVoiceName = SYSTEM_VOICES.find(v => v.id === voiceId)?.name
    || trainedVoices.find(v => v.voice_id === voiceId)?.name
    || voiceId

  // ── Activity logging (fire-and-forget) ──
  const logVoiceActivity = (eventType: string, extra: Record<string, unknown> = {}) => {
    try {
      fetch('/api/voice-labs/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          session_id: activeSessionId,
          voice_id: voiceId,
          settings: { speed, pitch, volume, emotion, audioFormat, sampleRate, bitrate, channel, languageBoost },
          ...extra,
        }),
      }).catch(() => {})
    } catch { /* never block UI */ }
  }

  const flushInputSession = () => {
    if (inputStartTimeRef.current) {
      const duration = Date.now() - inputStartTimeRef.current
      logVoiceActivity('input_end', {
        text_length: lastTextLengthRef.current,
        input_duration_ms: duration,
        keystroke_count: keystrokeCountRef.current,
        paste_count: pasteCountRef.current,
        delete_count: deleteCountRef.current,
        revision_count: revisionCountRef.current,
      })
      inputStartTimeRef.current = null
      keystrokeCountRef.current = 0
      pasteCountRef.current = 0
      deleteCountRef.current = 0
      revisionCountRef.current = 0
    }
  }

  // ── Fetch character meter ──
  const refreshMeter = async () => {
    try {
      const res = await fetch('/api/voice-labs/tokens')
      if (res.ok) {
        const data = await res.json()
        setCharMeter(data.tokens ?? 0)
      }
    } catch { /* ignore */ }
  }

  // ── Load voices + sessions + meter on mount + log session_open ──
  useEffect(() => {
    loadTrainedVoices()
    loadSessions()
    refreshMeter()
    // Log page open
    pageOpenTimeRef.current = Date.now()
    fetch('/api/voice-labs/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'session_open' }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-scroll chat ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Track voice changes ──
  const prevVoiceRef = useRef(voiceId)
  useEffect(() => {
    if (voiceId !== prevVoiceRef.current) {
      logVoiceActivity('voice_change', {
        voice_id: voiceId,
        metadata: { previous_voice: prevVoiceRef.current },
      })
      prevVoiceRef.current = voiceId
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceId])

  // ── Hide ESC hint after 2s ──
  useEffect(() => {
    const timer = setTimeout(() => setShowEscHint(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  // ── ESC key → navigate to /create (always active) ──
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't navigate if user is typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        router.push('/create')
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [router])

  // ── Cleanup + log session_close ──
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause()
      if (progressRef.current) clearInterval(progressRef.current)
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (inputIdleTimerRef.current) clearTimeout(inputIdleTimerRef.current)
      // Flush any pending input session
      if (inputStartTimeRef.current) {
        const duration = Date.now() - inputStartTimeRef.current
        navigator.sendBeacon('/api/voice-labs/activity', JSON.stringify({
          event_type: 'input_end',
          input_duration_ms: duration,
          text_length: lastTextLengthRef.current,
          keystroke_count: keystrokeCountRef.current,
          paste_count: pasteCountRef.current,
          delete_count: deleteCountRef.current,
          revision_count: revisionCountRef.current,
        }))
      }
      // Log page close
      const pageTime = Date.now() - pageOpenTimeRef.current
      navigator.sendBeacon('/api/voice-labs/activity', JSON.stringify({
        event_type: 'session_close',
        metadata: { page_duration_ms: pageTime },
      }))
    }
  }, [])

  // ── API Helpers ──

  const loadTrainedVoices = async () => {
    setLoadingVoices(true)
    try {
      const res = await fetch('/api/voice-trainings')
      if (res.ok) {
        const data = await res.json()
        setTrainedVoices((data.voices || []).filter((v: TrainedVoice) => v.status === 'ready'))
      }
    } catch {
      // ignore
    } finally { setLoadingVoices(false) }
  }

  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/voice-labs/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      // ignore
    } finally { setLoadingSessions(false) }
  }

  const loadMessages = async (sessionId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/voice-labs/messages?sessionId=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // ignore
    } finally { setLoadingMessages(false) }
  }

  const createSession = async () => {
    try {
      const res = await fetch('/api/voice-labs/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Session ${sessions.length + 1}`, voice_id: voiceId }),
      })
      if (res.ok) {
        const data = await res.json()
        const s = data.session
        setSessions(prev => [s, ...prev])
        setActiveSessionId(s.id)
        setMessages([])
        setLeftTab('sessions')
      }
    } catch {
      // ignore
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session and all its generations?')) return
    try {
      await fetch('/api/voice-labs/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setActiveSessionId(null)
        setMessages([])
      }
    } catch {
      // ignore
    }
  }

  const renameSession = async (sessionId: string, title: string) => {
    try {
      await fetch('/api/voice-labs/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, title }),
      })
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s))
    } catch {
      // ignore
    }
    setRenamingSessionId(null)
  }

  const switchSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    loadMessages(sessionId)
  }

  // ── Training ──

  const uploadReferenceFile = async (file: File): Promise<string | null> => {
    const res = await fetch('/api/generate/upload-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileType: file.type || 'audio/wav', fileSize: file.size, type: 'voice' }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Upload failed') }
    const data = await res.json()
    if (!data.uploadUrl || !data.publicUrl) throw new Error('Missing presigned URL')
    const uploadRes = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'audio/wav' }, body: file })
    if (!uploadRes.ok) throw new Error('Upload failed')
    return data.publicUrl
  }

  const handleTrainVoice = async () => {
    setTrainError(''); setTrainSuccess('')
    if (!trainFile && !trainFileUrl && !recordedBlob) { setTrainError('Upload audio, paste a URL, or record.'); return }
    if ((credits ?? 0) < TRAIN_COST) { setTrainError(`Need ${TRAIN_COST} credits. You have ${credits ?? 0}.`); return }
    setIsTraining(true)
    try {
      let fileUrl = trainFileUrl
      if (recordedBlob && !trainFile && !trainFileUrl) {
        const f = new File([recordedBlob], `voice-rec-${Date.now()}.webm`, { type: 'audio/webm' })
        fileUrl = (await uploadReferenceFile(f)) || ''
      }
      if (trainFile && !trainFileUrl) { fileUrl = (await uploadReferenceFile(trainFile)) || '' }
      const res = await fetch('/api/generate/voice-train', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceFileUrl: fileUrl, name: trainName.trim() || 'Untitled Voice', noiseReduction, volumeNormalization }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Training failed')
      setTrainSuccess(`"${data.name}" trained! ID: ${data.voiceId}`)
      setTrainFile(null); setTrainFileUrl(''); setTrainName(''); setRecordedBlob(null); setRecordingTime(0)
      refreshCredits(); await loadTrainedVoices()
      setVoiceId(data.voiceId)
      setLeftTab('voices'); setVoiceSubTab('custom')
    } catch (e) { setTrainError(e instanceof Error ? e.message : 'Training failed') }
    finally { setIsTraining(false) }
  }

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      recordingChunksRef.current = []; setRecordingTime(0)
      recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        setRecordedBlob(new Blob(recordingChunksRef.current, { type: 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
      }
      mediaRecorderRef.current = recorder; recorder.start(1000); setIsRecordingMic(true)
      recordingTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
    } catch { setTrainError('Microphone access denied.') }
  }

  const stopMicRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setIsRecordingMic(false)
  }

  // ── Generate TTS ──

  const handleGenerate = async () => {
    setGenError('')
    if (!text.trim() || text.length < 3) { setGenError('Enter at least 3 characters.'); return }
    if (text.length > 10000) { setGenError('Max 10,000 characters.'); return }
    if (!hasEnoughCredits) { setGenError(`This would push your meter to ${projectedMeter.toLocaleString()} chars, costing ${estimatedCost} credits. You have ${credits ?? 0}.`); return }

    // Flush any open input session before generation
    flushInputSession()
    if (inputIdleTimerRef.current) { clearTimeout(inputIdleTimerRef.current); inputIdleTimerRef.current = null }

    // Log generation start
    const genStartTime = Date.now()
    logVoiceActivity('generation_start', {
      text_length: text.trim().length,
      text_snapshot: text.trim().substring(0, 2000),
      credits_estimated: estimatedCost,
    })

    // Auto-create session if none active
    let sessionId = activeSessionId
    if (!sessionId) {
      try {
        const res = await fetch('/api/voice-labs/sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: text.substring(0, 40).trim() + '...', voice_id: voiceId }),
        })
        if (res.ok) {
          const data = await res.json()
          sessionId = data.session.id
          setSessions(prev => [data.session, ...prev])
          setActiveSessionId(sessionId)
        }
      } catch {
        // ignore
      }
    }

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const tempMsg: ChatMessage = {
      id: tempId, text: text.trim(), voice_id: voiceId, audio_url: null,
      credits_cost: 0, settings: { speed, pitch, volume, emotion, audioFormat, sampleRate, bitrate, channel, languageBoost },
      status: 'generating', created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])
    const inputText = text.trim()
    setText('')
    setIsGenerating(true)

    try {
      const res = await fetch('/api/generate/voice-labs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText, title: inputText.substring(0, 60),
          voice_id: voiceId, speed, volume, pitch, emotion,
          english_normalization: englishNormalization, sample_rate: sampleRate,
          bitrate, audio_format: audioFormat, channel, subtitle_enable: subtitleEnable, language_boost: languageBoost,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed')

      // Update message
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m, id: data.predictionId || tempId, audio_url: data.audioUrl,
        credits_cost: data.creditsDeducted, status: 'completed' as const,
      } : m))

      // Save to server
      if (sessionId) {
        await fetch('/api/voice-labs/messages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId, text: inputText, voice_id: voiceId, audio_url: data.audioUrl,
            credits_cost: data.creditsDeducted,
            settings: { speed, pitch, volume, emotion, audioFormat, sampleRate, bitrate, channel, languageBoost },
            status: 'completed',
          }),
        })
      }

      refreshCredits()
      // Update character meter from API response
      if (typeof data.meterAt === 'number') setCharMeter(data.meterAt)

      // Log generation complete
      logVoiceActivity('generation_complete', {
        text_length: inputText.length,
        text_snapshot: inputText.substring(0, 2000),
        tokens_consumed: data.chars || inputText.length,
        credits_spent: data.creditsDeducted || 0,
        generation_duration_ms: Date.now() - genStartTime,
        audio_url: data.audioUrl,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed'
      setGenError(msg)
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m))

      // Log generation failed
      logVoiceActivity('generation_failed', {
        text_length: inputText.length,
        text_snapshot: inputText.substring(0, 2000),
        tokens_consumed: inputText.length,
        generation_duration_ms: Date.now() - genStartTime,
        metadata: { error: msg },
      })
    } finally { setIsGenerating(false) }
  }

  // ── Playback ──

  const togglePlay = (msg: ChatMessage) => {
    if (!msg.audio_url) return
    if (playingId === msg.id) {
      audioRef.current?.pause(); setPlayingId(null)
      if (progressRef.current) clearInterval(progressRef.current)
      return
    }
    if (audioRef.current) { audioRef.current.pause(); if (progressRef.current) clearInterval(progressRef.current) }
    const audio = new Audio(msg.audio_url)
    audioRef.current = audio; setPlayingId(msg.id); setPlaybackProgress(0)
    audio.onended = () => { setPlayingId(null); setPlaybackProgress(0); if (progressRef.current) clearInterval(progressRef.current) }
    audio.play()
    progressRef.current = setInterval(() => {
      if (audio.currentTime && audio.duration) setPlaybackProgress((audio.currentTime / audio.duration) * 100)
    }, 100)
  }

  const downloadAudio = (url: string, name: string) => {
    const a = document.createElement('a'); a.href = url; a.download = name; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const fmtTime = (s: number) => { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}` }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() }
  }

  // ── Render ──

  return (
    <div className="h-screen text-white flex flex-col overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>
      <div className="fixed inset-0 bg-black/15 backdrop-blur-[0.5px] -z-[5] pointer-events-none" />

      <FloatingMenu />

      {/* ESC hint — visible for 2s then fades */}
      <div className={`fixed top-3 right-3 z-[60] flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg transition-all duration-500 ${showEscHint ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <kbd className="text-xs font-mono text-gray-400 bg-white/10 px-2 py-0.5 rounded border border-white/10">ESC</kbd>
        <span className="text-xs text-gray-500">Back to Create</span>
      </div>

      {/* ── 3-panel layout ── */}
      <div className="flex-1 flex overflow-hidden transition-all duration-300">

        {/* ══════ LEFT SIDEBAR ══════ */}
        <div className={`${leftOpen ? 'w-[300px] min-w-[300px]' : 'w-0 min-w-0 overflow-hidden'} flex flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-xl transition-all duration-200`}>

          {/* Sidebar header */}
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent tracking-wide">VOICE LABS</h2>
              <button
                onClick={() => { setSidebarHidden(h => !h); window.dispatchEvent(new CustomEvent('toggle-docked-sidebar')) }}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Toggle nav sidebar">
                <PanelLeft size={16} className={sidebarHidden ? 'text-cyan-400' : 'text-gray-500'} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg" title="Credits balance">
                <Zap size={16} className="text-yellow-400" />
                <span className="text-lg font-bold text-white">{credits ?? '...'}</span>
                <span className="text-xs text-gray-500">credits</span>
              </div>
            </div>

            {/* Character meter progress */}
            <div className="mt-2.5 px-2.5 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-400 font-medium">Character Meter</span>
                <span className="text-[11px] text-gray-500">{charMeter.toLocaleString()} / 1,000</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    charMeter >= 800 ? 'bg-amber-400' : 'bg-cyan-500/70'
                  }`}
                  style={{ width: `${Math.min(100, (charMeter / 1000) * 100)}%` }}
                />
              </div>
              {charsToAdd > 0 && (
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">After this gen:</span>
                  <span className={`text-[11px] font-medium ${estimatedCost > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {estimatedCost > 0 ? `${estimatedCost} cr (meter resets to ${meterAfter.toLocaleString()})` : `${projectedMeter.toLocaleString()} / 1,000 · free`}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-1.5 flex items-start gap-1.5">
                <Info size={10} className="text-gray-600 flex-shrink-0 mt-px" />
                3 credits charged every 1,000 characters used
              </p>
            </div>
          </div>

          {/* Sidebar tabs */}
          <div className="flex border-b border-white/[0.06]">
            {(['voices', 'train', 'sessions'] as const).map(tab => (
              <button key={tab} onClick={() => setLeftTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                  leftTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/[0.05]' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {tab === 'voices' ? 'Voices' : tab === 'train' ? 'Clone' : 'History'}
              </button>
            ))}
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">

            {/* ── VOICES TAB ── */}
            {leftTab === 'voices' && (
              <>
                <div className="flex bg-black/30 rounded-lg p-0.5 mb-2">
                  <button onClick={() => setVoiceSubTab('system')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${voiceSubTab === 'system' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-500'}`}>System</button>
                  <button onClick={() => setVoiceSubTab('custom')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${voiceSubTab === 'custom' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-500'}`}>My Clones{trainedVoices.length > 0 && ` (${trainedVoices.length})`}</button>
                </div>

                {voiceSubTab === 'system' ? (
                  SYSTEM_VOICES.map(v => (
                    <button key={v.id} onClick={() => setVoiceId(v.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                        voiceId === v.id ? 'bg-cyan-500/10 border border-cyan-500/40' : 'hover:bg-white/[0.03] border border-transparent'
                      }`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${voiceId === v.id ? 'bg-cyan-500/20' : 'bg-white/[0.04]'}`}>
                        <User size={16} className={voiceId === v.id ? 'text-cyan-400' : 'text-gray-500'} />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${voiceId === v.id ? 'text-cyan-300' : 'text-white/70'}`}>{v.name}</div>
                        <div className="text-xs text-gray-500 truncate">{v.desc}</div>
                      </div>
                    </button>
                  ))
                ) : loadingVoices ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
                ) : trainedVoices.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <User size={24} className="text-gray-600 mb-2" />
                    <p className="text-gray-400 text-sm mb-1">No cloned voices</p>
                    <button onClick={() => setLeftTab('train')} className="text-xs text-purple-400 hover:text-purple-300">Clone a voice →</button>
                  </div>
                ) : (
                  trainedVoices.map(v => (
                    <button key={v.voice_id} onClick={() => setVoiceId(v.voice_id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                        voiceId === v.voice_id ? 'bg-purple-500/10 border border-purple-500/40' : 'hover:bg-white/[0.03] border border-transparent'
                      }`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${voiceId === v.voice_id ? 'bg-purple-500/20' : 'bg-white/[0.04]'}`}>
                        <User size={16} className={voiceId === v.voice_id ? 'text-purple-400' : 'text-gray-500'} />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${voiceId === v.voice_id ? 'text-purple-300' : 'text-white/70'}`}>{v.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">ID: {v.voice_id.substring(0, 16)}...</div>
                      </div>
                    </button>
                  ))
                )}

                {/* Direct ID input */}
                <div className="pt-3 mt-3 border-t border-white/[0.06]">
                  <label className="text-xs text-gray-500 block mb-1">Voice ID</label>
                  <input type="text" value={voiceId} onChange={e => setVoiceId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/50" />
                </div>
              </>
            )}

            {/* ── CLONE/TRAIN TAB ── */}
            {leftTab === 'train' && (
              <div className="space-y-3">
                <div className="bg-cyan-500/[0.06] border border-cyan-500/20 rounded-xl p-3">
                  <p className="text-sm text-cyan-300 font-semibold mb-1">Voice Cloning — {TRAIN_COST} Credits</p>
                  <p className="text-xs text-gray-400 leading-relaxed">Upload 10s–5min audio (MP3/WAV/M4A). Your Voice ID works instantly in Voice Labs TTS.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Voice Name</label>
                  <input type="text" value={trainName} onChange={e => setTrainName(e.target.value)} placeholder="My Voice..."
                    maxLength={100} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50" />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">Audio Source</label>
                  <input ref={trainFileInputRef} type="file" accept=".mp3,.wav,.m4a" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setTrainFile(f); setTrainFileUrl(''); setRecordedBlob(null) } }} />
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => trainFileInputRef.current?.click()}
                      className="flex items-center justify-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-gray-300 hover:border-cyan-500/30 transition-colors truncate">
                      <Upload size={14} /> {trainFile ? trainFile.name.substring(0, 12) : 'Upload'}
                    </button>
                    <button onClick={isRecordingMic ? stopMicRecording : startMicRecording}
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${isRecordingMic ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse' : 'bg-black/40 border border-white/10 text-gray-300 hover:border-cyan-500/30'}`}>
                      {isRecordingMic ? <><MicOff size={14} />{fmtTime(recordingTime)}</> : <><Mic size={14} />Record</>}
                    </button>
                  </div>
                  {recordedBlob && !isRecordingMic && <div className="flex items-center gap-1.5 mt-1.5 text-green-400 text-xs"><CheckCircle2 size={14} /> Recording ready ({fmtTime(recordingTime)})</div>}
                  {!trainFile && !recordedBlob && (
                    <input type="url" value={trainFileUrl} onChange={e => setTrainFileUrl(e.target.value)} placeholder="Or paste URL..."
                      className="w-full mt-1.5 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50" />
                  )}
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={noiseReduction} onChange={e => setNoiseReduction(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" /> Noise Reduction
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={volumeNormalization} onChange={e => setVolumeNormalization(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" /> Volume Norm
                  </label>
                </div>

                {trainError && <div className="flex items-start gap-1.5 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5"><AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{trainError}</div>}
                {trainSuccess && <div className="flex items-start gap-1.5 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg p-2.5"><CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />{trainSuccess}</div>}

                <button onClick={handleTrainVoice} disabled={isTraining || (!trainFile && !trainFileUrl && !recordedBlob)}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-500 text-white font-semibold py-3 rounded-lg text-sm hover:from-cyan-500 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  {isTraining ? <><Loader2 size={16} className="animate-spin" />Training...</> : <><Zap size={16} />Clone — {TRAIN_COST} Cr</>}
                </button>
              </div>
            )}

            {/* ── SESSIONS TAB ── */}
            {leftTab === 'sessions' && (
              <>
                <button onClick={createSession} className="w-full flex items-center justify-center gap-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-lg py-2.5 text-xs font-semibold hover:bg-cyan-500/20 transition-colors mb-2">
                  <Plus size={14} /> New Session
                </button>
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
                ) : sessions.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <MessageSquare size={24} className="text-gray-600 mb-2" />
                    <p className="text-gray-400 text-sm">No sessions yet</p>
                    <p className="text-gray-500 text-xs">Generate speech to auto-create one</p>
                  </div>
                ) : sessions.map(s => (
                  <div key={s.id} onClick={() => switchSession(s.id)}
                    className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      activeSessionId === s.id ? 'bg-cyan-500/10 border border-cyan-500/30' : 'hover:bg-white/[0.03] border border-transparent'
                    }`}>
                    <MessageSquare size={14} className={activeSessionId === s.id ? 'text-cyan-400' : 'text-gray-600'} />
                    {renamingSessionId === s.id ? (
                      <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => renameSession(s.id, renameValue)}
                        onKeyDown={e => { if (e.key === 'Enter') renameSession(s.id, renameValue) }}
                        className="flex-1 bg-transparent text-sm text-white outline-none border-b border-cyan-500/50" />
                    ) : (
                      <span className={`flex-1 text-sm truncate ${activeSessionId === s.id ? 'text-cyan-300' : 'text-white/60'}`}>{s.title}</span>
                    )}
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setRenamingSessionId(s.id); setRenameValue(s.title) }} className="p-1 hover:bg-white/10 rounded"><Edit3 size={12} className="text-gray-500" /></button>
                      <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }} className="p-1 hover:bg-red-500/20 rounded"><Trash2 size={12} className="text-gray-500 hover:text-red-400" /></button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ══════ CENTER — CHAT AREA ══════ */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-black/20 backdrop-blur-xl">
            <button onClick={() => setLeftOpen(!leftOpen)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors md:block hidden">
              {leftOpen ? <ChevronLeft size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white truncate">
                  {activeSessionId ? sessions.find(s => s.id === activeSessionId)?.title || 'Session' : 'Voice Labs'}
                </span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-cyan-400/70">{selectedVoiceName}</span>
              </div>
            </div>
            <button onClick={createSession} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-300 hover:bg-cyan-500/20 transition-colors">
              <Plus size={12} /> New
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
            {messages.length === 0 && !loadingMessages && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-20 h-20 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4">
                  <Mic size={36} className="text-gray-600" />
                </div>
                <h3 className="text-white/60 text-lg font-medium mb-2">Voice Labs</h3>
                <p className="text-gray-500 text-sm max-w-sm leading-relaxed">Type text below and press Enter to generate speech. Select a voice from the sidebar.</p>
                <p className="text-gray-500 text-xs mt-3">Use <code className="text-cyan-400/60 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">{'<#0.5#>'}</code> for pauses</p>
              </div>
            )}
            {loadingMessages && (
              <div className="flex items-center justify-center py-12 text-gray-500 text-sm gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading messages...
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className="group">
                {/* User text */}
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Type size={14} className="text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      <span>{msg.voice_id === voiceId ? selectedVoiceName : msg.voice_id.substring(0, 16)}</span>
                      <span>•</span>
                      <span>{msg.credits_cost} credits</span>
                    </div>
                  </div>
                </div>

                {/* Audio response */}
                <div className="ml-8">
                  {msg.status === 'generating' ? (
                    <div className="flex items-center gap-2 bg-cyan-500/[0.06] border border-cyan-500/20 rounded-xl px-4 py-3">
                      <Loader2 size={16} className="text-cyan-400 animate-spin" />
                      <span className="text-cyan-300 text-sm">Generating audio...</span>
                    </div>
                  ) : msg.status === 'failed' ? (
                    <div className="flex items-center gap-2 bg-red-500/[0.06] border border-red-500/20 rounded-xl px-4 py-3">
                      <AlertCircle size={16} className="text-red-400" />
                      <span className="text-red-300 text-sm">Generation failed</span>
                    </div>
                  ) : msg.audio_url ? (
                    <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-cyan-500/20 transition-colors">
                      <button onClick={() => togglePlay(msg)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${playingId === msg.id ? 'bg-cyan-500/20 border border-cyan-500/40' : 'bg-black/40 border border-white/[0.08] hover:border-cyan-500/30'}`}>
                        {playingId === msg.id ? <Pause size={16} className="text-cyan-400" /> : <Play size={16} className="text-gray-400 ml-0.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        {playingId === msg.id ? (
                          <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-100" style={{ width: `${playbackProgress}%` }} />
                          </div>
                        ) : (
                          <div className="w-full bg-white/[0.06] rounded-full h-1.5" />
                        )}
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => downloadAudio(msg.audio_url!, `voice-labs-${msg.id}.${audioFormat}`)} className="p-1.5 hover:bg-white/10 rounded" title="Download"><Download size={14} className="text-gray-500 hover:text-cyan-400" /></button>
                        <button onClick={() => navigator.clipboard.writeText(msg.audio_url!)} className="p-1.5 hover:bg-white/10 rounded" title="Copy URL"><Copy size={14} className="text-gray-500 hover:text-cyan-400" /></button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div className="border-t border-white/[0.06] bg-black/30 backdrop-blur-xl px-4 py-3">
            {genError && (
              <div className="flex items-center gap-2 text-red-400 text-xs mb-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> {genError}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={text}
                  onChange={e => {
                    const val = e.target.value
                    setText(val)
                    lastTextLengthRef.current = val.length
                    revisionCountRef.current++
                    // Start input session on first keystroke
                    if (!inputStartTimeRef.current && val.length > 0) {
                      inputStartTimeRef.current = Date.now()
                      logVoiceActivity('input_start', { text_length: val.length })
                    }
                    // Reset idle timer — flush after 5s of inactivity
                    if (inputIdleTimerRef.current) clearTimeout(inputIdleTimerRef.current)
                    inputIdleTimerRef.current = setTimeout(flushInputSession, 5000)
                  }}
                  onKeyDown={(e) => {
                    keystrokeCountRef.current++
                    if (e.key === 'Backspace' || e.key === 'Delete') deleteCountRef.current++
                    handleKeyDown(e)
                  }}
                  onPaste={() => { pasteCountRef.current++ }}
                  placeholder="Enter text to generate speech..."
                  maxLength={10000}
                  rows={1}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pr-20 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed"
                  style={{ minHeight: '48px', maxHeight: '160px' }}
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px' }}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                  {charsToAdd > 0 && (
                    <span className={`text-xs mr-1 ${!hasEnoughCredits ? 'text-red-400' : estimatedCost > 0 ? 'text-amber-400' : 'text-emerald-400/70'}`}>
                      {estimatedCost > 0 ? `${estimatedCost} cr` : 'free'}
                    </span>
                  )}
                  <button onClick={handleGenerate} disabled={isGenerating || !text.trim() || text.length > 10000}
                    className={`p-2 rounded-lg transition-all ${isGenerating || !text.trim() ? 'text-gray-600' : 'text-cyan-400 hover:bg-cyan-500/20'}`}>
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-gray-500">
                {text.length.toLocaleString()}/10,000 chars · meter {charMeter}/{projectedMeter > 1000 ? `1,000 → ${estimatedCost} cr` : `1,000`} · {selectedVoiceName}
              </p>
              <p className="text-xs text-gray-500">
                Shift+Enter for newline · <code className="text-gray-500">{'<#0.5#>'}</code> for pauses
              </p>
            </div>
          </div>
        </div>

        {/* ══════ RIGHT SIDEBAR — CONTROLS ══════ */}
        <div className="hidden lg:flex w-[260px] min-w-[260px] flex-col border-l border-white/[0.06] bg-black/40 backdrop-blur-xl overflow-y-auto custom-scrollbar">

          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal size={14} /> Voice Controls
            </h3>
          </div>

          <div className="p-4 space-y-5">

            {/* Emotion */}
            <div>
              <label className="text-xs text-gray-400 block mb-2">Emotion</label>
              <div className="grid grid-cols-2 gap-1">
                {EMOTIONS.map(e => (
                  <button key={e.value} onClick={() => setEmotion(e.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs transition-all ${
                      emotion === e.value ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40' : 'text-gray-500 hover:text-gray-300 border border-transparent'
                    }`}>{e.label}</button>
                ))}
              </div>
            </div>

            {/* Speed */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Speed</label>
                <span className="text-xs font-mono text-white/50">{speed.toFixed(1)}x</span>
              </div>
              <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1.5" />
            </div>

            {/* Volume */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Volume</label>
                <span className="text-xs font-mono text-white/50">{volume.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="10" step="0.1" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-full accent-cyan-500 h-1.5" />
            </div>

            {/* Pitch */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Pitch</label>
                <span className="text-xs font-mono text-white/50">{pitch > 0 ? '+' : ''}{pitch}st</span>
              </div>
              <input type="range" min="-12" max="12" step="1" value={pitch} onChange={e => setPitch(parseInt(e.target.value))} className="w-full accent-cyan-500 h-1.5" />
            </div>

            {/* Language */}
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Language Boost</label>
              <select value={languageBoost} onChange={e => setLanguageBoost(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50 appearance-none">
                {LANGUAGES.map(l => <option key={l} value={l}>{l === 'None' ? 'None (auto)' : l}</option>)}
              </select>
            </div>

            {/* Advanced toggle */}
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors py-2 border-t border-white/[0.06] mt-2">
              <span className="flex items-center gap-1.5"><Settings2 size={14} /> Advanced</span>
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showAdvanced && (
              <div className="space-y-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={englishNormalization} onChange={e => setEnglishNormalization(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" />
                  <span className="text-xs text-gray-400">English Normalization</span>
                </label>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Format</label>
                  <div className="grid grid-cols-2 gap-1">
                    {AUDIO_FORMATS.map(f => (
                      <button key={f} onClick={() => setAudioFormat(f)}
                        className={`py-1.5 rounded-lg text-xs ${audioFormat === f ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40' : 'text-gray-500 border border-transparent hover:text-gray-300'}`}>{f.toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Sample Rate</label>
                  <select value={sampleRate} onChange={e => setSampleRate(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                    {SAMPLE_RATES.map(sr => <option key={sr} value={sr}>{(sr / 1000).toFixed(sr % 1000 ? 2 : 0)} kHz</option>)}
                  </select>
                </div>

                {audioFormat === 'mp3' && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Bitrate</label>
                    <select value={bitrate} onChange={e => setBitrate(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50">
                      {BITRATES.map(br => <option key={br} value={br}>{br / 1000} kbps</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Channel</label>
                  <div className="grid grid-cols-2 gap-1">
                    {CHANNELS.map(ch => (
                      <button key={ch} onClick={() => setChannel(ch)}
                        className={`py-1.5 rounded-lg text-xs capitalize ${channel === ch ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40' : 'text-gray-500 border border-transparent hover:text-gray-300'}`}>{ch}</button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={subtitleEnable} onChange={e => setSubtitleEnable(e.target.checked)} className="accent-cyan-500 w-3.5 h-3.5" />
                  <span className="text-xs text-gray-400">Generate Subtitles</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  )
}
