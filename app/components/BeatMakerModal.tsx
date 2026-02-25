'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Loader2, Lightbulb, Clock, Zap, Music2 } from 'lucide-react'

interface BeatMakerModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onGenerate: (params: BeatMakerGenerationParams) => void
}

export interface BeatMakerGenerationParams {
  title: string
  prompt: string
  duration: number
}

const MAX_PROMPT_LENGTH = 500
const MIN_DURATION = 5
const MAX_DURATION = 300
const DEFAULT_DURATION = 60

// Quick prompt tags for instrumentals/samples
const QUICK_TAGS = [
  'Lo-fi hip hop', 'Trap beat', 'Boom bap', 'R&B instrumental',
  'Cinematic score', 'EDM drop', 'Jazz fusion', 'Ambient pad',
  'Drill beat', 'Reggaeton', 'Afrobeats', 'House groove',
  'Synthwave', 'Acoustic guitar', 'Piano ballad', 'Orchestral',
]

const QUICK_PROMPTS = [
  'Dark trap beat with 808s, hi-hats, and haunting piano melodies. Key: F Minor, Tempo: 140 BPM.',
  'Smooth lo-fi hip hop beat with warm vinyl crackle, mellow keys, and soft drum loops. Tempo: 85 BPM.',
  'Epic cinematic orchestral score with sweeping strings, brass hits, and thundering percussion.',
  'Chill R&B instrumental with silky guitar, deep bass, and gentle snare. Key: Ab Major, Tempo: 75 BPM.',
  'Hard-hitting drill beat with sliding 808 bass, aggressive hi-hats, and dark synths. Tempo: 145 BPM.',
  'Upbeat afrobeats instrumental with tropical percussion, log drums, and catchy guitar riff. Tempo: 105 BPM.',
]

