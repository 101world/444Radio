'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Image as ImageIcon, Sparkles, Zap, Loader2 } from 'lucide-react'

interface CoverArtGenModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  /** Called with { prompt, params } when user clicks Generate */
  onGenerate: (params: CoverArtGenParams) => void
  initialPrompt?: string
  /** Plugin auth token for Atom LLM calls */
  authToken?: string | null
}

export interface CoverArtGenParams {
  prompt: string
  params: {
    width: number
    height: number
    output_format: string
    output_quality: number
    guidance_scale: number
    num_inference_steps: number
    go_fast: boolean
  }
}

// ─── Aspect ratio presets ───
const ASPECT_RATIOS = [
  { label: '1:1 Square',       w: 1024, h: 1024, desc: 'Album cover standard' },
  { label: '3:4 Portrait',     w: 768,  h: 1024, desc: 'Spotify canvas / stories' },
  { label: '4:3 Landscape',    w: 1024, h: 768,  desc: 'Banner / header' },
  { label: '9:16 Tall',        w: 576,  h: 1024, desc: 'Phone wallpaper' },
  { label: '16:9 Wide',        w: 1024, h: 576,  desc: 'YouTube thumbnail' },
  { label: '2:3 Poster',       w: 682,  h: 1024, desc: 'Poster format' },
  { label: '1:1 Small',        w: 512,  h: 512,  desc: 'Fast preview' },
] as const

const QUALITY_PRESETS = [
  { label: 'Draft', steps: 4, guidance: 0, desc: 'Fastest (~2s)' },
  { label: 'Standard', steps: 8, guidance: 0, desc: 'Balanced (~4s)' },
  { label: 'High', steps: 12, guidance: 3.5, desc: 'More detail (~6s)' },
  { label: 'Ultra', steps: 20, guidance: 7, desc: 'Maximum (~10s)' },
] as const

const MAX_PROMPT_LENGTH = 500

// Atom SVG icon (matches plugin page pattern)
function AtomIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </svg>
  )
}

