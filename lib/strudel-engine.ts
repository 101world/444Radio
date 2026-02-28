// ═══════════════════════════════════════════════════════════════
//  STRUDEL ENGINE — shared audio engine for /input and /studio
// ═══════════════════════════════════════════════════════════════
// Extracted from InputEditor.tsx so multiple pages can reuse
// the exact same Strudel initialization, eval, and cleanup logic.

const STRUDEL_CDN = 'https://strudel.b-cdn.net'

export interface StrudelEngine {
  evaluate: (code: string) => Promise<any>
  webaudio: any
  core: any
  scheduler: any
  soundMap: any
  /** Last eval error captured from the REPL (null if last eval succeeded) */
  lastEvalError: { error: Error | null }
}

export interface StrudelLoadProgress {
  message: string
  phase: 'modules' | 'audio' | 'synths' | 'samples' | 'aliases' | 'soundfonts' | 'tonal' | 'scope' | 'ready'
}

/**
 * Load and initialize the full Strudel engine.
 * Returns engine handle + Drawer class for paint-based vis.
 *
 * @param onProgress  called at each loading phase
 * @param sliderRef   ref object for slider() live values
 * @param sliderDefsRef ref object for slider definitions
 */
export async function initStrudelEngine(
  onProgress: (p: StrudelLoadProgress) => void,
  sliderRef: React.MutableRefObject<Record<string, number>>,
  sliderDefsRef: React.MutableRefObject<Record<string, { min: number; max: number; value: number }>>,
): Promise<{ engine: StrudelEngine; DrawerClass: any }> {
  onProgress({ message: 'importing modules...', phase: 'modules' })

  const [core, webaudio, transpilerMod, mini] = await Promise.all([
    import('@strudel/core'),
    import('@strudel/webaudio'),
    import('@strudel/transpiler'),
    import('@strudel/mini'),
  ])

  // Suppress noisy deprecation warnings
  if ((webaudio as any).setLogger) {
    (webaudio as any).setLogger((...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (msg.includes('Deprecation warning')) return
      console.log(...args)
    })
  }

  onProgress({ message: 'initializing audio...', phase: 'audio' })
  webaudio.initAudioOnFirstClick()

  onProgress({ message: 'loading synths...', phase: 'synths' })
  await webaudio.registerSynthSounds()
  await webaudio.registerZZFXSounds()

  onProgress({ message: 'loading samples from CDN...', phase: 'samples' })
  await Promise.all([
    webaudio.samples('github:tidalcycles/dirt-samples'),
    webaudio.samples(`${STRUDEL_CDN}/piano.json`, `${STRUDEL_CDN}/piano/`, { prebake: true }),
    webaudio.samples(`${STRUDEL_CDN}/vcsl.json`, `${STRUDEL_CDN}/VCSL/`, { prebake: true }),
    webaudio.samples(`${STRUDEL_CDN}/tidal-drum-machines.json`, `${STRUDEL_CDN}/tidal-drum-machines/machines/`, {
      prebake: true, tag: 'drum-machines',
    }),
    webaudio.samples(`${STRUDEL_CDN}/uzu-drumkit.json`, `${STRUDEL_CDN}/uzu-drumkit/`, {
      prebake: true, tag: 'drum-machines',
    }),
    webaudio.samples(`${STRUDEL_CDN}/uzu-wavetables.json`, `${STRUDEL_CDN}/uzu-wavetables/`, { prebake: true }),
    webaudio.samples(`${STRUDEL_CDN}/mridangam.json`, `${STRUDEL_CDN}/mrid/`, {
      prebake: true, tag: 'drum-machines',
    }),
    webaudio.samples(
      {
        casio: ['casio/high.wav', 'casio/low.wav', 'casio/noise.wav'],
        crow: ['crow/000_crow.wav', 'crow/001_crow2.wav', 'crow/002_crow3.wav', 'crow/003_crow4.wav'],
        insect: [
          'insect/000_everglades_conehead.wav',
          'insect/001_robust_shieldback.wav',
          'insect/002_seashore_meadow_katydid.wav',
        ],
        wind: [
          'wind/000_wind1.wav', 'wind/001_wind10.wav', 'wind/002_wind2.wav',
          'wind/003_wind3.wav', 'wind/004_wind4.wav', 'wind/005_wind5.wav',
          'wind/006_wind6.wav', 'wind/007_wind7.wav', 'wind/008_wind8.wav', 'wind/009_wind9.wav',
        ],
        jazz: [
          'jazz/000_BD.wav', 'jazz/001_CB.wav', 'jazz/002_FX.wav', 'jazz/003_HH.wav',
          'jazz/004_OH.wav', 'jazz/005_P1.wav', 'jazz/006_P2.wav', 'jazz/007_SN.wav',
        ],
        metal: [
          'metal/000_0.wav', 'metal/001_1.wav', 'metal/002_2.wav', 'metal/003_3.wav',
          'metal/004_4.wav', 'metal/005_5.wav', 'metal/006_6.wav', 'metal/007_7.wav',
          'metal/008_8.wav', 'metal/009_9.wav',
        ],
        east: [
          'east/000_nipon_wood_block.wav', 'east/001_ohkawa_mute.wav', 'east/002_ohkawa_open.wav',
          'east/003_shime_hi.wav', 'east/004_shime_hi_2.wav', 'east/005_shime_mute.wav',
          'east/006_taiko_1.wav', 'east/007_taiko_2.wav', 'east/008_taiko_3.wav',
        ],
        space: [
          'space/000_0.wav', 'space/001_1.wav', 'space/002_11.wav', 'space/003_12.wav',
          'space/004_13.wav', 'space/005_14.wav', 'space/006_15.wav', 'space/007_16.wav',
          'space/008_17.wav', 'space/009_18.wav', 'space/010_2.wav', 'space/011_3.wav',
          'space/012_4.wav', 'space/013_5.wav', 'space/014_6.wav', 'space/015_7.wav',
          'space/016_8.wav', 'space/017_9.wav',
        ],
        numbers: ['numbers/0.wav', 'numbers/1.wav', 'numbers/2.wav', 'numbers/3.wav', 'numbers/4.wav',
          'numbers/5.wav', 'numbers/6.wav', 'numbers/7.wav', 'numbers/8.wav'],
        num: [
          'num/00.wav', 'num/01.wav', 'num/02.wav', 'num/03.wav', 'num/04.wav',
          'num/05.wav', 'num/06.wav', 'num/07.wav', 'num/08.wav', 'num/09.wav',
          'num/10.wav', 'num/11.wav', 'num/12.wav', 'num/13.wav', 'num/14.wav',
          'num/15.wav', 'num/16.wav', 'num/17.wav', 'num/18.wav', 'num/19.wav', 'num/20.wav',
        ],
      },
      `${STRUDEL_CDN}/Dirt-Samples/`,
      { prebake: true },
    ),
  ])

  onProgress({ message: 'loading aliases...', phase: 'aliases' })
  await webaudio.aliasBank(`${STRUDEL_CDN}/tidal-drum-machines-alias.json`)

  onProgress({ message: 'loading soundfonts...', phase: 'soundfonts' })
  try {
    const sf = await import('@strudel/soundfonts')
    await sf.registerSoundfonts()
  } catch (e) {
    console.warn('[strudel-engine] soundfonts registration failed:', e)
  }

  onProgress({ message: 'loading tonal...', phase: 'tonal' })
  try {
    const tonal = await import('@strudel/tonal')
    if (typeof tonal.registerVoicings === 'function') {
      await tonal.registerVoicings()
    }
  } catch (e) {
    console.log('[strudel-engine] tonal not available:', e)
  }

  onProgress({ message: 'registering functions...', phase: 'scope' })
  await core.evalScope(
    import('@strudel/core'),
    import('@strudel/mini'),
    import('@strudel/webaudio'),
    import('@strudel/tonal'),
    // @ts-ignore
    import('@strudel/soundfonts'),
    // @ts-ignore
    import('@strudel/draw'),
  )

  // Inject sliderWithID for slider() support
  ;(globalThis as any).sliderWithID = (id: string, value: number, _min?: number, _max?: number) => {
    const min = _min ?? 0
    const max = _max ?? 1
    if (!(id in sliderRef.current)) {
      sliderRef.current[id] = value
    }
    sliderDefsRef.current[id] = { min, max, value: sliderRef.current[id] }
    return (core as any).ref(() => sliderRef.current[id])
  }

  // Create REPL evaluate function
  // IMPORTANT: The REPL's evaluate() catches errors INTERNALLY and does NOT re-throw.
  // We use onEvalError to capture the error so callers can detect failure.
  const lastEvalError: { error: Error | null } = { error: null }

  const replResult = core.repl({
    defaultOutput: webaudio.webaudioOutput,
    getTime: () => webaudio.getAudioContext().currentTime,
    transpiler: transpilerMod.transpiler,
    onEvalError: (err: Error) => {
      lastEvalError.error = err
      console.error('[strudel-engine] eval error:', err)
    },
  }) as any

  const rawEvaluate = replResult.evaluate
  // Wrap evaluate to clear/check error state
  const evaluate = async (code: string) => {
    lastEvalError.error = null
    const result = await rawEvaluate(code)
    // If evaluate returned undefined AND error was captured, throw it
    if (result === undefined && lastEvalError.error) {
      throw lastEvalError.error
    }
    return result
  }
  const scheduler = replResult.scheduler

  // Get Drawer class for visuals
  let DrawerClass: any = null
  try {
    const drawMod = await import('@strudel/draw')
    DrawerClass = drawMod.Drawer
  } catch (e) {
    console.warn('[strudel-engine] draw module not available:', e)
  }

  onProgress({ message: 'ready', phase: 'ready' })

  return {
    engine: {
      evaluate,
      webaudio,
      core,
      scheduler,
      soundMap: webaudio.soundMap,
      lastEvalError,
    },
    DrawerClass,
  }
}

/**
 * Fix legacy soundfont names (gm_ prefix mapping)
 */
export function fixSoundfontNames(code: string): string {
  return code
    .replace(/\.s\("gm_/g, '.s("gm_')
    .replace(/\.bank\("gm_/g, '.bank("gm_')
}

/**
 * Stop playback and clean up
 */
export async function stopPlayback(engine: StrudelEngine | null, drawer: any) {
  if (engine?.evaluate) {
    try { await engine.evaluate('silence') } catch { /* ok */ }
  }
  try {
    const { cleanupDraw } = await import('@strudel/draw')
    cleanupDraw(true)
  } catch { /* ok */ }
  if (drawer) {
    try { drawer.stop() } catch { /* ok */ }
  }
}
