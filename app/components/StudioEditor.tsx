'use client'

// ═══════════════════════════════════════════════════════════════
//  444 STUDIO — Pro Strudel Live Coding Studio (Orchestrator)
//  Composes: TopBar, GenreSelector, SliderPanel, MethodsPanel,
//            EffectsChain, CodeEditor — all as standalone components.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react'
import type { StrudelEngine } from '@/lib/strudel-engine'
import { fixSoundfontNames } from '@/lib/strudel-engine'
import { applyMixerOverrides, parseStrudelCode, parseChannelPattern, replaceChannelPattern, replaceChannelBlock, parseScale as parseMixerScale, updateScale, insertScale, updateParamInCode, insertEffectInChannel, removeEffectFromChannel, getArpInfo, setArpMode, setArpRate, getTranspose, setTranspose, getParamDef, PARAM_DEFS } from '@/lib/strudel-code-parser'
import { generateMetronomeCode } from '@/lib/strudel-code-parser'
import { setOrbitAnalyser, clearOrbitAnalysers } from '@/lib/studio-analysers'
import StudioPianoRoll from './studio/StudioPianoRoll'
import StudioDrumSequencer from './studio/StudioDrumSequencer'
// Sub-components
import StudioTopBar from './studio/StudioTopBar'
import StudioGenreSelector, { GENRE_TEMPLATES } from './studio/StudioGenreSelector'
import StudioSliderPanel from './studio/StudioSliderPanel'
import StudioMethodsPanel from './studio/StudioMethodsPanel'
import StudioCodeEditor, { type StudioCodeEditorHandle } from './studio/StudioCodeEditor'
import StudioMixerRack from './studio/StudioMixerRack'

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
  // ── State ──
  const [code, setCode] = useState(GENRE_TEMPLATES[0].code)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading')
  const [loadingMsg, setLoadingMsg] = useState('initializing...')
  const [error, setError] = useState<string | null>(null)
  const [masterVolume, setMasterVolume] = useState(0.75)
  const [activeGenre, setActiveGenre] = useState('acid')
  const [sliderDefs, setSliderDefs] = useState<Record<string, { min: number; max: number; value: number }>>({})
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [codeVisible, setCodeVisible] = useState(false)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [pianoRollChannel, setPianoRollChannel] = useState<number | null>(null)
  const [drumSequencerChannel, setDrumSequencerChannel] = useState<number | null>(null)

  // Undo/Redo
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isUndoRedo = useRef(false)

  // ── Refs ──
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
  const metronomeRef = useRef(false)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { metronomeRef.current = metronomeEnabled }, [metronomeEnabled])

  // ── Undo/Redo helpers ──
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

  // ── Master volume ──
  const updateMasterVolume = useCallback((v: number) => {
    setMasterVolume(v)
    if (masterGainRef.current) masterGainRef.current.gain.value = v
    if (typeof window !== 'undefined') localStorage.setItem('444-studio-volume', String(v))
  }, [])

  // ── Initialize Strudel engine ──
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
        // Do NOT monkey-patch ctx.destination — it breaks superdough's AudioController
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

  // ── Play/Stop ──
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

        // ── Mandatory scale: auto-inject if missing ──
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

        await engine.evaluate(applyMixerOverrides(fixSoundfontNames(src) + (metronomeRef.current ? generateMetronomeCode(0) : ''), mixerStateRef.current.muted, mixerStateRef.current.soloed))
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
  }, [isPlaying])

  // ── Live Update ──
  const handleUpdate = useCallback(async () => {
    const engine = engineRef.current
    if (!engine?.evaluate || !isPlayingRef.current) return
    try {
      setError(null)
      let src = codeRef.current.trim()
      if (!src) return
      if (src === lastEvaluatedRef.current) return

      // ── Mandatory scale: auto-inject if missing (same as handlePlay) ──
      const existingScale = parseMixerScale(src)
      if (!existingScale) {
        src = insertScale(src, 'C4', 'minor')
        codeRef.current = src
        setCode(src)
        console.log('[444 STUDIO] live-update: auto-injected scale: C4:minor')
      }

      lastEvaluatedRef.current = src
      if (editorDivRef.current) {
        editorDivRef.current.style.outline = '2px solid rgba(127,169,152,0.4)'
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
      const evalCode = applyMixerOverrides(fixSoundfontNames(src) + (metronomeRef.current ? generateMetronomeCode(0) : ''), mixerStateRef.current.muted, mixerStateRef.current.soloed)
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

  // ── Auto-update debounce ──
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isPlaying) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { handleUpdate() }, 1500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [code, isPlaying, handleUpdate])

  // ── Keyboard shortcuts ──
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

  // ── Global spacebar ──
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

  // ── Sound preview (one-shot via superdough, no pattern interruption) ──
  const handlePreviewSound = useCallback(async (soundCode: string) => {
    const engine = engineRef.current
    if (!engine) return
    try {
      // Get audio context and ensure it's running (user gesture required)
      const actx = engine.webaudio.getAudioContext()
      await actx.resume()

      // Resolve superdough function: engine direct ref → webaudio re-export → direct import
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

  // ── Insert snippet at cursor ──
  const insertAtCursor = useCallback((snippet: string) => {
    if (codeEditorRef.current) {
      codeEditorRef.current.insertAtCursor(snippet)
    }
  }, [])

  // ── Load genre template ──
  const loadTemplate = useCallback((id: string) => {
    const tmpl = GENRE_TEMPLATES.find(t => t.id === id)
    if (!tmpl) return
    setActiveGenre(id)
    setCodeWithUndo(tmpl.code)
  }, [setCodeWithUndo])

  // ── Slider change handler ──
  const handleSliderChange = useCallback((id: string, val: number) => {
    sliderValuesRef.current[id] = val
    setSliderDefs(prev => ({ ...prev, [id]: { ...prev[id], value: val } }))
  }, [])

  // ── Mixer solo/mute ──
  const handleMixerStateChange = useCallback((state: { muted: Set<number>; soloed: Set<number> }) => {
    mixerStateRef.current = state
    // Re-evaluate immediately if playing so user hears the change
    if (isPlayingRef.current && engineRef.current?.evaluate) {
      const src = codeRef.current.trim()
      if (!src) return
      const finalCode = applyMixerOverrides(fixSoundfontNames(src) + (metronomeRef.current ? generateMetronomeCode(0) : ''), state.muted, state.soloed)
      engineRef.current.evaluate(finalCode).catch(err => {
        console.error('[444 STUDIO] mixer state update error:', err)
      })
    }
  }, [])

  // ── Live code change (updates text + re-evaluates immediately) ──
  // Used by BPM slider, scale selector, etc. so changes are heard instantly
  const handleLiveCodeChange = useCallback((newCode: string) => {
    setCodeWithUndo(newCode)
    if (isPlayingRef.current && engineRef.current?.evaluate) {
      const src = newCode.trim()
      if (!src) return
      const { muted, soloed } = mixerStateRef.current
      const finalCode = applyMixerOverrides(
        fixSoundfontNames(src) + (metronomeRef.current ? generateMetronomeCode(0) : ''),
        muted, soloed
      )
      engineRef.current.evaluate(finalCode).catch(err => {
        console.error('[444 STUDIO] live code change error:', err)
      })
    }
  }, [setCodeWithUndo])

  // ── Metronome toggle (re-evaluate during playback) ──
  const handleMetronomeToggle = useCallback((enabled: boolean) => {
    setMetronomeEnabled(enabled)
    // Re-evaluate immediately so metronome starts/stops without pressing play again
    if (isPlayingRef.current && engineRef.current?.evaluate) {
      const src = codeRef.current.trim()
      if (!src) return
      const { muted, soloed } = mixerStateRef.current
      const finalCode = applyMixerOverrides(
        fixSoundfontNames(src) + (enabled ? generateMetronomeCode(0) : ''),
        muted, soloed
      )
      engineRef.current.evaluate(finalCode).catch(err => {
        console.error('[444 STUDIO] metronome toggle error:', err)
      })
    }
  }, [])

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: '#1c1e22' }}>
      {/* ── TOP BAR ── */}
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
      />

      {/* Hidden canvas for visualizations — now positioned inside mixer */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="hidden"
        style={{ zIndex: -1 }}
      />

      {/* ── MAIN BODY ── */}
      <div className="flex-1 flex overflow-hidden relative" style={{ zIndex: 1 }}>

        {/* ── LEFT PANEL (collapsible genre/sounds/methods) ── */}
        <div className={`shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-out ${leftPanelOpen ? 'w-60' : 'w-0'}`}>
          {leftPanelOpen && (
            <div className="flex-1 flex flex-col overflow-hidden w-60" style={{ background: '#23262b', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="shrink-0">
                <StudioGenreSelector activeGenre={activeGenre} onSelect={loadTemplate} />
                <StudioSliderPanel sliderDefs={sliderDefs} sliderValues={sliderValuesRef} onChange={handleSliderChange} />
              </div>
              <StudioMethodsPanel onInsert={insertAtCursor} onPreview={handlePreviewSound} />
            </div>
          )}
        </div>

        {/* ── LEFT PANEL TOGGLE ── */}
        <button
          onClick={() => setLeftPanelOpen(p => !p)}
          className="shrink-0 w-3 flex items-center justify-center hover:bg-white/[0.04] text-white/10 hover:text-white/30 transition-all duration-[180ms] ease-in-out cursor-pointer"
          title={leftPanelOpen ? 'Collapse panel' : 'Expand panel'}
        >
          <span className="text-[7px] font-mono">{leftPanelOpen ? '◂' : '▸'}</span>
        </button>

        {/* ── CENTER: MIXER RACK (Main View) ── */}
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
            onOpenPianoRoll={(idx) => { setDrumSequencerChannel(null); setPianoRollChannel(prev => prev === idx ? null : idx) }}
            onOpenDrumSequencer={(idx) => { setPianoRollChannel(null); setDrumSequencerChannel(prev => prev === idx ? null : idx) }}
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
            const currentPattern = patternInfo && !patternInfo.isGenerative
              ? patternInfo.pattern
              : ''
            // Use 'note' mode for note() channels, 'n' for n().scale() channels,
            // and default to 'note' for channels with no n()/note() so they can be edited
            const patternType = patternInfo?.type === 'n' ? 'n'
              : patternInfo?.type === 'note' ? 'note'
              : 'note'
            const isGenerative = patternInfo?.isGenerative ?? (patternInfo === null ? true : false)
            return (
              <StudioPianoRoll
                currentPattern={currentPattern}
                scale={scaleStr}
                color={ch.color}
                channelName={ch.name}
                soundSource={ch.source}
                isGenerative={isGenerative}
                patternType={patternType as 'n' | 'note' | 's'}
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
                    // Convert MIDI to note name (e.g., 60 → "c4")
                    const NOTES = ['c','cs','d','ds','e','f','fs','g','gs','a','as','b']
                    const noteName = NOTES[midi % 12] + (Math.floor(midi / 12) - 1)
                    const params: Record<string, unknown> = { s: source, gain: 0.5, release: 0.3 }
                    if (SYNTHS.has(source)) {
                      params.note = noteName
                    } else {
                      // Sample-based instruments (gm_piano, etc.): use note for pitched playback
                      params.note = noteName
                      params.n = 0
                      if (ch.bank) params.bank = ch.bank
                    }
                    await sd(params, now, 0.4)
                  } catch (err) {
                    console.error('[444 STUDIO] note preview error:', err)
                  }
                }}
                onClose={() => setPianoRollChannel(null)}
              />
            )
          })()}

          {/* Drum Sequencer — docks at bottom */}
          {drumSequencerChannel !== null && (() => {
            const channels = parseStrudelCode(code)
            const ch = channels[drumSequencerChannel]
            if (!ch) return null
            return (
              <StudioDrumSequencer
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
                    // Parse variant from instrument name (e.g., "bd:3" → s: "bd", n: 3)
                    const variantMatch = instrument.match(/^([^:]+):(\d+)$/)
                    const sName = variantMatch ? variantMatch[1] : instrument
                    const sampleN = variantMatch ? parseInt(variantMatch[2]) : 0
                    const params: Record<string, unknown> = { s: sName, n: sampleN, gain: 0.6 }
                    if (bank) params.bank = bank
                    await sd(params, now, 0.5)
                  } catch {
                    playDrumPreviewFallback(instrument)
                  }
                }}
              />
            )
          })()}
        </div>
      </div>

      {/* ── CODE EDITOR DRAWER (slides from right) ── */}
      <div
        className={`absolute top-10 right-0 bottom-0 z-30 transition-all duration-300 ease-out ${
          codeVisible ? 'w-[520px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
        style={{
          background: '#23262b',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          boxShadow: codeVisible ? '-8px 0 16px #14161a' : 'none',
        }}
      >
        {codeVisible && (
          <div className="h-full flex flex-col">
          <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#2a2e34' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#7fa998' }} />
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
        select { background-color: #2a2e34 !important; }
        select option { background: #23262b; color: #c8cdd2; }
        input[type='range'] {
          -webkit-appearance: none; height: 3px; border-radius: 10px;
          background: rgba(255,255,255,0.06);
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          border-radius: 50%; cursor: pointer;
          background: #7fa998;
          border: 2px solid #23262b;
          box-shadow: 2px 2px 4px #14161a, -1px -1px 3px #2c3036;
        }
      `}</style>
    </div>
  )
}