export default function BeatMakerModal({ isOpen, onClose, userCredits, onGenerate }: BeatMakerModalProps) {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showQuickPrompts, setShowQuickPrompts] = useState(false)
  const [error, setError] = useState('')
  const durationBarRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Credit cost calculation: 2 credits per 60 seconds, minimum 2
  const creditCost = Math.max(2, Math.ceil((duration / 60) * 2))

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('')
      setIsGenerating(false)
    }
  }, [isOpen])

  // Duration bar mouse/touch handler
  const handleDurationDrag = useCallback((clientX: number) => {
    if (!durationBarRef.current) return
    const rect = durationBarRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const newDuration = Math.round(MIN_DURATION + pct * (MAX_DURATION - MIN_DURATION))
    setDuration(newDuration)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      handleDurationDrag(clientX)
    }
    const handleUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMove, { passive: false })
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDragging, handleDurationDrag])

  // Validation
  const canGenerate =
    title.trim().length >= 1 &&
    prompt.trim().length >= 3 &&
    prompt.trim().length <= MAX_PROMPT_LENGTH &&
    duration >= MIN_DURATION &&
    duration <= MAX_DURATION &&
    !isGenerating

  const handleSubmit = () => {
    if (!canGenerate) return
    if (userCredits !== undefined && userCredits < creditCost) {
      setError(`You need at least ${creditCost} credits. You have ${userCredits}.`)
      return
    }
    setIsGenerating(true)
    onGenerate({
      title: title.trim(),
      prompt: prompt.trim(),
      duration,
    })
  }

  const addTag = (tag: string) => {
    const newPrompt = prompt ? `${prompt}, ${tag}` : tag
    setPrompt(newPrompt.slice(0, MAX_PROMPT_LENGTH))
  }

  const useQuickPrompt = (qp: string) => {
    setPrompt(qp)
    setShowQuickPrompts(false)
  }

  if (!isOpen) return null

  const promptLen = prompt.trim().length
  const durationPct = ((duration - MIN_DURATION) / (MAX_DURATION - MIN_DURATION)) * 100
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92vh] bg-gray-950/95 backdrop-blur-2xl border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {/* Ambient glow */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-400/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-xl px-6 pt-6 pb-4 border-b border-cyan-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/25 to-cyan-300/15 flex items-center justify-center border border-cyan-500/20">
                {/* Beat Maker icon — waveform */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                  <path d="M2 12h2l3-9 3 18 3-12 3 6 3-3h3" />
                </svg>
                {/* Pulsing glow */}
                <div className="absolute inset-0 rounded-xl bg-cyan-400/10 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Beat Maker</h3>
                <p className="text-[11px] text-cyan-400/50 mt-0.5">Instrumentals &amp; Samples • AI Generated</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors group">
              <X size={16} className="text-white/40 group-hover:text-white/60" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5 space-y-5">
          {/* ── Title ── */}
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 100))}
              placeholder="Name your beat"
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:shadow-[0_0_12px_rgba(6,182,212,0.08)]"
            />
            <p className="text-[10px] text-white/15 mt-1 text-right">{title.length}/100</p>
          </div>

          {/* ── Prompt with Bulb Quick Prompts ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">Describe Your Beat</label>
              <button
                onClick={() => setShowQuickPrompts(!showQuickPrompts)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  showQuickPrompts
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                    : 'bg-white/5 text-white/40 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent'
                }`}
              >
                <Lightbulb size={12} className={showQuickPrompts ? 'text-cyan-300' : ''} />
                Ideas
              </button>
            </div>

            {/* Quick Prompt Suggestions */}
            {showQuickPrompts && (
              <div className="mb-3 p-3 bg-cyan-500/[0.04] border border-cyan-500/15 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[10px] text-cyan-400/60 uppercase tracking-wider font-medium">Quick Prompts</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => useQuickPrompt(qp)}
                      className="w-full text-left px-3 py-2 bg-white/[0.02] hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 rounded-lg text-[11px] text-white/60 hover:text-cyan-200 transition-all duration-150 leading-relaxed"
                    >
                      {qp.substring(0, 100)}{qp.length > 100 ? '…' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the instrumental — style, mood, instruments, key, tempo..."
              rows={3}
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 focus:border-cyan-400/50 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200 resize-none focus:shadow-[0_0_12px_rgba(6,182,212,0.08)]"
            />

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="px-2.5 py-1 bg-white/[0.03] hover:bg-cyan-500/10 border border-white/8 hover:border-cyan-500/25 rounded-full text-[10px] text-white/40 hover:text-cyan-300 transition-all duration-150"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Char counter */}
            <div className="flex items-center justify-end mt-1.5">
              <span className={`text-[11px] font-mono ${
                promptLen === 0 ? 'text-white/20' :
                promptLen < 3 ? 'text-red-400/90' :
                promptLen > MAX_PROMPT_LENGTH ? 'text-red-400/90' :
                promptLen > MAX_PROMPT_LENGTH * 0.9 ? 'text-yellow-400/70' :
                'text-emerald-400/60'
              }`}>
                {promptLen}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </div>

          {/* ── Duration — Analog-Style Bar ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={12} className="text-cyan-400/60" />
                Duration
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-cyan-300 tabular-nums">
                  {formatTime(duration)}
                </span>
                <span className="text-[10px] text-white/25">({duration}s)</span>
              </div>
            </div>

            {/* Analog duration bar */}
            <div className="relative py-3">
              {/* Track */}
              <div
                ref={durationBarRef}
                className="relative h-3 bg-white/[0.04] rounded-full cursor-pointer border border-white/[0.06] overflow-hidden"
                onMouseDown={(e) => { setIsDragging(true); handleDurationDrag(e.clientX) }}
                onTouchStart={(e) => { setIsDragging(true); handleDurationDrag(e.touches[0].clientX) }}
              >
                {/* Fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75"
                  style={{
                    width: `${durationPct}%`,
                    background: 'linear-gradient(90deg, rgba(6,182,212,0.4) 0%, rgba(6,182,212,0.7) 50%, rgba(34,211,238,0.8) 100%)',
                    boxShadow: '0 0 10px rgba(6,182,212,0.3)',
                  }}
                />
                {/* Tick marks */}
                {[0, 25, 50, 75, 100].map(pct => (
                  <div
                    key={pct}
                    className="absolute top-0 bottom-0 w-px bg-white/10"
                    style={{ left: `${pct}%` }}
                  />
                ))}
              </div>

              {/* Knob */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-900 border-2 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)] transition-[left] duration-75 cursor-grab active:cursor-grabbing"
                style={{ left: `${durationPct}%`, top: '50%' }}
                onMouseDown={(e) => { e.stopPropagation(); setIsDragging(true) }}
                onTouchStart={(e) => { e.stopPropagation(); setIsDragging(true) }}
              >
                <div className="absolute inset-[3px] rounded-full bg-cyan-400/30" />
              </div>

              {/* Labels */}
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-white/20 font-mono">0:05</span>
                <span className="text-[9px] text-white/20 font-mono">1:15</span>
                <span className="text-[9px] text-white/20 font-mono">2:30</span>
                <span className="text-[9px] text-white/20 font-mono">3:45</span>
                <span className="text-[9px] text-white/20 font-mono">5:00</span>
              </div>
            </div>

            {/* Quick duration buttons */}
            <div className="flex gap-2 mt-1">
              {[15, 30, 60, 120, 180].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-150 ${
                    duration === d
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_6px_rgba(6,182,212,0.15)]'
                      : 'bg-white/[0.03] text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-cyan-500/20'
                  }`}
                >
                  {d >= 60 ? `${d / 60}m` : `${d}s`}
                </button>
              ))}
            </div>
          </div>

          {/* ── Cost Display ── */}
          <div className="flex items-center justify-between px-4 py-3 bg-cyan-500/[0.04] border border-cyan-500/15 rounded-xl">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-cyan-400" />
              <span className="text-[11px] text-white/50 uppercase tracking-wider font-medium">Cost</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-cyan-300">{creditCost} credits</span>
              <span className="text-[10px] text-white/25">for {formatTime(duration)}</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          {/* ── Generate Button ── */}
          <div className="pt-1">
            <button
              onClick={handleSubmit}
              disabled={!canGenerate}
              className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${
                canGenerate
                  ? 'bg-gradient-to-r from-cyan-600/40 to-cyan-400/40 hover:from-cyan-600/50 hover:to-cyan-400/50 border border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                  : 'bg-white/5 border border-white/10 text-white/25 cursor-not-allowed'
              }`}
            >
              {canGenerate && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent animate-shimmer" />
              )}
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2 relative z-10">
                  <Loader2 size={16} className="animate-spin" /> Generating Beat…
                </span>
              ) : (
                <span className="relative z-10">
                  Generate Beat — {creditCost} credits
                </span>
              )}
            </button>
            <p className="text-[10px] text-white/15 text-center mt-2.5">
              Beat Maker • Instrumentals &amp; Samples Only • WAV output
            </p>
          </div>
        </div>
      </div>

      {/* Shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}
