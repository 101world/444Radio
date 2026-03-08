'use client'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  444 STUDIO â€” Pro Strudel Live Coding Studio (Orchestrator)
//  Composes: TopBar, GenreSelector, SliderPanel, MethodsPanel,
//            EffectsChain, CodeEditor â€” all as standalone components.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { useEffect, useRef, useState, useCallback } from 'react'
import type { StrudelEngine } from '@/lib/strudel-engine'
import { fixSoundfontNames } from '@/lib/strudel-engine'
import { applyMixerOverrides, applyAutomationOverrides, parseStrudelCode, parseChannelPattern, replaceChannelPattern, replaceChannelBlock, parseScale as parseMixerScale, updateScale, insertScale, updateParamInCode, insertEffectInChannel, removeEffectFromChannel, getArpInfo, setArpMode, setArpRate, getTranspose, setTranspose, getParamDef, PARAM_DEFS, parseBPM, addChannel } from '@/lib/strudel-code-parser'
import { generateMetronomeCode } from '@/lib/strudel-code-parser'
import { setOrbitAnalyser, clearOrbitAnalysers } from '@/lib/studio-analysers'
import StudioPianoRoll from './studio/StudioPianoRoll'
import StudioDrumSequencer from './studio/StudioDrumSequencer'
import StudioVocalPadSampler from './studio/StudioVocalPadSampler'
// Sub-components
import StudioTopBar from './studio/StudioTopBar'
import StudioGenreSelector, { GENRE_TEMPLATES } from './studio/StudioGenreSelector'
import StudioSliderPanel from './studio/StudioSliderPanel'
import StudioMethodsPanel from './studio/StudioMethodsPanel'
import StudioCodeEditor, { type StudioCodeEditorHandle } from './studio/StudioCodeEditor'
import StudioMixerRack from './studio/StudioMixerRack'
import StudioBrowserPanel from './studio/StudioBrowserPanel'

// ── Collapsible sidebar section wrapper ──
function SidebarSection({ title, icon, color, isOpen, onToggle, children }: {
  title: string; icon: string; color: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[7px] font-black uppercase tracking-[.15em] cursor-pointer hover:bg-white/[0.02] transition-colors"
        style={{ color }}
      >
        <span className="text-[5px]">{isOpen ? '▼' : '▶'}</span>
        <span className="text-[9px]">{icon}</span>
        {title}
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  )
}

// Simple WebAudio fallback for drum preview when engine isn't available
let _prevCtx: AudioContext | null = null
function playDrumPreviewFallback(instrument: string) {
  if (!_prevCtx) _prevCtx = new AudioContext()
  if (_prevCtx.state === 'suspended') _prevCtx.resume()
  const now = _prevCtx.currentTime
  const osc = _prevCtx.createOscillator()
  const gain = _prevCtx.createGain()
  if (instrument === 'bd') {
    osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1)
    gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
  } else {
    osc.type = 'triangle'; osc.frequency.value = 800
    gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  }
  osc.connect(gain).connect(_prevCtx.destination); osc.start(); osc.stop(now + 0.2)
}

