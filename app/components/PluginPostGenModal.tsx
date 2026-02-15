'use client'

/**
 * PluginPostGenModal — shown after every generation in the plugin.
 *
 * Provides:
 *   • MP3 download
 *   • WAV download (client-side conversion)
 *   • Draggable WAV chip (drag → drop into DAW timeline)
 *   • Split Stems  (−5 credits)
 *   • Audio Boost  (−1 credit)
 *   • Release to Explore (publish to feed)
 */

import { useState, useRef, useEffect } from 'react'
import {
  X, Download, Play, Pause, Scissors, Volume2, Rocket,
  Loader2, Music, CheckCircle
} from 'lucide-react'

// ── WAV conversion (same as plugin page) ─────────────────────
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length * buffer.numberOfChannels * 2 + 44
  const arrayBuffer = new ArrayBuffer(length)
  const view = new DataView(arrayBuffer)
  let pos = 0
  const setUint16 = (d: number) => { view.setUint16(pos, d, true); pos += 2 }
  const setUint32 = (d: number) => { view.setUint32(pos, d, true); pos += 4 }
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157)
  setUint32(0x20746d66); setUint32(16); setUint16(1)
  setUint16(buffer.numberOfChannels); setUint32(buffer.sampleRate)
  setUint32(buffer.sampleRate * 2 * buffer.numberOfChannels)
  setUint16(buffer.numberOfChannels * 2); setUint16(16)
  setUint32(0x61746164); setUint32(length - pos - 4)
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      let s = buffer.getChannelData(ch)[i]
      s = Math.max(-1, Math.min(1, s))
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      pos += 2
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// ── Types ────────────────────────────────────────────────────
interface PostGenResult {
  audioUrl: string
  imageUrl?: string
  title: string
  prompt?: string
  lyrics?: string
  messageId: string
}

interface PluginPostGenModalProps {
  isOpen: boolean
  onClose: () => void
  result: PostGenResult | null
  token: string | null
  userCredits: number | null
  isInDAW: boolean
  onBridgeDownload: (url: string, title: string, format: 'mp3' | 'wav') => void
  onSplitStems: (audioUrl: string, messageId: string) => void
  onAudioBoost: (audioUrl: string, title: string) => void
  onCreditsChange: (credits: number) => void
  onPlayPause: (messageId: string, audioUrl: string, title: string, prompt?: string) => void
  playingId: string | null
}

