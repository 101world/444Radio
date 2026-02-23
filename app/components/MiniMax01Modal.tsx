'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Loader2, Music, Mic, MicOff, Upload, Trash2, Play, Pause, Volume2, Zap, User, Guitar, FileAudio } from 'lucide-react'

interface TrainedVoice {
  id: string
  voice_id: string
  name: string
  preview_url: string | null
  source_audio_url?: string
  status: string
  created_at: string
}

interface MiniMax01ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
  userCredits: number | null
}

type ActiveTab = 'voice-train' | 'voice-ref' | 'instrumental-ref'

export default function MiniMax01Modal({ isOpen, onClose, onSuccess, onError, userCredits }: MiniMax01ModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('voice-train')

  // Voice training state
  const [trainName, setTrainName] = useState('')
  const [trainFile, setTrainFile] = useState<File | null>(null)
  const [trainFileUrl, setTrainFileUrl] = useState('')
  const [noiseReduction, setNoiseReduction] = useState(false)
  const [volumeNormalization, setVolumeNormalization] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [trainError, setTrainError] = useState('')
  const [trainSuccess, setTrainSuccess] = useState('')

  // Trained voices list
  const [trainedVoices, setTrainedVoices] = useState<TrainedVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null)

  // Generation state (shared across voice-ref and instrumental-ref)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('medium')
  const [genre, setGenre] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  // Voice reference state
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [voiceRefFile, setVoiceRefFile] = useState<File | null>(null)
  const [voiceRefUrl, setVoiceRefUrl] = useState('')
  const [isUploadingVoiceRef, setIsUploadingVoiceRef] = useState(false)

  // Mic recording for voice reference
  const [isRecordingMic, setIsRecordingMic] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Instrumental reference state
  const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null)
  const [instrumentalUrl, setInstrumentalUrl] = useState('')
  const [isUploadingInstrumental, setIsUploadingInstrumental] = useState(false)

  // Song reference state
  const [songRefFile, setSongRefFile] = useState<File | null>(null)
  const [songRefUrl, setSongRefUrl] = useState('')
  const [isUploadingSongRef, setIsUploadingSongRef] = useState(false)

  // Refs
  const trainFileInputRef = useRef<HTMLInputElement>(null)
  const voiceRefInputRef = useRef<HTMLInputElement>(null)
  const instrumentalInputRef = useRef<HTMLInputElement>(null)
  const songRefInputRef = useRef<HTMLInputElement>(null)

  // Preview audio
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Load trained voices on mount
  useEffect(() => {
    if (isOpen) {
      loadTrainedVoices()
    }
  }, [isOpen])

  // Cleanup recording on unmount
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

  const handleDeleteVoice = async (trainingId: string) => {
    setDeletingVoiceId(trainingId)
    try {
      const res = await fetch('/api/voice-trainings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainingId })
      })
      if (res.ok) {
        setTrainedVoices(prev => prev.filter(v => v.id !== trainingId))
        if (selectedVoiceId === trainedVoices.find(v => v.id === trainingId)?.voice_id) {
          setSelectedVoiceId('')
        }
      }
    } catch (e) {
      console.error('Failed to delete voice:', e)
    } finally {
      setDeletingVoiceId(null)
    }
  }

  // Upload file helper — presigned URL flow (bypasses Vercel 4.5 MB limit)
  const uploadReferenceFile = async (file: File, type: 'voice' | 'instrumental' | 'song'): Promise<string | null> => {
    // Step 1: Get presigned URL
    const res = await fetch('/api/generate/upload-reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || 'audio/wav',
        fileSize: file.size,
        type,
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

  // ── VOICE TRAINING ──

  const handleTrainVoice = async () => {
    setTrainError('')
    setTrainSuccess('')

    if (!trainFile && !trainFileUrl) {
      setTrainError('Please upload a voice file or provide a URL')
      return
    }

    if ((userCredits ?? 0) < 120) {
      setTrainError('Insufficient credits. Voice training requires 120 credits.')
      return
    }

    setIsTraining(true)

    try {
      let fileUrl = trainFileUrl

      // If file uploaded, upload to R2 first
      if (trainFile && !trainFileUrl) {
        const uploadedUrl = await uploadReferenceFile(trainFile, 'voice')
        if (!uploadedUrl) throw new Error('Failed to upload voice file')
        fileUrl = uploadedUrl
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

      // Refresh voices list
      await loadTrainedVoices()

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice training failed'
      setTrainError(msg)
      onError?.(msg)
    } finally {
      setIsTraining(false)
    }
  }

  // ── MIC RECORDING ──

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

      recordingChunksRef.current = []
      setRecordingTime(0)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data)
        }
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
      recorder.start(1000) // Collect data every 1s
      setIsRecordingMic(true)

      // Timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Mic error:', err)
      setGenError('Could not access microphone. Please check permissions.')
    }
  }

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecordingMic(false)
  }

  const useRecordedAudioAsVoiceRef = async () => {
    if (!recordedBlob) return

    setIsUploadingVoiceRef(true)
    try {
      // Convert webm to wav-like file for upload
      const file = new File([recordedBlob], `voice-recording-${Date.now()}.webm`, { type: 'audio/webm' })
      const url = await uploadReferenceFile(file, 'voice')
      if (url) {
        setVoiceRefUrl(url)
        setRecordedBlob(null)
        setRecordingTime(0)
      }
    } catch (e) {
      setGenError('Failed to upload recording')
    } finally {
      setIsUploadingVoiceRef(false)
    }
  }

  // ── GENERATION (Music-01) ──

  const handleGenerate = async () => {
    setGenError('')

    if (!title.trim() || title.trim().length < 3) {
      setGenError('Title is required (at least 3 characters)')
      return
    }
    if (!prompt.trim() || prompt.trim().length < 10) {
      setGenError('Prompt is required (at least 10 characters)')
      return
    }

    if ((userCredits ?? 0) < 3) {
      setGenError('Insufficient credits. Music generation requires 3 credits.')
      return
    }

    setIsGenerating(true)

    try {
      // Upload pending reference files
      let finalVoiceRefUrl = voiceRefUrl
      let finalInstrumentalUrl = instrumentalUrl
      let finalSongRefUrl = songRefUrl

      if (voiceRefFile && !voiceRefUrl) {
        setIsUploadingVoiceRef(true)
        const url = await uploadReferenceFile(voiceRefFile, 'voice')
        if (url) finalVoiceRefUrl = url
        setIsUploadingVoiceRef(false)
      }

      if (instrumentalFile && !instrumentalUrl) {
        setIsUploadingInstrumental(true)
        const url = await uploadReferenceFile(instrumentalFile, 'instrumental')
        if (url) finalInstrumentalUrl = url
        setIsUploadingInstrumental(false)
      }

      if (songRefFile && !songRefUrl) {
        setIsUploadingSongRef(true)
        const url = await uploadReferenceFile(songRefFile, 'song')
        if (url) finalSongRefUrl = url
        setIsUploadingSongRef(false)
      }

      const requestBody: Record<string, unknown> = {
        title: title.trim(),
        prompt: prompt.trim().slice(0, 300),
        lyrics: lyrics.trim() || undefined,
        duration,
        genre: genre || undefined,
      }

      // If trained voice selected, use its source audio as voice_file
      // (voice_id from voice-cloning isn't transferable to music-01)
      if (selectedVoiceId) {
        const selectedVoice = trainedVoices.find(v => v.voice_id === selectedVoiceId)
        if (selectedVoice?.source_audio_url) {
          requestBody.voice_file = selectedVoice.source_audio_url
        } else {
          requestBody.voice_id = selectedVoiceId
        }
      }
      if (finalVoiceRefUrl) requestBody.voice_file = finalVoiceRefUrl
      if (finalSongRefUrl) requestBody.song_file = finalSongRefUrl
      if (finalInstrumentalUrl) requestBody.instrumental_file = finalInstrumentalUrl

      const res = await fetch('/api/generate/music-01', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      // Parse NDJSON stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let resultData: any = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'result') {
              resultData = parsed
            }
          } catch { /* skip */ }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer)
          if (parsed.type === 'result') resultData = parsed
        } catch { /* skip */ }
      }

      if (!resultData) {
        throw new Error('No result received from generation')
      }

      if (resultData.success) {
        onSuccess?.(resultData)
        handleClose()
      } else {
        throw new Error(resultData.error || 'Generation failed')
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setGenError(msg)
      onError?.(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── PREVIEW AUDIO ──

  const togglePreview = (url: string, id: string) => {
    if (previewPlayingId === id) {
      previewAudioRef.current?.pause()
      setPreviewPlayingId(null)
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
      }
      const audio = new Audio(url)
      audio.onended = () => setPreviewPlayingId(null)
      audio.play()
      previewAudioRef.current = audio
      setPreviewPlayingId(id)
    }
  }

  const handleClose = () => {
    if (isTraining || isGenerating) return
    setTrainError('')
    setTrainSuccess('')
    setGenError('')
    onClose()
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Music size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">444 Radio</h2>
              <p className="text-gray-400 text-xs">Voice Training · Voice Reference · Instrumental Reference</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { key: 'voice-train' as ActiveTab, label: 'Train Voice', icon: User, cost: 120, costLabel: '120 cr' },
            { key: 'voice-ref' as ActiveTab, label: 'Voice Ref', icon: Mic, cost: 3, costLabel: '3 credits' },
            { key: 'instrumental-ref' as ActiveTab, label: 'Instrumental', icon: Guitar, cost: 3, costLabel: '3 credits' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/10 text-gray-500'
              }`}>{tab.costLabel}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── VOICE TRAINING TAB ── */}
          {activeTab === 'voice-train' && (
            <>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                <p className="text-purple-300 text-sm">
                  <strong>Voice Training</strong> — Clone your voice from an audio file (10s–5min, MP3/WAV/M4A, &lt;20MB).
                  The trained voice ID can be reused for unlimited music generations.
                  <span className="text-purple-400 font-bold"> Costs 120 credits.</span>
                </p>
              </div>

              {/* Voice Name */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Voice Name</label>
                <input
                  type="text"
                  value={trainName}
                  onChange={e => setTrainName(e.target.value)}
                  placeholder="e.g., My Voice, Studio Singer"
                  maxLength={100}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Voice File Upload */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Voice Audio File</label>
                <input
                  ref={trainFileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setTrainFile(f)
                      setTrainFileUrl('')
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => trainFileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-300 hover:border-purple-500/50 hover:text-white transition-colors"
                  >
                    <Upload size={16} />
                    {trainFile ? trainFile.name : 'Upload Audio'}
                  </button>
                </div>
                {!trainFile && (
                  <div className="mt-2">
                    <input
                      type="url"
                      value={trainFileUrl}
                      onChange={e => setTrainFileUrl(e.target.value)}
                      placeholder="Or paste audio URL..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={noiseReduction} onChange={e => setNoiseReduction(e.target.checked)} className="accent-purple-500" />
                  Noise Reduction
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={volumeNormalization} onChange={e => setVolumeNormalization(e.target.checked)} className="accent-purple-500" />
                  Volume Normalization
                </label>
              </div>

              {/* Error/Success */}
              {trainError && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3">{trainError}</p>}
              {trainSuccess && <p className="text-green-400 text-sm bg-green-500/10 rounded-xl p-3">{trainSuccess}</p>}

              {/* Train Button */}
              <button
                onClick={handleTrainVoice}
                disabled={isTraining || (!trainFile && !trainFileUrl)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold py-3 rounded-xl hover:from-purple-500 hover:to-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isTraining ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Training Voice...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Train Voice (120 credits)
                  </>
                )}
              </button>

              {/* Trained Voices List */}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold text-sm">Your Trained Voices</h3>
                  <button onClick={loadTrainedVoices} className="text-xs text-gray-400 hover:text-cyan-400 transition-colors">
                    Refresh
                  </button>
                </div>

                {loadingVoices ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <Loader2 size={14} className="animate-spin" />
                    Loading voices...
                  </div>
                ) : trainedVoices.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">No trained voices yet. Train your first voice above!</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {trainedVoices.map(voice => (
                      <div key={voice.id} className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <User size={14} className="text-purple-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{voice.name}</p>
                            <p className="text-gray-500 text-xs">ID: {voice.voice_id.substring(0, 12)}...</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {voice.preview_url && (
                            <button
                              onClick={() => togglePreview(voice.preview_url!, voice.id)}
                              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                              title="Preview"
                            >
                              {previewPlayingId === voice.id ? <Pause size={14} className="text-cyan-400" /> : <Play size={14} className="text-gray-400" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteVoice(voice.id)}
                            disabled={deletingVoiceId === voice.id}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            {deletingVoiceId === voice.id ? <Loader2 size={14} className="text-gray-400 animate-spin" /> : <Trash2 size={14} className="text-gray-400 hover:text-red-400" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── VOICE REFERENCE TAB ── */}
          {activeTab === 'voice-ref' && (
            <>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4">
                <p className="text-cyan-300 text-sm">
                  <strong>Voice Reference Generation</strong> — Upload a voice file or record with your mic, and generate music with that voice style.
                  You can also select a previously trained voice ID.
                  <span className="text-cyan-400 font-bold"> Costs 3 credits.</span>
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Song title"
                  maxLength={100}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Prompt * <span className="text-gray-500">(10-300 chars)</span></label>
                <input
                  type="text"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe the style, mood, genre..."
                  maxLength={300}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                <p className="text-gray-500 text-xs mt-1 text-right">{prompt.length}/300</p>
              </div>

              {/* Lyrics */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Lyrics <span className="text-gray-500">(optional, max 400 chars)</span></label>
                <textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder="[intro]\nYour lyrics here...\n\n[chorus]\nChorus lyrics..."
                  maxLength={400}
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
                <p className="text-gray-500 text-xs mt-1 text-right">{lyrics.length}/400</p>
              </div>

              {/* Voice Source Selection */}
              <div className="space-y-3">
                <label className="text-sm text-gray-400 block">Voice Source</label>

                {/* Option 1: Trained Voice */}
                {trainedVoices.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Select Trained Voice</label>
                    <select
                      value={selectedVoiceId}
                      onChange={e => {
                        setSelectedVoiceId(e.target.value)
                        if (e.target.value) {
                          setVoiceRefFile(null)
                          setVoiceRefUrl('')
                          setRecordedBlob(null)
                        }
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="">— None (use file/mic below) —</option>
                      {trainedVoices.map(v => (
                        <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.voice_id.substring(0, 8)}...)</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Option 2: Upload Voice File */}
                {!selectedVoiceId && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Upload Voice File (.wav/.mp3, &gt;15s)</label>
                    <input
                      ref={voiceRefInputRef}
                      type="file"
                      accept=".wav,.mp3"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) {
                          setVoiceRefFile(f)
                          setVoiceRefUrl('')
                          setRecordedBlob(null)
                        }
                      }}
                    />
                    <button
                      onClick={() => voiceRefInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-300 hover:border-cyan-500/50 hover:text-white transition-colors"
                    >
                      <Upload size={16} />
                      {voiceRefFile ? voiceRefFile.name : voiceRefUrl ? '✓ Voice uploaded' : 'Upload Voice File'}
                    </button>
                  </div>
                )}

                {/* Option 3: Record with Mic */}
                {!selectedVoiceId && !voiceRefFile && !voiceRefUrl && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Or Record with Microphone</label>
                    <div className="flex gap-2">
                      <button
                        onClick={isRecordingMic ? stopMicRecording : startMicRecording}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-all ${
                          isRecordingMic
                            ? 'bg-red-500/20 border border-red-500/50 text-red-400 animate-pulse'
                            : 'bg-black/40 border border-white/10 text-gray-300 hover:border-cyan-500/50 hover:text-white'
                        }`}
                      >
                        {isRecordingMic ? <MicOff size={16} /> : <Mic size={16} />}
                        {isRecordingMic ? `Recording... ${formatTime(recordingTime)}` : 'Record Voice'}
                      </button>
                    </div>
                    {recordedBlob && !isRecordingMic && (
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-green-400 text-xs flex-1">✓ Recording ready ({formatTime(recordingTime)})</p>
                        <button
                          onClick={useRecordedAudioAsVoiceRef}
                          disabled={isUploadingVoiceRef}
                          className="text-xs bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded-lg hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                        >
                          {isUploadingVoiceRef ? 'Uploading...' : 'Use as Reference'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Song Reference (optional) */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Song Reference <span className="text-gray-500">(optional, .wav/.mp3, &gt;15s)</span></label>
                <input
                  ref={songRefInputRef}
                  type="file"
                  accept=".wav,.mp3"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setSongRefFile(f)
                      setSongRefUrl('')
                    }
                  }}
                />
                <button
                  onClick={() => songRefInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-300 hover:border-cyan-500/50 hover:text-white transition-colors"
                >
                  <FileAudio size={16} />
                  {songRefFile ? songRefFile.name : songRefUrl ? '✓ Song uploaded' : 'Upload Reference Song'}
                </button>
              </div>

              {/* Error */}
              {genError && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3">{genError}</p>}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !title.trim() || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold py-3 rounded-xl hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating with Voice Reference...
                  </>
                ) : (
                  <>
                    <Music size={18} />
                    Generate (3 credits)
                  </>
                )}
              </button>
            </>
          )}

          {/* ── INSTRUMENTAL REFERENCE TAB ── */}
          {activeTab === 'instrumental-ref' && (
            <>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <p className="text-orange-300 text-sm">
                  <strong>Instrumental Reference</strong> — Upload your own instrumental track, and the AI will generate music using that as the instrumental style reference.
                  <span className="text-orange-400 font-bold"> Costs 3 credits.</span>
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Song title"
                  maxLength={100}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Prompt * <span className="text-gray-500">(10-300 chars)</span></label>
                <input
                  type="text"
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe the style, mood, genre..."
                  maxLength={300}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50"
                />
                <p className="text-gray-500 text-xs mt-1 text-right">{prompt.length}/300</p>
              </div>

              {/* Lyrics */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Lyrics <span className="text-gray-500">(optional, max 400 chars)</span></label>
                <textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder="[intro]\nYour lyrics here...\n\n[chorus]\nChorus lyrics..."
                  maxLength={400}
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
                <p className="text-gray-500 text-xs mt-1 text-right">{lyrics.length}/400</p>
              </div>

              {/* Instrumental File Upload */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Instrumental File * <span className="text-gray-500">(.wav/.mp3, &gt;15s)</span></label>
                <input
                  ref={instrumentalInputRef}
                  type="file"
                  accept=".wav,.mp3"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setInstrumentalFile(f)
                      setInstrumentalUrl('')
                    }
                  }}
                />
                <button
                  onClick={() => instrumentalInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-300 hover:border-orange-500/50 hover:text-white transition-colors"
                >
                  <Guitar size={16} />
                  {instrumentalFile ? instrumentalFile.name : instrumentalUrl ? '✓ Instrumental uploaded' : 'Upload Instrumental'}
                </button>
              </div>

              {/* Voice (optional - can combine with instrumental) */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Voice <span className="text-gray-500">(optional — combine with trained voice)</span></label>
                {trainedVoices.length > 0 ? (
                  <select
                    value={selectedVoiceId}
                    onChange={e => setSelectedVoiceId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="">— No trained voice —</option>
                    {trainedVoices.map(v => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.voice_id.substring(0, 8)}...)</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-500 text-sm">No trained voices. Go to &quot;Train Voice&quot; tab first.</p>
                )}
              </div>

              {/* Error */}
              {genError && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3">{genError}</p>}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !title.trim() || !prompt.trim() || (!instrumentalFile && !instrumentalUrl)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold py-3 rounded-xl hover:from-orange-500 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating with Instrumental...
                  </>
                ) : (
                  <>
                    <Guitar size={18} />
                    Generate (3 credits)
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer credit display */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-gray-500 text-xs">Credits: {userCredits ?? '...'}</span>
          <span className="text-gray-600 text-xs">Voice Training · Music Generation</span>
        </div>
      </div>
    </div>
  )
}
