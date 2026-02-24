'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
//  NDE SOUND UPLOADER
//
//  Lets users upload custom audio samples to use in Strudel code.
//  Files go to R2 for persistence, then register in Strudel's
//  soundMap via the onRegisterSound callback.
//
//  Usage in code after upload: s("my_kick") or .sound("my_kick")
// ═══════════════════════════════════════════════════════════════

interface CustomSample {
  id: string
  name: string
  url: string
  original_filename: string
  file_size: number
  created_at: string
}

interface SoundUploaderProps {
  isOpen: boolean
  onClose: () => void
  /** Called after upload to register the sound in Strudel engine */
  onRegisterSound: (name: string, urls: string[]) => Promise<void>
  /** Called after delete to unregister from Strudel */
  onUnregisterSound?: (name: string) => void
  accentColor?: string
}

const HW = {
  bg: '#0a0a0c',
  surface: '#131316',
  surfaceAlt: '#18181b',
  raised: '#1e1e22',
  border: '#2a2a30',
  textBright: '#f4f4f5',
  text: '#a1a1aa',
  textDim: '#52525b',
  accent: '#22d3ee',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SoundUploader({ isOpen, onClose, onRegisterSound, onUnregisterSound, accentColor = HW.accent }: SoundUploaderProps) {
  const [samples, setSamples] = useState<CustomSample[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [soundName, setSoundName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch user's existing samples
  const fetchSamples = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/nde/samples')
      const data = await res.json()
      if (data.samples) {
        setSamples(data.samples)
        // Re-register all on load
        for (const s of data.samples) {
          try {
            await onRegisterSound(s.name, [s.url])
          } catch { /* silent — Strudel may not be ready yet */ }
        }
      }
    } catch (err) {
      console.error('[SoundUploader] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [onRegisterSound])

  useEffect(() => {
    if (isOpen) fetchSamples()
  }, [isOpen, fetchSamples])

  // Cleanup preview URL on unmount / file change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('audio/')) {
      setError('Only audio files are accepted')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB')
      return
    }
    setSelectedFile(file)
    setError(null)
    // Auto-generate name from filename
    const baseName = file.name.replace(/\.[^.]+$/, '') // strip extension
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 32)
    if (!soundName) setSoundName(baseName)
    // Create preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }, [soundName, previewUrl])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !soundName) return

    const cleanName = soundName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    if (cleanName.length < 2 || cleanName.length > 32) {
      setError('Name must be 2-32 characters')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', cleanName)

      const res = await fetch('/api/nde/samples', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
        return
      }

      // Register in Strudel
      await onRegisterSound(cleanName, [data.sample.url])

      setSamples(prev => [data.sample, ...prev])
      setSuccess(`"${cleanName}" registered! Use s("${cleanName}") in your code`)
      setSelectedFile(null)
      setSoundName('')
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('[SoundUploader] upload error:', err)
      setError('Upload failed — check your connection')
    } finally {
      setUploading(false)
    }
  }, [selectedFile, soundName, onRegisterSound, previewUrl])

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/nde/samples?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.success) {
        setSamples(prev => prev.filter(s => s.id !== id))
        onUnregisterSound?.(name)
        setSuccess(`"${name}" deleted`)
      } else {
        setError(data.error || 'Delete failed')
      }
    } catch {
      setError('Delete failed')
    } finally {
      setDeletingId(null)
    }
  }, [deletingId, onUnregisterSound])

  const togglePreview = useCallback(() => {
    if (!previewUrl) return
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
      } else {
        audioRef.current.play()
        setIsPlaying(true)
      }
    } else {
      const audio = new Audio(previewUrl)
      audioRef.current = audio
      audio.onended = () => setIsPlaying(false)
      audio.play()
      setIsPlaying(true)
    }
  }, [previewUrl, isPlaying])

  // Update audio ref when preview URL changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
    }
  }, [previewUrl])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: HW.surface, border: `1px solid ${HW.border}` }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${HW.border}`, background: HW.surfaceAlt }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎵</span>
            <span className="text-sm font-semibold" style={{ color: HW.textBright }}>Custom Samples</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${accentColor}15`, color: accentColor }}>
              {samples.length}/50
            </span>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-sm hover:scale-110 transition-transform cursor-pointer"
            style={{ background: HW.raised, color: HW.text, border: `1px solid ${HW.border}` }}>
            ✕
          </button>
        </div>

        {/* Upload area */}
        <div className="px-5 py-4 space-y-3" style={{ borderBottom: `1px solid ${HW.border}` }}>
          {/* Drop zone */}
          <div
            className={`relative rounded-lg border-2 border-dashed p-5 text-center transition-all cursor-pointer ${dragOver ? 'scale-[1.01]' : ''}`}
            style={{
              borderColor: dragOver ? accentColor : HW.border,
              background: dragOver ? `${accentColor}08` : HW.bg,
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileSelect(f)
              }}
            />
            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">📎</span>
                  <span className="text-xs font-medium" style={{ color: HW.textBright }}>{selectedFile.name}</span>
                  <span className="text-[10px]" style={{ color: HW.textDim }}>{formatFileSize(selectedFile.size)}</span>
                </div>
                {previewUrl && (
                  <button
                    onClick={e => { e.stopPropagation(); togglePreview() }}
                    className="px-3 py-1 rounded text-[10px] font-medium transition-all hover:scale-105 cursor-pointer"
                    style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30` }}>
                    {isPlaying ? '⏹ Stop' : '▶ Preview'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium" style={{ color: HW.text }}>
                  Drop audio file here or click to browse
                </p>
                <p className="text-[10px]" style={{ color: HW.textDim }}>
                  WAV, MP3, OGG, FLAC — max 10MB
                </p>
              </div>
            )}
          </div>

          {/* Name input + upload button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono"
                style={{ color: HW.textDim }}>s(&quot;</span>
              <input
                type="text"
                value={soundName}
                onChange={e => setSoundName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32))}
                placeholder="my_kick"
                maxLength={32}
                className="w-full pl-8 pr-8 py-2 rounded-md text-xs font-mono outline-none"
                style={{
                  background: HW.bg,
                  color: HW.textBright,
                  border: `1px solid ${HW.border}`,
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono"
                style={{ color: HW.textDim }}>&quot;)</span>
            </div>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !soundName || uploading}
              className="px-4 py-2 rounded-md text-xs font-semibold transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: accentColor,
                color: '#000',
              }}>
              {uploading ? '⏳' : '↑ Upload'}
            </button>
          </div>

          {/* Status messages */}
          {error && (
            <p className="text-[11px] px-2 py-1 rounded" style={{ background: '#ef444415', color: '#ef4444' }}>
              ⚠ {error}
            </p>
          )}
          {success && (
            <p className="text-[11px] px-2 py-1 rounded" style={{ background: `${accentColor}10`, color: accentColor }}>
              ✓ {success}
            </p>
          )}
        </div>

        {/* Existing samples list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-1">
          {loading ? (
            <p className="text-[11px] text-center py-8" style={{ color: HW.textDim }}>Loading samples…</p>
          ) : samples.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-2xl">🎤</p>
              <p className="text-xs" style={{ color: HW.textDim }}>
                No custom samples yet. Upload your first!
              </p>
              <p className="text-[10px]" style={{ color: HW.textDim }}>
                After upload, use <span className="font-mono" style={{ color: accentColor }}>s(&quot;name&quot;)</span> in any node
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: HW.textDim }}>
                Your Samples
              </p>
              {samples.map(s => (
                <div key={s.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg group transition-colors"
                  style={{ background: HW.bg, border: `1px solid ${HW.border}` }}>
                  <span className="text-xs">🔊</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium truncate" style={{ color: HW.textBright }}>
                      {s.name}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: HW.textDim }}>
                      {s.original_filename} · {formatFileSize(s.file_size)}
                    </p>
                  </div>
                  <code className="text-[9px] px-1.5 py-0.5 rounded font-mono hidden group-hover:block shrink-0"
                    style={{ background: `${accentColor}10`, color: accentColor }}>
                    s(&quot;{s.name}&quot;)
                  </code>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    disabled={deletingId === s.id}
                    className="w-6 h-6 flex items-center justify-center rounded text-[10px] opacity-0 group-hover:opacity-100 transition-all hover:scale-110 cursor-pointer shrink-0"
                    style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444425' }}
                    title="Delete sample">
                    {deletingId === s.id ? '⏳' : '✕'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2 text-center"
          style={{ borderTop: `1px solid ${HW.border}`, background: HW.surfaceAlt }}>
          <p className="text-[10px]" style={{ color: HW.textDim }}>
            After uploading, use <span className="font-mono" style={{ color: accentColor }}>s(&quot;name&quot;)</span> or{' '}
            <span className="font-mono" style={{ color: accentColor }}>note(&quot;c3&quot;).s(&quot;name&quot;)</span> in your patterns
          </p>
        </div>
      </div>
    </div>
  )
}
