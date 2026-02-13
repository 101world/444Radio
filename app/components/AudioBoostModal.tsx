'use client'

import { useState } from 'react'
import { X, Loader2, Volume2, Music, Zap } from 'lucide-react'

interface AudioBoostModalProps {
  isOpen: boolean
  onClose: () => void
  audioUrl: string
  trackTitle?: string
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
}

export default function AudioBoostModal({ isOpen, onClose, audioUrl, trackTitle, onSuccess, onError }: AudioBoostModalProps) {
  // Parameters with defaults matching the user's example
  const [bassBoost, setBassBoost] = useState(5)
  const [trebleBoost, setTrebleBoost] = useState(5)
  const [volumeBoost, setVolumeBoost] = useState(6)
  const [normalize, setNormalize] = useState(false)
  const [noiseReduction, setNoiseReduction] = useState(true)
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [bitrate, setBitrate] = useState('320k')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const handleBoost = async () => {
    setIsProcessing(true)
    setError('')

    try {
      const response = await fetch('/api/generate/audio-boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl,
          trackTitle,
          bass_boost: bassBoost,
          treble_boost: trebleBoost,
          volume_boost: volumeBoost,
          normalize,
          noise_reduction: noiseReduction,
          output_format: outputFormat,
          bitrate,
        })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Audio boost failed')
      }

      onSuccess?.(result)
      handleClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Audio boost failed'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    if (isProcessing) return
    setError('')
    setBassBoost(5)
    setTrebleBoost(5)
    setVolumeBoost(6)
    setNormalize(false)
    setNoiseReduction(true)
    setOutputFormat('mp3')
    setBitrate('320k')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900/95 to-black/95 border border-orange-500/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
              <Volume2 size={20} className="text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Audio Boost</h3>
              <p className="text-xs text-gray-400">Mix & master your track</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Track Info */}
        {trackTitle && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
              <Music size={14} className="text-orange-400 shrink-0" />
              <p className="text-sm text-gray-300 truncate">{trackTitle}</p>
            </div>
          </div>
        )}

        {/* Parameters */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Bass Boost */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Bass Boost</label>
              <span className="text-sm font-bold text-orange-400">{bassBoost > 0 ? '+' : ''}{bassBoost} dB</span>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={0.5}
              value={bassBoost}
              onChange={(e) => setBassBoost(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              disabled={isProcessing}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-20</span>
              <span>0</span>
              <span>+20</span>
            </div>
          </div>

          {/* Treble Boost */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Treble Boost</label>
              <span className="text-sm font-bold text-cyan-400">{trebleBoost > 0 ? '+' : ''}{trebleBoost} dB</span>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={0.5}
              value={trebleBoost}
              onChange={(e) => setTrebleBoost(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              disabled={isProcessing}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-20</span>
              <span>0</span>
              <span>+20</span>
            </div>
          </div>

          {/* Volume Boost */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Volume Boost</label>
              <span className="text-sm font-bold text-yellow-400">{volumeBoost}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={volumeBoost}
              onChange={(e) => setVolumeBoost(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              disabled={isProcessing}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0x</span>
              <span>5x</span>
              <span>10x</span>
            </div>
          </div>

          {/* Toggles Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Normalize */}
            <label className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                checked={normalize}
                onChange={(e) => setNormalize(e.target.checked)}
                disabled={isProcessing}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/50"
              />
              <div>
                <p className="text-sm font-medium text-white">Normalize</p>
                <p className="text-[10px] text-gray-500">Prevent clipping</p>
              </div>
            </label>

            {/* Noise Reduction */}
            <label className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                checked={noiseReduction}
                onChange={(e) => setNoiseReduction(e.target.checked)}
                disabled={isProcessing}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/50"
              />
              <div>
                <p className="text-sm font-medium text-white">Denoise</p>
                <p className="text-[10px] text-gray-500">Reduce noise</p>
              </div>
            </label>
          </div>

          {/* Output Format & Bitrate */}
          <div className="grid grid-cols-2 gap-3">
            {/* Format */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Format</label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer"
              >
                <option value="mp3" className="bg-gray-900">MP3</option>
                <option value="wav" className="bg-gray-900">WAV</option>
                <option value="aac" className="bg-gray-900">AAC</option>
                <option value="ogg" className="bg-gray-900">OGG</option>
              </select>
            </div>

            {/* Bitrate */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Bitrate</label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none cursor-pointer"
              >
                <option value="128k" className="bg-gray-900">128k</option>
                <option value="192k" className="bg-gray-900">192k</option>
                <option value="256k" className="bg-gray-900">256k</option>
                <option value="320k" className="bg-gray-900">320k</option>
              </select>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Quick Presets</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setBassBoost(5); setTrebleBoost(5); setVolumeBoost(6); setNormalize(false); setNoiseReduction(true); setBitrate('320k') }}
                disabled={isProcessing}
                className="px-3 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 hover:border-orange-400/50 rounded-lg text-xs font-semibold text-orange-300 transition-all disabled:opacity-50"
              >
                🔥 444 Mix
              </button>
              <button
                onClick={() => { setBassBoost(0); setTrebleBoost(0); setVolumeBoost(2); setNormalize(true); setNoiseReduction(false); setBitrate('320k') }}
                disabled={isProcessing}
                className="px-3 py-2 bg-white/5 border border-white/10 hover:border-white/30 rounded-lg text-xs font-semibold text-gray-300 transition-all disabled:opacity-50"
              >
                🎧 Clean
              </button>
              <button
                onClick={() => { setBassBoost(10); setTrebleBoost(3); setVolumeBoost(8); setNormalize(false); setNoiseReduction(true); setBitrate('320k') }}
                disabled={isProcessing}
                className="px-3 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 hover:border-purple-400/50 rounded-lg text-xs font-semibold text-purple-300 transition-all disabled:opacity-50"
              >
                💎 Heavy
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center gap-3 bg-black/40">
          <div className="flex-1 flex items-center gap-2 text-sm">
            <Zap size={14} className="text-orange-400" />
            <span className="font-semibold text-orange-400">1 credit</span>
          </div>
          <button
            onClick={handleBoost}
            disabled={isProcessing || !audioUrl}
            className="px-5 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px] bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-orange-500/30"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Boosting...</span>
              </>
            ) : (
              <>
                <Volume2 size={16} />
                <span>Boost Audio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
