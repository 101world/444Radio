'use client'

import { useState, useRef, useEffect, lazy, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Mic, MicOff, Upload, Trash2, Play, Pause, Loader2,
  Zap, User, Volume2, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, DollarSign
} from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'
import FloatingMenu from '@/app/components/FloatingMenu'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))

interface TrainedVoice {
  id: string
  voice_id: string
  name: string
  preview_url: string | null
  status: string
  created_at: string
  metadata?: Record<string, unknown>
}

export default function VoiceTrainingPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { totalCredits: credits, refreshCredits } = useCredits()

  // Training form
  const [trainName, setTrainName] = useState('')
  const [trainFile, setTrainFile] = useState<File | null>(null)
  const [trainFileUrl, setTrainFileUrl] = useState('')
  const [noiseReduction, setNoiseReduction] = useState(false)
  const [volumeNormalization, setVolumeNormalization] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [trainError, setTrainError] = useState('')
  const [trainSuccess, setTrainSuccess] = useState('')

  // Mic recording
  const [isRecordingMic, setIsRecordingMic] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Trained voices list
  const [trainedVoices, setTrainedVoices] = useState<TrainedVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null)

  // Preview
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null)

  const COST = 120

  useEffect(() => {
    loadTrainedVoices()
  }, [])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const loadTrainedVoices = async () => {
    setLoadingVoices(true)
    try {
      const res = await fetch('/api/voice-trainings')
      if (res.ok) {
        const data = await res.json()
        setTrainedVoices(data.voices || [])
      }
    } catch (e) {
      console.error('Failed to load trained voices:', e)
    } finally {
      setLoadingVoices(false)
    }
  }

  // Listing state
  const [listingVoiceId, setListingVoiceId] = useState<string | null>(null)

  const handleDeleteVoice = async (trainingId: string) => {
    if (!confirm('Delete this trained voice? This cannot be undone.')) return
    setDeletingVoiceId(trainingId)
    try {
      const res = await fetch('/api/voice-trainings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId })
      })
      if (res.ok) {
        setTrainedVoices(prev => prev.filter(v => v.id !== trainingId))
      }
    } catch (e) {
      console.error('Failed to delete voice:', e)
    } finally {
      setDeletingVoiceId(null)
    }
  }

  const handleListVoice = async (trainingId: string) => {
    setListingVoiceId(trainingId)
    try {
      const res = await fetch('/api/earn/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceTrainingId: trainingId })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to list voice')
      } else {
        alert('Voice listed on the Earn marketplace! You earn 1 credit each time someone uses it.')
      }
    } catch {
      alert('Failed to list voice')
    } finally {
      setListingVoiceId(null)
    }
  }

  const uploadReferenceFile = async (file: File): Promise<string | null> => {
    // Step 1: Get presigned URL
    const res = await fetch('/api/generate/upload-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || 'audio/wav',
        fileSize: file.size,
        type: 'voice',
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Upload failed')
    }
    const data = await res.json()
    if (!data.uploadUrl || !data.publicUrl) throw new Error('Missing presigned URL')

    // Step 2: Upload directly to R2
    const uploadRes = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'audio/wav' },
      body: file,
    })
    if (!uploadRes.ok) throw new Error('Direct upload to R2 failed')

    return data.publicUrl
  }

  const handleTrainVoice = async () => {
    setTrainError('')
    setTrainSuccess('')

    if (!trainFile && !trainFileUrl && !recordedBlob) {
      setTrainError('Please upload a voice file, paste a URL, or record with your microphone.')
      return
    }

    if ((credits ?? 0) < COST) {
      setTrainError(`Insufficient credits. Voice training requires ${COST} credits. You have ${credits ?? 0}.`)
      return
    }

    setIsTraining(true)

    try {
      let fileUrl = trainFileUrl

      // If recorded from mic, upload that
      if (recordedBlob && !trainFile && !trainFileUrl) {
        const file = new File([recordedBlob], `voice-recording-${Date.now()}.webm`, { type: 'audio/webm' })
        const url = await uploadReferenceFile(file)
        if (!url) throw new Error('Failed to upload recording')
        fileUrl = url
      }

      // If file uploaded, upload to R2 first
      if (trainFile && !trainFileUrl) {
        const url = await uploadReferenceFile(trainFile)
        if (!url) throw new Error('Failed to upload voice file')
        fileUrl = url
      }

      const res = await fetch('/api/generate/voice-train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceFileUrl: fileUrl,
          name: trainName.trim() || 'Untitled Voice',
          noiseReduction,
          volumeNormalization,
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Voice training failed')
      }

      setTrainSuccess(`Voice "${data.name}" trained successfully! Voice ID: ${data.voiceId}`)
      setTrainFile(null)
      setTrainFileUrl('')
      setTrainName('')
      setRecordedBlob(null)
      setRecordingTime(0)

      refreshCredits()
      await loadTrainedVoices()

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice training failed'
      setTrainError(msg)
    } finally {
      setIsTraining(false)
    }
  }

  // Mic recording
  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

      recordingChunksRef.current = []
      setRecordingTime(0)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(blob)
        stream.getTracks().forEach(t => t.stop())
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setIsRecordingMic(true)
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)
    } catch {
      setTrainError('Could not access microphone. Please check permissions.')
    }
  }

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecordingMic(false)
  }

  const togglePreview = (url: string, id: string) => {
    if (previewPlayingId === id) {
      previewAudioRef.current?.pause()
      setPreviewPlayingId(null)
    } else {
      if (previewAudioRef.current) previewAudioRef.current.pause()
      const audio = new Audio(url)
      audio.onended = () => setPreviewPlayingId(null)
      audio.play()
      previewAudioRef.current = audio
      setPreviewPlayingId(id)
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
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
        <div className="px-4 md:px-8 max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/create')} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.08] transition">
              <ArrowLeft size={18} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                VOICE TRAINING
              </h1>
              <p className="text-[10px] text-gray-500">Clone your voice with AI</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-purple-500/20 rounded-xl backdrop-blur-xl">
              <Zap size={12} className="text-purple-400" />
              <span className="text-xs font-semibold text-white">{credits ?? '...'}</span>
              <span className="text-[9px] text-gray-500">cr</span>
            </div>
          </div>

          {/* Cost info */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 mb-6 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-purple-300 font-semibold text-sm mb-1">Voice Cloning — {COST} Credits</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Upload an audio file (10s–5min, MP3/WAV/M4A, &lt;20MB) or record with your mic.
                  Your trained Voice ID can be used in <strong className="text-cyan-300"><a href="/voice-labs" className="underline decoration-cyan-400/30">Voice Labs</a></strong> to generate
                  text-to-speech with your cloned voice. You can also list your Voice ID on the Earn marketplace for others to use.
                </p>
              </div>
            </div>
          </div>

          {/* Training Form */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-xl mb-6 space-y-5">
            <h2 className="text-white font-bold text-base">Train a New Voice</h2>

            {/* Voice Name */}
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Voice Name</label>
              <input
                type="text"
                value={trainName}
                onChange={e => setTrainName(e.target.value)}
                placeholder="e.g., My Voice, Studio Singer..."
                maxLength={100}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>

            {/* File upload */}
            <div>
              <label className="text-sm text-gray-400 block mb-1.5">Voice Audio</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setTrainFile(f)
                    setTrainFileUrl('')
                    setRecordedBlob(null)
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-300 hover:border-purple-500/50 hover:text-white transition-colors"
                >
                  <Upload size={16} />
                  {trainFile ? trainFile.name : 'Upload File'}
                </button>
                <button
                  onClick={isRecordingMic ? stopMicRecording : startMicRecording}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${
                    isRecordingMic
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                      : 'bg-black/40 border border-white/10 text-gray-300 hover:border-purple-500/50 hover:text-white'
                  }`}
                >
                  {isRecordingMic ? <MicOff size={16} /> : <Mic size={16} />}
                  {isRecordingMic ? `Rec ${formatTime(recordingTime)}` : 'Record Mic'}
                </button>
              </div>

              {recordedBlob && !isRecordingMic && (
                <div className="flex items-center gap-2 mt-2 text-green-400 text-xs">
                  <CheckCircle2 size={14} />
                  Recording ready ({formatTime(recordingTime)})
                </div>
              )}

              {!trainFile && !recordedBlob && (
                <div className="mt-2">
                  <input
                    type="url"
                    value={trainFileUrl}
                    onChange={e => setTrainFileUrl(e.target.value)}
                    placeholder="Or paste audio URL..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                <input type="checkbox" checked={noiseReduction} onChange={e => setNoiseReduction(e.target.checked)} className="accent-purple-500 rounded" />
                Noise Reduction
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
                <input type="checkbox" checked={volumeNormalization} onChange={e => setVolumeNormalization(e.target.checked)} className="accent-purple-500 rounded" />
                Volume Normalization
              </label>
            </div>

            {/* Error/Success */}
            {trainError && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {trainError}
              </div>
            )}
            {trainSuccess && (
              <div className="flex items-start gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                {trainSuccess}
              </div>
            )}

            {/* Train Button */}
            <button
              onClick={handleTrainVoice}
              disabled={isTraining || (!trainFile && !trainFileUrl && !recordedBlob)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold py-3.5 rounded-xl hover:from-purple-500 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20"
            >
              {isTraining ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Training Voice...
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Train Voice — {COST} Credits
                </>
              )}
            </button>
          </div>

          {/* Trained Voices */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-base">Your Trained Voices</h2>
              <button
                onClick={loadTrainedVoices}
                disabled={loadingVoices}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-400 transition-colors"
              >
                <RefreshCw size={12} className={loadingVoices ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {loadingVoices ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-12">
                <Loader2 size={16} className="animate-spin" />
                Loading voices...
              </div>
            ) : trainedVoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-3">
                  <User size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-400 text-sm font-medium mb-1">No trained voices yet</p>
                <p className="text-gray-600 text-xs">Upload audio above to train your first Voice ID</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trainedVoices.map(voice => (
                  <div key={voice.id} className="flex items-center justify-between bg-black/30 border border-white/[0.06] rounded-xl px-4 py-3 group hover:border-purple-500/30 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                        <User size={16} className="text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{voice.name}</p>
                        <p className="text-gray-500 text-xs font-mono">ID: {voice.voice_id.substring(0, 16)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href="/voice-labs"
                        className="p-2 hover:bg-cyan-500/20 rounded-lg transition-colors"
                        title="Use in Voice Labs"
                      >
                        <Mic size={14} className="text-gray-500 hover:text-cyan-400" />
                      </a>
                      <button
                        onClick={() => handleListVoice(voice.id)}
                        disabled={listingVoiceId === voice.id}
                        className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors"
                        title="List on Earn marketplace"
                      >
                        {listingVoiceId === voice.id
                          ? <Loader2 size={14} className="text-gray-400 animate-spin" />
                          : <DollarSign size={14} className="text-gray-500 hover:text-emerald-400" />}
                      </button>
                      <button
                        onClick={() => handleDeleteVoice(voice.id)}
                        disabled={deletingVoiceId === voice.id}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        {deletingVoiceId === voice.id
                          ? <Loader2 size={14} className="text-gray-400 animate-spin" />
                          : <Trash2 size={14} className="text-gray-500 hover:text-red-400" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
