"use client";

import { useEffect, useMemo, useState } from 'react'
import { X, Download, FileAudio, Loader2 } from 'lucide-react'
import { audioBufferToWav, renderMixdown, MixdownSession } from '@/lib/audio-mixdown'
import { encodeMp3FromAudioBuffer } from '@/lib/mp3-encoder'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onStartExport?: (format: 'mp3' | 'wav', normalize: boolean, sampleRate: number) => void
  projectName?: string
  bpm?: number
  timeSig?: string
  // minimal session to export as JSON
  session?: MixdownSession
}

export default function ExportModal({ isOpen, onClose, onStartExport, projectName = 'Untitled Project', bpm = 120, timeSig = '4/4', session }: ExportModalProps) {
  const [format, setFormat] = useState<'mp3' | 'wav'>('wav')
  const [normalize, setNormalize] = useState(true)
  const [sampleRate, setSampleRate] = useState(44100)
  const [fileName, setFileName] = useState(projectName)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setFileName(projectName)
    }
  }, [isOpen, projectName])

  if (!isOpen) return null

  const sessionBlob = useMemo(() => {
    try {
      const payload = {
        name: fileName || projectName,
        bpm,
        timeSig,
        createdAt: new Date().toISOString(),
        ...((session ? { session } : {})),
      }
      const json = JSON.stringify(payload, null, 2)
      return new Blob([json], { type: 'application/json' })
    } catch {
      return null
    }
  }, [fileName, projectName, bpm, timeSig, session])

  const handleDownloadSession = () => {
    if (!sessionBlob) return
    const url = URL.createObjectURL(sessionBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(fileName || projectName).replace(/\s+/g, '_')}.444radio.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleStartMixdown = async () => {
    setIsExporting(true)
    try {
      // Let consumer know we started
      onStartExport?.(format, normalize, sampleRate)

      if (!session || !session.tracks || session.tracks.length === 0) {
        // Nothing to render; just close
        await new Promise(r => setTimeout(r, 300))
        return
      }

      const base = (fileName || projectName).replace(/\s+/g, '_')
      
      // Export individual stems (WAV + MP3 for each track)
      for (let i = 0; i < session.tracks.length; i++) {
        const track = session.tracks[i]
        setProgress((i / (session.tracks.length + 2)) * 0.5)
        
        // Create a session with just this track
        const stemSession = {
          ...session,
          tracks: [{ ...track, solo: false, mute: false }]
        }
        
        const stemBuffer = await renderMixdown(stemSession, { sampleRate, normalize })
        
        // Export as WAV
        const wavBlob = audioBufferToWav(stemBuffer, normalize)
        const wavUrl = URL.createObjectURL(wavBlob)
        const wavLink = document.createElement('a')
        wavLink.href = wavUrl
        wavLink.download = `${base}_${track.name.replace(/\s+/g, '_')}.wav`
        document.body.appendChild(wavLink)
        wavLink.click()
        document.body.removeChild(wavLink)
        URL.revokeObjectURL(wavUrl)
        
        // Export as MP3
        const mp3Blob = await encodeMp3FromAudioBuffer(stemBuffer, { kbps: 192 })
        const mp3Url = URL.createObjectURL(mp3Blob)
        const mp3Link = document.createElement('a')
        mp3Link.href = mp3Url
        mp3Link.download = `${base}_${track.name.replace(/\s+/g, '_')}.mp3`
        document.body.appendChild(mp3Link)
        mp3Link.click()
        document.body.removeChild(mp3Link)
        URL.revokeObjectURL(mp3Url)
      }

      // Export master mixdown (all tracks)
      setProgress(0.6)
      const masterBuffer = await renderMixdown(session, { sampleRate, normalize })

      // Master WAV
      setProgress(0.75)
      const masterWavBlob = audioBufferToWav(masterBuffer, normalize)
      const masterWavUrl = URL.createObjectURL(masterWavBlob)
      const masterWavLink = document.createElement('a')
      masterWavLink.href = masterWavUrl
      masterWavLink.download = `${base}_Master.wav`
      document.body.appendChild(masterWavLink)
      masterWavLink.click()
      document.body.removeChild(masterWavLink)
      URL.revokeObjectURL(masterWavUrl)

      // Master MP3
      setProgress(0.85)
      const masterMp3Blob = await encodeMp3FromAudioBuffer(masterBuffer, { kbps: 192, onProgress: (p) => setProgress(0.85 + (p * 0.13)) })
      const masterMp3Url = URL.createObjectURL(masterMp3Blob)
      const masterMp3Link = document.createElement('a')
      masterMp3Link.href = masterMp3Url
      masterMp3Link.download = `${base}_Master.mp3`
      document.body.appendChild(masterMp3Link)
      masterMp3Link.click()
      document.body.removeChild(masterMp3Link)
      URL.revokeObjectURL(masterMp3Url)

      setProgress(0.99)
    } catch (e) {
      console.error('Export failed:', e)
      alert('Export failed. See console for details.')
    } finally {
      setIsExporting(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl bg-gradient-to-b from-gray-900 via-black to-gray-900 rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Export Project</h2>
              <p className="text-xs text-cyan-400/70">Create a mixdown or export session data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* File name */}
          <div>
            <label className="block text-sm font-medium text-cyan-400 mb-2">File name</label>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/60"
              placeholder="Project name"
            />
          </div>

          {/* Format and options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav')}
                className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
              >
                <option value="wav">WAV (Lossless)</option>
                <option value="mp3">MP3 (Compressed)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-cyan-400 mb-2">Sample rate</label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-white focus:outline-none focus:border-cyan-500/60"
              >
                <option value={44100}>44.1 kHz</option>
                <option value={48000}>48 kHz</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-cyan-100">
                <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="accent-cyan-500" />
                Normalize mixdown (prevent clipping)
              </label>
              <p className="text-xs text-gray-500 mt-1">MP3 uses in-browser encoding; WAV is lossless.</p>
            </div>
          </div>

          {/* Session export */}
          <div className="p-3 rounded-lg bg-cyan-900/10 border border-cyan-700/30">
            <div className="flex items-center gap-2 mb-2">
              <FileAudio className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-200">Session export</span>
            </div>
            <p className="text-xs text-cyan-300/70 mb-3">Export a portable JSON snapshot of your project (tracks, clips, bpm, time signature).</p>
            <button
              onClick={handleDownloadSession}
              className="px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-sm transition-all"
            >
              Download Session (.json)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-cyan-500/30">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-5 py-2 rounded bg-gray-800 hover:bg-gray-700 text-white transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {isExporting && (
              <div className="w-32 h-2 rounded bg-gray-800 overflow-hidden">
                <div className="h-full bg-cyan-500 transition-[width]" style={{ width: `${Math.round(progress*100)}%` }} />
              </div>
            )}
            <button
              onClick={handleStartMixdown}
              disabled={isExporting}
              className="px-5 py-2 rounded bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 disabled:opacity-50 flex items-center gap-2"
            >
              {isExporting ? (<><Loader2 className="w-4 h-4 animate-spin"/>Exporting...</>) : 'Prepare Mixdown'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
