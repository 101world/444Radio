'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Music } from 'lucide-react'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'
import { validateGenerationPrompt } from '@/lib/validation'

interface MusiConGenModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (audioUrl: string, prompt: string) => void
  onGenerationStart?: (prompt: string, generationId: string) => void
  initialPrompt?: string
}

// 10 Curated Presets for MusiConGen
const MUSICONGEN_PRESETS = [
  {
    name: "Blues Shuffle",
    prompt: "A laid-back blues shuffle with warm tube guitar tones, relaxed groove, intimate late-night slow dance atmosphere.",
    text_chords: "A:min7 D:min7 E:7 A:min7",
    bpm: 78,
    time_sig: "4/4",
    duration: 15
  },
  {
    name: "Jazz Ballad",
    prompt: "Sophisticated jazz ballad with smooth piano, upright bass, and gentle brushed drums, romantic and elegant.",
    text_chords: "C:maj7 A:min7 D:min7 G:7",
    bpm: 72,
    time_sig: "4/4",
    duration: 20
  },
  {
    name: "Pop Anthem",
    prompt: "Uplifting pop anthem with bright synths, driving drums, catchy hooks, and sing-along energy.",
    text_chords: "C G A:min F",
    bpm: 128,
    time_sig: "4/4",
    duration: 15
  },
  {
    name: "Lo-fi Chill",
    prompt: "Mellow lo-fi hip-hop beat with warm vinyl crackle, jazzy chords, and relaxed downtempo groove.",
    text_chords: "D:maj7 B:min7 E:min7 A:7",
    bpm: 85,
    time_sig: "4/4",
    duration: 20
  },
  {
    name: "Funky Groove",
    prompt: "Funky disco groove with tight rhythm guitar, slap bass, horn stabs, and infectious danceable energy.",
    text_chords: "E:min7 A:7 D:maj7 B:7",
    bpm: 116,
    time_sig: "4/4",
    duration: 15
  },
  {
    name: "Dark Techno",
    prompt: "Dark underground techno with pulsing bass, industrial percussion, acid synths, and driving hypnotic rhythm.",
    text_chords: "A:min A:min G:min G:min",
    bpm: 130,
    time_sig: "4/4",
    duration: 25
  },
  {
    name: "Acoustic Folk",
    prompt: "Warm acoustic folk with fingerpicked guitar, gentle harmonies, and heartfelt singer-songwriter vibes.",
    text_chords: "G D E:min C",
    bpm: 92,
    time_sig: "4/4",
    duration: 18
  },
  {
    name: "Latin Salsa",
    prompt: "Explosive Latin salsa with vibrant brass, syncopated piano montunos, timbales, and fiery rhythmic intensity.",
    text_chords: "C:7 F:7 G:7 C:7",
    bpm: 180,
    time_sig: "4/4",
    duration: 15
  },
  {
    name: "Ambient Dream",
    prompt: "Ethereal ambient soundscape with lush pads, delicate textures, reverb-soaked melodies, and peaceful atmosphere.",
    text_chords: "A:maj7 F#:min7 D:maj7 E:maj7",
    bpm: 60,
    time_sig: "4/4",
    duration: 30
  },
  {
    name: "Indie Rock",
    prompt: "Energetic indie rock with jangly guitars, punchy drums, melodic bass lines, and youthful anthemic spirit.",
    text_chords: "A E F#:min D",
    bpm: 140,
    time_sig: "4/4",
    duration: 20
  }
]