export default function StudioEditor() {
  // â”€â”€ State â”€â”€
  const [code, setCode] = useState(GENRE_TEMPLATES[0].code)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading')
  const [loadingMsg, setLoadingMsg] = useState('initializing...')
  const [error, setError] = useState<string | null>(null)
  const [masterVolume, setMasterVolume] = useState(0.75)
  const [activeGenre, setActiveGenre] = useState('acid')
  const [sliderDefs, setSliderDefs] = useState<Record<string, { min: number; max: number; value: number }>>({})
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const [leftPanelPinned, setLeftPanelPinned] = useState(false)
  const leftPanelHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState<Set<string>>(new Set(['genres', 'knobs', 'methods']))
  const [codeVisible, setCodeVisible] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [pianoRollChannel, setPianoRollChannel] = useState<number | null>(null)
  const [drumSequencerChannel, setDrumSequencerChannel] = useState<number | null>(null)
  const [padSamplerChannel, setPadSamplerChannel] = useState<number | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  // Recording: capture drum hits with cycle position for converting to Strudel code
  const recordedHitsRef = useRef<{ sound: string; bank?: string; cycleTime: number }[]>([])
  const recordStartCycleRef = useRef<number>(0)

  // Undo/Redo
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isUndoRedo = useRef(false)

  // â”€â”€ Refs â”€â”€
  const codeRef = useRef(code)
  codeRef.current = code
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const editorDivRef = useRef<HTMLDivElement>(null)
  const codeEditorRef = useRef<StudioCodeEditorHandle>(null)
  const engineRef = useRef<StrudelEngine | null>(null)
  const drawerRef = useRef<any>(null)
  const isPlayingRef = useRef(false)
  const lastEvaluatedRef = useRef('')
  const masterGainRef = useRef<GainNode | null>(null)
  const sliderValuesRef = useRef<Record<string, number>>({})
  const sliderDefsRef = useRef<Record<string, { min: number; max: number; value: number }>>({})
  const drawStateRef = useRef({ counter: 0 })
  const mixerStateRef = useRef<{ muted: Set<number>; soloed: Set<number> }>({ muted: new Set(), soloed: new Set() })
  const automationStateRef = useRef<{ data: Map<string, number>; sections: { id: string; bars: number }[] }>({ data: new Map(), sections: [] })
  const metronomeRef = useRef(false)
  const evalThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEvalRef = useRef<string | null>(null)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { metronomeRef.current = metronomeEnabled }, [metronomeEnabled])

  // â”€â”€ Undo/Redo helpers â”€â”€
  const setCodeWithUndo = useCallback((newCode: string | ((prev: string) => string)) => {
    setCode(prev => {
      const next = typeof newCode === 'function' ? newCode(prev) : newCode
      if (!isUndoRedo.current) {
        undoStack.current.push(prev)
        if (undoStack.current.length > 100) undoStack.current.shift()
        redoStack.current = []
      }
      return next
    })
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return
    isUndoRedo.current = true
    const prev = undoStack.current.pop()!
    redoStack.current.push(codeRef.current)
    setCode(prev)
    isUndoRedo.current = false
  }, [])

  const handleRedo = useCallback(() => {
    if (redoStack.current.length === 0) return
    isUndoRedo.current = true
    const next = redoStack.current.pop()!
    undoStack.current.push(codeRef.current)
    setCode(next)
    isUndoRedo.current = false
  }, [])

  // â”€â”€ Master volume â”€â”€
  const updateMasterVolume = useCallback((v: number) => {
    setMasterVolume(v)
    if (masterGainRef.current) masterGainRef.current.gain.value = v
    if (typeof window !== 'undefined') localStorage.setItem('444-studio-volume', String(v))
  }, [])

  // â”€â”€ Initialize Strudel engine â”€â”€
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const { initStrudelEngine } = await import('@/lib/strudel-engine')

        const { engine, DrawerClass } = await initStrudelEngine(
          (p) => { if (!cancelled) setLoadingMsg(p.message) },
          sliderValuesRef,
          sliderDefsRef,
        )

        if (cancelled) return
        engineRef.current = engine

        // Volume control: use superdough's built-in destinationGain (same as InputEditor)
        // Do NOT monkey-patch ctx.destination â€” it breaks superdough's AudioController
        // which expects destination.maxChannelCount (only on AudioDestinationNode)
        const savedVol = typeof window !== 'undefined' ? localStorage.getItem('444-studio-volume') : null
        const vol = savedVol ? parseFloat(savedVol) : 0.75
        setMasterVolume(vol)

        // Drawer for inline visuals
        if (DrawerClass) {
          const drawer = new DrawerClass(
            (haps: any[], time: number, _drawer: any, painters: any[]) => {
              const canvas = canvasRef.current
              if (!canvas) return
              const ctx2d = canvas.getContext('2d', { willReadFrequently: true })
              if (!ctx2d) return
              const w = canvas.width, h = canvas.height

              if (painters && painters.length > 0) {
                ctx2d.clearRect(0, 0, w, h)
                if (painters.length === 1) {
                  try { painters[0].call(painters[0], haps, time, ctx2d, w, h) } catch {}
                } else {
                  const rowH = Math.floor(h / painters.length)
                  for (let i = 0; i < painters.length; i++) {
                    const offscreen = new OffscreenCanvas(w, rowH)
                    const offCtx = offscreen.getContext('2d')
                    if (!offCtx) continue
                    try { painters[i].call(painters[i], haps, time, offCtx, w, rowH) } catch {}
                    ctx2d.drawImage(offscreen, 0, i * rowH)
                  }
                }
              }
            },
            [-2, 2],
          )
          drawerRef.current = drawer
        }

        setStatus('ready')

        // Auto-register user samples so s("name") works in existing patterns
        try {
          const res = await fetch('/api/studio/samples')
          const data = await res.json()
          if (data.samples && engine.webaudio) {
            const samplesList = data.samples as { id: string; name: string; url: string }[]
            for (const s of samplesList) {
              try { await engine.webaudio.samples({ [s.name]: [s.url] }) }
              catch { /* individual sample registration failure is non-fatal */ }
            }
            if (samplesList.length > 0) {
              console.log(`[444 STUDIO] Auto-registered ${samplesList.length} custom sample(s)`)
            }
          }
        } catch { /* samples fetch failure is non-fatal */ }
      } catch (err: any) {
        console.error('[444 STUDIO] init failed:', err)
        if (!cancelled) {
          setError(err.message || 'Engine init failed')
          setStatus('error')
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // â”€â”€ Play/Stop â”€â”€
  // Build final eval code: mixer overrides + automation overrides
  const buildEvalCode = useCallback((src: string, muted: Set<number>, soloed: Set<number>) => {
    let code = applyMixerOverrides(
      fixSoundfontNames(src) + (metronomeRef.current ? generateMetronomeCode(0) : ''),
      muted, soloed
    )
    const { data, sections } = automationStateRef.current
    if (data.size > 0 && sections.length > 0) {
      code = applyAutomationOverrides(code, data, sections)
    }
    return code
  }, [])

  // Automation data change: store + re-evaluate
  const handleAutomationDataChange = useCallback((data: Map<string, number>, sections: { id: string; bars: number }[]) => {
    automationStateRef.current = { data, sections }
    if (isPlayingRef.current && engineRef.current?.evaluate) {
      const src = codeRef.current.trim()
      if (!src) return
      const { muted, soloed } = mixerStateRef.current
      const finalCode = buildEvalCode(src, muted, soloed)
      engineRef.current.evaluate(finalCode).catch(err => {
        console.error('[444 STUDIO] automation update error:', err)
      })
    }
  }, [buildEvalCode])

  const handlePlay = useCallback(async () => {
    const engine = engineRef.current
    if (!engine?.evaluate) { setError('Engine not ready'); return }

    try {
      if (isPlaying) {
        await engine.evaluate('silence')
        try { const { cleanupDraw } = await import('@strudel/draw'); cleanupDraw(true) } catch {}
        if (drawerRef.current) try { drawerRef.current.stop() } catch {}
        clearOrbitAnalysers()
        setIsPlaying(false)
        setStatus('ready')
        setError(null)
      } else {
        setError(null)
        let src = codeRef.current.trim()
        if (!src || src.split('\n').every(l => l.trim().startsWith('//'))) {
          throw new Error('Enter a pattern to play')
        }

        // â”€â”€ Mandatory scale: auto-inject if missing â”€â”€
        const existingScale = parseMixerScale(src)
        if (!existingScale) {
          src = insertScale(src, 'C4', 'minor')
          codeRef.current = src
          setCode(src)
          console.log('[444 STUDIO] auto-injected scale: C4:minor')
        }
        sliderDefsRef.current = {}
        await engine.webaudio.getAudioContext().resume()
        drawStateRef.current.counter = 0
        lastEvaluatedRef.current = ''

        // Pre-initialize orbits BEFORE evaluate so duck() has valid targets
        try {
          const controller = (engine.webaudio as any).getSuperdoughAudioController?.()
          if (controller?.getOrbit) {
            for (let i = 0; i < 12; i++) {
              controller.getOrbit(i)
            }
            console.log('[444 STUDIO] pre-initialized 12 orbits for duck()')
          }
          if (controller?.output?.destinationGain) {
            masterGainRef.current = controller.output.destinationGain
            const savedVol = localStorage.getItem('444-studio-volume')
            const vol = savedVol !== null ? parseFloat(savedVol) : 0.75
            if (!isNaN(vol)) masterGainRef.current!.gain.value = vol
            console.log('[444 STUDIO] master volume connected')

            // Connect analyser node for master visualizer
            try {
              const actx = engine.webaudio.getAudioContext()
              const analyser = actx.createAnalyser()
              analyser.fftSize = 256
              analyser.smoothingTimeConstant = 0.8
              masterGainRef.current!.connect(analyser)
              setAnalyserNode(analyser)
              console.log('[444 STUDIO] master analyser connected')
            } catch (ae) {
              console.log('[444 STUDIO] analyser connect failed:', ae)
            }

            // Connect per-orbit analysers for channel LCD visualization
            try {
              const actx = engine.webaudio.getAudioContext()
              clearOrbitAnalysers()
              for (let i = 0; i < 12; i++) {
                const orbit = controller.getOrbit(i)
                if (orbit?.output) {
                  const orbAnalyser = actx.createAnalyser()
                  orbAnalyser.fftSize = 1024
                  orbAnalyser.smoothingTimeConstant = 0.3
                  orbit.output.connect(orbAnalyser)
                  setOrbitAnalyser(i, orbAnalyser)
                }
              }
              console.log('[444 STUDIO] per-orbit analysers connected')
            } catch (oe) {
              console.log('[444 STUDIO] orbit analyser setup failed:', oe)
            }
          }
        } catch (err) {
          console.log('[444 STUDIO] controller not available yet:', err)
        }

        await engine.evaluate(buildEvalCode(src, mixerStateRef.current.muted, mixerStateRef.current.soloed))
        setSliderDefs({ ...sliderDefsRef.current })

        if (drawerRef.current && engine.scheduler) {
          try {
            const hasPainters = engine.scheduler.pattern?.getPainters?.()?.length > 0
            drawerRef.current.setDrawTime(hasPainters ? [-2, 2] : [-0.1, 0.1])
            drawerRef.current.start(engine.scheduler)
          } catch {}
        }
        setIsPlaying(true)
        setStatus('playing')
      }
    } catch (err: any) {
      console.error('[444 STUDIO] play error:', err)
      setError(err.message || 'Playback failed')
      setStatus('error')
      setIsPlaying(false)
    }
  }, [isPlaying, buildEvalCode])

  // â”€â”€ Live Update â”€â”€
  const handleUpdate = useCallback(async () => {
    const engine = engineRef.current
    if (!engine?.evaluate || !isPlayingRef.current) return
    try {
      setError(null)
      let src = codeRef.current.trim()
      if (!src) return
      if (src === lastEvaluatedRef.current) return

      // â”€â”€ Mandatory scale: auto-inject if missing (same as handlePlay) â”€â”€
      const existingScale = parseMixerScale(src)
      if (!existingScale) {
        src = insertScale(src, 'C4', 'minor')
        codeRef.current = src
        setCode(src)
        console.log('[444 STUDIO] live-update: auto-injected scale: C4:minor')
      }

      lastEvaluatedRef.current = src
      if (editorDivRef.current) {
        editorDivRef.current.style.outline = '2px solid rgba(0,229,199,0.4)'
        setTimeout(() => { if (editorDivRef.current) editorDivRef.current.style.outline = 'none' }, 200)
      }
      sliderDefsRef.current = {}
      await engine.webaudio.getAudioContext().resume()
      drawStateRef.current.counter = 0
      // Ensure orbits exist for duck() on live updates
      try {
        const controller = (engine.webaudio as any).getSuperdoughAudioController?.()
        if (controller?.getOrbit) {
          for (let i = 0; i < 12; i++) controller.getOrbit(i)
        }
      } catch {}
      const evalCode = buildEvalCode(src, mixerStateRef.current.muted, mixerStateRef.current.soloed)
      await engine.evaluate(evalCode)
      if (engine.scheduler?.clock) {
        setTimeout(() => {
          try { engine.scheduler.clock.pause(); engine.scheduler.clock.start() } catch {}
        }, 100)
      }
      if (drawerRef.current && engine.scheduler) {
        try {
          const hasPainters = engine.scheduler.pattern?.getPainters?.()?.length > 0
          drawerRef.current.setDrawTime(hasPainters ? [-2, 2] : [-0.1, 0.1])
          drawerRef.current.invalidate(engine.scheduler)
        } catch {}
      }
      setSliderDefs({ ...sliderDefsRef.current })
    } catch (err: any) {
      console.error('[444 STUDIO] update error:', err)
      setError(err.message || 'Update failed')
    }
  }, [])

  // â”€â”€ Auto-update debounce â”€â”€
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isPlaying) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleUpdate() }, 1500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [code, isPlaying, handleUpdate])

  // â”€â”€ Keyboard shortcuts â”€â”€
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') { e.preventDefault(); handlePlay(); return }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleUpdate(); return }
    if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); handleUpdate(); return }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return }
    if ((e.ctrlKey || e.metaKey) && ((e.key === 'Z' && e.shiftKey) || e.key === 'y')) { e.preventDefault(); handleRedo(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = codeEditorRef.current?.getTextarea()
      if (!ta) return
      const s = ta.selectionStart
      const end = ta.selectionEnd
      const next = code.substring(0, s) + '  ' + code.substring(end)
      setCodeWithUndo(next)
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2 }, 0)
    }
  }, [code, handlePlay, handleUpdate, handleUndo, handleRedo, setCodeWithUndo])

  // â”€â”€ Global spacebar â”€â”€
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement
      const isTextInput = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement || (active as HTMLElement)?.isContentEditable
      if (isTextInput) return
      if (e.key === ' ') { e.preventDefault(); handlePlay() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handlePlay])

  // â”€â”€ Sound preview (one-shot via superdough, no pattern interruption) â”€â”€
  const handlePreviewSound = useCallback(async (soundCode: string) => {
    const engine = engineRef.current
    if (!engine) return
    try {
      // Get audio context and ensure it's running (user gesture required)
      const actx = engine.webaudio.getAudioContext()
      await actx.resume()

      // Resolve superdough function: engine direct ref â†’ webaudio re-export â†’ direct import
      let sd = engine.superdough || engine.webaudio.superdough
      if (!sd) {
        const sdMod = await import('superdough')
        sd = sdMod.superdough
      }
      if (!sd) {
        console.warn('[444 STUDIO] superdough function not available')
        return
      }

      const now = actx.currentTime + 0.05

      // Parse the sound code to extract superdough params
      // Instruments/Sounds: s("bd"), s("sawtooth"), etc.
      const soundMatch = soundCode.match(/^s\(["']([^"']+)["']\)$/)
      // Banks: .bank("RolandTR808")
      const bankMatch = soundCode.match(/^\.bank\(["']([^"']+)["']\)$/)

      // Known synth oscillators (no samples, need a note)
      const SYNTHS = new Set([
        'sawtooth','supersaw','sine','square','triangle','pulse','sbd',
        'white','pink','brown','crackle','noise','noise2',
        'zzfx','z_sine','z_sawtooth','z_triangle','z_square','z_tan','z_noise',
      ])

      if (soundMatch) {
        const name = soundMatch[1]
        if (SYNTHS.has(name)) {
          // Synth: play a note
          await sd({ s: name, note: 'c3', gain: 0.5, release: 0.3 }, now, 0.4)
        } else {
          // Sample: play the first sample
          await sd({ s: name, n: 0, gain: 0.6 }, now, 0.5)
        }
      } else if (bankMatch) {
        const bank = bankMatch[1]
        // Play a kick from this bank so user hears the machine character
        await sd({ s: 'bd', bank, n: 0, gain: 0.6 }, now, 0.5)
      } else {
        console.warn('[444 STUDIO] preview: unrecognized sound code format:', soundCode)
      }
    } catch (err) {
      console.error('[444 STUDIO] preview error:', err)
    }
  }, [])

  // â”€â”€ Insert snippet at cursor â”€â”€
  const insertAtCursor = useCallback((snippet: string) => {
    if (codeEditorRef.current) {
      codeEditorRef.current.insertAtCursor(snippet)
    }
  }, [])

  // â”€â”€ Load genre template â”€â”€
  const loadTemplate = useCallback((id: string) => {
    const tmpl = GENRE_TEMPLATES.find(t => t.id === id)
    if (!tmpl) return
    setActiveGenre(id)
    setCodeWithUndo(tmpl.code)
  }, [setCodeWithUndo])

  // â”€â”€ Slider change handler â”€â”€
  const handleSliderChange = useCallback((id: string, val: number) => {
    sliderValuesRef.current[id] = val
    setSliderDefs(prev => ({ ...prev, [id]: { ...prev[id], value: val } }))
  }, [])

  // â”€â”€ Mixer solo/mute â”€â”€
  const handleMixerStateChange = useCallback((state: { muted: Set<number>; soloed: Set<number> }) => {
    mixerStateRef.current = state
    if (isPlayingRef.current && engineRef.current?.evaluate) {
      const src = codeRef.current.trim()
      if (!src) return
      const finalCode = buildEvalCode(src, state.muted, state.soloed)
      engineRef.current.evaluate(finalCode).catch(err => {
        console.error('[444 STUDIO] mixer state update error:', err)
      })
    }
  }, [buildEvalCode])

  // Throttled evaluate helper - pre-warms orbits so effects (room, delay) work
  const doEvaluate = useCallback((src: string) => {
    if (!isPlayingRef.current || !engineRef.current?.evaluate) return
    lastEvaluatedRef.current = src
    const { muted, soloed } = mixerStateRef.current
    const finalCode = buildEvalCode(src, muted, soloed)
    // Pre-warm orbits so effects (room, delay) work on all orbit buses
    try {
      const controller = (engineRef.current.webaudio as any).getSuperdoughAudioController?.()
      if (controller?.getOrbit) {
        for (let i = 0; i < 12; i++) controller.getOrbit(i)
      }
    } catch {}
    engineRef.current.evaluate(finalCode).catch(err => {
      console.error('[444 STUDIO] live code change error:', err)
    })
  }, [])
  const handleLiveCodeChange = useCallback((newCode: string) => {
    setCodeWithUndo(newCode)
    const src = newCode.trim()
    if (!src) return
    pendingEvalRef.current = src
    if (!evalThrottleRef.current) {
      // Leading edge: evaluate immediately
      doEvaluate(src)
      evalThrottleRef.current = setTimeout(() => {
        evalThrottleRef.current = null
        // Trailing edge: if a newer code arrived during the throttle window, evaluate it
        if (pendingEvalRef.current && pendingEvalRef.current !== lastEvaluatedRef.current) {
          doEvaluate(pendingEvalRef.current)
        }
      }, 120)
    }
  }, [setCodeWithUndo, doEvaluate])

  // â”€â”€ Metronome toggle (re-evaluate during playback) â”€â”€
  const handleMetronomeToggle = useCallback((enabled: boolean) => {
    metronomeRef.current = enabled
    setMetronomeEnabled(enabled)
    if (isPlayingRef.current && engineRef.current?.evaluate) {
      const src = codeRef.current.trim()
      if (!src) return
      const { muted, soloed } = mixerStateRef.current
      const finalCode = buildEvalCode(src, muted, soloed)
      engineRef.current.evaluate(finalCode).catch(err => {
        console.error('[444 STUDIO] metronome toggle error:', err)
      })
    }
  }, [buildEvalCode])

  // â”€â”€ Register custom sound in Strudel engine â”€â”€
  const registerCustomSound = useCallback(async (name: string, url: string) => {
    const engine = engineRef.current
    if (!engine?.webaudio) {
      console.warn('[444 STUDIO] Engine not ready for sample registration')
      return
    }
    try {
      await engine.webaudio.samples({ [name]: [url] })
      console.log(`[444 STUDIO] Registered custom sound: s("${name}")`)
    } catch (err) {
      console.error('[444 STUDIO] Failed to register sound:', err)
    }
  }, [])

  // â”€â”€ Add a vocal/sample channel with auto-calculated loopAt â”€â”€
  // — Add channel from browser panel —
  const handleBrowserAddChannel = useCallback((soundId: string, type: 'synth' | 'sample' | 'vocal' | 'instrument' | 'drumpad', loopAt?: number) => {
    const currentCode = codeRef.current
    const projectBpm = parseBPM(currentCode) ?? 120
    const chanType = type === 'vocal' ? 'vocal' : type === 'instrument' ? 'instrument' : type === 'drumpad' ? 'drumpad' : type === 'synth' ? 'synth' : 'sample'
    const newCode = addChannel(currentCode, soundId, chanType, loopAt, undefined, projectBpm)
    if (newCode !== currentCode) {
      handleLiveCodeChange(newCode)
    }
  }, [handleLiveCodeChange])

  // ── Recording: capture drum hits and convert to Strudel code ──
  const handleRecordToggle = useCallback(() => {
    setIsRecording(prev => {
      if (!prev) {
        // Start recording
        recordedHitsRef.current = []
        // Capture current cycle position as start reference
        try {
          const engine = engineRef.current
          if (engine?.scheduler?.now) {
            recordStartCycleRef.current = engine.scheduler.now()
          } else {
            recordStartCycleRef.current = 0
          }
        } catch { recordStartCycleRef.current = 0 }
        console.log('[444 STUDIO] Recording started')
        return true
      } else {
        // Stop recording and convert hits to code
        const hits = recordedHitsRef.current
        if (hits.length === 0) {
          console.log('[444 STUDIO] Recording stopped — no hits captured')
          return false
        }
        // Convert recorded hits to a drum pattern
        const startCycle = recordStartCycleRef.current
        // Normalize all hit times relative to start
        const normalizedHits = hits.map(h => ({
          ...h,
          pos: h.cycleTime - startCycle,
        }))
        // Determine how many bars were recorded (round up to nearest integer)
        const maxPos = Math.max(...normalizedHits.map(h => h.pos))
        const recordedBars = Math.max(1, Math.ceil(maxPos))
        const stepsPerBar = 16
        const totalSteps = recordedBars * stepsPerBar

        // Group hits by sound and quantize to step grid
        const soundSteps = new Map<string, Set<number>>()
        for (const hit of normalizedHits) {
          if (hit.pos < 0) continue
          const step = Math.round((hit.pos / recordedBars) * totalSteps) % totalSteps
          const key = hit.sound
          if (!soundSteps.has(key)) soundSteps.set(key, new Set())
          soundSteps.get(key)!.add(step)
        }

        // Build mini-notation for each sound row
        const rows: string[] = []
        for (const [sound, steps] of soundSteps) {
          // Create pattern string: e.g., "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"
          const cells: string[] = []
          for (let i = 0; i < totalSteps; i++) {
            cells.push(steps.has(i) ? sound : '~')
          }
          // Compress consecutive tildes into sub-groups for readability
          rows.push(`s("${cells.join(' ')}")`)
        }

        // Build the channel code
        const bank = normalizedHits[0]?.bank
        const bankSuffix = bank ? `.bank("${bank}")` : ''
        const channelCode = rows.length === 1
          ? `${rows[0]}${bankSuffix}`
          : `stack(\n  ${rows.join(',\n  ')}\n)${bankSuffix}`

        // Add as a new channel
        const currentCode = codeRef.current
        const newCode = currentCode.trimEnd() + '\n\n// Recorded drum pattern\n$: ' + channelCode + '\n'
        handleLiveCodeChange(newCode)

        console.log(`[444 STUDIO] Recording stopped — ${hits.length} hits → ${soundSteps.size} sounds, ${recordedBars} bars`)
        recordedHitsRef.current = []
        return false
      }
    })
  }, [handleLiveCodeChange])

  const handleRecordHit = useCallback((sound: string, bank?: string) => {
    if (!isRecording) return
    try {
      const engine = engineRef.current
      const cycleTime = engine?.scheduler?.now?.() ?? 0
      recordedHitsRef.current.push({ sound, bank, cycleTime })
    } catch {
      recordedHitsRef.current.push({ sound, bank, cycleTime: Date.now() / 1000 })
    }
  }, [isRecording])
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: '#0a0b0d' }}>
      {/* â”€â”€ TOP BAR â”€â”€ */}
      <StudioTopBar
        status={status}
        loadingMsg={loadingMsg}
        error={error}
        isPlaying={isPlaying}
        masterVolume={masterVolume}
        codeVisible={codeVisible}
        analyserNode={analyserNode}
        onPlay={handlePlay}
        onUpdate={handleUpdate}
        onVolumeChange={updateMasterVolume}
        onToggleCode={() => setCodeVisible(v => !v)}
        isRecording={isRecording}
        onRecord={handleRecordToggle}
      />

      {/* Hidden canvas for visualizations â€” now positioned inside mixer */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="hidden"
        style={{ zIndex: -1 }}
      />

      {/* â”€â”€ MAIN BODY â”€â”€ */}
      <div className="flex-1 flex overflow-hidden relative" style={{ zIndex: 1 }}>

        {/* â”€â”€ LEFT PANEL (collapsible genre/sounds/methods) â”€â”€ */}
                {/* LEFT PANEL (hover-reveal, pin to keep open) */}
        <div
          className={`shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-out ${(leftPanelOpen || leftPanelPinned) ? 'w-60' : 'w-0'}`}
          onMouseEnter={() => {
            if (leftPanelHoverTimer.current) clearTimeout(leftPanelHoverTimer.current)
            setLeftPanelOpen(true)
          }}
          onMouseLeave={() => {
            if (leftPanelPinned) return
            leftPanelHoverTimer.current = setTimeout(() => setLeftPanelOpen(false), 300)
          }}
        >
          {(leftPanelOpen || leftPanelPinned) && (
            <div className="flex-1 flex flex-col overflow-hidden w-60" style={{ background: '#111318', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Header + Pin */}
              <div className="flex items-center shrink-0 px-2 py-1.5 border-b border-white/5">
                <span className="text-[7px] font-black uppercase tracking-[.2em] text-white/40">BROWSER</span>
                <div className="flex-1" />
                <button
                  onClick={() => setLeftPanelPinned(p => !p)}
                  className="px-1.5 py-1 text-[8px] transition-colors cursor-pointer"
                  style={{ color: leftPanelPinned ? '#e8ecf0' : '#5a616b' }}
                  title={leftPanelPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
                >
                  {leftPanelPinned ? '📌' : '📎'}
                </button>
              </div>

              {/* Unified scrollable sidebar with collapsible sections */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1d22 transparent' }}>

                {/* ── GENRE PRESETS (collapsible) ── */}
                <SidebarSection
                  title="GENRE PRESETS"
                  icon="🎵"
                  color="#06b6d4"
                  isOpen={!leftCollapsed.has('genres')}
                  onToggle={() => setLeftCollapsed(prev => {
                    const next = new Set(prev)
                    next.has('genres') ? next.delete('genres') : next.add('genres')
                    return next
                  })}
                >
                  <StudioGenreSelector activeGenre={activeGenre} onSelect={loadTemplate} />
                </SidebarSection>

                {/* ── LIVE KNOBS (collapsible) ── */}
                {Object.keys(sliderDefs).length > 0 && (
                  <SidebarSection
                    title="LIVE KNOBS"
                    icon="🎛️"
                    color="#00e5c7"
                    isOpen={!leftCollapsed.has('knobs')}
                    onToggle={() => setLeftCollapsed(prev => {
                      const next = new Set(prev)
                      next.has('knobs') ? next.delete('knobs') : next.add('knobs')
                      return next
                    })}
                  >
                    <StudioSliderPanel sliderDefs={sliderDefs} sliderValues={sliderValuesRef} onChange={handleSliderChange} />
                  </SidebarSection>
                )}

                {/* ── INSTRUMENTS / SOUNDS / BANKS (from BrowserPanel) ── */}
                <StudioBrowserPanel
                  onAddChannel={handleBrowserAddChannel}
                  onPreview={handlePreviewSound}
                  projectBpm={parseBPM(code) ?? 120}
                />

                {/* ── METHODS (collapsible) ── */}
                <SidebarSection
                  title="METHODS"
                  icon="🔧"
                  color="#6f8fb3"
                  isOpen={!leftCollapsed.has('methods')}
                  onToggle={() => setLeftCollapsed(prev => {
                    const next = new Set(prev)
                    next.has('methods') ? next.delete('methods') : next.add('methods')
                    return next
                  })}
                >
                  <StudioMethodsPanel onInsert={insertAtCursor} onPreview={handlePreviewSound} methodsOnly />
                </SidebarSection>

              </div>
            </div>
          )}
        </div>

        {/* LEFT PANEL HOVER ZONE */}
        <div
          className="shrink-0 w-3 flex items-center justify-center hover:bg-white/[0.04] text-white/10 hover:text-white/30 transition-all duration-[180ms] ease-in-out cursor-pointer"
          onMouseEnter={() => {
            if (leftPanelHoverTimer.current) clearTimeout(leftPanelHoverTimer.current)
            setLeftPanelOpen(true)
          }}
          title={leftPanelPinned ? 'Sidebar pinned' : 'Hover to open sidebar'}
        >
          <span className="text-[7px] font-mono">{(leftPanelOpen || leftPanelPinned) ? '◂' : '▸'}</span>
        </div>

        {/* â”€â”€ CENTER: MIXER RACK (Main View) â”€â”€ */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <StudioMixerRack
            code={code}
            onCodeChange={(c: string) => setCodeWithUndo(c)}
            onLiveCodeChange={handleLiveCodeChange}
            onMixerStateChange={handleMixerStateChange}
            metronomeEnabled={metronomeEnabled}
            onMetronomeToggle={handleMetronomeToggle}
            isPlaying={isPlaying}
            onPreview={handlePreviewSound}
            onOpenPianoRoll={(idx) => { setDrumSequencerChannel(null); setPadSamplerChannel(null); setPianoRollChannel(prev => prev === idx ? null : idx) }}
            onOpenDrumSequencer={(idx) => { setPianoRollChannel(null); setPadSamplerChannel(null); setDrumSequencerChannel(prev => prev === idx ? null : idx) }}
            onOpenPadSampler={(idx) => { setPianoRollChannel(null); setDrumSequencerChannel(null); setPadSamplerChannel(prev => prev === idx ? null : idx) }}
            onAutomationDataChange={handleAutomationDataChange}
            getCyclePosition={() => {
              try {
                const engine = engineRef.current
                if (!engine?.scheduler?.now) return null
                return engine.scheduler.now()
              } catch { return null }
            }}
            onSeek={(barPosition: number) => {
              try {
                const engine = engineRef.current
                if (engine?.scheduler?.setCycle) {
                  engine.scheduler.setCycle(barPosition)
                  console.log(`[444 STUDIO] seeked to bar ${barPosition.toFixed(2)}`)
                }
              } catch (err) {
                console.warn('[444 STUDIO] seek failed:', err)
              }
            }}
            projectBpm={parseBPM(code) ?? 120}
          />

          {/* Piano Roll — docks at bottom */}
          {pianoRollChannel !== null && (() => {
            const channels = parseStrudelCode(code)
            const ch = channels[pianoRollChannel]
            if (!ch) return null
            const patternInfo = parseChannelPattern(ch)
            const scaleInfo = parseMixerScale(code)
            const scaleStr = scaleInfo
              ? `${scaleInfo.root}4:${scaleInfo.scale}`
              : 'C4:minor'
            // For sample channels with type 's' and no note()/n(), start with empty pattern
            // so the user draws fresh pitched notes on the piano roll
            const isSampleChannelNoPitch = ch.sourceType === 'sample' && patternInfo?.type === 's'
            const currentPattern = isSampleChannelNoPitch
              ? ''
              : (patternInfo && !patternInfo.isGenerative ? patternInfo.pattern : '')
            // Use 'note' mode for note() channels, 'n' for n().scale() channels.
            // Sample channels without n()/note(): use 'note' mode so piano roll
            // generates note("c3 e3 ...").s("sample") â€” the Strudel way to pitch samples.
            const patternType = patternInfo?.type === 'n' ? 'n'
              : patternInfo?.type === 'note' ? 'note'
              : 'note'
            const isGenerative = isSampleChannelNoPitch ? false
              : (patternInfo?.isGenerative ?? (patternInfo === null ? true : false))
            return (
              <StudioPianoRoll
                currentPattern={currentPattern}
                scale={scaleStr}
                color={ch.color}
                channelName={ch.name}
                soundSource={ch.source}
                isGenerative={isSampleChannelNoPitch ? false : isGenerative}
                patternType={isSampleChannelNoPitch ? 'note' : patternType as 'n' | 'note' | 's'}
                channelData={ch}
                channelIdx={pianoRollChannel}
                onPatternChange={(newPattern: string) => {
                  const latest = codeRef.current
                  const newCode = replaceChannelPattern(latest, pianoRollChannel, newPattern, patternType as 'n' | 'note')
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onEffectChange={(paramKey: string, value: number) => {
                  const latest = codeRef.current
                  const newCode = updateParamInCode(latest, pianoRollChannel, paramKey, value)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onEffectAdd={(effectCode: string) => {
                  const latest = codeRef.current
                  const newCode = insertEffectInChannel(latest, pianoRollChannel, effectCode)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onEffectRemove={(effectKey: string) => {
                  const latest = codeRef.current
                  const newCode = removeEffectFromChannel(latest, pianoRollChannel, effectKey)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onArpChange={(mode: string) => {
                  const latest = codeRef.current
                  const newCode = setArpMode(latest, pianoRollChannel, mode)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onArpRateChange={(rate: number) => {
                  const latest = codeRef.current
                  const newCode = setArpRate(latest, pianoRollChannel, rate)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onTransposeChange={(semitones: number) => {
                  const latest = codeRef.current
                  const clamped = Math.max(-24, Math.min(24, semitones))
                  const newCode = setTranspose(latest, pianoRollChannel, clamped)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onNotePreview={async (midi: number) => {
                  const engine = engineRef.current
                  if (!engine) return
                  try {
                    const actx = engine.webaudio.getAudioContext()
                    await actx.resume()
                    let sd = engine.superdough || engine.webaudio.superdough
                    if (!sd) {
                      const sdMod = await import('superdough')
                      sd = sdMod.superdough
                    }
                    if (!sd) return
                    const now = actx.currentTime + 0.05
                    const channels = parseStrudelCode(codeRef.current)
                    const ch = channels[pianoRollChannel]
                    if (!ch) return
                    const source = ch.source
                    // Known synth oscillators (need a note, not a sample index)
                    const SYNTHS = new Set([
                      'sawtooth','supersaw','sine','square','triangle','pulse','sbd',
                      'white','pink','brown','crackle','noise','noise2',
                      'zzfx','z_sine','z_sawtooth','z_triangle','z_square','z_tan','z_noise',
                    ])
                    // Convert MIDI to note name (e.g., 60 â†’ "c4")
                    const NOTES = ['c','cs','d','ds','e','f','fs','g','gs','a','as','b']
                    const noteName = NOTES[midi % 12] + (Math.floor(midi / 12) - 1)
                    const params: Record<string, unknown> = { s: source, gain: 0.5, release: 0.3 }
                    if (SYNTHS.has(source)) {
                      params.note = noteName
                    } else {
                      // Sample-based: use note for pitched playback (Strudel way)
                      params.note = noteName
                      // For GM soundfonts, don't set n — superdough resolves the correct
                      // sample from the note name alone. Setting n=0 can override instrument selection.
                      if (!source.startsWith('gm_')) {
                        params.n = 0
                      }
                      if (ch.bank) params.bank = ch.bank
                      // Pass begin/end if channel has trim so preview matches
                      const beginP = ch.params.find(p => p.key === 'begin')
                      const endP = ch.params.find(p => p.key === 'end')
                      if (beginP) params.begin = beginP.value
                      if (endP) params.end = endP.value
                    }
                    await sd(params, now, 0.4)
                  } catch (err) {
                    console.error('[444 STUDIO] note preview error:', err)
                  }
                }}
                onClose={() => setPianoRollChannel(null)}
                isPlaying={isPlaying}
                projectBpm={parseBPM(code) ?? 120}
                getCyclePosition={() => {
                  try {
                    const engine = engineRef.current
                    if (!engine?.scheduler?.now) return null
                    return engine.scheduler.now()
                  } catch { return null }
                }}
              />
            )
          })()}

          {/* Drum Sequencer â€” docks at bottom */}
          {drumSequencerChannel !== null && (() => {
            const channels = parseStrudelCode(code)
            const ch = channels[drumSequencerChannel]
            if (!ch) return null
            return (
              <StudioDrumSequencer
                key={drumSequencerChannel}
                channelRawCode={ch.rawCode}
                color={ch.color}
                channelName={ch.name}
                bank={ch.bank}
                onPatternChange={(newRawCode: string) => {
                  const latest = codeRef.current
                  const newCode = replaceChannelBlock(latest, drumSequencerChannel, newRawCode)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onClose={() => setDrumSequencerChannel(null)}
                isPlaying={isPlaying}
                projectBpm={parseBPM(code) ?? 120}
                isRecording={isRecording}
                onRecordHit={handleRecordHit}
                getCyclePosition={() => {
                  try {
                    const engine = engineRef.current
                    if (!engine?.scheduler?.now) return null
                    return engine.scheduler.now()
                  } catch { return null }
                }}
                onPreviewDrum={async (instrument: string, bank?: string) => {
                  const engine = engineRef.current
                  if (!engine) { playDrumPreviewFallback(instrument); return }
                  try {
                    const actx = engine.webaudio.getAudioContext()
                    await actx.resume()
                    let sd = engine.superdough || engine.webaudio.superdough
                    if (!sd) {
                      const sdMod = await import('superdough')
                      sd = sdMod.superdough
                    }
                    if (!sd) { playDrumPreviewFallback(instrument); return }
                    const now = actx.currentTime + 0.05
                    // Parse variant from instrument name (e.g., "bd:3" â†’ s: "bd", n: 3)
                    const variantMatch = instrument.match(/^([^:]+):(\d+)$/)
                    const sName = variantMatch ? variantMatch[1] : instrument
                    const sampleN = variantMatch ? parseInt(variantMatch[2]) : 0
                    const params: Record<string, unknown> = { s: sName, n: sampleN, gain: 0.6, cut: 1 }
                    if (bank) params.bank = bank
                    await sd(params, now, 0.5)
                  } catch {
                    playDrumPreviewFallback(instrument)
                  }
                }}
              />
            )
          })()}

          {/* Vocal Pad Sampler — docks at bottom */}
          {padSamplerChannel !== null && (() => {
            const channels = parseStrudelCode(code)
            const ch = channels[padSamplerChannel]
            if (!ch) return null
            // Extract chop/slice count from channel code (e.g., .splice(16,...) or .slice(16,...) or .chop(16) → 16)
            const spliceMatch = ch.rawCode.match(/\.splice\(\s*(\d+)/)
            const sliceMatch = spliceMatch || ch.rawCode.match(/\.slice\(\s*(\d+)/)
            const chopMatch = sliceMatch || ch.rawCode.match(/\.chop\(\s*(\d+)\s*\)/)
            let chopCount = chopMatch ? parseInt(chopMatch[1]) : 16
            // Extract loopAt from channel code
            const loopAtMatch = ch.rawCode.match(/\.loopAt\(\s*(\d+)\s*\)/)
            const loopAtVal = loopAtMatch ? parseInt(loopAtMatch[1]) : 4
            // Extract trim begin/end — first check trim metadata comment, then fall back to params
            const trimMeta = ch.rawCode.match(/\/\/\s*trim:([\d.]+):([\d.]+):(\d+)/)
            let trimBegin: number, trimEnd: number
            if (trimMeta) {
              trimBegin = parseFloat(trimMeta[1])
              trimEnd = parseFloat(trimMeta[2])
              chopCount = parseInt(trimMeta[3]) // restore original pad count
            } else {
              const trimBeginParam = ch.params.find(p => p.key === 'begin')
              const trimEndParam = ch.params.find(p => p.key === 'end')
              trimBegin = trimBeginParam?.value ?? 0
              trimEnd = trimEndParam?.value ?? 1
            }
            return (
              <StudioVocalPadSampler
                key={padSamplerChannel}
                sampleName={ch.source}
                color={ch.color}
                channelName={ch.name}
                channelRawCode={ch.rawCode}
                chopCount={chopCount}
                trimBegin={trimBegin}
                trimEnd={trimEnd}
                projectBpm={parseBPM(code) ?? 120}
                isTransportPlaying={isPlaying}
                onToggleTransport={handlePlay}
                onPatternChange={(newRawCode: string) => {
                  const latest = codeRef.current
                  const newCode = replaceChannelBlock(latest, padSamplerChannel, newRawCode)
                  if (newCode !== latest) handleLiveCodeChange(newCode)
                }}
                onPreviewPad={async (sampleName: string, begin: number, end: number, speed?: number) => {
                  // ── Try superdough first ──
                  const engine = engineRef.current
                  if (engine) {
                    try {
                      const actx = engine.webaudio.getAudioContext()
                      await actx.resume()
                      let sd = engine.superdough || engine.webaudio.superdough
                      if (!sd) {
                        const sdMod = await import('superdough')
                        sd = sdMod.superdough
                      }
                      if (sd) {
                        const now = actx.currentTime + 0.05
                        const params: Record<string, unknown> = {
                          s: sampleName,
                          begin,
                          end,
                          gain: 0.7,
                          cut: 2,
                        }
                        if (speed !== undefined && speed !== 1) params.speed = speed
                        if (ch.bank) params.bank = ch.bank
                        const sliceDur = Math.max(0.25, (end - begin) * 60)
                        await sd(params, now, Math.min(sliceDur, 8))
                        return // superdough worked
                      }
                    } catch (err) {
                      console.warn('[444 STUDIO] superdough pad preview failed, trying direct playback:', err)
                    }
                  }

                  // Fallback: superdough is the primary path; if it failed, log and return
                  console.warn('[444 STUDIO] pad preview: superdough path unavailable for', sampleName)
                }}
                onPreviewDrum={async (sound: string, gain?: number) => {
                  const engine = engineRef.current
                  if (!engine) return
                  try {
                    const actx = engine.webaudio.getAudioContext()
                    await actx.resume()
                    let sd = engine.superdough || engine.webaudio.superdough
                    if (!sd) {
                      const sdMod = await import('superdough')
                      sd = sdMod.superdough
                    }
                    if (!sd) return
                    await sd({ s: sound, gain: gain ?? 0.7 }, actx.currentTime + 0.01, 0.3)
                  } catch {}
                }}
                onClose={() => setPadSamplerChannel(null)}
              />
            )
          })()}
        </div>
      </div>

      {/* â”€â”€ CODE EDITOR DRAWER (slides from right) â”€â”€ */}
      <div
        className={`absolute top-10 right-0 bottom-0 z-30 transition-all duration-300 ease-out ${
          codeVisible ? 'w-[520px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
        style={{
          background: '#111318',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          boxShadow: codeVisible ? '-8px 0 16px #050607' : 'none',
        }}
      >
        {codeVisible && (
          <div className="h-full flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#16181d' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00e5c7' }} />
                <span className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color: '#9aa7b3' }}>Music Code</span>
              </div>
              <button
                onClick={() => setCodeVisible(false)}
                className="text-[9px] text-white/20 hover:text-white/50 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-white/[0.04]"
              >
                ESC
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col" ref={editorDivRef}>
              <StudioCodeEditor
                ref={codeEditorRef}
                code={code}
                onChange={(c) => setCodeWithUndo(c)}
                onKeyDown={handleKeyDown}
                canvasRef={canvasRef}
                editorRef={editorDivRef}
              />
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        textarea::-webkit-scrollbar { width: 5px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
        textarea::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
        select { background-color: #16181d !important; }
        select option { background: #111318; color: #e8ecf0; }
        input[type='range'] {
          -webkit-appearance: none; height: 3px; border-radius: 10px;
          background: rgba(255,255,255,0.06);
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; cursor: pointer;
          background: #00e5c7;
          border: 2px solid #111318;
          box-shadow: 2px 2px 4px #050607, -1px -1px 3px #1a1d22;
        }
      `}</style>
    </div>
  )
}