export default function CoverArtGenModal({ isOpen, onClose, userCredits, onGenerate, initialPrompt, authToken }: CoverArtGenModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [selectedRatio, setSelectedRatio] = useState(0)
  const [outputQuality, setOutputQuality] = useState(100)
  const [qualityPreset, setQualityPreset] = useState(1) // 'Standard'
  const [goFast, setGoFast] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [customSteps, setCustomSteps] = useState(8)
  const [customGuidance, setCustomGuidance] = useState(0)
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
  const [mounted, setMounted] = useState(false)
  const portalRoot = useRef<HTMLElement | null>(null)

  // Ensure portal target exists (client-only)
  useEffect(() => {
    portalRoot.current = document.body
    setMounted(true)
  }, [])

  // Sync initialPrompt when modal opens
  useEffect(() => {
    if (isOpen && initialPrompt) {
      setPrompt(initialPrompt)
    }
  }, [isOpen, initialPrompt])

  if (!isOpen || !mounted || !portalRoot.current) return null

  const ratio = ASPECT_RATIOS[selectedRatio]
  const preset = QUALITY_PRESETS[qualityPreset]
  const steps = showAdvanced ? customSteps : preset.steps
  const guidance = showAdvanced ? customGuidance : preset.guidance
  const canGenerate = prompt.trim().length >= 3 && (userCredits ?? 0) >= 1
  const megapixels = (ratio.w * ratio.h / 1_000_000).toFixed(1)

  const handleGenerate = () => {
    if (!canGenerate) return
    onGenerate({
      prompt: prompt.trim(),
      params: {
        width: ratio.w,
        height: ratio.h,
        output_format: 'jpg',
        output_quality: outputQuality,
        guidance_scale: guidance,
        num_inference_steps: steps,
        go_fast: goFast,
      },
    })
  }

  // ── Atom prompt enhancer / generator ──
  const handleAtomPrompt = async () => {
    if (isEnhancingPrompt) return
    setIsEnhancingPrompt(true)
    try {
      const res = await fetch('/api/plugin/atom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ action: 'cover-art-prompt', prompt: prompt.trim() }),
      })
      const data = await res.json()
      if (data.success && data.prompt) {
        setPrompt(data.prompt.slice(0, MAX_PROMPT_LENGTH))
      }
    } catch {
      // silent fail
    } finally {
      setIsEnhancingPrompt(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: 'linear-gradient(180deg, #0c0c18 0%, #080810 100%)', border: '1px solid rgba(200,200,220,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(6,182,212,0.1)' }}>
              <ImageIcon size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Cover Art Generator</h2>
              <p className="text-[10px] text-gray-500">z-image-turbo · 1 credit · JPG</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ color: 'rgba(250,204,21,0.8)', background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)' }}>
              <Zap size={10} className="inline mr-1" />{userCredits ?? 0} cr
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Prompt + Atom Enhancer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-400">Prompt</label>
              <button onClick={handleAtomPrompt} disabled={isEnhancingPrompt}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                style={isEnhancingPrompt
                  ? { background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: 'rgba(168,85,247,0.7)' }
                  : { background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: 'rgba(200,180,255,0.85)' }
                }>
                {isEnhancingPrompt
                  ? <><Loader2 size={10} className="animate-spin" /> Enhancing...</>
                  : <><AtomIcon /> {prompt.trim() ? 'Enhance with Atom' : 'Create with Atom'}</>
                }
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
              placeholder="Neon cyberpunk city, glitch art album cover, vibrant electric blue and purple..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-cyan-500/30 transition"
              rows={3}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-600">Min 3 characters · {prompt.trim() ? 'Atom will enhance' : 'Atom will suggest'}</span>
              <span className={`text-[10px] ${prompt.length > 450 ? 'text-amber-400' : 'text-gray-600'}`}>
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-2 block">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ASPECT_RATIOS.map((ar, i) => (
                <button key={ar.label} onClick={() => setSelectedRatio(i)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
                  style={selectedRatio === i
                    ? { background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.35)', color: '#22d3ee' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(200,200,220,0.08)', color: 'rgba(200,200,220,0.7)' }
                  }>
                  <div className="flex-shrink-0 flex items-center justify-center w-7 h-7">
                    <div className="rounded-sm" style={{
                      width: `${Math.round((ar.w / Math.max(ar.w, ar.h)) * 22)}px`,
                      height: `${Math.round((ar.h / Math.max(ar.w, ar.h)) * 22)}px`,
                      border: selectedRatio === i ? '1.5px solid rgba(6,182,212,0.6)' : '1.5px solid rgba(200,200,220,0.2)',
                      background: selectedRatio === i ? 'rgba(6,182,212,0.08)' : 'transparent',
                    }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate">{ar.label}</div>
                    <div className="text-[9px] opacity-50">{ar.w}×{ar.h} · {ar.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5">{megapixels} MP · {ratio.w}×{ratio.h}px · JPG output</p>
          </div>

          {/* Quality Preset */}
          <div>
            <label className="text-xs font-semibold text-gray-400 mb-2 block">Quality</label>
            <div className="flex gap-1.5">
              {QUALITY_PRESETS.map((qp, i) => (
                <button key={qp.label}
                  onClick={() => { setQualityPreset(i); setCustomSteps(qp.steps); setCustomGuidance(qp.guidance) }}
                  className="flex-1 py-2 rounded-lg text-center transition-all"
                  style={qualityPreset === i && !showAdvanced
                    ? { background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.35)', color: '#22d3ee' }
                    : { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(200,200,220,0.08)', color: 'rgba(200,200,220,0.6)' }
                  }>
                  <div className="text-[11px] font-semibold">{qp.label}</div>
                  <div className="text-[9px] opacity-50">{qp.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Advanced toggle */}
          <button onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
            style={{ color: showAdvanced ? 'rgba(6,182,212,0.8)' : 'rgba(200,200,220,0.4)' }}>
            <Sparkles size={12} />
            Advanced Parameters
            <span className="text-[9px] opacity-50">{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && (
            <div className="space-y-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(200,200,220,0.06)' }}>
              {/* Inference Steps */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] text-gray-500">Inference Steps</label>
                  <span className="text-[11px] text-cyan-400 font-mono">{customSteps}</span>
                </div>
                <input type="range" min={1} max={30} step={1} value={customSteps}
                  onChange={e => setCustomSteps(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, rgba(6,182,212,0.5) ${(customSteps / 30) * 100}%, rgba(255,255,255,0.06) ${(customSteps / 30) * 100}%)` }}
                />
                <p className="text-[9px] text-gray-600 mt-0.5">More steps = finer detail but slower. 4-8 fast, 12-20 detailed.</p>
              </div>

              {/* Guidance Scale */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] text-gray-500">Guidance Scale</label>
                  <span className="text-[11px] text-cyan-400 font-mono">{customGuidance.toFixed(1)}</span>
                </div>
                <input type="range" min={0} max={20} step={0.5} value={customGuidance}
                  onChange={e => setCustomGuidance(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, rgba(6,182,212,0.5) ${(customGuidance / 20) * 100}%, rgba(255,255,255,0.06) ${(customGuidance / 20) * 100}%)` }}
                />
                <p className="text-[9px] text-gray-600 mt-0.5">0 = creative freedom, higher = stricter prompt adherence. 0-3.5 recommended.</p>
              </div>

              {/* Output Quality (JPG compression) */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] text-gray-500">JPG Quality</label>
                  <span className="text-[11px] text-cyan-400 font-mono">{outputQuality}%</span>
                </div>
                <input type="range" min={50} max={100} step={5} value={outputQuality}
                  onChange={e => setOutputQuality(Number(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, rgba(6,182,212,0.5) ${((outputQuality - 50) / 50) * 100}%, rgba(255,255,255,0.06) ${((outputQuality - 50) / 50) * 100}%)` }}
                />
                <p className="text-[9px] text-gray-600 mt-0.5">100 = maximum quality. Lower = smaller file size.</p>
              </div>

              {/* Go Fast */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] text-gray-500 block">Turbo Mode</label>
                  <p className="text-[9px] text-gray-600">Skip some computations for speed</p>
                </div>
                <button onClick={() => setGoFast(!goFast)}
                  className="w-10 h-5 rounded-full transition-all relative"
                  style={{ background: goFast ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.08)' }}>
                  <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all"
                    style={{ left: goFast ? '22px' : '2px' }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <button onClick={handleGenerate} disabled={!canGenerate}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
            style={canGenerate
              ? { background: 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(20,184,166,0.2))', border: '1px solid rgba(6,182,212,0.4)', color: '#22d3ee', boxShadow: '0 0 20px rgba(6,182,212,0.1)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,200,220,0.08)', color: 'rgba(200,200,220,0.3)' }
            }>
            <ImageIcon size={16} />
            Generate Cover Art · 1 credit
          </button>
          {(userCredits ?? 0) < 1 && (
            <p className="text-[10px] text-red-400 text-center mt-2">Insufficient credits — need at least 1</p>
          )}
        </div>
      </div>
    </div>,
    portalRoot.current,
  )
}
