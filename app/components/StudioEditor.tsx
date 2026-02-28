'use client'

// ═══════════════════════════════════════════════════════════════
//  444 STUDIO — Pro Strudel Live Coding Studio (Orchestrator)
//  Composes: TopBar, GenreSelector, SliderPanel, MethodsPanel,
//            EffectsChain, CodeEditor — all as standalone components.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react'
import type { StrudelEngine } from '@/lib/strudel-engine'
import { fixSoundfontNames } from '@/lib/strudel-engine'

// Sub-components
import StudioTopBar from './studio/StudioTopBar'
import StudioGenreSelector, { GENRE_TEMPLATES } from './studio/StudioGenreSelector'
import StudioSliderPanel from './studio/StudioSliderPanel'
import StudioMethodsPanel from './studio/StudioMethodsPanel'
import StudioCodeEditor, { type StudioCodeEditorHandle } from './studio/StudioCodeEditor'
import StudioMixerRack from './studio/StudioMixerRack'

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

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

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
        setIsPlaying(false)
        setStatus('ready')
        setError(null)
      } else {
        setError(null)
        const src = codeRef.current.trim()
        if (!src || src.split('\n').every(l => l.trim().startsWith('//'))) {
          throw new Error('Enter a pattern to play')
        }
        sliderDefsRef.current = {}
        await engine.webaudio.getAudioContext().resume()
        drawStateRef.current.counter = 0
        lastEvaluatedRef.current = ''
        await engine.evaluate(fixSoundfontNames(src))
        setSliderDefs({ ...sliderDefsRef.current })

        // Grab master gain from superdough's internal audio controller (like InputEditor)
        try {
          const controller = (engine.webaudio as any).getSuperdoughAudioController?.()
          if (controller?.output?.destinationGain) {
            masterGainRef.current = controller.output.destinationGain
            // Apply saved volume
            const savedVol = localStorage.getItem('444-studio-volume')
            const vol = savedVol !== null ? parseFloat(savedVol) : 0.75
            if (!isNaN(vol)) masterGainRef.current!.gain.value = vol
            console.log('[444 STUDIO] master volume connected')
          }
          // Pre-initialize orbits 0-11 so duck() always has valid targets
          if (controller?.getOrbit) {
            for (let i = 0; i < 12; i++) {
              controller.getOrbit(i)
            }
            console.log('[444 STUDIO] pre-initialized 12 orbits for duck()')
          }
        } catch (err) {
          console.log('[444 STUDIO] master gain not available:', err)
        }

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
      const src = codeRef.current.trim()
      if (!src) return
      if (src === lastEvaluatedRef.current) return
      lastEvaluatedRef.current = src
      if (editorDivRef.current) {
        editorDivRef.current.style.outline = '2px solid rgba(34,211,238,0.4)'
        setTimeout(() => { if (editorDivRef.current) editorDivRef.current.style.outline = 'none' }, 200)
      }
      sliderDefsRef.current = {}
      await engine.webaudio.getAudioContext().resume()
      drawStateRef.current.counter = 0
      await engine.evaluate(fixSoundfontNames(src))
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

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-screen bg-[#0a0a0e] flex flex-col overflow-hidden select-none">
      {/* ── TOP BAR ── */}
      <StudioTopBar
        status={status}
        loadingMsg={loadingMsg}
        error={error}
        isPlaying={isPlaying}
        masterVolume={masterVolume}
        onPlay={handlePlay}
        onUpdate={handleUpdate}
        onVolumeChange={updateMasterVolume}
      />

      {/* ── MAIN BODY ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT PANEL (collapsible) ── */}
        <div className={`shrink-0 border-r border-white/[0.06] bg-[#0c0c10] flex flex-col overflow-hidden transition-all duration-200 ${leftPanelOpen ? 'w-52' : 'w-0'}`}>
          {leftPanelOpen && (
            <div className="flex-1 overflow-y-auto w-52">
              <StudioGenreSelector activeGenre={activeGenre} onSelect={loadTemplate} />
              <StudioSliderPanel sliderDefs={sliderDefs} sliderValues={sliderValuesRef} onChange={handleSliderChange} />
              <StudioMethodsPanel onInsert={insertAtCursor} />
            </div>
          )}
        </div>

        {/* ── LEFT PANEL TOGGLE ── */}
        <button
          onClick={() => setLeftPanelOpen(p => !p)}
          className="shrink-0 w-4 flex items-center justify-center border-r border-white/[0.04] bg-[#0a0a0e] hover:bg-white/[0.03] text-white/15 hover:text-white/30 transition-colors cursor-pointer"
          title={leftPanelOpen ? 'Collapse panel' : 'Expand panel'}
        >
          <span className="text-[8px] font-mono">{leftPanelOpen ? '◂' : '▸'}</span>
        </button>

        {/* ── CENTER: Code Editor + Visuals Canvas ── */}
        <StudioCodeEditor
          ref={codeEditorRef}
          code={code}
          onChange={(c) => setCodeWithUndo(c)}
          onKeyDown={handleKeyDown}
          canvasRef={canvasRef}
          editorRef={editorDivRef}
        />

        {/* ── RIGHT PANEL: Hardware Mixer Rack ── */}
        <div className="w-56 shrink-0 border-l border-white/[0.06]">
          <StudioMixerRack
            code={code}
            onCodeChange={(c) => setCodeWithUndo(c)}
          />
        </div>
      </div>

      <style jsx global>{`
        textarea::-webkit-scrollbar { width: 6px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 3px; }
        textarea::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
      `}</style>
    </div>
  )
}