export default function PluginPostGenModal({
  isOpen, onClose, result, token, userCredits,
  isInDAW, onBridgeDownload,
  onSplitStems, onAudioBoost, onCreditsChange,
  onPlayPause, playingId
}: PluginPostGenModalProps) {
  // ── State ──
  const [downloadingMp3, setDownloadingMp3] = useState(false)
  const [downloadingWav, setDownloadingWav] = useState(false)
  const [wavBlobUrl, setWavBlobUrl] = useState<string | null>(null)
  const [wavFileName, setWavFileName] = useState('')
  const [preparingWav, setPreparingWav] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const [released, setReleased] = useState(false)
  const [releaseError, setReleaseError] = useState('')

  // Reset state when a new result comes in
  useEffect(() => {
    if (isOpen && result) {
      setDownloadingMp3(false)
      setDownloadingWav(false)
      setReleasing(false)
      setReleased(false)
      setReleaseError('')
      // Pre-prepare WAV blob only for browser context (drag-and-drop)
      if (!isInDAW) prepareWavBlob()
    }
    return () => {
      if (wavBlobUrl) { URL.revokeObjectURL(wavBlobUrl); setWavBlobUrl(null) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, result?.audioUrl])

  if (!isOpen || !result) return null

  const safeName = (result.title || 'track').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_') || 'track'

  // ── Fetch audio → WAV blob (for drag chip) ──
  async function prepareWavBlob() {
    if (!result?.audioUrl) return
    setPreparingWav(true)
    try {
      let res: Response
      try { res = await fetch(result.audioUrl) } catch {
        res = await fetch(`/api/r2/proxy?url=${encodeURIComponent(result.audioUrl)}`)
      }
      if (!res.ok) throw new Error('fetch failed')
      const ab = await res.arrayBuffer()
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const decoded = await ctx.decodeAudioData(ab)
      const blob = audioBufferToWav(decoded)
      const url = URL.createObjectURL(blob)
      setWavBlobUrl(url)
      setWavFileName(`${safeName}.wav`)
    } catch (err) {
      console.error('WAV prep error:', err)
    } finally {
      setPreparingWav(false)
    }
  }

  // ── MP3 download ──
  async function handleDownloadMp3() {
    if (downloadingMp3 || !result) return
    // In DAW context → send to C++ bridge for native download + drag bar
    if (isInDAW) {
      onBridgeDownload(result.audioUrl, result.title, 'mp3')
      onClose()
      return
    }
    setDownloadingMp3(true)
    try {
      let response: Response
      try {
        response = await fetch(result.audioUrl)
        if (!response.ok) throw new Error('direct failed')
      } catch {
        const downloadUrl = `/api/plugin/download?url=${encodeURIComponent(result.audioUrl)}&filename=${encodeURIComponent(safeName + '.mp3')}`
        response = await fetch(downloadUrl, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
      }
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl; link.download = `${safeName}.mp3`
      document.body.appendChild(link); link.click(); document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (err: any) {
      alert(err.message || 'MP3 download failed')
    } finally {
      setDownloadingMp3(false)
    }
  }

  // ── WAV download ──
  async function handleDownloadWav() {
    if (downloadingWav || !result) return
    // In DAW context → send to C++ bridge for native download + WAV conversion + drag bar
    if (isInDAW) {
      onBridgeDownload(result.audioUrl, result.title, 'wav')
      onClose()
      return
    }
    setDownloadingWav(true)
    try {
      if (wavBlobUrl) {
        // Already prepared — just trigger download
        const link = document.createElement('a')
        link.href = wavBlobUrl; link.download = `${safeName}.wav`
        document.body.appendChild(link); link.click(); document.body.removeChild(link)
      } else {
        // Prepare on-the-fly
        let res: Response
        try { res = await fetch(result.audioUrl) } catch {
          res = await fetch(`/api/r2/proxy?url=${encodeURIComponent(result.audioUrl)}`)
        }
        if (!res.ok) throw new Error('fetch failed')
        const ab = await res.arrayBuffer()
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const decoded = await ctx.decodeAudioData(ab)
        const blob = audioBufferToWav(decoded)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url; link.download = `${safeName}.wav`
        document.body.appendChild(link); link.click(); document.body.removeChild(link)
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } catch (err: any) {
      alert(err.message || 'WAV download failed')
    } finally {
      setDownloadingWav(false)
    }
  }

  // ── Release to Explore ──
  async function handleRelease() {
    if (releasing || released || !result || !token) return
    setReleasing(true)
    setReleaseError('')
    try {
      const res = await fetch('/api/plugin/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          audioUrl: result.audioUrl,
          imageUrl: result.imageUrl || null,
          title: result.title,
          prompt: result.prompt || '',
          lyrics: result.lyrics || null,
        })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Release failed')
      }
      setReleased(true)
    } catch (err: any) {
      setReleaseError(err.message || 'Release failed')
    } finally {
      setReleasing(false)
    }
  }

  const isPlaying = playingId === result.messageId

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-gray-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="relative">
          {result.imageUrl ? (
            <div className="h-32 w-full bg-gradient-to-br from-cyan-900/60 to-purple-900/60 relative overflow-hidden">
              <img src={result.imageUrl} alt="" className="w-full h-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
            </div>
          ) : (
            <div className="h-20 w-full bg-gradient-to-br from-cyan-900/40 to-purple-900/40" />
          )}
          <button onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-colors">
            <X size={16} className="text-gray-300" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end gap-3">
            <button
              onClick={() => onPlayPause(result.messageId, result.audioUrl, result.title, result.prompt)}
              className="w-12 h-12 flex-shrink-0 bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
            >
              {isPlaying ? <Pause size={20} className="text-black" /> : <Play size={20} className="text-black ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white truncate">{result.title}</p>
              {result.prompt && <p className="text-xs text-gray-400 truncate">{result.prompt}</p>}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-5 pb-6 space-y-4">
          {/* Download buttons — in DAW these go through C++ bridge, in browser they do normal download */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadMp3}
              disabled={downloadingMp3}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm text-white transition-all disabled:opacity-50"
            >
              {downloadingMp3 ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="font-semibold">MP3</span>
            </button>
            <button
              onClick={handleDownloadWav}
              disabled={downloadingWav}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 hover:border-emerald-400/60 rounded-xl text-sm text-emerald-300 transition-all disabled:opacity-50"
            >
              {downloadingWav ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="font-semibold">WAV</span>
            </button>
          </div>

          {/* Processing tools */}
          <div className="grid grid-cols-2 gap-3">
            {/* Split Stems */}
            <button
              onClick={() => { onSplitStems(result.audioUrl, result.messageId); onClose() }}
              disabled={userCredits !== null && userCredits < 5}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-400/50 rounded-xl text-sm text-purple-300 transition-all disabled:opacity-40"
            >
              <Scissors size={16} />
              <div className="text-left">
                <span className="font-semibold">Split Stems</span>
                <span className="text-[10px] text-gray-500 ml-1">−5</span>
              </div>
            </button>
            {/* Audio Boost */}
            <button
              onClick={() => { onAudioBoost(result.audioUrl, result.title); onClose() }}
              disabled={userCredits !== null && userCredits < 1}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 hover:border-orange-400/50 rounded-xl text-sm text-orange-300 transition-all disabled:opacity-40"
            >
              <Volume2 size={16} />
              <div className="text-left">
                <span className="font-semibold">Boost Audio</span>
                <span className="text-[10px] text-gray-500 ml-1">−1</span>
              </div>
            </button>
          </div>

          {/* Release to Explore */}
          <button
            onClick={handleRelease}
            disabled={releasing || released}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${
              released
                ? 'bg-green-500/20 border border-green-500/40 text-green-300 cursor-default'
                : 'bg-gradient-to-r from-cyan-600/90 to-cyan-400/90 hover:from-cyan-500 hover:to-cyan-300 text-black shadow-lg shadow-cyan-500/20 disabled:opacity-50'
            }`}
          >
            {releasing ? (
              <><Loader2 size={16} className="animate-spin" /> Publishing...</>
            ) : released ? (
              <><CheckCircle size={16} /> Released to Explore!</>
            ) : (
              <><Rocket size={16} /> Release to Explore</>
            )}
          </button>
          {releaseError && (
            <p className="text-xs text-red-400 text-center">{releaseError}</p>
          )}

          {/* Credits indicator */}
          {userCredits !== null && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <span className="font-medium text-cyan-400">{userCredits}</span> credits remaining
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