export default function MusiConGenModal({ 
  isOpen, 
  onClose, 
  userCredits, 
  onSuccess, 
  onGenerationStart, 
  initialPrompt = '' 
}: MusiConGenModalProps) {
  const { addGeneration, updateGeneration } = useGenerationQueue()
  const [prompt, setPrompt] = useState(initialPrompt)
  
  // Update prompt when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt)
    }
  }, [initialPrompt])
  
  const [text_chords, setTextChords] = useState('C G A:min F')
  const [bpm, setBpm] = useState(120)
  const [time_sig, setTimeSig] = useState('4/4')
  const [duration, setDuration] = useState(15)
  const [temperature, setTemperature] = useState(1)
  const [top_k, setTopK] = useState(250)
  const [top_p, setTopP] = useState(0)
  const [classifier_free_guidance, setClassifierFreeGuidance] = useState(3)
  const [seed, setSeed] = useState<number | undefined>(undefined)
  const [output_format, setOutputFormat] = useState<'wav' | 'mp3'>('wav')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPresets, setShowPresets] = useState(true)

  // Calculate credit cost based on duration
  const creditCost = duration <= 15 ? 5 : 7

  const loadPreset = (preset: typeof MUSICONGEN_PRESETS[0]) => {
    setPrompt(preset.prompt)
    setTextChords(preset.text_chords)
    setBpm(preset.bpm)
    setTimeSig(preset.time_sig)
    setDuration(preset.duration)
    setShowPresets(false)
  }

  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < creditCost) {
      alert(`⚡ You need at least ${creditCost} credits to generate with MusiConGen!`)
      return
    }

    // Use validation library for prompt
    const validation = validateGenerationPrompt(prompt)
    if (!validation.isValid) {
      const errorMessage = Object.values(validation.errors).join('. ')
      alert(`❌ ${errorMessage}`)
      return
    }

    setIsGenerating(true)
    setGeneratedAudioUrl(null)
    
    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'music',
      prompt: prompt,
      title: `MusiConGen: ${prompt.substring(0, 30)}`
    })
    
    // Update status to generating
    updateGeneration(generationId, { status: 'generating', progress: 10 })
    
    // Call onGenerationStart to close modal and show chat immediately
    if (onGenerationStart) {
      onGenerationStart(prompt, generationId)
      onClose()
    }
    
    try {
      // Create timeout controller (200s)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 200000) // 200 seconds
      
      const res = await fetch('/api/generate/musicongen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          text_chords,
          bpm,
          time_sig,
          duration,
          temperature,
          top_k,
          top_p,
          classifier_free_guidance,
          seed: seed === undefined ? -1 : seed,
          output_format
        })
      })

      clearTimeout(timeoutId)
      const data = await res.json()
      
      if (data.success) {
        setGeneratedAudioUrl(data.audioUrl)
        
        // Update generation queue with success
        updateGeneration(generationId, {
          status: 'completed',
          result: {
            audioUrl: data.audioUrl,
            title: `MusiConGen: ${prompt.substring(0, 30)}`,
            prompt: prompt
          }
        })
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.audioUrl, prompt)
        }
        
        // Refresh credits in shared context
        window.dispatchEvent(new Event('credits:refresh'))
        
        alert(`🎹 Music generated with chords! ${data.creditsRemaining} credits remaining`)
      } else {
        // Update generation queue with failure
        updateGeneration(generationId, {
          status: 'failed',
          error: data.error || 'Unknown error'
        })
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      
      // Check if it's a timeout/abort error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⏱️ Request timed out')
        updateGeneration(generationId, {
          status: 'failed',
          error: 'Request timed out. Check your Library - music may have generated.'
        })
        alert(`⏱️ Request timed out. Check your Library - music may have generated server-side.`)
      } else {
        // Other errors
        updateGeneration(generationId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        alert('Failed to generate music')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      setPrompt('')
      setGeneratedAudioUrl(null)
      setShowAdvanced(false)
      setShowPresets(true)
      onClose()
    }
  }

  if (!isOpen) return null

  const promptLength = prompt.length
  const isPromptValid = promptLength >= 10 && promptLength <= 300

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-gray-900/95 to-black/95 border border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-gray-900/95 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Music size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">MusiConGen</h3>
              <p className="text-xs text-gray-400">Rhythm & chord control</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            disabled={isGenerating}
          >
            <X size={20} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Presets Section */}
          {showPresets && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  🎯 Try a Preset
                </label>
                <button
                  onClick={() => setShowPresets(false)}
                  className="text-xs text-gray-500 hover:text-gray-400"
                >
                  Hide presets
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MUSICONGEN_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset)}
                    disabled={isGenerating}
                    className="p-3 bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="text-sm font-medium text-purple-300 group-hover:text-purple-200 mb-1">
                      {preset.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {preset.text_chords} • {preset.bpm} BPM
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!showPresets && (
            <button
              onClick={() => setShowPresets(true)}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              ← Show presets
            </button>
          )}
          
          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 block">
              Describe the music
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A laid-back blues shuffle with warm guitar tones..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all resize-none"
              rows={3}
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-500">Min 10, max 300 characters</span>
              <span className={`text-xs font-mono font-medium ${
                !isPromptValid ? 'text-red-400' : promptLength > 270 ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {promptLength}/300
              </span>
            </div>
          </div>

          {/* Chord Progression */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 block">
              Chord Progression
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Format: <code className="bg-white/5 px-1 rounded">C G A:min F</code> or <code className="bg-white/5 px-1 rounded">C:maj7 A:min7 D:7</code>
              <br />Supported: maj, min, dim, aug, min6, maj6, min7, maj7, 7, dim7, hdim7, sus2, sus4
            </p>
            <input
              type="text"
              value={text_chords}
              onChange={(e) => setTextChords(e.target.value)}
              placeholder="C G A:min F"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all font-mono"
              disabled={isGenerating}
            />
          </div>

          {/* BPM, Time Sig, Duration Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 block">BPM</label>
              <input
                type="number"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                min={40}
                max={200}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                disabled={isGenerating}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 block">Time Sig</label>
              <select
                value={time_sig}
                onChange={(e) => setTimeSig(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                disabled={isGenerating}
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
                <option value="5/4">5/4</option>
                <option value="7/8">7/8</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 block">
                Duration (s)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={1}
                max={30}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showAdvanced ? '▼' : '▶'} Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-4 pl-4 border-l-2 border-purple-500/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">Temperature</label>
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    min={0.1}
                    max={2}
                    step={0.1}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">Top K</label>
                  <input
                    type="number"
                    value={top_k}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    min={0}
                    max={500}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">Top P</label>
                  <input
                    type="number"
                    value={top_p}
                    onChange={(e) => setTopP(Number(e.target.value))}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">CFG</label>
                  <input
                    type="number"
                    value={classifier_free_guidance}
                    onChange={(e) => setClassifierFreeGuidance(Number(e.target.value))}
                    min={1}
                    max={10}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">Seed (-1 = random)</label>
                  <input
                    type="number"
                    value={seed ?? -1}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setSeed(val === -1 ? undefined : val)
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    disabled={isGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 block">Output Format</label>
                  <select
                    value={output_format}
                    onChange={(e) => setOutputFormat(e.target.value as 'wav' | 'mp3')}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    disabled={isGenerating}
                  >
                    <option value="wav">WAV</option>
                    <option value="mp3">MP3</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Credit Cost Display */}
          <div className="flex items-center justify-between p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
            <span className="text-sm text-gray-300">Credit Cost</span>
            <span className="text-sm font-semibold text-purple-300">
              {creditCost} credits • {duration <= 15 ? 'Short' : 'Long'} track
            </span>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !isPromptValid}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-purple-500/25 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Generating...
              </>
            ) : (
              <>
                <Music size={18} />
                Generate with Chords ({creditCost} credits)
              </>
            )}
          </button>

          {/* Preview Audio */}
          {generatedAudioUrl && !isGenerating && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-300 mb-2">✅ Generated Successfully</p>
              <audio controls className="w-full" src={generatedAudioUrl}>
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
